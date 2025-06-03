"""
Django management command to calculate and update emission rates for ships.
This command processes all ships in the database and calculates their theoretical
emission rates for the four operation modes.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from apps.north_sea_watch.models import Ship
from apps.north_sea_watch.utils.emission_calculator import calculate_ship_emission_rates
import logging
from django.db import models

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Management command to update emission calculations for all ships.
    
    Usage:
        python manage.py update_ship_emissions
        python manage.py update_ship_emissions --force  # Recalculate all ships
        python manage.py update_ship_emissions --imo 1234567  # Update specific ship
    """
    
    help = 'Calculate and update emission rates for ships in the database'

    def add_arguments(self, parser):
        """Add command line arguments."""
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recalculate emission rates for all ships, even if already calculated',
        )
        parser.add_argument(
            '--imo',
            type=str,
            help='Update emission rates for a specific ship by IMO number',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of ships to process in each batch (default: 100)',
        )
        parser.add_argument(
            '--analyze',
            action='store_true',
            help='Analyze ships without emission data but don\'t update them',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed information about each ship processed',
        )

    def handle(self, *args, **options):
        """Execute the command."""
        force_update = options['force']
        specific_imo = options['imo']
        batch_size = options['batch_size']
        analyze_mode = options['analyze']
        verbose = options['verbose']
        
        self.stdout.write(
            self.style.SUCCESS('Starting ship emission rate calculation...')
        )
        
        # Filter ships based on options
        if specific_imo:
            ships_queryset = Ship.objects.filter(imo_number=specific_imo)
            self.stdout.write(f'Processing specific ship: {specific_imo}')
        elif force_update:
            # Only process Cargo and Tanker ships even in force mode
            ships_queryset = Ship.objects.filter(type_name__in=['Cargo', 'Tanker'])
            self.stdout.write('Processing all Cargo and Tanker ships (force update)...')
        else:
            # Process ships that don't have COMPLETE emission data
            # A ship needs calculation if ANY of its emission fields is null
            # AND it's a supported ship type (Cargo or Tanker)
            ships_queryset = Ship.objects.filter(
                type_name__in=['Cargo', 'Tanker']
            ).filter(
                models.Q(emission_berth__isnull=True) |
                models.Q(emission_anchor__isnull=True) |
                models.Q(emission_maneuver__isnull=True) |
                models.Q(emission_cruise__isnull=True)
            )
            self.stdout.write('Processing Cargo and Tanker ships without complete emission rates...')
        
        total_ships = ships_queryset.count()
        if total_ships == 0:
            self.stdout.write(
                self.style.WARNING('No ships found to process.')
            )
            return
            
        self.stdout.write(f'Found {total_ships} ships to process')
        
        # If in analyze mode, show statistics and exit
        if analyze_mode:
            self._analyze_ships(ships_queryset)
            return
        
        # Process ships in batches
        updated_count = 0
        skipped_count = 0
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
                    result = self._update_ship_emissions(ship, force_update, verbose)
                    if result == 'updated':
                        updated_count += 1
                    elif result == 'skipped':
                        skipped_count += 1
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error processing ship {ship.imo_number}: {str(e)}'
                        )
                    )
                    logger.error(f'Error updating ship {ship.imo_number}: {str(e)}')
        
        # Print summary
        self.stdout.write(
            self.style.SUCCESS(
                f'\nCompleted processing {total_ships} ships:\n'
                f'  - Updated: {updated_count}\n'
                f'  - Skipped: {skipped_count}\n'
                f'  - Errors: {error_count}'
            )
        )

    def _update_ship_emissions(self, ship: Ship, force_update: bool = False, verbose: bool = False) -> str:
        """
        Update emission rates for a single ship.
        
        Args:
            ship: Ship instance to update
            force_update: Whether to update even if values already exist
            verbose: Whether to show detailed information about the ship
            
        Returns:
            'updated', 'skipped', or raises exception
        """
        # Check if ship already has COMPLETE emission rates calculated
        has_complete_emissions = all([
            ship.emission_berth is not None,
            ship.emission_anchor is not None,
            ship.emission_maneuver is not None,
            ship.emission_cruise is not None
        ])
        
        if has_complete_emissions and not force_update:
            if verbose:
                self.stdout.write(f'Skipped ship {ship.imo_number} ({ship.name}) - already has complete emission data')
            return 'skipped'
        
        # Skip if not a supported ship type (this should be caught by the filter, but double-check)
        if ship.type_name not in ['Cargo', 'Tanker']:
            if verbose:
                self.stdout.write(f'Skipped ship {ship.imo_number} ({ship.name}) - type "{ship.type_name}" not supported')
            return 'skipped'
        
        # Calculate new emission rates
        berth_rate, anchor_rate, maneuver_rate, cruise_rate = calculate_ship_emission_rates(
            imo_number=ship.imo_number,
            length=ship.length,
            width=ship.width,
            max_draught=ship.max_draught,
            type_name=ship.type_name
        )
        
        # Check if we got valid calculations
        if not any([berth_rate, anchor_rate, maneuver_rate, cruise_rate]):
            if verbose:
                self.stdout.write(f'Skipped ship {ship.imo_number} ({ship.name}) - calculation failed (missing dimensions or other issues)')
            return 'skipped'
        
        # Update the ship with calculated emission rates
        try:
            with transaction.atomic():
                ship.emission_berth = berth_rate
                ship.emission_anchor = anchor_rate
                ship.emission_maneuver = maneuver_rate
                ship.emission_cruise = cruise_rate
                ship.save(update_fields=[
                    'emission_berth', 'emission_anchor', 
                    'emission_maneuver', 'emission_cruise'
                ])
            
            if verbose:
                self.stdout.write(
                    f'Updated ship {ship.imo_number} ({ship.name}) - '
                    f'Type: {ship.type_name}, '
                    f'Berth: {berth_rate}, Anchor: {anchor_rate}, '
                    f'Maneuver: {maneuver_rate}, Cruise: {cruise_rate}'
                )
            return 'updated'
            
        except Exception as e:
            logger.error(f'Database error updating ship {ship.imo_number}: {str(e)}')
            raise  # Re-raise to be caught by the caller
    
    def _analyze_ships(self, ships_queryset):
        """
        Analyze ships that need emission calculation and provide detailed statistics.
        
        Args:
            ships_queryset: QuerySet of ships to analyze
        """
        self.stdout.write(self.style.SUCCESS('\n=== SHIP EMISSION ANALYSIS ==='))
        
        total_ships = ships_queryset.count()
        self.stdout.write(f'Total ships needing emission calculation: {total_ships}')
        
        # Analyze by ship type
        cargo_ships = ships_queryset.filter(type_name='Cargo')
        tanker_ships = ships_queryset.filter(type_name='Tanker')
        
        self.stdout.write(f'\nBreakdown by ship type:')
        self.stdout.write(f'  - Cargo ships: {cargo_ships.count()}')
        self.stdout.write(f'  - Tanker ships: {tanker_ships.count()}')
        
        # Analyze by missing fields
        missing_berth = ships_queryset.filter(emission_berth__isnull=True).count()
        missing_anchor = ships_queryset.filter(emission_anchor__isnull=True).count()
        missing_maneuver = ships_queryset.filter(emission_maneuver__isnull=True).count()
        missing_cruise = ships_queryset.filter(emission_cruise__isnull=True).count()
        
        self.stdout.write(f'\nMissing emission fields:')
        self.stdout.write(f'  - Missing berth: {missing_berth}')
        self.stdout.write(f'  - Missing anchor: {missing_anchor}')
        self.stdout.write(f'  - Missing maneuver: {missing_maneuver}')
        self.stdout.write(f'  - Missing cruise: {missing_cruise}')
        
        # Analyze ships with missing dimensions
        missing_length = ships_queryset.filter(length__isnull=True).count()
        missing_width = ships_queryset.filter(width__isnull=True).count()
        missing_draught = ships_queryset.filter(max_draught__isnull=True).count()
        
        ships_with_all_dimensions = ships_queryset.filter(
            length__isnull=False,
            width__isnull=False,
            max_draught__isnull=False
        ).count()
        
        self.stdout.write(f'\nShip dimensions analysis:')
        self.stdout.write(f'  - Missing length: {missing_length}')
        self.stdout.write(f'  - Missing width: {missing_width}')
        self.stdout.write(f'  - Missing max_draught: {missing_draught}')
        self.stdout.write(f'  - Ships with all dimensions: {ships_with_all_dimensions}')
        
        # Sample some ships for detailed inspection
        self.stdout.write(f'\nSample ships (first 10):')
        for ship in ships_queryset[:10]:
            emission_status = []
            if ship.emission_berth is None:
                emission_status.append('berth')
            if ship.emission_anchor is None:
                emission_status.append('anchor')
            if ship.emission_maneuver is None:
                emission_status.append('maneuver')
            if ship.emission_cruise is None:
                emission_status.append('cruise')
            
            dimensions_status = f"L:{ship.length}, W:{ship.width}, D:{ship.max_draught}"
            missing_emissions = ', '.join(emission_status) if emission_status else 'none'
            
            self.stdout.write(
                f'  {ship.imo_number} ({ship.name}) - Type: {ship.type_name}, '
                f'Dimensions: {dimensions_status}, Missing: {missing_emissions}'
            ) 