from django.contrib import admin
from django.db import connections
from django.core.exceptions import ValidationError
from django.forms import ModelForm
from .models import PortContent, Port, UserTracking

class PortContentForm(ModelForm):
    """
    Custom form for PortContent model.
    """
    class Meta:
        model = PortContent
        fields = '__all__'
        labels = {
            'policy_status': 'Policy Status',
        }
    
    def clean(self):
        """
        Validate port name and country code existence and match
        """
        cleaned_data = super().clean()
        port_name = cleaned_data.get('port_name')
        country = cleaned_data.get('country')
        
        if port_name and country:
            # Check if port exists
            try:
                port = Port.objects.using('ais_data').get(port_name=port_name)
                # Check if country code matches
                if port.country != country:
                    raise ValidationError(
                        f"Country code does not match. The correct country code for port '{port_name}' is '{port.country}', not '{country}'."
                    )
            except Port.DoesNotExist:
                # Check if any port uses this country code
                country_ports = Port.objects.using('ais_data').filter(country=country)
                if country_ports.exists():
                    port_names = ", ".join([p.port_name for p in country_ports[:5]])
                    more_text = " etc" if country_ports.count() > 5 else ""
                    raise ValidationError(
                        f"Port '{port_name}' does not exist. The valid ports for country code '{country}' include: {port_names}{more_text}."
                    )
                else:
                    raise ValidationError(
                        f"Port '{port_name}' and country code '{country}' do not exist in the database. Please check your input."
                    )
        
        return cleaned_data

class PortContentAdmin(admin.ModelAdmin):
    """
    Admin interface for PortContent model.
    """
    form = PortContentForm
    list_display = ('port_name', 'country', 'has_details', 'has_policy', 'has_infrastructure', 
                   'has_operational', 'has_additional', 'last_updated')
    list_filter = ('country', 'last_updated')
    search_fields = ('port_name', 'country')
    readonly_fields = ('last_updated',)
    
    fieldsets = (
        (None, {
            'fields': ('port_name', 'country')
        }),
        ('Content', {
            'fields': ('details', 'policy_status', 'infrastructure_capacity', 
                      'operational_statistics', 'additional_features')
        }),
        ('Metadata', {
            'fields': ('last_updated',),
            'classes': ('collapse',)
        }),
    )
    
    def has_details(self, obj):
        """
        Check if the port has details content.
        """
        return bool(obj.details)
    has_details.boolean = True
    has_details.short_description = 'Has Details'
    
    def has_policy(self, obj):
        """
        Check if the port has policy status content.
        """
        return bool(obj.policy_status)
    has_policy.boolean = True
    has_policy.short_description = 'Has Policy Status'
    
    def has_infrastructure(self, obj):
        """
        Check if the port has infrastructure and capacity content.
        """
        return bool(obj.infrastructure_capacity)
    has_infrastructure.boolean = True
    has_infrastructure.short_description = 'Has Infrastructure'
    
    def has_operational(self, obj):
        """
        Check if the port has operational statistics content.
        """
        return bool(obj.operational_statistics)
    has_operational.boolean = True
    has_operational.short_description = 'Has Operational Stats'
    
    def has_additional(self, obj):
        """
        Check if the port has additional features content.
        """
        return bool(obj.additional_features)
    has_additional.boolean = True
    has_additional.short_description = 'Has Additional'
    
    def get_form(self, request, obj=None, **kwargs):
        """
        Add port selection dropdown for new port content.
        """
        form = super().get_form(request, obj, **kwargs)
        if obj is None:  # Only for new objects
            # Get all ports from ais_data database
            ports = Port.objects.using('ais_data').all().order_by('port_name')
            # Create choices list for port_name field
            port_choices = [(p.port_name, f"{p.port_name} ({p.country})") for p in ports]
            # Update the form field
            form.base_fields['port_name'].widget.choices = [('', '---------')] + port_choices
        return form

admin.site.register(PortContent, PortContentAdmin)

class UserTrackingAdmin(admin.ModelAdmin):
    """
    Admin interface for UserTracking model.
    """
    list_display = ('ip_address', 'country', 'country_code', 'city', 'device_type', 'timestamp', 'page_url', 'is_bot')
    list_filter = ('country', 'country_code', 'region_name', 'city', 'timezone', 'device_type', 'timestamp', 'is_bot')
    search_fields = ('ip_address', 'country', 'country_code', 'region', 'region_name', 'city', 'user_agent', 
                    'page_url', 'referer', 'session_id', 'bot_agent', 'isp', 'org')
    readonly_fields = ('timestamp',)
    
    fieldsets = (
        (None, {
            'fields': ('ip_address', 'timestamp')
        }),
        ('Location Information', {
            'fields': ('country', 'country_code', 'region', 'region_name', 'city', 'zip_code', 'latitude', 'longitude', 'timezone')
        }),
        ('Network Information', {
            'fields': ('isp', 'org', 'as_number')
        }),
        ('User Information', {
            'fields': ('user_agent', 'device_type', 'session_id')
        }),
        ('Page Information', {
            'fields': ('page_url', 'referer')
        }),
        ('Bot Information', {
            'fields': ('is_bot', 'bot_agent')
        }),
    )

admin.site.register(UserTracking, UserTrackingAdmin)
