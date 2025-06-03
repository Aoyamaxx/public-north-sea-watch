from django.urls import path
from . import views

urlpatterns = [
    path('simulations/create/', views.create_simulation, name='create_simulation'),
    path('simulations/<str:simulation_id>/', views.get_simulation_state, name='get_simulation_state'),
    path('simulations/<str:simulation_id>/start/', views.start_simulation, name='start_simulation'),
    path('simulations/<str:simulation_id>/stop/', views.stop_simulation, name='stop_simulation'),
    path('simulations/<str:simulation_id>/step/', views.step_simulation, name='step_simulation'),
    path('simulations/<str:simulation_id>/fps/', views.set_simulation_fps, name='set_simulation_fps'),
    path('simulations/<str:simulation_id>/reset/', views.reset_simulation, name='reset_simulation'),
    path('simulations/<str:simulation_id>/delete/', views.delete_simulation, name='delete_simulation'),
] 