from django.http import JsonResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.urls import reverse
from apps.north_sea_watch.models import (
    Port, Ship, ShipData, PortContent, UserTracking,
    ICCTScrubberMarch2025, ICCTWFRCombined
)
from .serializers import (
    PortSerializer, ShipSerializer, ShipDataSerializer, 
    ShipWithLatestPositionSerializer, PortContentSerializer, 
    UserTrackingSerializer, ICCTScrubberMarch2025Serializer,
    ICCTWFRCombinedSerializer
)
from django.db import connections, connection
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta, datetime
import pytz
import os
import re
import logging
import traceback
import requests
import user_agents
from django.conf import settings
from django.db.models import Max
from apps.common.utils import get_real_client_ip
from django.forms.models import model_to_dict
from django.apps import apps

logger = logging.getLogger(__name__)

def api_root(request):
    return JsonResponse({
        "message": "North Sea Watch API V1",
        "status": "ok",
        "version": "1.0",
        "endpoints": {
            "ports": reverse('api_v1:all-ports', request=request),
            "active_ships": reverse('api_v1:active-ships', request=request),
            "port_contents": reverse('api_v1:all-port-contents', request=request),
            "tracking": reverse('api_v1:tracking', request=request),
            "test_ip_api": reverse('api_v1:test-ip-api', request=request),
            "check_tracking_records": reverse('api_v1:check-tracking-records', request=request),
            "debug_ip_tracking": reverse('api_v1:debug-ip-tracking', request=request),
            "debug_database_tables": reverse('api_v1:debug-database-tables', request=request),
            "scrubber_vessels": reverse('api_v1:scrubber-vessels', request=request),
            "engine_data": reverse('api_v1:engine-data', request=request)
        }
    })

class PortViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows ports to be viewed.
    """
    queryset = Port.objects.using('ais_data').all()
    serializer_class = PortSerializer

class ShipViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows ships to be viewed.
    """
    queryset = Ship.objects.using('ais_data').all()
    serializer_class = ShipSerializer

@api_view(['GET'])
def get_all_ports(request):
    """
    Get all ports with their coordinates for map display.
    """
    try:
        ports = Port.objects.using('ais_data').all()
        serializer = PortSerializer(ports, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_active_ships(request):
    """
    Get all ships that have been active in the last 3 hours with their latest positions.
    """
    try:
        # Get the current time in UTC
        now = timezone.now()
        # Calculate the time 3 hours ago
        three_hours_ago = now - timedelta(hours=3)
        
        # Get the latest position for each ship within the last 3 hours
        with connections['ais_data'].cursor() as cursor:
            cursor.execute("""
                WITH latest_positions AS (
                    SELECT DISTINCT ON (imo_number) 
                        imo_number, 
                        timestamp_ais, 
                        latitude, 
                        longitude, 
                        destination,
                        navigational_status_code,
                        navigational_status,
                        true_heading,
                        rate_of_turn,
                        cog,
                        sog
                    FROM ship_data
                    WHERE timestamp_ais >= %s
                    ORDER BY imo_number, timestamp_ais DESC
                )
                SELECT s.imo_number, s.mmsi, s.name, s.ship_type, s.length, s.width, 
                       s.max_draught, s.type_name, s.type_remark,
                       s.emission_berth, s.emission_anchor, s.emission_maneuver, s.emission_cruise,
                       lp.timestamp_ais, lp.latitude, lp.longitude, lp.destination,
                       lp.navigational_status_code, lp.navigational_status, lp.true_heading,
                       lp.rate_of_turn, lp.cog, lp.sog
                FROM ships s
                JOIN latest_positions lp ON s.imo_number = lp.imo_number
                ORDER BY s.name
            """, [three_hours_ago])
            
            results = []
            for row in cursor.fetchall():
                ship_data = {
                    'imo_number': row[0],
                    'mmsi': row[1],
                    'name': row[2],
                    'ship_type': row[3],
                    'length': row[4],
                    'width': row[5],
                    'max_draught': row[6],
                    'type_name': row[7],
                    'type_remark': row[8],
                    'emission_berth': float(row[9]) if row[9] is not None else None,
                    'emission_anchor': float(row[10]) if row[10] is not None else None,
                    'emission_maneuver': float(row[11]) if row[11] is not None else None,
                    'emission_cruise': float(row[12]) if row[12] is not None else None,
                    'latest_position': {
                        'imo_number': row[0],
                        'timestamp_ais': row[13],
                        'latitude': row[14],
                        'longitude': row[15],
                        'destination': row[16],
                        'navigational_status_code': row[17],
                        'navigational_status': row[18],
                        'true_heading': row[19],
                        'rate_of_turn': row[20],
                        'cog': row[21],
                        'sog': row[22]
                    }
                }
                results.append(ship_data)
        
        return Response(results)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_ship_path(request, imo_number):
    """
    Get the path of a specific ship over the last 24 hours.
    """
    try:
        # Get the current time in UTC
        now = timezone.now()
        # Calculate the time 24 hours ago
        twenty_four_hours_ago = now - timedelta(hours=24)
        
        # Use raw SQL query instead of ORM to avoid potential issues
        with connections['ais_data'].cursor() as cursor:
            cursor.execute("""
                SELECT imo_number, timestamp_ais, latitude, longitude, destination,
                       navigational_status_code, navigational_status, true_heading,
                       rate_of_turn, cog, sog
                FROM ship_data
                WHERE imo_number = %s AND timestamp_ais >= %s
                ORDER BY timestamp_ais
            """, [imo_number, twenty_four_hours_ago])
            
            results = []
            for row in cursor.fetchall():
                position_data = {
                    'imo_number': row[0],
                    'timestamp_ais': row[1].isoformat() if row[1] else None,
                    'latitude': row[2],
                    'longitude': row[3],
                    'destination': row[4],
                    'navigational_status_code': row[5],
                    'navigational_status': row[6],
                    'true_heading': row[7],
                    'rate_of_turn': row[8],
                    'cog': row[9],
                    'sog': row[10]
                }
                results.append(position_data)
        
        return Response(results)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_ship_path for IMO {imo_number}: {str(e)}\n{error_details}")
        return Response({"error": str(e), "details": error_details}, status=500)

@api_view(['GET'])
def test_db_connection(request):
    """
    Test the database connection to ais_data_collection.
    """
    try:
        # Test connection to ais_data database
        with connections['ais_data'].cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM ports")
            row = cursor.fetchone()
            port_count = row[0] if row else 0
        
        # Get a sample port if available
        sample_port = None
        if port_count > 0:
            port = Port.objects.using('ais_data').first()
            if port:
                sample_port = {
                    "port_name": port.port_name,
                    "country": port.country,
                    "latitude": port.latitude,
                    "longitude": port.longitude
                }
        
        return Response({
            "status": "success",
            "message": "Database connection successful",
            "port_count": port_count,
            "sample_port": sample_port,
            "database_info": {
                "name": connections['ais_data'].settings_dict['NAME'],
                "user": connections['ais_data'].settings_dict['USER'],
                "host": connections['ais_data'].settings_dict['HOST'],
                "port": connections['ais_data'].settings_dict['PORT'],
            }
        })
    except Exception as e:
        return Response({
            "status": "error",
            "message": f"Database connection failed: {str(e)}",
            "database_info": {
                "name": connections['ais_data'].settings_dict['NAME'],
                "user": connections['ais_data'].settings_dict['USER'],
                "host": connections['ais_data'].settings_dict['HOST'],
                "port": connections['ais_data'].settings_dict['PORT'],
            }
        }, status=500)

@api_view(['GET'])
def get_table_structure(request):
    """
    Get the structure of the ports table.
    """
    try:
        with connections['ais_data'].cursor() as cursor:
            # Get table columns
            cursor.execute("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'ports'
                ORDER BY ordinal_position
            """)
            columns = [
                {
                    "name": row[0],
                    "type": row[1],
                    "max_length": row[2]
                }
                for row in cursor.fetchall()
            ]
            
            # Get primary key
            cursor.execute("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = 'ports'::regclass AND i.indisprimary
            """)
            primary_key = cursor.fetchone()
            
            return Response({
                "status": "success",
                "table_name": "ports",
                "columns": columns,
                "primary_key": primary_key[0] if primary_key else None
            })
    except Exception as e:
        return Response({
            "status": "error",
            "message": f"Failed to get table structure: {str(e)}"
        }, status=500)

@api_view(['GET'])
def get_port_content(request, port_name, country):
    """
    Get content for a specific port.
    """
    try:
        # First check if the port exists in the ais_data database
        try:
            port = Port.objects.using('ais_data').get(port_name=port_name, country=country)
        except Port.DoesNotExist:
            return Response({"error": f"Port {port_name} ({country}) not found"}, status=404)
        
        # Then try to get the content from the default database
        try:
            port_content = PortContent.objects.get(port_name=port_name, country=country)
            serializer = PortContentSerializer(port_content)
            return Response(serializer.data)
        except PortContent.DoesNotExist:
            # If no content exists yet, return empty content
            return Response({
                "port_name": port_name,
                "country": country,
                "details": None,
                "policy_status": None,
                "last_updated": None
            })
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_all_port_contents(request):
    """
    Get all port contents.
    """
    try:
        port_contents = PortContent.objects.all()
        serializer = PortContentSerializer(port_contents, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['POST'])
def track_user_visit(request):
    """
    API endpoint for tracking user visits to the website.
    
    This endpoint accepts POST requests with user visit data and stores it in the database.
    It performs several validations and enrichments:
    1. Validates the page URL format
    2. Determines the real client IP address
    3. Identifies location and network information using IP-API
    4. Detects whether the request is from a bot
    5. Records device type information
    
    Only requests from the official domain are recorded.
    """
    # Create a copy of the data to avoid modifying the request directly
    data = request.data.copy()
    
    # Enhanced logging for debugging
    ip_address = get_real_client_ip(request)
    logging.info(f"Tracking request received from IP: {ip_address}")
    logging.debug(f"Tracking request data: {data}")
    
    try:
        # Add debug flag if requested
        debug_mode = request.GET.get('debug', 'false').lower() == 'true'
        
        # Get the serializer with the provided data
        serializer = UserTrackingSerializer(data=data)
        
        # Return early if validation fails
        if not serializer.is_valid():
            logging.warning(f"Invalid tracking data: {serializer.errors}")
            return Response(
                {"status": "error", "message": "Invalid tracking data", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Start building the tracking record
        tracking_data = serializer.validated_data.copy()
        
        # Get the real client IP
        tracking_data['ip_address'] = ip_address
        
        # Get current timestamp
        tracking_data['timestamp'] = datetime.now()
        
        # Process User-Agent string
        user_agent_string = tracking_data.get('user_agent', '')
        
        # Determine if the request is from a bot
        is_bot = False
        bot_agent = ""
        
        # List of common bot identifiers in user agent strings
        bot_identifiers = [
            'bot', 'crawl', 'spider', 'slurp', 'search', 'fetch', 'monitor', 
            'scrape', 'archive', 'indexer', 'validator', 'facebook', 'whatsapp',
            'telegram', 'slack', 'discord', 'googlebot', 'bingbot', 'yandexbot'
        ]
        
        # Check if user agent contains any bot identifiers
        if user_agent_string:
            ua_lower = user_agent_string.lower()
            for bot_id in bot_identifiers:
                if bot_id in ua_lower:
                    is_bot = True
                    bot_agent = user_agent_string
                    break
        
        tracking_data['is_bot'] = is_bot
        tracking_data['bot_agent'] = bot_agent
        
        # Determine device type if not provided
        if not tracking_data.get('device_type'):
            device_type = "Unknown"
            if user_agent_string:
                try:
                    # Parse the user agent string
                    ua = user_agents.parse(user_agent_string)
                    if ua.is_mobile:
                        device_type = "mobile"
                    elif ua.is_pc:
                        device_type = "desktop"
                    elif ua.is_tablet:
                        device_type = "mobile"  # Consider tablets as mobile devices
                except Exception as e:
                    logging.warning(f"Error parsing user agent: {e}")
            
            tracking_data['device_type'] = device_type
        
        # Get location and network information from IP-API directly - similar to test_ip_api
        if ip_address and ip_address != "Unknown":
            try:
                logging.info(f"Attempting IP lookup for tracking: {ip_address}")
                
                # Build the IP-API URL with the IP address - same as in test_ip_api
                api_url = settings.IP_API_URL.format(ip=ip_address)
                
                # Add fields parameter if specified in settings
                if hasattr(settings, 'IP_API_FIELDS') and settings.IP_API_FIELDS:
                    fields_param = ','.join(settings.IP_API_FIELDS)
                    api_url = f"{api_url}?fields={fields_param}"
                
                logging.info(f"IP-API URL for tracking: {api_url}")
                
                # Make the API request with increased timeout for reliability
                response = requests.get(api_url, timeout=5)
                
                # Log the raw response for debugging
                if response.status_code == 200:
                    ip_data = response.json()
                    logging.info(f"IP lookup successful. Raw response: {ip_data}")
                    
                    # Direct mapping of IP-API fields to tracking data fields
                    # Explicitly map each field to avoid any confusion
                    if ip_data.get('status') == 'success':
                        tracking_data['country'] = ip_data.get('country')
                        tracking_data['country_code'] = ip_data.get('countryCode')
                        tracking_data['region'] = ip_data.get('region')
                        tracking_data['region_name'] = ip_data.get('regionName')
                        tracking_data['city'] = ip_data.get('city')
                        tracking_data['zip_code'] = ip_data.get('zip')
                        tracking_data['latitude'] = ip_data.get('lat')
                        tracking_data['longitude'] = ip_data.get('lon')
                        tracking_data['timezone'] = ip_data.get('timezone')
                        tracking_data['isp'] = ip_data.get('isp')
                        tracking_data['org'] = ip_data.get('org')
                        tracking_data['as_number'] = ip_data.get('as')
                        
                        logging.info(f"Successfully mapped IP data fields for {ip_address}: Country={tracking_data.get('country', 'N/A')}, City={tracking_data.get('city', 'N/A')}")
                    else:
                        logging.warning(f"IP-API returned non-success status for {ip_address}: {ip_data}")
                else:
                    logging.warning(f"IP-API request failed with status {response.status_code}")
                    
            except requests.RequestException as e:
                logging.warning(f"IP-API request failed: {str(e)}")
            except Exception as e:
                logging.error(f"Unexpected error in IP lookup: {str(e)}", exc_info=True)
        else:
            logging.warning(f"IP address is missing or unknown, skipping geolocation: {ip_address}")
        
        # If in debug mode, return the data that would be saved instead of saving it
        if debug_mode:
            return Response({
                "status": "debug_mode",
                "message": "Data that would be saved (debug mode)",
                "tracking_data": tracking_data,
                "ip_address": ip_address,
                "note": "Record not saved because debug mode is enabled"
            })
        
        # Create and save the tracking record
        try:
            logging.info(f"Preparing to save tracking data with fields: {', '.join(tracking_data.keys())}")
            
            has_ip_data = any(field in tracking_data for field in 
                             ['country', 'city', 'isp', 'latitude', 'longitude'])
            logging.info(f"Has IP geolocation data: {has_ip_data}")
            
            # Verify all fields are in the model
            model_fields = [f.name for f in UserTracking._meta.get_fields()]
            unknown_fields = [k for k in tracking_data.keys() if k not in model_fields]
            if unknown_fields:
                logging.warning(f"Unknown fields being removed from tracking data: {unknown_fields}")
                for field in unknown_fields:
                    tracking_data.pop(field, None)
            
            # Create the record with error handling
            try:
                tracking_record = UserTracking.objects.create(**tracking_data)
                logging.info(f"Successfully saved tracking record ID: {tracking_record.id}")
                
                # Verify if geolocation fields were actually saved
                if has_ip_data:
                    saved_record = UserTracking.objects.get(id=tracking_record.id)
                    geo_data_saved = bool(saved_record.country or saved_record.city or saved_record.latitude)
                    logging.info(f"Geolocation data was {'successfully saved' if geo_data_saved else 'NOT saved'} to database")
                
                return Response({"status": "success", "record_id": tracking_record.id}, status=status.HTTP_201_CREATED)
            except Exception as e:
                logging.error(f"Initial save attempt failed: {str(e)}", exc_info=True)
                
                # Try again with minimal required fields, but include geolocation data
                logging.info("Retrying with minimal required fields plus geolocation")
                minimal_data = {
                    'ip_address': ip_address,
                    'timestamp': datetime.now(),
                    'device_type': tracking_data.get('device_type', 'Unknown'),
                    'is_bot': is_bot
                }
                
                for field in ['country', 'country_code', 'city', 'latitude', 'longitude']:
                    if field in tracking_data and tracking_data[field] is not None:
                        minimal_data[field] = tracking_data[field]
                
                tracking_record = UserTracking.objects.create(**minimal_data)
                logging.info(f"Successfully saved minimal tracking record ID: {tracking_record.id}")
                return Response(
                    {"status": "success", "message": "Saved with minimal data due to previous error", "record_id": tracking_record.id},
                    status=status.HTTP_201_CREATED
                )
        except Exception as e:
            logging.error(f"Error saving tracking data: {str(e)}", exc_info=True)
            return Response(
                {"status": "error", "message": f"Server error while recording tracking data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        # Catch-all for unexpected errors
        logging.error(f"Unexpected error in track_user_visit: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Unexpected server error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def test_ip_api(request, ip=None):
    """
    Test endpoint for IP-API integration.
    
    This endpoint accepts a GET request and attempts to query IP-API
    with the requester's IP address or a provided IP parameter.
    It returns the raw API response for debugging purposes.
    
    Ways to specify the IP to test:
    1. As part of the URL path: /api/v1/test-ip-api/8.8.8.8/
    2. As a query parameter: /api/v1/test-ip-api/?ip=8.8.8.8
    3. If none provided, the requester's IP is used
    """
    try:
        # Get the IP to test in this order:
        # 1. URL path parameter (ip)
        # 2. Query parameter (?ip=x.x.x.x)
        # 3. Requester's IP
        test_ip = ip or request.GET.get('ip') or get_real_client_ip(request)
            
        logging.info(f"Testing IP-API with IP: {test_ip}")
        
        # Build the IP-API URL
        api_url = settings.IP_API_URL.format(ip=test_ip)
        
        # Add fields parameter if specified in settings
        if hasattr(settings, 'IP_API_FIELDS') and settings.IP_API_FIELDS:
            fields_param = ','.join(settings.IP_API_FIELDS)
            api_url = f"{api_url}?fields={fields_param}"
        
        # Make the API request
        response = requests.get(api_url, timeout=5)
        
        # Return the raw response and additional information
        return Response({
            "status": "success",
            "requested_ip": test_ip,
            "api_url": api_url,
            "response_status_code": response.status_code,
            "ip_api_response": response.json(),
            "debug_info": {
                "backend_version": "1.0",
                "ip_api_fields_setting": settings.IP_API_FIELDS if hasattr(settings, 'IP_API_FIELDS') else None,
                "allowed_domains": settings.TRACKING_ALLOWED_DOMAINS if hasattr(settings, 'TRACKING_ALLOWED_DOMAINS') else None,
            }
        })
    except Exception as e:
        logging.error(f"Error testing IP-API: {str(e)}", exc_info=True)
        return Response({
            "status": "error",
            "message": str(e),
            "requested_ip": ip or request.GET.get('ip', get_real_client_ip(request)),
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def check_tracking_records(request):
    """
    Diagnostic endpoint to check if IP geolocation data is being saved correctly.
    
    This endpoint is for debugging purposes and shows a summary of recent tracking records
    with focus on IP-related fields. It helps verify that the IP-API data is being 
    correctly saved to the database.
    
    Query Parameters:
        limit (optional): Number of recent records to fetch. Default is 10.
    """
    try:
        # Get query parameters
        limit = int(request.GET.get('limit', 10))
        
        # Cap the limit to a reasonable number
        if limit > 50:
            limit = 50
            
        # Get the most recent tracking records
        records = UserTracking.objects.all().order_by('-timestamp')[:limit]
        
        # Prepare a summary of each record focusing on IP data
        records_summary = []
        for record in records:
            records_summary.append({
                'id': record.id,
                'timestamp': record.timestamp,
                'ip_address': record.ip_address,
                'ip_data_present': bool(record.country or record.city or record.isp),
                'country': record.country,
                'city': record.city,
                'isp': record.isp,
                'device_type': record.device_type,
                'is_bot': record.is_bot
            })
            
        # Calculate some statistics
        total_records = len(records_summary)
        records_with_ip_data = sum(1 for r in records_summary if r['ip_data_present'])
        
        return Response({
            'status': 'success',
            'stats': {
                'total_records_checked': total_records,
                'records_with_ip_data': records_with_ip_data,
                'percentage_with_ip_data': round(records_with_ip_data / total_records * 100 if total_records else 0, 1)
            },
            'records': records_summary
        })
    except Exception as e:
        logging.error(f"Error checking tracking records: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def debug_ip_tracking(request, ip=None):
    """
    Debug endpoint that tests the complete IP tracking workflow.
    
    This endpoint performs all the steps that would be done during a real tracking request:
    1. Gets an IP address (from URL path, query params, or the requester's IP)
    2. Queries IP-API for geolocation data
    3. Creates a test record in the database with the obtained data
    4. Verifies that the data was correctly saved
    5. Returns detailed information about each step for debugging
    
    This helps diagnose issues with the IP tracking feature.
    """
    try:
        debug_log = []
        debug_log.append("Starting IP tracking debug process")
        
        # Step 1: Get the IP address
        debug_log.append("Step 1: Determining IP address")
        test_ip = ip or request.GET.get('ip') or get_real_client_ip(request)
        debug_log.append(f"Using IP address: {test_ip}")
        
        # Step 2: Make the IP-API request
        debug_log.append("Step 2: Making IP-API request")
        ip_data = None
        api_url = None
        response_status = None
        error = None
        
        try:
            # Build the IP-API URL
            api_url = settings.IP_API_URL.format(ip=test_ip)
            
            # Add fields parameter if specified in settings
            if hasattr(settings, 'IP_API_FIELDS') and settings.IP_API_FIELDS:
                fields_param = ','.join(settings.IP_API_FIELDS)
                api_url = f"{api_url}?fields={fields_param}"
            
            debug_log.append(f"API URL: {api_url}")
            
            # Make the API request
            response = requests.get(api_url, timeout=5)
            response_status = response.status_code
            debug_log.append(f"API response status: {response_status}")
            
            if response_status == 200:
                ip_data = response.json()
                debug_log.append(f"API response data: {ip_data}")
            else:
                debug_log.append(f"API request failed with status {response_status}")
        except Exception as e:
            error = str(e)
            debug_log.append(f"Error making API request: {error}")
        
        # Step 3: Create a test tracking record
        debug_log.append("Step 3: Creating test tracking record")
        record_id = None
        
        if ip_data and ip_data.get('status') == 'success':
            try:
                # Prepare tracking data
                tracking_data = {
                    'ip_address': test_ip,
                    'timestamp': datetime.now(),
                    'user_agent': request.META.get('HTTP_USER_AGENT', 'Debug Test'),
                    'device_type': 'debug',
                    'page_url': 'https://northseawatch.org/debug-test',
                    'is_bot': False,
                    
                    # IP-API data
                    'country': ip_data.get('country'),
                    'country_code': ip_data.get('countryCode'),
                    'region': ip_data.get('region'),
                    'region_name': ip_data.get('regionName'),
                    'city': ip_data.get('city'),
                    'zip_code': ip_data.get('zip'),
                    'latitude': ip_data.get('lat'),
                    'longitude': ip_data.get('lon'),
                    'timezone': ip_data.get('timezone'),
                    'isp': ip_data.get('isp'),
                    'org': ip_data.get('org'),
                    'as_number': ip_data.get('as')
                }
                
                # List fields to be saved
                debug_log.append(f"Fields to be saved: {', '.join(tracking_data.keys())}")
                
                # Check for unknown fields
                model_fields = [f.name for f in UserTracking._meta.get_fields()]
                unknown_fields = [k for k in tracking_data.keys() if k not in model_fields]
                if unknown_fields:
                    debug_log.append(f"Warning: Unknown fields will be removed: {unknown_fields}")
                    for field in unknown_fields:
                        tracking_data.pop(field, None)
                
                # Create the record
                record = UserTracking.objects.create(**tracking_data)
                record_id = record.id
                debug_log.append(f"Test record created with ID: {record_id}")
            except Exception as e:
                debug_log.append(f"Error creating test record: {str(e)}")
                
                # Try with minimal data
                try:
                    debug_log.append("Attempting with minimal data")
                    minimal_data = {
                        'ip_address': test_ip,
                        'timestamp': datetime.now(),
                        'device_type': 'debug',
                        'is_bot': False
                    }
                    
                    # Add geolocation fields
                    for field in ['country', 'country_code', 'city']:
                        if field in tracking_data:
                            minimal_data[field] = tracking_data[field]
                    
                    record = UserTracking.objects.create(**minimal_data)
                    record_id = record.id
                    debug_log.append(f"Minimal test record created with ID: {record_id}")
                except Exception as e2:
                    debug_log.append(f"Error creating minimal test record: {str(e2)}")
        else:
            debug_log.append("Skipping record creation due to missing or invalid IP data")
        
        # Step 4: Verify saved data
        debug_log.append("Step 4: Verifying saved data")
        verification_result = "Not attempted"
        
        if record_id:
            try:
                saved_record = UserTracking.objects.get(id=record_id)
                verification = {
                    'id': saved_record.id,
                    'ip_address': saved_record.ip_address,
                    'has_country': bool(saved_record.country),
                    'country': saved_record.country,
                    'has_city': bool(saved_record.city),
                    'city': saved_record.city,
                    'has_coordinates': bool(saved_record.latitude and saved_record.longitude),
                    'latitude': saved_record.latitude,
                    'longitude': saved_record.longitude
                }
                verification_result = verification
                debug_log.append(f"Verification result: {verification}")
                
                # Check if geolocation data was saved correctly
                if saved_record.country != ip_data.get('country'):
                    debug_log.append(f"Warning: Country mismatch, expected '{ip_data.get('country')}', got '{saved_record.country}'")
                if saved_record.city != ip_data.get('city'):
                    debug_log.append(f"Warning: City mismatch, expected '{ip_data.get('city')}', got '{saved_record.city}'")
            except Exception as e:
                debug_log.append(f"Error verifying record: {str(e)}")
                verification_result = f"Error: {str(e)}"
        
        # Return comprehensive debug information
        return Response({
            'status': 'success',
            'debug_mode': True,
            'ip_address': test_ip,
            'api_url': api_url,
            'api_response_status': response_status,
            'ip_data_received': bool(ip_data and ip_data.get('status') == 'success'),
            'test_record_id': record_id,
            'verification': verification_result,
            'debug_log': debug_log,
            'error': error
        })
    except Exception as e:
        logging.error(f"Error in debug_ip_tracking: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': str(e),
            'debug_mode': True
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_scrubber_vessels(request):
    """
    Get all ships that have scrubber systems installed.
    This endpoint returns data from the icct_scrubber_march_2025 table.
    """
    try:
        # First, verify the table exists and get its structure
        table_info = {}
        with connections['ais_data'].cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_name = 'icct_scrubber_march_2025'
                );
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                logging.error("Table icct_scrubber_march_2025 does not exist in the database")
                return Response({
                    "error": "Configuration error: Table icct_scrubber_march_2025 not found",
                    "hint": "Please verify the table name and that the necessary migrations have been applied"
                }, status=500)
                
            # Get table columns
            cursor.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'icct_scrubber_march_2025'
                ORDER BY ordinal_position;
            """)
            
            columns = cursor.fetchall()
            table_info['columns'] = [{'name': col[0], 'type': col[1]} for col in columns]
            logging.info(f"Table structure: {table_info}")
            
            # Then fetch the actual data
            cursor.execute("""
                SELECT imo_number, sox_scrubber_status, sox_scrubber_1_technology_type 
                FROM icct_scrubber_march_2025
            """)
            
            results = []
            for row in cursor.fetchall():
                scrubber_data = {
                    'imo_number': row[0],
                    'sox_scrubber_status': row[1],
                    'sox_scrubber_1_technology_type': row[2]
                }
                results.append(scrubber_data)
        
        # Log the count for monitoring
        logging.info(f"Returning {len(results)} scrubber vessel records")
        return Response(results)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logging.error(f"Error in get_scrubber_vessels: {str(e)}\n{error_details}")
        return Response({
            "error": "Failed to fetch scrubber vessel data",
            "details": str(e),
            "trace": error_details if settings.DEBUG else "Enable DEBUG for detailed trace"
        }, status=500)

@api_view(['GET'])
def get_engine_data(request):
    """
    Get all ships that have engine data available.
    This endpoint returns data from the icct_wfr_combined table.
    """
    try:
        # First, verify the table exists and get its structure
        table_info = {}
        with connections['ais_data'].cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_name = 'icct_wfr_combined'
                );
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                logging.error("Table icct_wfr_combined does not exist in the database")
                return Response({
                    "error": "Configuration error: Table icct_wfr_combined not found",
                    "hint": "Please verify the table name and that the necessary migrations have been applied"
                }, status=500)
                
            # Get table columns
            cursor.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'icct_wfr_combined'
                ORDER BY ordinal_position;
            """)
            
            columns = cursor.fetchall()
            table_info['columns'] = [{'name': col[0], 'type': col[1]} for col in columns]
            logging.info(f"Table structure: {table_info}")
            
            # Then fetch the actual data
            cursor.execute("""
                SELECT imo_number
                FROM icct_wfr_combined
            """)
            
            results = []
            for row in cursor.fetchall():
                engine_data = {
                    'imo_number': row[0]
                }
                results.append(engine_data)
        
        # Log the count for monitoring
        logging.info(f"Returning {len(results)} engine data records")
        return Response(results)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logging.error(f"Error in get_engine_data: {str(e)}\n{error_details}")
        return Response({
            "error": "Failed to fetch engine data",
            "details": str(e),
            "trace": error_details if settings.DEBUG else "Enable DEBUG for detailed trace"
        }, status=500)

def get_available_tables(connection_name='ais_data'):
    """
    Helper function to get all tables in the database.
    Useful for diagnostics when table names are unknown.
    """
    tables = []
    try:
        with connections[connection_name].cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = [row[0] for row in cursor.fetchall()]
    except Exception as e:
        logging.error(f"Error getting available tables: {e}")
    return tables

@api_view(['GET'])
def debug_database_tables(request):
    """
    Debug endpoint to check database tables structure
    """
    try:
        # Get list of all application models
        app_models = [m for m in apps.get_app_config('north_sea_watch').get_models()]
        
        tables_info = {}
        
        # For each model, get table info
        for model in app_models:
            model_name = model.__name__
            
            # Get field information
            fields = []
            for field in model._meta.fields:
                field_info = {
                    'name': field.name,
                    'type': type(field).__name__,
                    'null': field.null,
                    'blank': field.blank,
                    'primary_key': field.primary_key,
                }
                fields.append(field_info)
            
            # Count records
            record_count = model.objects.count()
            
            # Get sample record (first one) if exists
            sample = None
            if record_count > 0:
                try:
                    first_obj = model.objects.first()
                    if first_obj:
                        sample = model_to_dict(first_obj)
                except Exception as e:
                    sample = f"Error getting sample: {str(e)}"
            
            tables_info[model_name] = {
                'table_name': model._meta.db_table,
                'fields': fields,
                'record_count': record_count,
                'sample_record': sample
            }
        
        # Get raw database info using connection
        with connection.cursor() as cursor:
            # Get list of tables
            if connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            elif connection.vendor == 'postgresql':
                cursor.execute("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';")
            elif connection.vendor == 'mysql':
                cursor.execute("SHOW TABLES;")
            else:
                return Response({
                    "message": "Database vendor not supported for raw table listing",
                    "tables_info": tables_info,
                    "db_vendor": connection.vendor
                })
                
            db_tables = [table[0] for table in cursor.fetchall()]
        
        return Response({
            "message": "Database tables information",
            "db_vendor": connection.vendor,
            "db_tables_raw": db_tables,
            "tables_info": tables_info
        })
    except Exception as e:
        logger.error(f"Error in debug_database_tables: {str(e)}")
        logger.error(traceback.format_exc())
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_past_scrubber_distribution(request):
    """
    Get scrubber vessel distribution data for a past time period.
    This endpoint returns position data of scrubber vessels grouped by time intervals.
    
    Query parameters:
    - time_value: integer value representing the amount of time to look back (default: 1)
    - time_unit: string enum (Hour, Day, Week, Month, Year) representing the time unit (default: Hour)
    - user_current_time: ISO format datetime string (optional, defaults to server's current time)
    
    The response contains scrubber vessel positions grouped by time intervals,
    suitable for creating time-based heatmaps or animations.
    """
    try:
        # Extract query parameters
        time_value = request.GET.get('time_value', '1')
        time_unit = request.GET.get('time_unit', 'Hour')
        user_current_time = request.GET.get('user_current_time', None)
        
        # Validate time_value
        try:
            time_value = int(time_value)
            if time_value <= 0:
                return Response({
                    "error": "time_value must be a positive integer",
                }, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({
                "error": "time_value must be a valid integer",
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate time_unit
        valid_time_units = ['Hour', 'Day', 'Week', 'Month', 'Year']
        if time_unit not in valid_time_units:
            return Response({
                "error": f"time_unit must be one of {', '.join(valid_time_units)}",
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Determine end time (user's current time or server time)
        if user_current_time:
            try:
                end_time = parse_datetime(user_current_time)
                if not end_time:
                    raise ValueError("Invalid datetime format")
                # Ensure timezone is set
                if not end_time.tzinfo:
                    end_time = end_time.replace(tzinfo=timezone.utc)
            except ValueError:
                return Response({
                    "error": "user_current_time must be a valid ISO format datetime string",
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            end_time = timezone.now()
        
        # Calculate start time based on time_value and time_unit
        # Use the requested time unit directly instead of converting
        actual_unit = time_unit.lower()
        
        # Skip the most recent period to ensure data completeness
        if time_unit == 'Hour':
            adjusted_end_time = end_time.replace(minute=0, second=0, microsecond=0)
            target_start_time = adjusted_end_time - timezone.timedelta(hours=time_value)
            
            grouping_format = "%Y-%m-%d %H:00:00"  # Group by hour
            group_by_sql = "date_trunc('hour', timestamp_ais)"
            interval_unit = "hour"
        elif time_unit == 'Day':
            adjusted_end_time = end_time.replace(hour=0, minute=0, second=0, microsecond=0)
            target_start_time = adjusted_end_time - timezone.timedelta(days=time_value)
            
            grouping_format = "%Y-%m-%d 00:00:00"  # Group by day
            group_by_sql = "date_trunc('day', timestamp_ais)"
            interval_unit = "day"
        elif time_unit == 'Week':
            # Define Week as exactly 7 days
            adjusted_end_time = end_time.replace(hour=0, minute=0, second=0, microsecond=0)
            # Adjust to the start of the week (Monday)
            weekday = adjusted_end_time.weekday()
            adjusted_end_time = adjusted_end_time - timezone.timedelta(days=weekday)
            target_start_time = adjusted_end_time - timezone.timedelta(weeks=time_value)
            
            grouping_format = "%Y-%m-%d 00:00:00"  # Group by week start date (Monday)
            group_by_sql = "date_trunc('week', timestamp_ais)"  # PostgreSQL's week starts on Monday
            interval_unit = "week"
        elif time_unit == 'Month':
            adjusted_end_time = end_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Calculate months back using a loop to handle variable month lengths
            target_start_time = adjusted_end_time
            for _ in range(time_value):
                # Go back one month at a time
                if target_start_time.month == 1:
                    target_start_time = target_start_time.replace(year=target_start_time.year-1, month=12)
                else:
                    target_start_time = target_start_time.replace(month=target_start_time.month-1)
            
            grouping_format = "%Y-%m-01 00:00:00"  # Group by month
            group_by_sql = "date_trunc('month', timestamp_ais)"  # PostgreSQL's date_trunc for month
            interval_unit = "month"
        else:  # Year
            adjusted_end_time = end_time.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Go back years
            target_start_time = adjusted_end_time.replace(year=adjusted_end_time.year - time_value)
            
            grouping_format = "%Y-%m-01 00:00:00"  # Group by month
            group_by_sql = "date_trunc('month', timestamp_ais)"
            interval_unit = "month"
        
        # Store the query target start time (before adjustment)
        original_target_start_time = target_start_time
        
        # Use adjusted end time instead of the original end time for the query
        end_time = adjusted_end_time
        
        # Find the earliest actual record date to handle incomplete early data
        earliest_record_time = None
        with connections['ais_data'].cursor() as cursor:
            try:
                cursor.execute("""
                    SELECT MIN(timestamp_ais) 
                    FROM ship_data 
                    WHERE timestamp_ais IS NOT NULL
                """)
                earliest_record = cursor.fetchone()
                if earliest_record and earliest_record[0]:
                    earliest_record_time = earliest_record[0]
                    if earliest_record_time.tzinfo is None:
                        earliest_record_time = earliest_record_time.replace(tzinfo=timezone.utc)
                    logging.info(f"Earliest record in database: {earliest_record_time.isoformat()}")
            except Exception as e:
                logging.error(f"Error finding earliest record: {str(e)}")
                # Continue without this optimization if it fails
        
        # Adjust the start time based on actual earliest data
        if earliest_record_time and earliest_record_time > target_start_time:
            logging.info(f"Target start time ({target_start_time.isoformat()}) is earlier than earliest record ({earliest_record_time.isoformat()})")
            
            # Adjust the start_time to the beginning of the next complete time unit
            if actual_unit == 'hour':
                # Start from the next complete hour
                start_time = earliest_record_time.replace(minute=0, second=0, microsecond=0)
                start_time = start_time + timezone.timedelta(hours=1)
            elif actual_unit == 'day':
                # Start from the next complete day
                start_time = earliest_record_time.replace(hour=0, minute=0, second=0, microsecond=0)
                start_time = start_time + timezone.timedelta(days=1)
            elif actual_unit == 'month':
                # Start from the next complete month
                if earliest_record_time.month == 12:
                    start_time = earliest_record_time.replace(
                        year=earliest_record_time.year + 1,
                        month=1,
                        day=1,
                        hour=0, 
                        minute=0, 
                        second=0, 
                        microsecond=0
                    )
                else:
                    start_time = earliest_record_time.replace(
                        month=earliest_record_time.month + 1,
                        day=1,
                        hour=0, 
                        minute=0, 
                        second=0, 
                        microsecond=0
                    )
            else:
                # Default case - use earliest record time
                start_time = earliest_record_time
            
            logging.info(f"Adjusted start time to next complete {actual_unit}: {start_time.isoformat()}")
        else:
            # Use the target start time if no adjustment needed
            start_time = target_start_time
            
        # Log the query parameters for debugging
        logging.info(f"Past scrubber distribution query: time_value={time_value}, time_unit={time_unit}, actual_unit={actual_unit}")
        logging.info(f"Original target start time: {original_target_start_time.isoformat()}")
        logging.info(f"Final time range after adjustments: {start_time.isoformat()} to {end_time.isoformat()}")
        
        # First, get the list of scrubber vessel IMO numbers
        scrubber_vessels = []
        with connections['ais_data'].cursor() as cursor:
            try:
                # Get all scrubber vessels from the specialized table
                cursor.execute("""
                    SELECT DISTINCT imo_number 
                    FROM icct_scrubber_march_2025
                    WHERE imo_number IS NOT NULL
                    AND sox_scrubber_status IS NOT NULL
                    AND sox_scrubber_status != 'Not installed'
                """)
                
                # Get all IMO numbers from the scrubber table
                scrubber_table_imos = [str(row[0]) for row in cursor.fetchall()]
                logging.info(f"Found {len(scrubber_table_imos)} vessels in scrubber table")
                
                if scrubber_table_imos:
                    # Convert to a list suitable for SQL IN clause
                    imo_list_str = ','.join([f"'{imo}'" for imo in scrubber_table_imos])
                    
                    # Filter for active vessels during the time range
                    query = f"""
                        SELECT DISTINCT imo_number 
                        FROM ship_data 
                        WHERE imo_number IS NOT NULL
                        AND timestamp_ais >= %s
                        AND timestamp_ais < %s
                        AND imo_number IN ({imo_list_str})
                    """
                    
                    cursor.execute(query, [start_time, end_time])
                    
                    # Get active IMOs during the time period
                    active_scrubber_imos = [str(row[0]) for row in cursor.fetchall()]
                    logging.info(f"Found {len(active_scrubber_imos)} active scrubber vessels in the selected time period")
                    
                    # Use active IMOs if available, otherwise fall back to all scrubber IMOs
                    if active_scrubber_imos:
                        scrubber_vessels = active_scrubber_imos
                    else:
                        scrubber_vessels = scrubber_table_imos
                else:
                    # Fallback to a more general approach - all vessels in the time period
                    logging.warning("No vessels found in scrubber table, using fallback method")
                    cursor.execute("""
                        SELECT DISTINCT imo_number 
                        FROM ship_data 
                        WHERE imo_number IS NOT NULL
                        AND timestamp_ais >= %s
                        AND timestamp_ais < %s
                    """, [start_time, end_time])
                    
                    scrubber_vessels = [str(row[0]) for row in cursor.fetchall()]
                    logging.info(f"Found {len(scrubber_vessels)} vessels using fallback method")
                
            except Exception as e:
                # If there's an error with the specialized table, use a direct query to ship_data
                logging.error(f"Error querying scrubber table: {str(e)}")
                logging.warning("Using direct ship_data query due to error")
                
                cursor.execute("""
                    SELECT DISTINCT imo_number 
                    FROM ship_data 
                    WHERE imo_number IS NOT NULL
                    AND timestamp_ais >= %s
                    AND timestamp_ais < %s
                """, [start_time, end_time])
                
                scrubber_vessels = [str(row[0]) for row in cursor.fetchall()]
                logging.info(f"Found {len(scrubber_vessels)} vessels using error fallback method")
            
            if not scrubber_vessels:
                logging.warning("No vessels found matching the criteria for the specified time period")
                return Response({
                    "status": "no_data",
                    "message": "No vessels found matching the criteria for the specified time period",
                    "time_groups": [],
                    "query_params": {
                        "time_value": time_value,
                        "time_unit": time_unit,
                        "actual_unit": actual_unit,
                        "target_start_time": original_target_start_time.isoformat(),
                        "adjusted_start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "data_availability": {
                            "earliest_record": earliest_record_time.isoformat() if earliest_record_time else None,
                            "start_adjusted": earliest_record_time > original_target_start_time if earliest_record_time else False
                        }
                    }
                }, status=status.HTTP_404_NOT_FOUND)
        
        if not scrubber_vessels:
            logging.warning("No scrubber vessels found in the database")
            return Response({
                "message": "No scrubber vessels found in the database",
                "time_groups": [],
                "query_params": {
                    "time_value": time_value,
                    "time_unit": time_unit,
                    "actual_unit": actual_unit,
                    "target_start_time": original_target_start_time.isoformat(),
                    "adjusted_start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "data_availability": {
                        "earliest_record": earliest_record_time.isoformat() if earliest_record_time else None,
                        "start_adjusted": earliest_record_time > original_target_start_time if earliest_record_time else False
                    }
                }
            })
        
        logging.info(f"Found {len(scrubber_vessels)} scrubber vessels")
        
        # Format the list of IMO numbers for SQL IN clause
        imo_list = "', '".join(scrubber_vessels)
        
        # Check if the database is using PostgreSQL
        db_engine = connections['ais_data'].vendor
        
        # Adjust SQL for different database engines
        if db_engine == 'postgresql':
            # PostgreSQL query - using date_trunc and parameterized query
            # Use placeholders for the IN clause to prevent SQL injection
            int_imo_numbers = [int(imo) for imo in scrubber_vessels if imo.isdigit()]
            logging.info(f"Original IMO numbers: {scrubber_vessels}")
            logging.info(f"Converted to integer IMO numbers: {int_imo_numbers}")
            logging.info(f"Time range for query: {start_time} to {end_time}")
            
            if not int_imo_numbers:
                logging.warning("No valid IMO numbers for query - all IMOs failed integer conversion")
                return Response({
                    "message": "No valid IMO numbers found for query",
                    "time_groups": [],
                    "query_params": {
                        "time_value": time_value,
                        "time_unit": time_unit,
                        "actual_unit": actual_unit,
                        "target_start_time": original_target_start_time.isoformat(),
                        "adjusted_start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "data_availability": {
                            "earliest_record": earliest_record_time.isoformat() if earliest_record_time else None,
                            "start_adjusted": earliest_record_time > original_target_start_time if earliest_record_time else False
                        }
                    }
                })
            
            placeholder_str = ','.join(['%s'] * len(int_imo_numbers))
            
            # Modify the query based on time_unit to address the inconsistency between hour/day granularity
            if time_unit in ['Week', 'Month', 'Year']:
                # For Week, Month, Year: First collect all data points, then group by the proper interval
                
                # Log the SQL parameters
                logging.info(f"SQL params for time intervals: start={start_time}, end={end_time}, interval_unit={interval_unit}")
                
                time_groups_query = f"""
                    WITH all_time_intervals AS (
                        SELECT 
                            time_series as interval_start,
                            time_series + interval '1 {interval_unit}' as interval_end
                        FROM generate_series(
                            %s::timestamp, 
                            %s::timestamp - interval '1 {interval_unit}', 
                            interval '1 {interval_unit}'
                        ) AS time_series
                    ),
                    vessel_positions AS (
                        SELECT 
                            {group_by_sql} as time_group,
                            imo_number,
                            latitude,
                            longitude
                        FROM ship_data
                        WHERE 
                            timestamp_ais >= %s AND 
                            timestamp_ais < %s AND
                            imo_number IN ({placeholder_str})
                    )
                    SELECT 
                        ti.interval_start,
                        ti.interval_end,
                        vp.imo_number,
                        vp.latitude,
                        vp.longitude
                    FROM all_time_intervals ti
                    LEFT JOIN vessel_positions vp ON 
                        vp.time_group >= ti.interval_start AND 
                        vp.time_group < ti.interval_end
                    WHERE vp.imo_number IS NOT NULL
                    ORDER BY ti.interval_start, vp.imo_number
                """
                # Create parameters for this query
                query_params = [start_time, end_time, start_time, end_time] + int_imo_numbers
                
                # Log the expected number of time intervals that should be generated
                if interval_unit == 'day':
                    days_diff = (end_time - start_time).days
                    logging.info(f"Expected {days_diff} day intervals between {start_time} and {end_time}")
                elif interval_unit == 'week':
                    weeks_diff = (end_time - start_time).days // 7
                    logging.info(f"Expected {weeks_diff} week intervals between {start_time} and {end_time}")
                elif interval_unit == 'month':
                    month_diff = (end_time.year - start_time.year) * 12 + end_time.month - start_time.month
                    logging.info(f"Expected {month_diff} month intervals between {start_time} and {end_time}")
            else:
                # Original query for Hour and Day granularity
                time_groups_query = f"""
                    WITH time_groups AS (
                        SELECT 
                            {group_by_sql} as interval_start,
                            {group_by_sql} + interval '1 {interval_unit}' as interval_end
                        FROM ship_data
                        WHERE 
                            timestamp_ais >= %s AND 
                            timestamp_ais < %s AND
                            imo_number IN ({placeholder_str})
                        GROUP BY {group_by_sql}
                        ORDER BY interval_start
                    )
                    SELECT 
                        tg.interval_start,
                        tg.interval_end,
                        sd.imo_number,
                        sd.latitude,
                        sd.longitude
                    FROM time_groups tg
                    JOIN ship_data sd ON 
                        sd.timestamp_ais >= tg.interval_start AND 
                        sd.timestamp_ais < tg.interval_end AND
                        sd.imo_number IN ({placeholder_str})
                    ORDER BY tg.interval_start, sd.imo_number
                """
                # Create parameters list with start_time, end_time, and IMO numbers (twice)
                query_params = [start_time, end_time] + int_imo_numbers + int_imo_numbers
        else:
            # Generic fallback for other database engines - simplified query
            # Use placeholders for the IN clause to prevent SQL injection
            # Convert IMO numbers to integers since they appear to be stored as numbers in the database
            int_imo_numbers = [int(imo) for imo in scrubber_vessels if imo.isdigit()]
            logging.info(f"Original IMO numbers: {scrubber_vessels}")
            logging.info(f"Converted to integer IMO numbers: {int_imo_numbers}")
            logging.info(f"Time range for query: {start_time} to {end_time}")
            
            if not int_imo_numbers:
                logging.warning("No valid IMO numbers for query - all IMOs failed integer conversion")
                return Response({
                    "message": "No valid IMO numbers found for query",
                    "time_groups": [],
                    "query_params": {
                        "time_value": time_value,
                        "time_unit": time_unit,
                        "actual_unit": actual_unit,
                        "target_start_time": original_target_start_time.isoformat(),
                        "adjusted_start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "data_availability": {
                            "earliest_record": earliest_record_time.isoformat() if earliest_record_time else None,
                            "start_adjusted": earliest_record_time > original_target_start_time if earliest_record_time else False
                        }
                    }
                })
                
            placeholder_str = ','.join(['%s'] * len(int_imo_numbers))
            time_groups_query = f"""
                SELECT 
                    timestamp_ais,
                    imo_number,
                    latitude,
                    longitude
                FROM ship_data
                WHERE 
                    timestamp_ais >= %s AND 
                    timestamp_ais < %s AND
                    imo_number IN ({placeholder_str})
                ORDER BY timestamp_ais, imo_number
            """
            # Create parameters list with start_time, end_time, and IMO numbers
            query_params = [start_time, end_time] + int_imo_numbers
        
        # Query ship positions within the time range, grouped by time interval
        result_groups = []
        
        with connections['ais_data'].cursor() as cursor:
            if db_engine == 'postgresql':
                cursor.execute(time_groups_query, query_params)
                
                # Process results into time-grouped format
                current_group = None
                current_positions = []
                
                for row in cursor.fetchall():
                    interval_start = row[0]
                    interval_end = row[1]
                    imo_number = row[2]
                    latitude = row[3]
                    longitude = row[4]
                    
                    # Skip null results that might come from LEFT JOIN
                    if imo_number is None:
                        continue
                    
                    # Convert datetime to string in the specified format
                    interval_start_str = interval_start.strftime(grouping_format)
                    interval_end_str = interval_end.strftime(grouping_format)
                    
                    if current_group is None or current_group['interval_start'] != interval_start_str:
                        # Add the previous group to results if it exists
                        if current_group is not None:
                            current_group['positions'] = current_positions
                            result_groups.append(current_group)
                        
                        # Start a new group
                        current_group = {
                            'interval_start': interval_start_str,
                            'interval_end': interval_end_str,
                            'positions': []
                        }
                        current_positions = []
                    
                    # Add the position to the current group
                    current_positions.append({
                        'imo_number': imo_number,
                        'latitude': latitude,
                        'longitude': longitude
                    })
                
                # Add the last group
                if current_group is not None:
                    current_group['positions'] = current_positions
                    result_groups.append(current_group)
            else:
                # Non-PostgreSQL databases - group data in Python
                cursor.execute(time_groups_query, query_params)
                
                all_records = cursor.fetchall()
                
                # Group data by time intervals in Python
                if time_unit == 'Hour':
                    # Group by hour
                    time_format = "%Y-%m-%d %H:00:00"
                    interval_seconds = 3600  # 1 hour in seconds
                elif time_unit == 'Day':
                    # Group by day
                    time_format = "%Y-%m-%d 00:00:00"
                    interval_seconds = 86400  # 1 day in seconds
                elif time_unit == 'Week':
                    # Group by week
                    time_format = "%Y-%m-%d 00:00:00"  # Use Monday as week start
                    interval_seconds = 604800  # 7 days in seconds
                elif time_unit == 'Month':
                    # Group by month
                    time_format = "%Y-%m-01 00:00:00"  # First day of month
                    interval_seconds = 2592000  # 30 days in seconds (approximate month)
                else:  # Year
                    # Group by month for Year
                    time_format = "%Y-%m-01 00:00:00"
                    interval_seconds = 2592000  # 30 days in seconds (approximate month)
                
                groups_by_interval = {}
                
                for row in all_records:
                    timestamp = row[0]
                    imo_number = row[1]
                    latitude = row[2]
                    longitude = row[3]
                    
                    # Format the timestamp for grouping
                    interval_start_str = timestamp.strftime(time_format)
                    
                    # Calculate interval end
                    interval_end = timestamp + timezone.timedelta(seconds=interval_seconds)
                    interval_end_str = interval_end.strftime(time_format)
                    
                    # Create group if it doesn't exist
                    if interval_start_str not in groups_by_interval:
                        groups_by_interval[interval_start_str] = {
                            'interval_start': interval_start_str,
                            'interval_end': interval_end_str,
                            'positions': []
                        }
                    
                    # Add position to group
                    groups_by_interval[interval_start_str]['positions'].append({
                        'imo_number': imo_number,
                        'latitude': latitude,
                        'longitude': longitude
                    })
                
                # Convert groups dictionary to list and sort by interval start
                for interval_start in sorted(groups_by_interval.keys()):
                    result_groups.append(groups_by_interval[interval_start])
        
        # Count unique vessels in each time group for both database engines
        for group in result_groups:
            # Extract the unique IMO numbers in this time group
            unique_imos = set(position['imo_number'] for position in group['positions'])
            # Add the count as a new field
            group['vessel_count'] = len(unique_imos)
        
        # Calculate total unique vessels across all time groups (without double counting)
        all_unique_imos = set()
        for group in result_groups:
            for position in group['positions']:
                all_unique_imos.add(position['imo_number'])
        
        # Log the results summary
        logging.info(f"Returning {len(result_groups)} time groups with {sum(len(g['positions']) for g in result_groups)} total positions")
        logging.info(f"Unique vessels per time group: {[g['vessel_count'] for g in result_groups]}")
        logging.info(f"Total unique vessels across all time periods: {len(all_unique_imos)}")
        
        return Response({
            "time_groups": result_groups,
            "query_params": {
                "time_value": time_value,
                "time_unit": time_unit,
                "actual_unit": actual_unit,
                "target_start_time": original_target_start_time.isoformat(),
                "adjusted_start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "data_availability": {
                    "earliest_record": earliest_record_time.isoformat() if earliest_record_time else None,
                    "start_adjusted": earliest_record_time > original_target_start_time if earliest_record_time else False
                }
            }
        })
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logging.error(f"Error in get_past_scrubber_distribution: {str(e)}\n{error_details}")
        
        if settings.DEBUG:
            error_response = {
                "error": "Failed to fetch past scrubber distribution data",
                "details": str(e),
                "trace": error_details
            }
        else:
            error_response = {
                "error": "Failed to fetch past scrubber distribution data",
                "message": "An internal server error occurred. Please try again later."
            }
        
        return Response(error_response, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
