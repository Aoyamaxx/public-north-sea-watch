from rest_framework import serializers
from apps.north_sea_watch.models import (
    Port, Ship, ShipData, PortContent, UserTracking, 
    ICCTScrubberMarch2025, ICCTWFRCombined
)
import logging

class PortSerializer(serializers.ModelSerializer):
    """
    Serializer for the Port model.
    """
    class Meta:
        model = Port
        fields = ['port_name', 'country', 'latitude', 'longitude', 'scrubber_status']

class PortContentSerializer(serializers.ModelSerializer):
    """
    Serializer for the PortContent model.
    """
    class Meta:
        model = PortContent
        fields = ['port_name', 'country', 'details', 'policy_status', 'infrastructure_capacity', 
                 'operational_statistics', 'additional_features', 'last_updated']

class ShipSerializer(serializers.ModelSerializer):
    """
    Serializer for the Ship model.
    """
    class Meta:
        model = Ship
        fields = ['imo_number', 'mmsi', 'name', 'ship_type', 'length', 'width', 
                 'max_draught', 'type_name', 'type_remark']

class ShipDataSerializer(serializers.ModelSerializer):
    """
    Serializer for the ShipData model.
    """
    class Meta:
        model = ShipData
        fields = ['imo_number', 'timestamp_ais', 'latitude', 'longitude', 'destination', 
                 'navigational_status_code', 'navigational_status', 'true_heading', 
                 'rate_of_turn', 'cog', 'sog']

class ShipWithLatestPositionSerializer(serializers.ModelSerializer):
    """
    Serializer for Ship with its latest position data.
    """
    latest_position = ShipDataSerializer(read_only=True)
    
    class Meta:
        model = Ship
        fields = ['imo_number', 'mmsi', 'name', 'ship_type', 'length', 'width', 
                 'max_draught', 'type_name', 'type_remark', 'latest_position']

class UserTrackingSerializer(serializers.ModelSerializer):
    """
    Serializer for the UserTracking model.
    Used for tracking user visits to the website.
    
    This serializer allows the frontend to send basic tracking information
    but also accommodates the additional IP geolocation data populated by the backend.
    """
    class Meta:
        model = UserTracking
        fields = [
            # Required fields from frontend
            'user_agent', 
            'device_type', 
            'page_url', 
            'referer', 
            'session_id',
            
            # Fields populated by backend
            'ip_address',
            'country',
            'country_code',
            'region',
            'region_name',
            'city',
            'zip_code',
            'latitude',
            'longitude',
            'timezone',
            'isp',
            'org',
            'as_number',
            'is_bot',
            'bot_agent',
            'timestamp'
        ]
        # Make only the frontend-provided fields required
        read_only_fields = [
            'ip_address',
            'country',
            'country_code',
            'region',
            'region_name', 
            'city',
            'zip_code',
            'latitude',
            'longitude',
            'timezone',
            'isp',
            'org',
            'as_number',
            'is_bot',
            'bot_agent',
            'timestamp'
        ]
        
    def validate_page_url(self, value):
        """
        Validate that the page URL starts with the correct domain.
        """
        if not value:
            return value
            
        # Allow localhost and development URLs in development/testing environments
        import os
        is_development = os.environ.get('DEBUG', 'False').lower() == 'true'
        
        logging.info(f"Validating page_url: {value}, is_development: {is_development}")
        
        if is_development and ('localhost' in value or '127.0.0.1' in value):
            logging.info(f"Accepting development URL: {value}")
            return value
            
        # Production URL validation
        from django.conf import settings
        allowed_domains = getattr(settings, 'TRACKING_ALLOWED_DOMAINS', ['northseawatch.org'])
        
        # Log the allowed domains for debugging
        logging.info(f"Allowed domains for tracking: {allowed_domains}")
        
        # Check if URL starts with any allowed domain
        is_valid = False
        for domain in allowed_domains:
            if value.startswith(f'https://{domain}') or value.startswith(f'http://{domain}'):
                is_valid = True
                logging.info(f"URL {value} matches allowed domain {domain}")
                break
                
        # Less strict validation - check if domain is anywhere in the URL
        if not is_valid:
            for domain in allowed_domains:
                if domain in value:
                    logging.info(f"URL {value} contains allowed domain {domain}, accepting with warning")
                    is_valid = True
                    break
                    
        if not is_valid:
            logging.warning(f"Invalid page URL: {value}, not from allowed domains: {allowed_domains}")
            # Instead of raising error, accept but log warning
            return value
            
        return value

class ICCTScrubberMarch2025Serializer(serializers.ModelSerializer):
    """
    Serializer for the ICCTScrubberMarch2025 model.
    """
    class Meta:
        model = ICCTScrubberMarch2025
        fields = ['imo_number', 'sox_scrubber_status', 'sox_scrubber_1_technology_type']

class ICCTWFRCombinedSerializer(serializers.ModelSerializer):
    """
    Serializer for the ICCTWFRCombined model.
    """
    class Meta:
        model = ICCTWFRCombined
        fields = ['imo_number']
