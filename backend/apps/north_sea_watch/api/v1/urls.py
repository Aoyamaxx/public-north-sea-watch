from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'api_v1'

# Create a router and register our viewsets with it
router = DefaultRouter()
router.register(r'ports', views.PortViewSet)
router.register(r'ships', views.ShipViewSet)

urlpatterns = [
    # API root
    path('', views.api_root, name='api-root'),
    
    # Include the router URLs
    path('', include(router.urls)),
    
    # Additional endpoints
    path('all-ports/', views.get_all_ports, name='all-ports'),
    path('active-ships/', views.get_active_ships, name='active-ships'),
    path('ship-path/<str:imo_number>/', views.get_ship_path, name='ship-path'),
    path('test-db-connection/', views.test_db_connection, name='test-db-connection'),
    path('table-structure/', views.get_table_structure, name='table-structure'),
    
    # Port content endpoints
    path('port-content/<str:port_name>/<str:country>/', views.get_port_content, name='port-content'),
    path('all-port-contents/', views.get_all_port_contents, name='all-port-contents'),
    
    # User tracking endpoint
    path('tracking/', views.track_user_visit, name='tracking'),
    
    # Debug/test endpoints
    path('test-ip-api/', views.test_ip_api, name='test-ip-api'),
    path('test-ip-api/<str:ip>/', views.test_ip_api, name='test-ip-api-with-param'),
    path('check-tracking-records/', views.check_tracking_records, name='check-tracking-records'),
    path('debug-ip-tracking/', views.debug_ip_tracking, name='debug-ip-tracking'),
    path('debug-ip-tracking/<str:ip>/', views.debug_ip_tracking, name='debug-ip-tracking-with-param'),
    path('debug-database-tables/', views.debug_database_tables, name='debug-database-tables'),
    
    # New endpoints for scrubber vessels and engine data
    path('ais_data/icct_scrubber_march_2025/', views.get_scrubber_vessels, name='scrubber-vessels'),
    path('ais_data/icct_wfr_combined/', views.get_engine_data, name='engine-data'),
    
    # New endpoint for past scrubber distribution
    path('past-scrubber-distribution/', views.get_past_scrubber_distribution, name='past-scrubber-distribution'),
]