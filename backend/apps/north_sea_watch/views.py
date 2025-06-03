from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import Ship
import json


@require_http_methods(["GET"])
def get_ship_emission_rates(request, imo_number):
    """
    API endpoint to get precalculated emission rates for a specific ship.
    
    Args:
        request: HTTP request object
        imo_number: Ship's IMO number
        
    Returns:
        JSON response with emission rates for all operation modes
    """
    try:
        ship = Ship.objects.get(imo_number=imo_number)
        
        response_data = {
            'imo_number': ship.imo_number,
            'name': ship.name,
            'type_name': ship.type_name,
            'emission_rates': {
                'berth': float(ship.emission_berth) if ship.emission_berth else None,
                'anchor': float(ship.emission_anchor) if ship.emission_anchor else None,
                'maneuver': float(ship.emission_maneuver) if ship.emission_maneuver else None,
                'cruise': float(ship.emission_cruise) if ship.emission_cruise else None,
            },
            'has_calculated_rates': any([
                ship.emission_berth,
                ship.emission_anchor,
                ship.emission_maneuver,
                ship.emission_cruise
            ])
        }
        
        return JsonResponse(response_data)
        
    except Ship.DoesNotExist:
        return JsonResponse({
            'error': f'Ship with IMO {imo_number} not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'error': f'Error retrieving ship data: {str(e)}'
        }, status=500)


@require_http_methods(["GET"])
def get_ships_emission_summary(request):
    """
    API endpoint to get summary statistics about ship emission calculations.
    
    Returns:
        JSON response with summary information about calculated emission rates
    """
    try:
        total_ships = Ship.objects.count()
        ships_with_emissions = Ship.objects.filter(
            emission_berth__isnull=False,
            emission_anchor__isnull=False,
            emission_maneuver__isnull=False,
            emission_cruise__isnull=False
        ).count()
        
        # Get breakdown by ship type
        cargo_ships_total = Ship.objects.filter(type_name='Cargo').count()
        cargo_ships_calculated = Ship.objects.filter(
            type_name='Cargo',
            emission_berth__isnull=False
        ).count()
        
        tanker_ships_total = Ship.objects.filter(type_name='Tanker').count()
        tanker_ships_calculated = Ship.objects.filter(
            type_name='Tanker',
            emission_berth__isnull=False
        ).count()
        
        response_data = {
            'total_ships': total_ships,
            'ships_with_calculated_emissions': ships_with_emissions,
            'calculation_coverage_percentage': round(
                (ships_with_emissions / total_ships * 100) if total_ships > 0 else 0, 2
            ),
            'breakdown_by_type': {
                'cargo': {
                    'total': cargo_ships_total,
                    'calculated': cargo_ships_calculated,
                    'percentage': round(
                        (cargo_ships_calculated / cargo_ships_total * 100) if cargo_ships_total > 0 else 0, 2
                    )
                },
                'tanker': {
                    'total': tanker_ships_total,
                    'calculated': tanker_ships_calculated,
                    'percentage': round(
                        (tanker_ships_calculated / tanker_ships_total * 100) if tanker_ships_total > 0 else 0, 2
                    )
                }
            }
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'error': f'Error retrieving summary data: {str(e)}'
        }, status=500) 