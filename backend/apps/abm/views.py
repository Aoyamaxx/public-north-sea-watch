import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import uuid
import threading
import time

# Import the Mesa model
from .mesa.mesa_model import ShipPortModel, agent_portrayal

# Dictionary to store active simulations
active_simulations = {}

# Last activity timestamp for each simulation
simulation_last_activity = {}

# Inactivity timeouts in seconds
NORMAL_INACTIVITY_TIMEOUT = 300   # 5 minutes
DEV_INACTIVITY_TIMEOUT = 18000    # 5 hours

# Function to update simulation activity timestamp
def update_simulation_activity(simulation_id):
    """Update the last activity timestamp for a simulation"""
    simulation_last_activity[simulation_id] = time.time()

# Cleanup thread function to remove inactive simulations
def cleanup_inactive_simulations():
    """Background thread to clean up inactive simulations"""
    while True:
        try:
            current_time = time.time()
            to_delete = []
            
            # Check each simulation for inactivity
            with threading.Lock():
                for simulation_id, last_activity in list(simulation_last_activity.items()):
                    # Skip if simulation no longer exists
                    if simulation_id not in active_simulations:
                        to_delete.append(simulation_id)
                        continue
                    
                    # Get the appropriate timeout based on if this is a developer test
                    is_dev_test = active_simulations[simulation_id].get('is_developer_test', False)
                    timeout = DEV_INACTIVITY_TIMEOUT if is_dev_test else NORMAL_INACTIVITY_TIMEOUT
                    
                    # Check if inactive for too long
                    if current_time - last_activity > timeout:
                        print(f"Simulation {simulation_id} inactive for more than {timeout // 60} minutes, cleaning up")
                        
                        # Mark for deletion
                        to_delete.append(simulation_id)
                        
                        # If simulation is running, stop it first
                        if active_simulations[simulation_id].get('running', False):
                            active_simulations[simulation_id]['running'] = False
                            time.sleep(0.1)  # Give thread time to stop
                        
                        # Remove from active simulations
                        active_simulations.pop(simulation_id, None)
            
            # Clean up activity tracking for deleted simulations
            for simulation_id in to_delete:
                simulation_last_activity.pop(simulation_id, None)
            
        except Exception as e:
            print(f"Error in cleanup thread: {str(e)}")
        
        # Sleep for one minute before checking again
        time.sleep(60)

# Start the cleanup thread
cleanup_thread = threading.Thread(target=cleanup_inactive_simulations)
cleanup_thread.daemon = True
cleanup_thread.start()

# Loading stages
LOADING_STAGES = {
    'IDLE': 'IDLE',
    'INITIALIZING': 'INITIALIZING',
    'LOADING_DATA': 'LOADING_DATA',
    'CREATING_AGENTS': 'CREATING_AGENTS',
    'ESTABLISHING_ROUTES': 'ESTABLISHING_ROUTES',
    'COMPLETE': 'COMPLETE',
    'FAILED': 'FAILED'
}

def get_simulation(simulation_id):
    """
    Get a simulation by ID or return None
    """
    return active_simulations.get(simulation_id)

def create_model_thread(simulation_id, params):
    """
    Background thread function to create model in stages
    """
    print(f"[MODEL CREATION START] Simulation {simulation_id} with params: {params}")
    
    # Use lock to ensure atomic access to the simulation dictionary
    create_lock = threading.Lock()
    
    with create_lock:
        simulation = active_simulations.get(simulation_id)
        if not simulation:
            print(f"[ERROR] Simulation {simulation_id} does not exist, skipping model creation")
            return
        
        # Get developer testing mode flag
        is_dev_test = simulation.get('is_developer_test', False)
        timeout = DEV_INACTIVITY_TIMEOUT if is_dev_test else NORMAL_INACTIVITY_TIMEOUT
        timeout_minutes = timeout // 60
        
        print(f"[INFO] Simulation {simulation_id} in developer testing mode: {is_dev_test}, timeout: {timeout_minutes} minutes")
        
        # Mark that creation has started to avoid race conditions
        simulation['creation_in_progress'] = True
    
    try:
        print(f"[STAGE 1] Initializing simulation {simulation_id}")
        # Stage 1: Initialize basic structure
        with create_lock:
            if simulation_id not in active_simulations:
                print(f"[ABORT] Simulation {simulation_id} was deleted during initialization setup, stopping")
                return
            simulation['loading_stage'] = LOADING_STAGES['INITIALIZING']
            simulation['loading_progress'] = 10
        
        # Short sleep to simulate work and allow potential cleanup to happen
        time.sleep(0.5)
        
        # Check if simulation was deleted during creation
        with create_lock:
            if simulation_id not in active_simulations:
                print(f"[ABORT] Simulation {simulation_id} was deleted during initialization, stopping")
                return
            
            # Stage 2: Load geographical data
            simulation['loading_stage'] = LOADING_STAGES['LOADING_DATA']
            simulation['loading_progress'] = 30
        
        # More simulation of work
        time.sleep(0.5)
        
        # Check if simulation was deleted during creation
        with create_lock:
            if simulation_id not in active_simulations:
                print(f"[ABORT] Simulation {simulation_id} was deleted during data loading, stopping")
                return
            
            # Stage 3: Create model with ships and ports
            simulation['loading_stage'] = LOADING_STAGES['CREATING_AGENTS']
            simulation['loading_progress'] = 50
        
        # Actually create the model - This is the critical section
        try:
            print(f"[STAGE 3] Creating model for {simulation_id}")
            model = ShipPortModel(
                width=params['width'],
                height=params['height'],
                num_ships=params['num_ships'],
                ship_wait_time=params['ship_wait_time'],
                custom_port_policies=params['custom_port_policies'],
                national_ban = params['national_ban'],
                port_info = params.get('port_info', '')
            )
            print(f"[SUCCESS] Model created successfully for {simulation_id}")
        except Exception as model_error:
            print(f"[ERROR] Error creating ShipPortModel for {simulation_id}: {str(model_error)}")
            with create_lock:
                if simulation_id in active_simulations:
                    simulation['loading_stage'] = LOADING_STAGES['FAILED']
                    simulation['error_message'] = f"Error creating model: {str(model_error)}"
                    simulation['loading_progress'] = 0
                    simulation['creation_in_progress'] = False
            return
        
        # Check if simulation still exists
        with create_lock:
            if simulation_id not in active_simulations:
                print(f"[ABORT] Simulation {simulation_id} was deleted during model creation, stopping")
                return
            
            simulation['loading_progress'] = 70
            # Stage 4: Establish shipping routes
            simulation['loading_stage'] = LOADING_STAGES['ESTABLISHING_ROUTES']
            simulation['loading_progress'] = 85
        
        # Final simulation work
        time.sleep(0.5)
        
        # Check if simulation still exists
        with create_lock:
            if simulation_id not in active_simulations:
                print(f"[ABORT] Simulation {simulation_id} was deleted during route establishment, stopping")
                return
        
        # Add grid state check
        try:
            print(f"[VALIDATION] Validating grid for {simulation_id}")
            # Quick sanity check - attempt to get grid state
            test_grid_state = []
            for cell_content in model.grid.coord_iter():
                cell_agents, _, _ = cell_content
                if len(cell_agents) > 0:
                    # If we found at least one agent, the grid looks valid
                    break
            
            print(f"[SUCCESS] Grid validation successful for {simulation_id}")
        except Exception as grid_error:
            print(f"[ERROR] Grid validation failed for {simulation_id}: {str(grid_error)}")
            # Check if simulation still exists
            with create_lock:
                if simulation_id in active_simulations:
                    simulation['loading_stage'] = LOADING_STAGES['FAILED']
                    simulation['error_message'] = f"Error validating grid: {str(grid_error)}"
                    simulation['loading_progress'] = 0
                    simulation['creation_in_progress'] = False
            return
        
        # Save the model to the simulation - Final critical section
        with create_lock:
            if simulation_id in active_simulations:
                simulation['model'] = model
                # Mark as complete
                simulation['loading_stage'] = LOADING_STAGES['COMPLETE']
                simulation['loading_progress'] = 100
                simulation['creation_in_progress'] = False
                print(f"[COMPLETE] Simulation {simulation_id} created successfully")
            else:
                print(f"[ABORT] Simulation {simulation_id} was deleted before completion, discarding model")
        
    except Exception as e:
        print(f"[ERROR] Unexpected error creating model for {simulation_id}: {str(e)}")
        # Check if simulation still exists
        with create_lock:
            if simulation_id in active_simulations:
                simulation['loading_stage'] = LOADING_STAGES['FAILED']
                simulation['error_message'] = str(e)
                simulation['loading_progress'] = 0
                simulation['creation_in_progress'] = False

@csrf_exempt
def create_simulation(request):
    """
    Create a new simulation with parameters from the request.
    Returns immediately with simulation_id and starts model creation in background.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            width = int(data.get('width', 100))
            height = int(data.get('height', 100))
            num_ships = int(data.get('num_ships', 120))
            ship_wait_time = int(data.get('ship_wait_time', 100))
            national_ban = data.get('national_ban', 'None')
            custom_port_policies = data.get('custom_port_policies', 'None')
            fps = float(data.get('fps', 1.0))
            client_id = data.get('client_id', None)  # Client identifier
            is_developer_test = data.get('is_developer_test', False)# Developer testing flag
            port_info = data.get('port_info', '')
            
            print(f"Received create simulation request, client ID: {client_id}, developer testing: {is_developer_test}")
            
            # Create a global lock to prevent concurrent conflicts
            create_lock = getattr(create_simulation, 'create_lock', threading.Lock())
            setattr(create_simulation, 'create_lock', create_lock)
            
            # Use lock to ensure atomic creation process
            with create_lock:
                # Limit frequent creation requests
                if client_id:
                    # Check the last request time for creating simulations for the same client
                    client_last_request = getattr(create_simulation, f'last_request_{client_id}', 0)
                    current_time = time.time()
                    
                    # If the last request was within 5 seconds, ignore this request (increase time window to reduce 429 errors)
                    if current_time - client_last_request < 5:
                        print(f"Rate limiting request for client {client_id}, last request was {current_time - client_last_request:.2f} seconds ago")
                        return JsonResponse({
                            'status': 'error',
                            'message': 'Request rate limited, please try again in a few seconds',
                            'loading_stage': LOADING_STAGES['FAILED'],
                            'loading_progress': 0
                        }, status=429)
                    
                    # Update the last request time
                    setattr(create_simulation, f'last_request_{client_id}', current_time)
                    
                    # First clean up simulations that were marked as failed
                    to_delete = []
                    for sim_id, sim in active_simulations.items():
                        if sim.get('loading_stage') == LOADING_STAGES['FAILED']:
                            to_delete.append(sim_id)
                            
                    for sim_id in to_delete:
                        print(f"Cleaning up failed simulation: {sim_id}")
                        active_simulations.pop(sim_id, None)
                    
                    # Look for matching client ID
                    for sim_id, sim in active_simulations.items():
                        if sim.get('client_id') == client_id:
                            print(f"Found existing simulation {sim_id} for client {client_id}")
                            
                            # Check for case where model is None but loading is complete
                            if sim.get('model') is None and sim.get('loading_stage') == LOADING_STAGES['COMPLETE']:
                                print(f"Simulation {sim_id} has inconsistent state, resetting...")
                                active_simulations.pop(sim_id, None)
                                break
                                
                            # If simulation is in failed state, recreate it
                            if sim.get('loading_stage') == LOADING_STAGES['FAILED']:
                                print(f"Simulation {sim_id} is in failed state, will be recreated")
                                active_simulations.pop(sim_id, None)
                                break
                            
                            # If model is still initializing, return current status
                            if sim.get('model') is None and sim.get('loading_stage') != LOADING_STAGES['FAILED']:
                                # Check if initialization appears to be stuck (creation_in_progress is False but status is not COMPLETE or FAILED)
                                if not sim.get('creation_in_progress', True) and sim.get('loading_stage') not in [LOADING_STAGES['COMPLETE'], LOADING_STAGES['FAILED']]:
                                    print(f"Simulation {sim_id} appears to be stuck in {sim.get('loading_stage')}, resetting...")
                                    active_simulations.pop(sim_id, None)
                                    break
                                
                                print(f"Simulation {sim_id} is still initializing, stage: {sim.get('loading_stage')}, progress: {sim.get('loading_progress')}")
                                return JsonResponse({
                                    'status': 'initializing',
                                    'simulation_id': sim_id,
                                    'message': 'Simulation initialization in progress',
                                    'loading_stage': sim.get('loading_stage'),
                                    'loading_progress': sim.get('loading_progress', 0)
                                })
                            
                            # Return existing simulation ID
                            print(f"Returning existing simulation {sim_id} for client {client_id}, stage: {sim.get('loading_stage')}")
                            return JsonResponse({
                                'status': 'success',
                                'simulation_id': sim_id,
                                'message': 'Using existing simulation',
                                'loading_stage': sim.get('loading_stage'),
                                'loading_progress': sim.get('loading_progress', 100)
                            })
                
                # Limit the number of simulations running simultaneously
                active_count = len(active_simulations)
                print(f"Active simulations: {active_count}")
                
                # Clean up old, unused simulations
                # If there are more than 2 active simulations, delete the oldest one
                if active_count > 2:  # Reduce max simulations to lower server load
                    oldest_sim_id = None
                    oldest_time = float('inf')
                    
                    for sim_id, sim in active_simulations.items():
                        # Skip simulations for the current client
                        if client_id and sim.get('client_id') == client_id:
                            continue
                            
                        if sim.get('creation_time', float('inf')) < oldest_time:
                            oldest_time = sim.get('creation_time', float('inf'))
                            oldest_sim_id = sim_id
                    
                    if oldest_sim_id:
                        # Stop simulation
                        if active_simulations.get(oldest_sim_id, {}).get('running', False):
                            active_simulations[oldest_sim_id]['running'] = False
                            time.sleep(0.1)  # Give thread time to stop
                        
                        # Delete simulation
                        active_simulations.pop(oldest_sim_id, None)
                        print(f"Deleted old simulation {oldest_sim_id} to save resources")
                
                # Create a unique ID for this simulation
                simulation_id = str(uuid.uuid4())
                print(f"Creating new simulation {simulation_id} for client {client_id}")
                
                # Store initial simulation state
                active_simulations[simulation_id] = {
                    'model': None,  # Will be populated by background thread
                    'running': False,
                    'step_thread': None,
                    'step_count': 0,
                    'fps': fps,
                    'loading_stage': LOADING_STAGES['INITIALIZING'],
                    'loading_progress': 0,
                    'error_message': None,
                    'client_id': client_id,  # Store client ID
                    'creation_time': time.time(),  # Record creation time
                    'creation_in_progress': False,  # Will be set to True by the creation thread
                    'is_developer_test': is_developer_test  # Store developer testing flag
                }
            
            # Start a background thread to create the model outside the lock
            params = {
                'width': width,
                'height': height,
                'num_ships': num_ships,
                'ship_wait_time': ship_wait_time,
                'national_ban': national_ban,
                'custom_port_policies': custom_port_policies,
                'port_info': port_info
            }
            
            # Create and start the thread with a small delay
            # This allows the response to be sent before potentially intensive model creation starts
            def delayed_thread_start():
                time.sleep(0.1)  # Short delay
                thread = threading.Thread(target=create_model_thread, args=(simulation_id, params))
                thread.daemon = True
                thread.start()
                
            threading.Thread(target=delayed_thread_start).start()
            
            # Set initial activity timestamp
            update_simulation_activity(simulation_id)
            
            return JsonResponse({
                'status': 'initializing',
                'simulation_id': simulation_id,
                'message': 'Simulation initialization started',
                'loading_stage': LOADING_STAGES['INITIALIZING'],
                'loading_progress': 0
            })
        except Exception as e:
            print(f"Error in create_simulation: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': f'Error creating simulation: {str(e)}',
                'loading_stage': LOADING_STAGES['FAILED'],
                'loading_progress': 0
            }, status=400)
    
    return JsonResponse({
        'status': 'error',
        'message': 'Invalid request method',
        'loading_stage': LOADING_STAGES['FAILED'],
        'loading_progress': 0
    }, status=405)

@csrf_exempt
def get_simulation_state(request, simulation_id):
    """
    Get the current state of a simulation
    """
    simulation = get_simulation(simulation_id)
    
    if not simulation:
        return JsonResponse({
            'status': 'error',
            'message': 'Simulation not found'
        }, status=404)
    
    # Update last activity timestamp
    update_simulation_activity(simulation_id)
    
    # If model is still being created, return loading status
    if simulation['model'] is None:
        # Check for state inconsistency - if marked as COMPLETE but model is still None, fix the state
        if simulation.get('loading_stage') == LOADING_STAGES['COMPLETE']:
            print(f"State inconsistency detected: Simulation {simulation_id} marked as COMPLETE but model is None, downgrading to ESTABLISHING_ROUTES")
            simulation['loading_stage'] = LOADING_STAGES['ESTABLISHING_ROUTES']
            simulation['loading_progress'] = 85
        
        creation_status = "in progress" if simulation.get('creation_in_progress', False) else "waiting"
        print(f"Simulation {simulation_id} still initializing: {simulation.get('loading_stage')}, progress: {simulation.get('loading_progress')}, creation: {creation_status}")
        
        return JsonResponse({
            'status': 'initializing',
            'running': False,
            'step_count': 0,
            'fps': simulation['fps'],
            'grid_state': [],
            'model_data': {},
            'loading_stage': simulation['loading_stage'],
            'loading_progress': simulation['loading_progress'],
            'message': simulation.get('error_message')
        })
    
    # At this point the model is confirmed to be initialized, ensure loading_stage is COMPLETE
    if simulation.get('loading_stage') != LOADING_STAGES['COMPLETE']:
        print(f"State correction: Simulation {simulation_id} has initialized model but state is not COMPLETE, updating state")
        simulation['loading_stage'] = LOADING_STAGES['COMPLETE']
        simulation['loading_progress'] = 100
        # Also ensure creation_in_progress is set to False
        simulation['creation_in_progress'] = False
    
    # Get snapshot of the data we need to process
    model = simulation['model']
    running = simulation['running']
    step_count = simulation['step_count']
    fps = simulation['fps']

    # Process grid state outside the lock to reduce lock contention
    try:
        grid_state = []
        # Add diagnostic counters for ships
        ship_count = 0
        docked_ships_count = 0
        scrubber_ship_count = 0
        
        # First pass: Add all agents from the grid to grid_state
        for cell_content in model.grid.coord_iter():
            cell_agents, x, y = cell_content
            for agent in cell_agents:
                portrayal = agent_portrayal(agent)
                if portrayal:  # Only include agents with a portrayal
                    portrayal['x'] = x
                    portrayal['y'] = y
                    grid_state.append(portrayal)
                    
                    # Count ships by type for diagnostic purposes
                    if hasattr(agent, 'ship_type'):
                        ship_count += 1
                        if hasattr(agent, 'docked') and agent.docked:
                            docked_ships_count += 1
                        if hasattr(agent, 'is_scrubber') and agent.is_scrubber:
                            scrubber_ship_count += 1
        
        # Second pass: Explicitly add docked ships that might not be in the grid
        # This is crucial for the ship dynamics to work correctly
        from .mesa.ship import Ship
        
        # Get all ships from the schedule that might not be visible in the grid (e.g., they're docked)
        schedule_ship_count = 0
        docked_not_in_grid = 0
        
        for agent in model.schedule.agents:
            if isinstance(agent, Ship):
                schedule_ship_count += 1
                
                # Check if this ship is in docked state but not included in grid_state
                if agent.docked:
                    # Look for this agent in the existing grid_state
                    agent_found = False
                    for existing in grid_state:
                        # Cannot compare directly, so check if a ship with same ID exists
                        if existing.get('ship_id') == agent.unique_id:
                            agent_found = True
                            break
                    
                    # If not found, add this ship to grid_state at its current position
                    if not agent_found and hasattr(agent, 'pos'):
                        portrayal = agent_portrayal(agent)
                        if portrayal:
                            x, y = agent.pos
                            portrayal['x'] = x
                            portrayal['y'] = y
                            # Add a special flag to identify docked ships added manually
                            portrayal['docked'] = True
                            grid_state.append(portrayal)
                            docked_not_in_grid += 1
        
        # Get model data
        if hasattr(model, 'datacollector') and model.datacollector:
            model_data = {key: model.datacollector.model_vars[key][-1] if model.datacollector.model_vars[key] else None 
                        for key in model.datacollector.model_vars}
        else:
            model_data = {}
            
        # Add port revenue data with scrubber breakdown
        try:
            # Get the port revenues with scrubber breakdown
            port_revenues, port_scrubber_revenues, port_non_scrubber_revenues = model._get_port_revenues()
            
            # Add port revenue data to model_data
            model_data['PortRevenues'] = port_revenues
            model_data['PortScrubberRevenues'] = port_scrubber_revenues
            model_data['PortNonScrubberRevenues'] = port_non_scrubber_revenues
            
            # Add total counts by ship type
            from .mesa.ship import Ship
            ships = [agent for agent in model.schedule.agents if isinstance(agent, Ship)]
            model_data['NumShips'] = len(ships)
            model_data['NumScrubberShips'] = sum(1 for ship in ships if getattr(ship, 'is_scrubber', False))
            
            # Get port policies for each port
            from .mesa.port import Port
            port_policies = {}
            for agent in model.schedule.agents:
                if isinstance(agent, Port) and hasattr(agent, 'name') and hasattr(agent, 'scrubber_policy'):
                    port_policies[agent.name] = agent.scrubber_policy
            model_data['PortPolicies'] = port_policies
        except Exception as e:
            print(f"Error collecting detailed revenue data: {e}")
            # Continue with basic model data even if the detailed revenue collection failed
        
        # Log diagnostic information
        print(f"Simulation {simulation_id} diagnostics:")
        print(f"  - Ships in grid: {ship_count}")
        print(f"  - Docked ships: {docked_ships_count}")
        print(f"  - Ships with scrubbers: {scrubber_ship_count}")
        print(f"  - Ships from schedule: {schedule_ship_count}")
        print(f"  - Added docked ships not in grid: {docked_not_in_grid}")
        print(f"  - Total agents in grid_state: {len(grid_state)}")
        
        # Ensure model data matches what we counted in the grid
        if 'NumShips' in model_data and model_data['NumShips'] != schedule_ship_count:
            print(f"  [WARNING] NumShips mismatch: model_data={model_data['NumShips']}, counted={schedule_ship_count}")
        
        # Update TotalDockedShips if it doesn't match our count
        actual_docked = sum(1 for agent in model.schedule.agents if isinstance(agent, Ship) and getattr(agent, 'docked', False))
        if 'TotalDockedShips' in model_data and model_data['TotalDockedShips'] != actual_docked:
            print(f"  [WARNING] TotalDockedShips mismatch: model_data={model_data['TotalDockedShips']}, counted={actual_docked}")
            model_data['TotalDockedShips'] = actual_docked
            
        print(f"Successfully processed model data for simulation {simulation_id}, grid state has {len(grid_state)} elements")
        
    except Exception as e:
        print(f"Error processing model data for simulation {simulation_id}: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Error processing simulation data: {str(e)}',
            'loading_stage': LOADING_STAGES['FAILED'],
            'loading_progress': 0
        }, status=500)
    
    return JsonResponse({
        'status': 'success',
        'running': running,
        'step_count': step_count,
        'fps': fps,
        'grid_state': grid_state,
        'model_data': model_data,
        'loading_stage': LOADING_STAGES['COMPLETE'],
        'loading_progress': 100
    })

def run_step_thread(simulation_id):
    """
    Background thread function to run simulation steps
    """
    print(f"Step thread started for simulation {simulation_id}")
    
    # Initialization wait time settings
    init_wait_time = 0
    MAX_INIT_WAIT_TIME = 10  # Maximum wait time for model initialization (seconds)
    
    # First check if simulation exists
    simulation = active_simulations.get(simulation_id)
    if not simulation:
        print(f"Simulation {simulation_id} not found at thread start, exiting thread")
        return
    
    # Set step counter
    step_count = 0
    
    try:
        # If simulation is marked as running but model is not yet initialized, wait for some time
        while simulation.get('running', False) and simulation.get('model') is None and init_wait_time < MAX_INIT_WAIT_TIME:
            print(f"Waiting for model initialization: {simulation_id}, waited {init_wait_time}s so far")
            time.sleep(1.0)
            init_wait_time += 1
            
            # Refresh simulation reference to prevent concurrent modification issues
            simulation = active_simulations.get(simulation_id)
            if not simulation:
                print(f"Simulation {simulation_id} was deleted during initialization wait, exiting thread")
                return
        
        # If wait timeout, model still not initialized, set error and exit
        if simulation.get('model') is None:
            print(f"Model initialization timeout for {simulation_id}, exiting thread")
            if simulation_id in active_simulations:
                simulation['running'] = False
                simulation['error_message'] = "Model initialization timeout"
                simulation['loading_stage'] = LOADING_STAGES['FAILED']
            return
        
        # Main loop - run simulation steps
        while simulation.get('running', False):
            try:
                # Check if simulation still exists - this is important to prevent race conditions
                if simulation_id not in active_simulations:
                    print(f"Simulation {simulation_id} was deleted, exiting step thread")
                    return
                
                # Get model reference
                model = simulation.get('model')
                if model is None:
                    print(f"Model became None for {simulation_id}, exiting step thread")
                    if simulation_id in active_simulations:
                        simulation['running'] = False
                        simulation['error_message'] = "Model became unavailable"
                        simulation['loading_stage'] = LOADING_STAGES['FAILED']
                    return
                
                # Execute simulation step
                model.step()
                simulation['step_count'] += 1
                step_count += 1
                
                # Log every 10 steps
                if step_count % 10 == 0:
                    print(f"Simulation {simulation_id}: {step_count} steps completed, current step count: {simulation['step_count']}")
                    
                    # Add detailed diagnostics about ship status
                    from .mesa.ship import Ship
                    ships = [agent for agent in model.schedule.agents if isinstance(agent, Ship)]
                    
                    # Count ships by status
                    total_ships = len(ships)
                    docked_ships = sum(1 for ship in ships if getattr(ship, 'docked', False))
                    exiting_ships = sum(1 for ship in ships if hasattr(ship, 'exiting') and ship.exiting)
                    scrubber_ships = sum(1 for ship in ships if getattr(ship, 'is_scrubber', False))
                    
                    # Report ID ranges to detect potential ID conflicts
                    ship_ids = sorted([ship.unique_id for ship in ships])
                    id_range = f"min={min(ship_ids) if ship_ids else 'N/A'}, max={max(ship_ids) if ship_ids else 'N/A'}"
                    
                    # Check if we're still spawning
                    remaining = getattr(model, 'remaining_ships', 0)
                    next_id = getattr(model, 'next_ship_id', 'unknown')
                    
                    print(f"  Ship status: total={total_ships}, docked={docked_ships}, exiting={exiting_ships}, scrubbers={scrubber_ships}")
                    print(f"  Ship IDs: {id_range}, next ID={next_id}, remaining to spawn={remaining}")
                
                # Calculate delay based on FPS
                fps = max(0.5, min(simulation.get('fps', 1.0), 10))  # Limit between 0.5 and 10 FPS
                delay = 1.0 / fps
                
                # Check again if simulation still exists
                if simulation_id not in active_simulations:
                    print(f"Simulation {simulation_id} was deleted after step execution, exiting thread")
                    return
                
                # Pause according to FPS setting
                time.sleep(delay)
            except Exception as e:
                print(f"Error in simulation step for {simulation_id}: {str(e)}")
                # Check if simulation still exists
                if simulation_id in active_simulations:
                    simulation['running'] = False
                    simulation['error_message'] = str(e)
                break
    except Exception as e:
        print(f"Unexpected error in simulation thread {simulation_id}: {str(e)}")
    finally:
        # Ensure running state is set to False
        if simulation_id in active_simulations and active_simulations[simulation_id].get('running', False):
            active_simulations[simulation_id]['running'] = False
            print(f"Simulation {simulation_id} step thread ended, completed {step_count} steps")
        else:
            print(f"Simulation {simulation_id} step thread ended (simulation may have been deleted), completed {step_count} steps")

@csrf_exempt
def start_simulation(request, simulation_id):
    """
    Start running the simulation in background thread
    """
    simulation = get_simulation(simulation_id)
    
    if not simulation:
        return JsonResponse({
            'status': 'error',
            'message': 'Simulation not found'
        }, status=404)
    
    # Update activity timestamp
    update_simulation_activity(simulation_id)
    
    # Check if model is still being created
    if simulation.get('model') is None:
        loading_stage = simulation.get('loading_stage', LOADING_STAGES['INITIALIZING'])
        loading_progress = simulation.get('loading_progress', 0)
        print(f"Cannot start simulation {simulation_id} - model not initialized yet, stage: {loading_stage}, progress: {loading_progress}")
        
        # If marked as COMPLETE but model is None, this is an inconsistency
        if loading_stage == LOADING_STAGES['COMPLETE']:
            print(f"State inconsistency detected: Simulation {simulation_id} marked as COMPLETE but model is None")
            # Correct the state to ESTABLISHING_ROUTES instead of FAILED to give more chances to complete initialization
            simulation['loading_stage'] = LOADING_STAGES['ESTABLISHING_ROUTES']
            simulation['loading_progress'] = 85
            return JsonResponse({
                'status': 'error',
                'message': 'Simulation model is still initializing, please wait',
                'loading_stage': LOADING_STAGES['ESTABLISHING_ROUTES'],
                'loading_progress': 85
            }, status=400)
        
        return JsonResponse({
            'status': 'error',
            'message': 'Cannot start simulation until initialization is complete',
            'loading_stage': loading_stage,
            'loading_progress': loading_progress
        }, status=400)
    
    # Check if model is in COMPLETE state
    if simulation.get('loading_stage') != LOADING_STAGES['COMPLETE']:
        print(f"Warning: Simulation {simulation_id} not in COMPLETE state, currently: {simulation.get('loading_stage')}")
        # Since model is initialized, force update state
        simulation['loading_stage'] = LOADING_STAGES['COMPLETE']
        simulation['loading_progress'] = 100
        print(f"Updated simulation {simulation_id} state to COMPLETE")
    
    # If simulation is not running, start it
    if not simulation.get('running', False):
        print(f"Starting simulation {simulation_id}")
        simulation['running'] = True
        
        # Start a background thread for simulation steps
        thread = threading.Thread(target=run_step_thread, args=(simulation_id,))
        thread.daemon = True
        thread.start()
        
        simulation['step_thread'] = thread
        
        print(f"Simulation {simulation_id} started successfully with thread {thread.name}")
        return JsonResponse({
            'status': 'success',
            'message': 'Simulation started successfully',
            'running': True,
            'loading_stage': LOADING_STAGES['COMPLETE'],
            'loading_progress': 100
        })
    
    print(f"Simulation {simulation_id} already running")
    return JsonResponse({
        'status': 'success',
        'message': 'Simulation already running',
        'running': True,
        'loading_stage': LOADING_STAGES['COMPLETE'],
        'loading_progress': 100
    })

@csrf_exempt
def stop_simulation(request, simulation_id):
    """
    Stop running the simulation
    """
    simulation = get_simulation(simulation_id)
    
    if not simulation:
        return JsonResponse({
            'status': 'error',
            'message': 'Simulation not found'
        }, status=404)
    
    # Update activity timestamp
    update_simulation_activity(simulation_id)
    
    # Set running flag to false
    if simulation['running']:
        simulation['running'] = False
        
        # The thread will detect this and stop
        return JsonResponse({
            'status': 'success',
            'message': 'Simulation stopped'
        })
    
    return JsonResponse({
        'status': 'success', 
        'message': 'Simulation already stopped'
    })

@csrf_exempt
def step_simulation(request, simulation_id):
    """
    Step the simulation forward by one time step
    """
    simulation = get_simulation(simulation_id)
    
    if not simulation:
        return JsonResponse({
            'status': 'error',
            'message': 'Simulation not found'
        }, status=404)
    
    # Update last activity timestamp
    update_simulation_activity(simulation_id)
    
    # Check if model is still being created
    if simulation['model'] is None:
        return JsonResponse({
            'status': 'error',
            'message': 'Cannot step simulation until initialization is complete',
            'loading_stage': simulation['loading_stage'],
            'loading_progress': simulation['loading_progress']
        }, status=400)
    
    model = simulation['model']
    model.step()
    simulation['step_count'] += 1
    
    return JsonResponse({
        'status': 'success',
        'message': 'Simulation stepped',
        'step_count': simulation['step_count']
    })

@csrf_exempt
def set_simulation_fps(request, simulation_id):
    """
    Set the frames per second (simulation speed) for a simulation
    """
    if request.method != 'POST':
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid request method'
        }, status=405)
    
    simulation = get_simulation(simulation_id)
    if not simulation:
        return JsonResponse({
            'status': 'error',
            'message': 'Simulation not found'
        }, status=404)
    
    try:
        data = json.loads(request.body)
        fps = float(data.get('fps', 1.0))
        
        # Validate FPS range
        fps = max(0.5, min(fps, 10.0))  # Limit between 0.5 and 10 FPS
        
        # Update the FPS value
        simulation['fps'] = fps
        
        return JsonResponse({
            'status': 'success',
            'message': 'FPS updated successfully',
            'fps': fps
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error setting FPS: {str(e)}'
        }, status=400)

@csrf_exempt
def reset_simulation(request, simulation_id):
    """
    Reset a simulation with new parameters from the request
    """
    print(f"Received reset request for simulation {simulation_id}")
    
    # Use thread lock to ensure atomic reset operation
    with threading.Lock():
        simulation = get_simulation(simulation_id)
        
        if not simulation:
            print(f"Simulation {simulation_id} not found for reset request")
            return JsonResponse({
                'status': 'error',
                'message': 'Simulation not found',
                'loading_stage': LOADING_STAGES['FAILED'],
                'loading_progress': 0
            }, status=404)
        
        if request.method != 'POST':
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid request method',
                'loading_stage': LOADING_STAGES['FAILED'],
                'loading_progress': 0
            }, status=405)
        
        # Make sure the simulation is stopped
        simulation['running'] = False
        
        try:
            data = json.loads(request.body)
            width = int(data.get('width', 100))
            height = int(data.get('height', 100))
            num_ships = int(data.get('num_ships', 120))
            ship_wait_time = int(data.get('ship_wait_time', 100))
            national_ban = data.get('national_ban', 'None')
            custom_port_policies = data.get('custom_port_policies', 'None')
            fps = float(data.get('fps', simulation['fps']))
            port_info = data.get('port_info', '')
            
            # Update loading stage
            simulation['loading_stage'] = LOADING_STAGES['INITIALIZING']
            simulation['loading_progress'] = 0
            
            # Start a background thread to create the new model
            params = {
                'width': width,
                'height': height,
                'num_ships': num_ships,
                'ship_wait_time': ship_wait_time,
                'national_ban': national_ban,
                'custom_port_policies': custom_port_policies,
                'port_info': port_info
            }
            
            # Wait a moment for any ongoing operations to finish
            time.sleep(0.1)
            
            # Set the model to None to indicate it's being recreated
            simulation['model'] = None
            simulation['step_count'] = 0
            simulation['fps'] = fps
            
            # Create a new thread separate from any existing threads
            thread = threading.Thread(target=create_model_thread, args=(simulation_id, params))
            thread.daemon = True
            thread.start()
            
            return JsonResponse({
                'status': 'initializing',
                'message': 'Simulation reset initiated',
                'loading_stage': LOADING_STAGES['INITIALIZING'],
                'loading_progress': 0
            })
        except Exception as e:
            print(f"Error in reset_simulation: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': f'Error resetting simulation: {str(e)}',
                'loading_stage': LOADING_STAGES['FAILED'],
                'loading_progress': 0
            }, status=400)

@csrf_exempt
def delete_simulation(request, simulation_id):
    """
    Delete a simulation and free up resources
    """
    print(f"Received delete request, simulation ID: {simulation_id}")
    
    # Use thread lock to ensure atomic deletion operation
    with threading.Lock():
        # Check if the simulation exists
        simulation = get_simulation(simulation_id)
        
        if not simulation:
            print(f"Simulation {simulation_id} not found")
            # If simulation does not exist but request is valid, return success
            return JsonResponse({
                'status': 'success',
                'message': 'Simulation already deleted or does not exist'
            })
        
        # First mark as not running and mark with deletion flag to prevent further updates
        simulation['running'] = False
        simulation['being_deleted'] = True
        
        # Get reference to the model before removing from dictionary
        model = simulation.get('model')
        
        # Remove from active simulations immediately
        try:
            print(f"Removing simulation {simulation_id} from active simulations")
            active_simulations.pop(simulation_id, None)
            
            # For any cleanup that needs to happen after removal
            if model:
                print(f"Cleaning up model resources for {simulation_id}")
                # Any additional model cleanup can go here
                # For now, just setting to None is sufficient as Python will handle garbage collection
                model = None
            
            print(f"Successfully deleted simulation {simulation_id}")
        except Exception as e:
            print(f"Error during simulation deletion {simulation_id}: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': f'Error deleting simulation: {str(e)}'
            }, status=500)
    
    return JsonResponse({
        'status': 'success',
        'message': 'Simulation deleted successfully'
    }) 