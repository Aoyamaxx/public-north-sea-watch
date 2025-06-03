"""
Scrubber discharge rate calculation utilities for ships.
Contains the logic to calculate theoretical scrubber water discharge rates for different operation modes.
"""

from typing import Dict, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)

# Block coefficients for displacement calculation
CARGO_BLOCK_COEF = 0.625
TANKER_BLOCK_COEF = 0.825

# Cargo AE power by DWT category and operation mode (kW)
CARGO_EMISSION_SPECS = {
    1: {'Berth': 90, 'Anchor': 50, 'Maneuver': 180, 'Cruise': 60},
    2: {'Berth': 240, 'Anchor': 130, 'Maneuver': 490, 'Cruise': 180},
    3: {'Berth': 720, 'Anchor': 370, 'Maneuver': 1450, 'Cruise': 520},
    4: {'Berth': 720, 'Anchor': 370, 'Maneuver': 1450, 'Cruise': 520}
}

# Tanker AE power by DWT category and operation mode (kW)
TANKER_EMISSION_SPECS = {
    1: {'Berth': 250, 'Anchor': 250, 'Maneuver': 375, 'Cruise': 250},
    2: {'Berth': 375, 'Anchor': 375, 'Maneuver': 560, 'Cruise': 375},
    3: {'Berth': 690, 'Anchor': 500, 'Maneuver': 580, 'Cruise': 490},
    4: {'Berth': 720, 'Anchor': 520, 'Maneuver': 600, 'Cruise': 510},
    5: {'Berth': 620, 'Anchor': 490, 'Maneuver': 770, 'Cruise': 560},
    6: {'Berth': 800, 'Anchor': 640, 'Maneuver': 910, 'Cruise': 690},
    7: {'Berth': 2500, 'Anchor': 770, 'Maneuver': 1300, 'Cruise': 860},
    8: {'Berth': 2500, 'Anchor': 770, 'Maneuver': 1300, 'Cruise': 860}
}

# Cargo BO (Boiler) power by DWT category and operation mode (kW)
CARGO_BO_SPECS = {
    1: {'Berth': 0, 'Anchor': 0, 'Maneuver': 0, 'Cruise': 0},
    2: {'Berth': 110, 'Anchor': 110, 'Maneuver': 100, 'Cruise': 0},
    3: {'Berth': 150, 'Anchor': 150, 'Maneuver': 130, 'Cruise': 0},
    4: {'Berth': 150, 'Anchor': 150, 'Maneuver': 130, 'Cruise': 0}
}

# Tanker BO (Boiler) power by DWT category and operation mode (kW)
TANKER_BO_SPECS = {
    1: {'Berth': 500, 'Anchor': 100, 'Maneuver': 100, 'Cruise': 0},
    2: {'Berth': 750, 'Anchor': 150, 'Maneuver': 150, 'Cruise': 0},
    3: {'Berth': 1250, 'Anchor': 250, 'Maneuver': 250, 'Cruise': 0},
    4: {'Berth': 2700, 'Anchor': 270, 'Maneuver': 270, 'Cruise': 270},
    5: {'Berth': 3250, 'Anchor': 360, 'Maneuver': 360, 'Cruise': 280},
    6: {'Berth': 4000, 'Anchor': 400, 'Maneuver': 400, 'Cruise': 280},
    7: {'Berth': 6500, 'Anchor': 500, 'Maneuver': 500, 'Cruise': 300},
    8: {'Berth': 7000, 'Anchor': 600, 'Maneuver': 600, 'Cruise': 300}
}

# Default AE power value for unknown ship types/categories (kW)
DEFAULT_EMISSION_VALUE = 500
# Default BO power value for unknown ship types/categories (kW) 
DEFAULT_BO_VALUE = 0

# Scrubber discharge multipliers based on technology type (kg/kWh)
SCRUBBER_DISCHARGE_MULTIPLIERS = {
    'Open Loop': 45,       # Updated discharge rate
    'Closed Loop': 0.1,    # Updated discharge rate for closed loop
    'Hybrid': 45,          # Same as Open Loop
    'TBC': 45,             # Treat TBC as Open Loop (default)
    # Membrane and Dry are treated as N/A (not calculated)
}

def normalize_scrubber_type(scrubber_type: Optional[str]) -> Optional[str]:
    """
    Normalize scrubber technology type to standard values.
    
    Args:
        scrubber_type: Raw scrubber type from database
        
    Returns:
        Normalized scrubber type or None if not applicable
    """
    if not scrubber_type:
        return None
        
    scrubber_type_clean = scrubber_type.strip()
    
    # Treat Membrane and Dry as N/A (return None)
    if scrubber_type_clean in ['Membrane', 'Dry']:
        return None
        
    # Return the exact match for known types
    if scrubber_type_clean in SCRUBBER_DISCHARGE_MULTIPLIERS:
        return scrubber_type_clean
        
    # Default unknown types to Open Loop
    logger.warning(f"Unknown scrubber type '{scrubber_type_clean}', defaulting to Open Loop")
    return 'Open Loop'


def calculate_dwt_category(dwt: float, ship_type: str) -> int:
    """
    Calculate DWT category based on deadweight tonnage and ship type.
    Uses the capacity ranges from the notebook specifications.
    
    Args:
        dwt: Deadweight tonnage
        ship_type: Ship type ('Cargo' or 'Tanker')
        
    Returns:
        DWT category (1-4 for cargo, 1-8 for tanker)
    """
    if ship_type == 'Cargo':
        # Cargo capacity ranges from notebook
        if dwt <= 4999:
            return 1
        elif dwt <= 9999:
            return 2
        elif dwt <= 19999:
            return 3
        else:  # 20000+
            return 4
    elif ship_type == 'Tanker':
        # Tanker capacity ranges from notebook
        if dwt <= 4999:
            return 1
        elif dwt <= 9999:
            return 2
        elif dwt <= 19999:
            return 3
        elif dwt <= 59999:
            return 4
        elif dwt <= 79999:
            return 5
        elif dwt <= 119999:
            return 6
        elif dwt <= 199999:
            return 7
        else:  # 200000+
            return 8
    else:
        return 1  # Default category for unknown types


def calculate_ship_discharge_rates(
    imo_number: str,
    length: Optional[float],
    width: Optional[float],
    max_draught: Optional[float],
    type_name: Optional[str],
    scrubber_type: Optional[str]
) -> Tuple[Optional[Decimal], Optional[Decimal], Optional[Decimal], Optional[Decimal]]:
    """
    Calculate theoretical scrubber water discharge rates for all four operation modes.
    Only calculates for scrubber vessels with valid scrubber technology types.
    
    Args:
        imo_number: Ship's IMO number for logging
        length: Ship length in meters
        width: Ship width in meters  
        max_draught: Ship maximum draught in meters
        type_name: Ship type name ('Cargo', 'Tanker', etc.)
        scrubber_type: Scrubber technology type from icct_wfr_combined table
        
    Returns:
        Tuple of (berth_rate, anchor_rate, maneuver_rate, cruise_rate) in kg/h
        Returns None values if calculation is not possible
    """
    try:
        # Normalize and validate scrubber type
        normalized_scrubber_type = normalize_scrubber_type(scrubber_type)
        if not normalized_scrubber_type:
            logger.info(f"Ship {imo_number}: No valid scrubber type ({scrubber_type}), skipping discharge calculation")
            return None, None, None, None
            
        # Convert all inputs to float to avoid Decimal/float operation issues
        length = float(length) if length is not None else None
        width = float(width) if width is not None else None
        max_draught = float(max_draught) if max_draught is not None else None
        
        # Validate required dimensions
        if not all([length, width, max_draught]):
            logger.info(f"Ship {imo_number}: Missing dimensions for discharge calculation")
            return None, None, None, None
            
        # Only calculate for Cargo and Tanker types
        if type_name not in ['Cargo', 'Tanker']:
            logger.info(f"Ship {imo_number}: Type '{type_name}' not supported for discharge calculation")
            return None, None, None, None
            
        # Step 1: Calculate ship displacement volume
        block_coef = TANKER_BLOCK_COEF if type_name == 'Tanker' else CARGO_BLOCK_COEF
        displacement_volume = length * width * max_draught * block_coef
        
        # Step 2: Calculate displacement weight (tonnage)
        seawater_density = 1.025  # t/m³
        displacement_weight = displacement_volume * seawater_density
        
        # Step 3: Calculate DWT (Deadweight Tonnage)
        lightweight_factor = 0.16 if type_name == 'Tanker' else 0.32
        dwt = displacement_weight - (displacement_weight * lightweight_factor)
        
        # Step 4: Determine DWT category
        dwt_category = calculate_dwt_category(dwt, type_name)
        
        # Step 5: Get AE and BO power specs for the ship type
        ae_specs = TANKER_EMISSION_SPECS if type_name == 'Tanker' else CARGO_EMISSION_SPECS
        bo_specs = TANKER_BO_SPECS if type_name == 'Tanker' else CARGO_BO_SPECS
        
        # Step 6: Get discharge multiplier for scrubber type
        discharge_multiplier = SCRUBBER_DISCHARGE_MULTIPLIERS[normalized_scrubber_type]
        
        # Step 7: Calculate AE and BO power for all operation modes (kW)
        ae_berth = ae_specs[dwt_category].get('Berth', DEFAULT_EMISSION_VALUE)
        ae_anchor = ae_specs[dwt_category].get('Anchor', DEFAULT_EMISSION_VALUE)
        ae_maneuver = ae_specs[dwt_category].get('Maneuver', DEFAULT_EMISSION_VALUE)
        ae_cruise = ae_specs[dwt_category].get('Cruise', DEFAULT_EMISSION_VALUE)
        
        bo_berth = bo_specs[dwt_category].get('Berth', DEFAULT_BO_VALUE)
        bo_anchor = bo_specs[dwt_category].get('Anchor', DEFAULT_BO_VALUE)
        bo_maneuver = bo_specs[dwt_category].get('Maneuver', DEFAULT_BO_VALUE)
        bo_cruise = bo_specs[dwt_category].get('Cruise', DEFAULT_BO_VALUE)
        
        # Step 8: Calculate total power (AE + BO) for all operation modes (kW)
        total_berth = ae_berth + bo_berth
        total_anchor = ae_anchor + bo_anchor
        total_maneuver = ae_maneuver + bo_maneuver
        total_cruise = ae_cruise + bo_cruise
        
        # Step 9: Calculate discharge rates using updated formula: Discharge rate (kg/h) = (AE + BO) (kW) × multiplier (kg/kWh)
        discharge_berth = total_berth * discharge_multiplier
        discharge_anchor = total_anchor * discharge_multiplier
        discharge_maneuver = total_maneuver * discharge_multiplier
        discharge_cruise = total_cruise * discharge_multiplier
        
        # Convert to Decimal with 2 decimal places
        berth_decimal = Decimal(str(discharge_berth)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        anchor_decimal = Decimal(str(discharge_anchor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        maneuver_decimal = Decimal(str(discharge_maneuver)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        cruise_decimal = Decimal(str(discharge_cruise)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        logger.info(f"Ship {imo_number}: Calculated discharge rates - "
                   f"DWT: {dwt:.1f}t, Category: {dwt_category}, Scrubber: {normalized_scrubber_type}, "
                   f"AE Power - Berth: {ae_berth}kW, Anchor: {ae_anchor}kW, Maneuver: {ae_maneuver}kW, Cruise: {ae_cruise}kW, "
                   f"BO Power - Berth: {bo_berth}kW, Anchor: {bo_anchor}kW, Maneuver: {bo_maneuver}kW, Cruise: {bo_cruise}kW, "
                   f"Total Power - Berth: {total_berth}kW, Anchor: {total_anchor}kW, Maneuver: {total_maneuver}kW, Cruise: {total_cruise}kW, "
                   f"Discharge - Berth: {berth_decimal} kg/h, Anchor: {anchor_decimal} kg/h, "
                   f"Maneuver: {maneuver_decimal} kg/h, Cruise: {cruise_decimal} kg/h")
        
        return berth_decimal, anchor_decimal, maneuver_decimal, cruise_decimal
        
    except Exception as e:
        logger.error(f"Error calculating discharge rates for ship {imo_number}: {str(e)}")
        return None, None, None, None


def calculate_scrubber_discharge_rate(
    ae_power: float,
    scrubber_type: str
) -> float:
    """
    Calculate scrubber discharge rate based on AE power and scrubber type.
    This maintains compatibility with frontend calculations.
    Note: This function only uses AE power for backward compatibility.
    The main calculation function now uses AE + BO total power.
    
    Args:
        ae_power: Auxiliary Engine power in kW
        scrubber_type: Type of scrubber ('open', 'closed', 'hybrid', etc.)
        
    Returns:
        Discharge rate in kg/h
    """
    try:
        # Normalize scrubber type
        normalized_type = normalize_scrubber_type(scrubber_type)
        if not normalized_type:
            return 2250.0  # Default discharge rate for unknown/invalid types (45 * 50 kW default)
            
        # Get discharge multiplier (kg/kWh)
        discharge_multiplier = SCRUBBER_DISCHARGE_MULTIPLIERS.get(normalized_type, 45)
        
        # Calculate discharge rate using updated formula: Discharge rate (kg/h) = AE (kW) × multiplier (kg/kWh)
        discharge_rate = ae_power * discharge_multiplier
        
        return round(discharge_rate, 1)  # Round to 1 decimal place
        
    except Exception as e:
        logger.error(f"Error calculating scrubber discharge rate: {str(e)}")
        return 2250.0  # Default discharge rate 