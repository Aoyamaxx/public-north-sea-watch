#!/usr/bin/env python3
"""
Test script to validate the updated discharge calculation logic.
Tests the new AE + BO power calculation for both Cargo and Tanker ships.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'apps'))

from north_sea_watch.utils.emission_calculator import (
    calculate_ship_discharge_rates,
    calculate_dwt_category,
    CARGO_EMISSION_SPECS,
    TANKER_EMISSION_SPECS,
    CARGO_BO_SPECS,
    TANKER_BO_SPECS
)

def test_cargo_ship():
    """Test calculation for a cargo ship"""
    print("=== Testing Cargo Ship ===")
    
    # Test case: Cargo ship with dimensions from notebook
    imo = "TEST_CARGO_001"
    length = 148.0  # m
    width = 10.0    # m
    max_draught = 7.7  # m
    type_name = "Cargo"
    scrubber_type = "Open Loop"
    
    # Calculate discharge rates
    berth, anchor, maneuver, cruise = calculate_ship_discharge_rates(
        imo, length, width, max_draught, type_name, scrubber_type
    )
    
    print(f"Ship: {imo}")
    print(f"Dimensions: {length}m × {width}m × {max_draught}m")
    print(f"Discharge rates: Berth={berth}, Anchor={anchor}, Maneuver={maneuver}, Cruise={cruise}")
    
    # Calculate expected values manually
    displacement_volume = length * width * max_draught * 0.625  # cargo block coef
    displacement_weight = displacement_volume * 1.025
    dwt = displacement_weight - (displacement_weight * 0.32)
    dwt_category = calculate_dwt_category(dwt, type_name)
    
    print(f"DWT: {dwt:.1f}t, Category: {dwt_category}")
    
    # Get AE and BO power for each operation mode
    ae_specs = CARGO_EMISSION_SPECS[dwt_category]
    bo_specs = CARGO_BO_SPECS[dwt_category]
    
    print("Power breakdown:")
    for mode in ['Berth', 'Anchor', 'Maneuver', 'Cruise']:
        ae_power = ae_specs[mode]
        bo_power = bo_specs[mode] 
        total_power = ae_power + bo_power
        discharge_rate = total_power * 45  # Updated Open Loop multiplier
        print(f"  {mode}: AE={ae_power}kW + BO={bo_power}kW = {total_power}kW → {discharge_rate:.2f} kg/h")
    
    print()

def test_tanker_ship():
    """Test calculation for a tanker ship"""
    print("=== Testing Tanker Ship ===")
    
    # Test case: Tanker ship with dimensions from notebook  
    imo = "TEST_TANKER_001"
    length = 149.0  # m
    width = 34.0    # m
    max_draught = 8.0  # m
    type_name = "Tanker"
    scrubber_type = "Open Loop"
    
    # Calculate discharge rates
    berth, anchor, maneuver, cruise = calculate_ship_discharge_rates(
        imo, length, width, max_draught, type_name, scrubber_type
    )
    
    print(f"Ship: {imo}")
    print(f"Dimensions: {length}m × {width}m × {max_draught}m")
    print(f"Discharge rates: Berth={berth}, Anchor={anchor}, Maneuver={maneuver}, Cruise={cruise}")
    
    # Calculate expected values manually
    displacement_volume = length * width * max_draught * 0.825  # tanker block coef
    displacement_weight = displacement_volume * 1.025
    dwt = displacement_weight - (displacement_weight * 0.16)
    dwt_category = calculate_dwt_category(dwt, type_name)
    
    print(f"DWT: {dwt:.1f}t, Category: {dwt_category}")
    
    # Get AE and BO power for each operation mode
    ae_specs = TANKER_EMISSION_SPECS[dwt_category]
    bo_specs = TANKER_BO_SPECS[dwt_category]
    
    print("Power breakdown:")
    for mode in ['Berth', 'Anchor', 'Maneuver', 'Cruise']:
        ae_power = ae_specs[mode]
        bo_power = bo_specs[mode]
        total_power = ae_power + bo_power
        discharge_rate = total_power * 45  # Updated Open Loop multiplier
        print(f"  {mode}: AE={ae_power}kW + BO={bo_power}kW = {total_power}kW → {discharge_rate:.2f} kg/h")
    
    print()

def test_closed_loop():
    """Test calculation for closed loop scrubber (should be zero discharge)"""
    print("=== Testing Closed Loop Scrubber ===")
    
    imo = "TEST_CLOSED_001"
    length = 149.0
    width = 34.0
    max_draught = 8.0
    type_name = "Tanker"
    scrubber_type = "Closed Loop"
    
    berth, anchor, maneuver, cruise = calculate_ship_discharge_rates(
        imo, length, width, max_draught, type_name, scrubber_type
    )
    
    print(f"Ship: {imo} (Closed Loop)")
    print(f"Discharge rates: Berth={berth}, Anchor={anchor}, Maneuver={maneuver}, Cruise={cruise}")
    print("Expected: All values should be calculated with 0.1 kg/kWh multiplier for Closed Loop scrubber")
    print()

if __name__ == "__main__":
    test_cargo_ship()
    test_tanker_ship() 
    test_closed_loop()
    print("Test completed!") 