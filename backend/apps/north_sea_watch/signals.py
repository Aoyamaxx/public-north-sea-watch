"""
Django signals for the north_sea_watch app.
Handles automatic calculation of scrubber discharge rates for new ships.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Ship, ICCTWFRCombined
from .utils.emission_calculator import calculate_ship_discharge_rates
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Ship)
def calculate_ship_discharge_rates_on_create(sender, instance, created, **kwargs):
    """
    Signal handler to automatically calculate scrubber discharge rates for newly created ships.
    
    This signal is triggered after a Ship instance is saved to the database.
    For new ships (created=True), it calculates and updates the discharge rates
    for all four operation modes if the ship has scrubber technology and required dimensions.
    
    Args:
        sender: The Ship model class
        instance: The Ship instance that was saved
        created: Boolean indicating if this is a new instance
        **kwargs: Additional keyword arguments
    """
    if not created:
        # Only process newly created ships
        return
        
    # Check if discharge rates are already calculated
    has_discharge_rates = any([
        instance.emission_berth is not None,
        instance.emission_anchor is not None,
        instance.emission_maneuver is not None,
        instance.emission_cruise is not None
    ])
    
    if has_discharge_rates:
        # Discharge rates already exist, no need to calculate
        return
        
    try:
        # Check if ship has scrubber data
        try:
            scrubber_data = ICCTWFRCombined.objects.using('ais_data').get(imo_number=instance.imo_number)
            scrubber_type = scrubber_data.sox_scrubber_1_technology_type
        except ICCTWFRCombined.DoesNotExist:
            logger.info(
                f"No scrubber data found for new ship {instance.imo_number} "
                f"({instance.name}) - skipping discharge rate calculation"
            )
            return
        
        # Calculate discharge rates for the new scrubber ship
        berth_rate, anchor_rate, maneuver_rate, cruise_rate = calculate_ship_discharge_rates(
            imo_number=instance.imo_number,
            length=instance.length,
            width=instance.width,
            max_draught=instance.max_draught,
            type_name=instance.type_name,
            scrubber_type=scrubber_type
        )
        
        # Update the ship instance if we got valid calculations
        if any([berth_rate, anchor_rate, maneuver_rate, cruise_rate]):
            # Use update() to avoid triggering the signal again
            Ship.objects.using('ais_data').filter(imo_number=instance.imo_number).update(
                emission_berth=berth_rate,
                emission_anchor=anchor_rate,
                emission_maneuver=maneuver_rate,
                emission_cruise=cruise_rate
            )
            
            logger.info(
                f"Auto-calculated discharge rates for new scrubber ship {instance.imo_number} "
                f"({instance.name}) with {scrubber_type}: Berth={berth_rate} kg/h, "
                f"Anchor={anchor_rate} kg/h, Maneuver={maneuver_rate} kg/h, Cruise={cruise_rate} kg/h"
            )
        else:
            logger.info(
                f"Could not calculate discharge rates for new scrubber ship {instance.imo_number} "
                f"({instance.name}) - missing required data or unsupported scrubber type"
            )
            
    except Exception as e:
        logger.error(
            f"Error auto-calculating discharge rates for ship {instance.imo_number}: {str(e)}"
        ) 