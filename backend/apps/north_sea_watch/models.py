from django.db import models
from ckeditor.fields import RichTextField

class Port(models.Model):
    """
    Model representing a port from the ais_data_collection database.
    This is a proxy model that maps to the existing 'ports' table.
    """
    port_name = models.CharField(max_length=255, primary_key=True)
    country = models.CharField(max_length=3)
    latitude = models.FloatField()
    longitude = models.FloatField()
    scrubber_status = models.BigIntegerField(null=True, blank=True)

    class Meta:
        managed = False  # Django won't create or modify this table
        db_table = 'ports'  # The actual table name in the database
        app_label = 'north_sea_watch'
        
    def __str__(self):
        return f"{self.port_name} ({self.country})"

class PortContent(models.Model):
    """
    Model for storing custom content for ports.
    This model is stored in the default database (backend).
    """
    port_name = models.CharField(max_length=255, primary_key=True)
    country = models.CharField(max_length=3)
    details = RichTextField(blank=True, null=True)
    policy_status = RichTextField(blank=True, null=True)
    infrastructure_capacity = RichTextField(blank=True, null=True)
    operational_statistics = RichTextField(blank=True, null=True)
    additional_features = RichTextField(blank=True, null=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'port_content'
        app_label = 'north_sea_watch'
        verbose_name = 'Port Content'
        verbose_name_plural = 'Port Contents'
        
    def __str__(self):
        return f"{self.port_name} ({self.country}) Content"

class Ship(models.Model):
    """
    Model representing a ship from the ais_data_collection database.
    Maps to the existing 'ships' table.
    """
    imo_number = models.CharField(max_length=20, primary_key=True)
    mmsi = models.CharField(max_length=20, null=True, blank=True)
    name = models.CharField(max_length=255)
    ship_type = models.IntegerField(null=True, blank=True)
    length = models.FloatField(null=True, blank=True)
    width = models.FloatField(null=True, blank=True)
    max_draught = models.FloatField(null=True, blank=True)
    type_name = models.CharField(max_length=255, null=True, blank=True)
    type_remark = models.CharField(max_length=255, null=True, blank=True)
    
    # Pre-calculated scrubber water discharge rates for different operation modes (kg/h)
    # Only calculated for scrubber vessels, NULL for non-scrubber vessels
    emission_berth = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    emission_anchor = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    emission_maneuver = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    emission_cruise = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        managed = False  # Django won't create or modify this table (restored after migration)
        db_table = 'ships'  # The actual table name in the database
        app_label = 'north_sea_watch'
        
    def __str__(self):
        return f"{self.name} (IMO: {self.imo_number})"

class ShipData(models.Model):
    """
    Model representing ship position data from the ais_data_collection database.
    Maps to the existing 'ship_data' table.
    """
    id = models.AutoField(primary_key=True)
    imo_number = models.CharField(max_length=20)
    timestamp_ais = models.DateTimeField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    destination = models.CharField(max_length=255, null=True, blank=True)
    navigational_status_code = models.IntegerField(null=True, blank=True)
    navigational_status = models.CharField(max_length=100, null=True, blank=True)
    true_heading = models.FloatField(null=True, blank=True)
    rate_of_turn = models.FloatField(null=True, blank=True)
    cog = models.FloatField(null=True, blank=True)
    sog = models.FloatField(null=True, blank=True)

    class Meta:
        managed = False  # Django won't create or modify this table
        db_table = 'ship_data'  # The actual table name in the database
        app_label = 'north_sea_watch'
        indexes = [
            models.Index(fields=['imo_number']),
            models.Index(fields=['timestamp_ais']),
        ]
        
    def __str__(self):
        return f"Ship data for IMO {self.imo_number} at {self.timestamp_ais}"

class UserTracking(models.Model):
    """
    Model for tracking user visits to the website.
    This model is stored in the default database (backend).
    """
    ip_address = models.CharField(max_length=45, blank=True, null=True)
    
    # IP-API fields - following the exact order of the API response
    country = models.CharField(max_length=100, blank=True, null=True)
    country_code = models.CharField(max_length=10, blank=True, null=True)
    region = models.CharField(max_length=100, blank=True, null=True)
    region_name = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    timezone = models.CharField(max_length=100, blank=True, null=True)
    isp = models.CharField(max_length=255, blank=True, null=True)
    org = models.CharField(max_length=255, blank=True, null=True)
    as_number = models.CharField(max_length=255, blank=True, null=True)
    
    user_agent = models.TextField(blank=True, null=True)
    device_type = models.CharField(max_length=20, blank=True, null=True)
    timestamp = models.DateTimeField(blank=True, null=True)
    page_url = models.URLField(max_length=255, blank=True, null=True)
    referer = models.URLField(max_length=255, blank=True, null=True)
    session_id = models.CharField(max_length=100, blank=True, null=True)
    is_bot = models.BooleanField(default=False)
    bot_agent = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'user_tracking'
        app_label = 'north_sea_watch'
        verbose_name = 'User Tracking'
        verbose_name_plural = 'User Tracking'
        ordering = ['-timestamp']
        
    def __str__(self):
        return f"Visit from {self.ip_address or 'Unknown'} at {self.timestamp or 'Unknown'}"

class ICCTScrubberMarch2025(models.Model):
    """
    Model representing scrubber vessel data from the ais_data_collection database.
    Maps to the existing 'icct_scrubber_march_2025' table.
    """
    id = models.AutoField(primary_key=True)
    imo_number = models.CharField(max_length=20)
    sox_scrubber_status = models.CharField(max_length=255, null=True, blank=True)
    sox_scrubber_1_technology_type = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        managed = False  # Django won't create or modify this table
        db_table = 'icct_scrubber_march_2025'  # The actual table name in the database
        app_label = 'north_sea_watch'
        
    def __str__(self):
        return f"Scrubber data for IMO {self.imo_number}"

class ICCTWFRCombined(models.Model):
    """
    Model representing engine and scrubber data from the ais_data_collection database.
    Maps to the existing 'icct_wfr_combined' table.
    """
    imo_number = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=100, null=True, blank=True)
    sox_scrubber_1_technology_type = models.CharField(max_length=100, null=True, blank=True)
    sox_scrubber_1_retrofit_date = models.CharField(max_length=50, null=True, blank=True)
    sox_scrubber_status = models.CharField(max_length=100, null=True, blank=True)
    type = models.CharField(max_length=100, null=True, blank=True)
    built = models.CharField(max_length=10, null=True, blank=True)
    status_wfr = models.CharField(max_length=100, null=True, blank=True)
    company = models.CharField(max_length=255, null=True, blank=True)
    group_company = models.CharField(max_length=255, null=True, blank=True)
    operator = models.CharField(max_length=255, null=True, blank=True)
    builder = models.CharField(max_length=255, null=True, blank=True)
    flag_state = models.CharField(max_length=100, null=True, blank=True)
    sox_scrubber_status_wfr = models.CharField(max_length=100, null=True, blank=True)
    power_type = models.CharField(max_length=100, null=True, blank=True)
    current_global_zone = models.CharField(max_length=100, null=True, blank=True)
    current_national_waters = models.CharField(max_length=100, null=True, blank=True)
    name_wfr = models.CharField(max_length=255, null=True, blank=True)
    
    class Meta:
        managed = False  # Django won't create or modify this table
        db_table = 'icct_wfr_combined'  # The actual table name in the database
        app_label = 'north_sea_watch'
        
    def __str__(self):
        return f"Scrubber data for IMO {self.imo_number}"
