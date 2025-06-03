"""
Django management command to clear emission data from ships.
This command allows clearing emission rates for all ships or specific ships.
"""

from django.core.management.base import BaseCommand
from django.db import transaction, models
from apps.north_sea_watch.models import Ship
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Management command to clear emission data from ships.
    
    Usage:
        python manage.py clear_ship_emissions
        python manage.py clear_ship_emissions --imo 1234567  # Clear specific ship
        python manage.py clear_ship_emissions --type Cargo   # Clear specific ship type
        python manage.py clear_ship_emissions --dry-run      # Show what would be cleared
    """
    
    help = 'Clear emission rates from ships in the database'

    def add_arguments(self, parser):
        """Add command line arguments."""
        parser.add_argument(
            '--imo',
            type=str,
            help='Clear emission rates for a specific ship by IMO number',
        )
        parser.add_argument(
            '--type',
            type=str,
            choices=['Cargo', 'Tanker'],
            help='Clear emission rates for ships of a specific type (Cargo or Tanker)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show which ships would be affected without actually clearing data',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of ships to process in each batch (default: 100)',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed information about each ship processed',
        )

    def handle(self, *args, **options):
        """Execute the command."""
        specific_imo = options['imo']
        ship_type = options['type']
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        verbose = options['verbose']
        
        self.stdout.write(
            self.style.SUCCESS('Starting ship emission data clearing...')
        )
        
        # Build the queryset based on options
        ships_queryset = Ship.objects.all()
        
        # Filter by specific IMO if provided
        if specific_imo:
            ships_queryset = ships_queryset.filter(imo_number=specific_imo)
            self.stdout.write(f'Targeting specific ship: {specific_imo}')
        
        # Filter by ship type if provided
        if ship_type:
            ships_queryset = ships_queryset.filter(type_name=ship_type)
            self.stdout.write(f'Targeting ships of type: {ship_type}')
        
        # Only include ships that have emission data to clear
        ships_queryset = ships_queryset.filter(
            models.Q(emission_berth__isnull=False) |
            models.Q(emission_anchor__isnull=False) |
            models.Q(emission_maneuver__isnull=False) |
            models.Q(emission_cruise__isnull=False)
        )
        
        total_ships = ships_queryset.count()
        if total_ships == 0:
            self.stdout.write(
                self.style.WARNING('No ships found with emission data to clear.')
            )
            return
            
        self.stdout.write(f'Found {total_ships} ships with emission data')
        
        # If dry run, show what would be affected and exit
        if dry_run:
            self._show_dry_run_results(ships_queryset, verbose)
            return
        
        # Confirm before proceeding (unless specific IMO is provided)
        if not specific_imo:
            confirm = input(f'Are you sure you want to clear emission data from {total_ships} ships? (Y/n): ')
            if confirm.lower() not in ['y', 'yes', '']:
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return
        
        # Process ships in batches
        cleared_count = 0
        error_count = 0
        
        for batch_start in range(0, total_ships, batch_size):
            batch_end = min(batch_start + batch_size, total_ships)
            ships_batch = ships_queryset[batch_start:batch_end]
            
            if verbose:
                self.stdout.write(
                    f'Processing batch {batch_start + 1}-{batch_end} of {total_ships}...'
                )
            
            # Process each ship in the batch
            for ship in ships_batch:
                try:
                    result = self._clear_ship_emissions(ship, verbose)
                    if result == 'cleared':
                        cleared_count += 1
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error processing ship {ship.imo_number}: {str(e)}'
                        )
                    )
                    logger.error(f'Error clearing ship {ship.imo_number}: {str(e)}')
        
        # Print summary
        self.stdout.write(
            self.style.SUCCESS(
                f'\nCompleted processing {total_ships} ships:\n'
                f'  - Cleared: {cleared_count}\n'
                f'  - Errors: {error_count}'
            )
        )

    def _clear_ship_emissions(self, ship: Ship, verbose: bool = False) -> str:
        """
        Clear emission rates for a single ship.
        
        Args:
            ship: Ship instance to clear
            verbose: Whether to show detailed information about the ship
            
        Returns:
            'cleared' or raises exception
        """
        # Check if ship has any emission data
        has_emission_data = any([
            ship.emission_berth is not None,
            ship.emission_anchor is not None,
            ship.emission_maneuver is not None,
            ship.emission_cruise is not None
        ])
        
        if not has_emission_data:
            if verbose:
                self.stdout.write(f'Skipped ship {ship.imo_number} ({ship.name}) - no emission data to clear')
            return 'skipped'
        
        # Clear emission rates
        try:
            with transaction.atomic():
                ship.emission_berth = None
                ship.emission_anchor = None
                ship.emission_maneuver = None
                ship.emission_cruise = None
                ship.save(update_fields=[
                    'emission_berth', 'emission_anchor', 
                    'emission_maneuver', 'emission_cruise'
                ])
            
            if verbose:
                self.stdout.write(
                    f'Cleared emission data for ship {ship.imo_number} ({ship.name}) - Type: {ship.type_name}'
                )
            return 'cleared'
            
        except Exception as e:
            logger.error(f'Database error clearing ship {ship.imo_number}: {str(e)}')
            raise  # Re-raise to be caught by the caller
    
    def _show_dry_run_results(self, ships_queryset, verbose: bool = False):
        """
        Show what would be affected in a dry run.
        
        Args:
            ships_queryset: QuerySet of ships that would be affected
            verbose: Whether to show detailed information
        """
        self.stdout.write(self.style.SUCCESS('\n=== DRY RUN RESULTS ==='))
        
        total_ships = ships_queryset.count()
        self.stdout.write(f'Total ships that would be affected: {total_ships}')
        
        # Analyze by ship type
        cargo_ships = ships_queryset.filter(type_name='Cargo')
        tanker_ships = ships_queryset.filter(type_name='Tanker')
        other_ships = ships_queryset.exclude(type_name__in=['Cargo', 'Tanker'])
        
        self.stdout.write(f'\nBreakdown by ship type:')
        self.stdout.write(f'  - Cargo ships: {cargo_ships.count()}')
        self.stdout.write(f'  - Tanker ships: {tanker_ships.count()}')
        self.stdout.write(f'  - Other types: {other_ships.count()}')
        
        # Analyze emission data completeness
        complete_emissions = ships_queryset.filter(
            emission_berth__isnull=False,
            emission_anchor__isnull=False,
            emission_maneuver__isnull=False,
            emission_cruise__isnull=False
        ).count()
        
        partial_emissions = total_ships - complete_emissions
        
        self.stdout.write(f'\nEmission data status:')
        self.stdout.write(f'  - Ships with complete emission data: {complete_emissions}')
        self.stdout.write(f'  - Ships with partial emission data: {partial_emissions}')
        
        # Show sample ships if verbose
        if verbose and total_ships > 0:
            self.stdout.write(f'\nSample ships (first 10):')
            for ship in ships_queryset[:10]:
                emission_fields = []
                if ship.emission_berth is not None:
                    emission_fields.append(f'berth={ship.emission_berth}')
                if ship.emission_anchor is not None:
                    emission_fields.append(f'anchor={ship.emission_anchor}')
                if ship.emission_maneuver is not None:
                    emission_fields.append(f'maneuver={ship.emission_maneuver}')
                if ship.emission_cruise is not None:
                    emission_fields.append(f'cruise={ship.emission_cruise}')
                
                emission_info = ', '.join(emission_fields) if emission_fields else 'none'
                
                self.stdout.write(
                    f'  {ship.imo_number} ({ship.name}) - Type: {ship.type_name}, '
                    f'Emissions: {emission_info}'
                )
        
        self.stdout.write(
            self.style.WARNING(
                f'\nTo actually clear the data, run the command without --dry-run'
            )
        ) 