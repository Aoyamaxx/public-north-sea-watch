"""
Debug command to analyze why ships are being skipped in discharge rate calculation.
"""

from django.core.management.base import BaseCommand
from apps.north_sea_watch.models import Ship, ICCTWFRCombined
from apps.north_sea_watch.utils.emission_calculator import calculate_ship_discharge_rates


class Command(BaseCommand):
    help = 'Debug ship discharge rate calculation issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sample-size',
            type=int,
            default=10,
            help='Number of ships to analyze (default: 10)',
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting debug analysis...")
        
        # Get some sample IMO numbers from both tables to check format
        self.stdout.write("\n--- IMO Number Format Analysis ---")
        
        # Check Ship table IMO format
        ship_imos = list(Ship.objects.using('ais_data').values_list('imo_number', flat=True)[:5])
        self.stdout.write("Sample Ship IMO numbers:")
        for imo in ship_imos:
            self.stdout.write(f"  {repr(imo)} (type: {type(imo).__name__})")
        
        # Check ICCTWFRCombined table IMO format  
        scrubber_imos = list(ICCTWFRCombined.objects.using('ais_data').values_list('imo_number', flat=True)[:5])
        self.stdout.write("Sample Scrubber IMO numbers:")
        for imo in scrubber_imos:
            self.stdout.write(f"  {repr(imo)} (type: {type(imo).__name__})")
        
        # Get scrubber data
        scrubber_data = {}
        for scrubber in ICCTWFRCombined.objects.using('ais_data').all():
            scrubber_data[scrubber.imo_number] = {
                'technology_type': scrubber.sox_scrubber_1_technology_type,
                'status': scrubber.sox_scrubber_status,
                'type': scrubber.type
            }
        
        self.stdout.write(f"\nFound {len(scrubber_data)} scrubber records")
        
        # Try to find any overlap by converting both to strings
        scrubber_imos_str = set(str(imo) for imo in scrubber_data.keys())
        ship_imos_all = set(str(imo) for imo in Ship.objects.using('ais_data').values_list('imo_number', flat=True))
        
        overlap = scrubber_imos_str.intersection(ship_imos_all)
        self.stdout.write(f"IMO overlap when converted to strings: {len(overlap)} ships")
        
        if len(overlap) > 0:
            self.stdout.write("Sample overlapping IMOs:")
            for i, imo in enumerate(list(overlap)[:5]):
                self.stdout.write(f"  {imo}")
        
        # Get ships with scrubber data (using string conversion)
        overlap_list = list(overlap)[:options['sample_size']]
        ships = Ship.objects.using('ais_data').filter(imo_number__in=overlap_list)
        
        self.stdout.write(f"\nAnalyzing {len(ships)} ships with scrubber data...")
        
        for i, ship in enumerate(ships):
            self.stdout.write(f"\n--- Ship {i+1}: IMO {ship.imo_number} ---")
            self.stdout.write(f"Name: {ship.name}")
            self.stdout.write(f"Type: {ship.type_name}")
            self.stdout.write(f"Dimensions: L={ship.length}, W={ship.width}, D={ship.max_draught}")
            
            # Look up scrubber data using string conversion
            scrubber_info = None
            for scrubber_imo, data in scrubber_data.items():
                if str(scrubber_imo) == str(ship.imo_number):
                    scrubber_info = data
                    break
            
            if scrubber_info:
                self.stdout.write(f"Scrubber type: {scrubber_info['technology_type']}")
                self.stdout.write(f"Scrubber status: {scrubber_info['status']}")
                
                # Try calculation
                berth, anchor, maneuver, cruise = calculate_ship_discharge_rates(
                    imo_number=ship.imo_number,
                    length=ship.length,
                    width=ship.width,
                    max_draught=ship.max_draught,
                    type_name=ship.type_name,
                    scrubber_type=scrubber_info['technology_type']
                )
                
                if any([berth, anchor, maneuver, cruise]):
                    self.stdout.write(f"✓ Calculation successful: Berth={berth}, Anchor={anchor}, Maneuver={maneuver}, Cruise={cruise}")
                else:
                    self.stdout.write("✗ Calculation failed - all rates are None")
            else:
                self.stdout.write("✗ No scrubber data found")
        
        # Check data distribution
        self.stdout.write(f"\n--- Data Analysis ---")
        
        # Scrubber technology types
        tech_types = {}
        for data in scrubber_data.values():
            tech_type = data['technology_type']
            tech_types[tech_type] = tech_types.get(tech_type, 0) + 1
        
        self.stdout.write("Scrubber technology types:")
        for tech_type, count in tech_types.items():
            self.stdout.write(f"  {tech_type}: {count}")
        
        # Ship types in filtered set
        ship_types = {}
        for ship in ships:
            ship_type = ship.type_name
            ship_types[ship_type] = ship_types.get(ship_type, 0) + 1
        
        self.stdout.write("Ship types:")
        for ship_type, count in ship_types.items():
            self.stdout.write(f"  {ship_type}: {count}") 