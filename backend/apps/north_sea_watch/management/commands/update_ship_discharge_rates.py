"""
Management command to calculate and update scrubber water discharge rates for ships.
This command replaces the previous emission rate calculation with discharge rate calculation.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, connections
from django.db.models import Q
from apps.north_sea_watch.models import Ship, ICCTWFRCombined
from apps.north_sea_watch.utils.emission_calculator import calculate_ship_discharge_rates
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Calculate and update scrubber water discharge rates for ships in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-all',
            action='store_true',
            dest='clear_all',
            help='Clear all existing discharge rate data before calculation',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of ships to process in each batch (default: 100)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            dest='dry_run',
            help='Perform a dry run without making any database changes',
        )
        parser.add_argument(
            '--scrubber-only',
            action='store_true',
            dest='scrubber_only',
            help='Only calculate for ships with known scrubber technology',
        )
        parser.add_argument(
            '--imo-list',
            type=str,
            help='Comma-separated list of IMO numbers to process (for testing)',
        )

    def handle(self, *args, **options):
        """
        Main command handler for updating ship discharge rates.
        """
        try:
            self.stdout.write("Starting scrubber discharge rate calculation...")
            
            # Handle clear all option
            if options['clear_all']:
                self.clear_all_discharge_rates(options['dry_run'])
            
            # Get ships to process
            ships_queryset = self.get_ships_to_process(options)
            total_ships = ships_queryset.count()
            
            self.stdout.write(f"Found {total_ships} ships to process")
            
            if total_ships == 0:
                self.stdout.write("No ships found matching criteria. Exiting.")
                return
            
            # Get scrubber data
            scrubber_data = self.get_scrubber_data()
            self.stdout.write(f"Loaded scrubber data for {len(scrubber_data)} vessels")
            
            # Process ships in batches
            batch_size = options['batch_size']
            processed_count = 0
            updated_count = 0
            skipped_count = 0
            
            for i in range(0, total_ships, batch_size):
                batch_ships = ships_queryset[i:i + batch_size]
                
                batch_updated, batch_skipped = self.process_ship_batch(
                    batch_ships, 
                    scrubber_data,
                    options['dry_run']
                )
                
                updated_count += batch_updated
                skipped_count += batch_skipped
                processed_count += len(batch_ships)
                
                self.stdout.write(
                    f"Processed batch {i//batch_size + 1}: "
                    f"{processed_count}/{total_ships} ships processed, "
                    f"{updated_count} updated, {skipped_count} skipped"
                )
            
            # Final summary
            self.stdout.write(
                self.style.SUCCESS(
                    f"Discharge rate calculation completed!\n"
                    f"Total processed: {processed_count}\n"
                    f"Updated: {updated_count}\n"
                    f"Skipped: {skipped_count}\n"
                    f"Dry run: {options['dry_run']}"
                )
            )
            
        except Exception as e:
            logger.error(f"Error in update_ship_discharge_rates command: {str(e)}")
            raise CommandError(f"Command failed: {str(e)}")

    def clear_all_discharge_rates(self, dry_run=False):
        """
        Clear all existing discharge rate data from the ships table.
        """
        self.stdout.write("Clearing all existing discharge rate data...")
        
        if dry_run:
            count = Ship.objects.using('ais_data').filter(
                Q(emission_berth__isnull=False) |
                Q(emission_anchor__isnull=False) |
                Q(emission_maneuver__isnull=False) |
                Q(emission_cruise__isnull=False)
            ).count()
            self.stdout.write(f"[DRY RUN] Would clear discharge rates for {count} ships")
        else:
            with transaction.atomic(using='ais_data'):
                updated = Ship.objects.using('ais_data').update(
                    emission_berth=None,
                    emission_anchor=None,
                    emission_maneuver=None,
                    emission_cruise=None
                )
                self.stdout.write(f"Cleared discharge rates for {updated} ships")

    def get_ships_to_process(self, options):
        """
        Get queryset of ships to process based on command options.
        """
        # Start with all ships
        queryset = Ship.objects.using('ais_data').all()
        
        # Filter by IMO list if provided
        if options['imo_list']:
            imo_numbers = [imo.strip() for imo in options['imo_list'].split(',')]
            queryset = queryset.filter(imo_number__in=imo_numbers)
            self.stdout.write(f"Filtering by IMO list: {imo_numbers}")
        
        # Filter for scrubber vessels only if requested
        if options['scrubber_only']:
            # Get IMO numbers of ships with scrubber data (convert to int for matching)
            scrubber_imos_str = set(ICCTWFRCombined.objects.using('ais_data').values_list('imo_number', flat=True))
            scrubber_imos_int = set()
            for imo_str in scrubber_imos_str:
                try:
                    scrubber_imos_int.add(int(imo_str))
                except (ValueError, TypeError):
                    continue
            queryset = queryset.filter(imo_number__in=scrubber_imos_int)
            self.stdout.write("Filtering for scrubber vessels only")
        
        return queryset.order_by('imo_number')

    def get_scrubber_data(self):
        """
        Load all scrubber data into memory for efficient lookup.
        """
        scrubber_data = {}
        
        for scrubber in ICCTWFRCombined.objects.using('ais_data').all():
            try:
                # Convert string IMO to int for consistent matching
                imo_int = int(scrubber.imo_number)
                scrubber_data[imo_int] = {
                    'technology_type': scrubber.sox_scrubber_1_technology_type,
                    'status': scrubber.sox_scrubber_status,
                    'type': scrubber.type
                }
            except (ValueError, TypeError):
                # Skip invalid IMO numbers
                continue
        
        return scrubber_data

    def process_ship_batch(self, ships, scrubber_data, dry_run=False):
        """
        Process a batch of ships for discharge rate calculation.
        """
        updated_count = 0
        skipped_count = 0
        
        ships_to_update = []
        
        for ship in ships:
            # Check if ship has scrubber data
            scrubber_info = scrubber_data.get(ship.imo_number)
            
            if not scrubber_info:
                skipped_count += 1
                continue
                
            scrubber_type = scrubber_info.get('technology_type')
            
            # Calculate discharge rates
            berth_rate, anchor_rate, maneuver_rate, cruise_rate = calculate_ship_discharge_rates(
                imo_number=ship.imo_number,
                length=ship.length,
                width=ship.width,
                max_draught=ship.max_draught,
                type_name=ship.type_name,
                scrubber_type=scrubber_type
            )
            
            # Check if calculation was successful
            if any([berth_rate, anchor_rate, maneuver_rate, cruise_rate]):
                # Update ship object for batch update
                ship.emission_berth = berth_rate
                ship.emission_anchor = anchor_rate
                ship.emission_maneuver = maneuver_rate
                ship.emission_cruise = cruise_rate
                ships_to_update.append(ship)
                updated_count += 1
            else:
                skipped_count += 1
        
        # Perform batch update
        if ships_to_update and not dry_run:
            with transaction.atomic(using='ais_data'):
                Ship.objects.using('ais_data').bulk_update(
                    ships_to_update,
                    ['emission_berth', 'emission_anchor', 'emission_maneuver', 'emission_cruise'],
                    batch_size=100
                )
        
        return updated_count, skipped_count 