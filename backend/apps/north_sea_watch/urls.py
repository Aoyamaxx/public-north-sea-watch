"""
URL configuration for north_sea_watch project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path, include
from . import views

app_name = 'north_sea_watch'

urlpatterns = [
    # APP URL patterns
    path('api/v1/', include('apps.north_sea_watch.api.v1.urls')),
    
    # Ship emission rate API endpoints
    path('api/ships/<str:imo_number>/emissions/', views.get_ship_emission_rates, name='ship_emission_rates'),
    path('api/ships/emissions/summary/', views.get_ships_emission_summary, name='ships_emission_summary'),
    
    # Other URLs
]
