from mesa import Agent, Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from mesa.datacollection import DataCollector
from mesa.visualization.modules import CanvasGrid
from mesa.visualization.ModularVisualization import ModularServer
# Updated import to be compatible with newer Mesa versions
from mesa.visualization.UserParam import UserSettableParameter
import math
import numpy as np
import csv
import statistics
from shapely.geometry import Polygon, Point
import os
import pickle
import sys
from pathlib import Path

# Add the parent directory to sys.path if running directly (for independent testing)
if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    sys.path.append(str(current_dir))

# Import Port and Ship from their modules
from .port import Port
from .ship import Ship, Terrain, ScrubberTrail


class ShipPortModel(Model):
    """"
    Simulation class that runs the model logic.
    """

    def __init__(self, width, height, num_ships, ship_wait_time=100, custom_port_policies="None", national_ban = 'None', port_info = ''):
        self.num_ships = min(num_ships, 50)
        # torus False means ships cannot travel to the other side of the grid
        self.grid = MultiGrid(width, height, torus=False)
        self.schedule = RandomActivation(self)
        self.running = True
        # initial numbers for docked and undocked
        self.docked_ships_count = 0
        self.undocked_ships_count = 0
        
        # Set maximum time steps to 400
        self.max_steps = 400

        self.next_trail_id = 10000
        
        # Extra environment settings
        self.ship_wait_time = ship_wait_time
        
        # initialize scrubber penalty accumulators
        self.scrubber_penalty_sum = 0
        self.scrubber_penalty_count = 0

        self.port_info = port_info

        # Process custom port policies mapping (e.g., "amsterdam:ban, rotterdam:ban, hamburg:ban, antwerp:ban, london:ban")
        if custom_port_policies != "None":
            self.custom_port_policies = {}
            for pair in custom_port_policies.split(','):
                if ':' in pair:
                    port_name, policy = pair.split(':', 1)
                    self.custom_port_policies[port_name.strip().lower()] = policy.strip()
        else:
            self.custom_port_policies = {}

        self.national_ban = national_ban

        # pre-loaded terrain matrix
        self.terrain_matrix = self.get_terrain_matrix(width, height)

        # optimization: terrain load
        self._setup_terrain(width, height)
        # optimization: port load
        self.ports = self._setup_ports()
        
        # Setup for gradual ship spawning
        self.next_ship_id = len(self.ports)
        # Set how many ships to spawn in the initialization phase
        self.initial_ships = min(10, self.num_ships)
        # Set how many ships remain to be spawned over time
        self.remaining_ships = max(0, self.num_ships - self.initial_ships)
        # Set the duration over which the remaining ships will spawn
        self.spawn_duration = 20  # Spawn ships over 20 steps
        
        # Track used ship IDs to prevent duplicates
        self.used_ship_ids = set()
        
        # optimization: ship route creation - only create initial ships
        self._setup_ships(self.initial_ships, len(self.ports), self.ports)
        # collection of scrubber data
        self._setup_data_collector()

    def get_average_penalty(self):
        if self.scrubber_penalty_count > 0:
            return self.scrubber_penalty_sum / self.scrubber_penalty_count
        return 0

    def _setup_terrain(self, width, height):
        """Sets up terrain on the grid"""
        for x in range(width):
            for y in range(height):
                # check if the point is within the polygon
                # converts method is used to color areas inside of the polygon
                terrain_type = self.terrain_matrix[x][y]
                terrain = Terrain(f'terrain_{x}_{y}', self, terrain_type)
                self.grid.place_agent(terrain, (x, y))
                self.schedule.add(terrain)

    def _setup_ports(self):
        """Sets up ports on the grid"""
        ports = []
        try:
            for i, port_data in enumerate(Port.raw_port_data):
                try:
                    # Check if a custom policy exists for this port (using lower-case names)
                    port_policy_for_agent = None
                    port_name_lc = port_data['name'].lower()
                    port_country = port_data['country']

                    country_to_ban = ['DK', 'FR', 'BE', 'SE']
                    port_to_ban = ['LEITH', 'DUNDEE', 'TILBURY', 'BREMEN', 'BRAKE', 'HAMBURG', 'STAVANGER', 'AMSTERDAM']
                    #policy national ban
                    if port_country in country_to_ban:
                        port_policy_for_agent = 'ban'
                    #policy port ban
                    elif port_data['name'] in port_to_ban:
                        port_policy_for_agent = 'ban'
                    # national_ban
                    elif self.national_ban != "None" and port_country == self.national_ban:
                        port_policy_for_agent = "ban"
                        print(f"Applying national ban to {port_data['name']} in {port_country}")
                    # custom policy
                    elif hasattr(self,'custom_port_policies') and self.custom_port_policies and port_name_lc in self.custom_port_policies:
                        port_policy_for_agent = self.custom_port_policies[port_name_lc]
                    
                    # Create the Port agent with the determined policy.
                    port = Port(i, self, port_data, policy=port_policy_for_agent)
                    
                    x = port_data['x']
                    y = port_data['y']
                    
                    self.grid.place_agent(port, (x, y))
                    self.schedule.add(port)
                    ports.append(port)
                except Exception as port_error:
                    print(f"Error creating port {i}: {str(port_error)}")
        except Exception as ports_error:
            print(f"Error in port creation: {str(ports_error)}")
        
        return ports

    def _calculate_port_popularities(self, ports):
        """Precompute port popularities to avoid recalculating for each ship"""
        port_popularities = {}
        # ship type specific factors
        ship_type_factors = {
            "cargo": 1.0,
            "tanker": 1.0,
            "fishing": 0.8,
            "other": 0.8,
            "tug": 0.5,
            "passenger": 1.2,
            "hsc": 1.2,
            "dredging": 0.6,
            "search": 0.7
        }

        #base popularity calculation
        for port in ports:
            port_name = port.name.lower()
            base_pop = 1

            # fast lookup instead of multiple conditions
            if port_name == "rotterdam":
                base_pop = 8
            elif port_name == "antwerp":
                base_pop = 5
            elif port_name in {"amsterdam", "hamburg"}:
                base_pop = 2

            # store all popularities per ship type
            port_popularities[port] = {
                ship_type: base_pop * factor
                for ship_type, factor in ship_type_factors.items()}

        return port_popularities

    def _assign_ship_route(self, ship, ports, port_popularities, route_length=3):
        """Assign a route to a ship more efficiently"""
        # limit route length to number of available ports
        k = min(route_length, len(ports))
        # get weights for this ship type
        ship_type = ship.ship_type
        weights = [port_popularities[port].get(ship_type, 1.0) for port in ports]
        
        # Adjust weights based on port policy and ship type
        for i, port in enumerate(ports):
            if hasattr(port, 'scrubber_policy'):
                if port.scrubber_policy == 'ban' and ship.is_scrubber:
                    weights[i] = 0
                elif port.scrubber_policy == 'tax' and ship.is_scrubber:
                    weights[i] *= 0.5  # reduce desirability for scrubber ships
                elif port.scrubber_policy == 'subsidy' and not ship.is_scrubber:
                    weights[i] *= 1.5  # increase desirability for non-scrubber ships
        
        # less complex random sample, its less accurate but also lighter
        selected_indices = self.random.choices(
            range(len(ports)),
            weights=weights,
            k=k)
        return [ports[i] for i in selected_indices]

    def _setup_ships(self, num_ships, num_ports, ports):
        """Create ships and assign routes"""
        # Ensure we don't create more ships than requested
        num_ships = min(num_ships, self.num_ships)
        
        # Water cells for initial placement - use ALL water cells for random distribution
        water_cells = []
        
        # Collect all water cells for initial random placement
        for x in range(self.grid.width):
            for y in range(self.grid.height):
                if (x < self.grid.width and y < self.grid.height and 
                    self.terrain_matrix[x][y] == 'water'):
                    water_cells.append((x, y))

        # precompute port popularises
        port_popularities = self._calculate_port_popularities(ports)
        
        # Track the ports we've created
        used_ids = set()
        for port in ports:
            used_ids.add(port.unique_id)
        
        # create initial ships starting after port IDs
        ship_id = num_ports
        ships_created = 0
        
        while ships_created < num_ships and water_cells:
            # Find a unique ID that doesn't conflict with existing agents
            while ship_id in used_ids:
                ship_id += 1
                
            # Create and place the ship
            ship = Ship(ship_id, self)
            used_ids.add(ship_id)
            
            # Place ship on water
            x, y = self.random.choice(water_cells)
            water_cells.remove((x, y))  # Don't place multiple ships at same location
            self.grid.place_agent(ship, (x, y))
            self.schedule.add(ship)
            
            # Assign route if ports exist
            if ports:
                ship.route = self._assign_ship_route(ship, ports, port_popularities)
                
            # Update counters
            ships_created += 1
            ship_id += 1
            
        # Update next_ship_id to continue from where we left off
        self.next_ship_id = ship_id
        
        # Print diagnostic information
        print(f"Created {ships_created} initial ships. Next ship ID: {self.next_ship_id}")
        print(f"Remaining ships to spawn: {self.remaining_ships}")

    def spawn_ship(self, ship_id):
        """Spawns a new Ship agent at bottom water cells for entry"""
        # Track used IDs for all agents, not just ships
        if not hasattr(self, 'all_agent_ids'):
            self.all_agent_ids = {agent.unique_id for agent in self.schedule.agents}

        # Check if the ship with this ID already exists
        if ship_id in self.all_agent_ids:
            # Generate a new unique ID
            original_id = ship_id
            new_id = max(self.all_agent_ids) + 1000  # Start from a much higher number
            ship_id = new_id
            print(f"ID conflict detected: Changed ID from {original_id} to {ship_id}")

        # Add this ID to our tracking set
        self.all_agent_ids.add(ship_id)

        # Create the new ship
        new_ship = Ship(ship_id, self)

        # Find bottom water cells for entry - prioritize bottom 10 rows
        bottom_y_range = 10
        water_cells = []
        
        # First, try bottom section for entry
        for x in range(self.grid.width):
            for y in range(bottom_y_range):
                if (x < self.grid.width and y < self.grid.height and
                        self.terrain_matrix[x][y] == 'water'):
                    water_cells.append((x, y))
        
        # If not enough water cells in bottom section, expand search
        if len(water_cells) == 0:
            for x in range(self.grid.width):
                for y in range(self.grid.height):
                    if (x < self.grid.width and y < self.grid.height and
                            self.terrain_matrix[x][y] == 'water'):
                        water_cells.append((x, y))

        # Choose a water cell for placement (prefer bottom)
        if water_cells:
            start_pos = self.random.choice(water_cells)
        else:
            print(f"Warning: No water cells found for ship {ship_id}, placing at (0,0)")
            start_pos = (0, 0)

        # Place the ship on the grid and add to scheduler
        self.grid.place_agent(new_ship, start_pos)
        self.schedule.add(new_ship)

        # Assign route based on ship type and port popularity
        ports = [agent for agent in self.schedule.agents if isinstance(agent, Port)]
        if ports:
            # Use the same route assignment logic as in _setup_ships
            port_popularities = self._calculate_port_popularities(ports)
            new_ship.route = self._assign_ship_route(new_ship, ports, port_popularities)

            print(
                f"Created ship {new_ship.unique_id} of type {new_ship.ship_type} at {start_pos} with route length {len(new_ship.route)}")
        else:
            print(
                f"Created ship {new_ship.unique_id} of type {new_ship.ship_type} at {start_pos} with no route (no ports available)")

        return new_ship

    def get_ship_details(self):
        """Get details of ships for the data collector"""
        try:
            ship_details = []
            for agent in self.schedule.agents:
                if isinstance(agent, Ship):
                    # Extract key ship properties
                    details = {
                        "id": getattr(agent, "unique_id", None),
                        "type": getattr(agent, "ship_type", "Unknown"),
                        "is_scrubber": getattr(agent, "is_scrubber", False),
                        "docked": getattr(agent, "docked", False),
                        "position": getattr(agent, "pos", (0, 0))
                    }
                    ship_details.append(details)
            return ship_details
        except Exception as e:
            print(f"Error in get_ship_details: {e}")
            return []
    
    def get_port_details(self):
        """Get details of ports for the data collector"""
        try:
            port_details = []
            for agent in self.schedule.agents:
                if isinstance(agent, Port):
                    # Extract key port properties
                    details = {
                        "id": getattr(agent, "unique_id", None),
                        "name": getattr(agent, "name", "Unknown"),
                        "country": getattr(agent, "country", "Unknown"),
                        "position": getattr(agent, "pos", (0, 0)),
                        "revenue": getattr(agent, "revenue", 0),
                        "ships_docked": len(getattr(agent, "docked_ships", [])),
                        "scrubber_policy": getattr(agent, "scrubber_policy", "Unknown")
                    }
                    port_details.append(details)
            return port_details
        except Exception as e:
            print(f"Error in get_port_details: {e}")
            return []
    
    def _setup_data_collector(self):
        """Sets up the datacollector"""
        # Initialize tracking for port and country revenue history
        self.revenue_history = {}
        self.port_revenue_history = {}
        
        self.datacollector = DataCollector(
            model_reporters = {
                "NumScrubberShips": lambda m: sum(1 for a in m.schedule.agents if isinstance(a, Ship) and getattr(a, 'is_scrubber', False)),
                "NumShips": lambda m: sum(1 for a in m.schedule.agents if isinstance(a, Ship)),
                "NumPorts": lambda m: sum(1 for a in m.schedule.agents if isinstance(a, Port)),
                "AveragePortRevenue": lambda m: statistics.mean([p.revenue for p in m.schedule.agents if isinstance(p, Port)]) if any(isinstance(p, Port) for p in m.schedule.agents) else 0,
                "TotalPortRevenue": lambda m: sum([p.revenue for p in m.schedule.agents if isinstance(p, Port)]),
                "AmsterdamRevenue": lambda m: m._get_port_revenue_by_name('Amsterdam'),
                "ShipTypesToDestinations": lambda m: m._get_ship_types_to_destinations('all'),
                "ScrubberShipTypesToDestinations": lambda m: m._get_ship_types_to_destinations('scrubber'),
                "NonScrubberShipTypesToDestinations": lambda m: m._get_ship_types_to_destinations('non-scrubber'),
                "CountryRevenues": lambda m: m._get_country_revenues(),
                "PortRevenues": lambda m: m._get_port_revenues(),
            },
            tables = {}
        )

    def get_terrain_matrix(self, width, height):
        """
        Generate or load a pre-computed terrain matrix
        """
        script_dir = os.path.dirname(os.path.abspath(__file__))
        cache_filename = os.path.join(script_dir, "terrain_matrix_cache.pkl")

        # check for cached version
        if os.path.exists(cache_filename):
            try:
                with open(cache_filename, 'rb') as f:
                    return pickle.load(f)
            except:
                pass

        # !DO NOT TRY TO CHANGE THIS WITHOUT ANDREY'S CONSENT CAUSE HE LOST HIS ABILITY TO SEE TRYING TO SET IT UP!
        land_regions = [
            # UK and islands
            [(0, 0), (0, 2), (26, 2), (26, 0)], [(0, 3), (0, 5), (20, 5), (20, 3), (0, 3)],
            [(0, 5), (0, 24), (26, 24), (32, 14), (26, 6), (0, 6)], [(0, 25), (20, 25), (10, 25), (0, 25)],
            [(0, 26), (20, 26), (10, 26), (0, 26)], [(0, 27), (18, 27), (10, 27), (0, 27)],
            [(0, 28), (0, 34), (18, 34), (18, 28), (0, 28)], [(0, 34), (0, 41), (10, 41), (10, 34), (0, 34)],
            [(11, 34), (11, 38), (12, 38), (12, 34)], [(11, 39), (11, 39), (11, 39), (11, 39)],
            [(0, 42), (0, 48), (10, 41)], [(0, 52), (4, 52), (4, 52)], [(0, 56), (0, 60), (6, 60)],
            [(0, 61), (0, 68), (10, 68), (5, 61)], [(8, 64), (8, 65), (8, 65)], [(9, 66), (9, 65), (9, 65)],
            [(0, 71), (0, 76), (7, 76), (2, 71)], [(0, 80), (0, 82), (2, 82), (0, 80)],
            [(10, 89), (13, 95), (15, 95), (10, 89)], [(10, 90), (10, 90), (10, 90)],

            # France and NL
            [(41, 0), (41, 1), (46, 1), (47, 0)], [(55, 0), (55, 5), (100, 5), (100, 0)],
            [(57, 5), (57, 10), (100, 10), (100, 5)], [(56, 6), (56, 6), (56, 6)],
            [(59, 11), (59, 12), (100, 12), (100, 11)], [(51, 5), (51, 6), (54, 3)],
            [(53, 10), (53, 13), (56, 10)], [(56, 11), (58, 11), (58, 11)],
            [(63, 13), (71, 21), (71, 13)], [(72, 13), (72, 21), (79, 21), (82, 13)],
            [(80, 19), (100, 19), (100, 12), (80, 13)], [(72, 22), (79, 22), (79, 22)],
            [(55, 15), (58, 15), (59, 15)], [(55, 16), (59, 23), (61, 17), (59, 16)],
            [(59, 21), (60, 22), (60, 22)], [(66, 16), (68, 22,), (74, 22), (74, 0)],
            [(75, 23), (78, 25), (78, 23)], [(86, 20), (86, 23), (100, 23), (100, 20)],
            [(84, 23), (86, 23), (86, 23)], [(85, 24), (85, 27), (92, 23)],
            [(87, 30), (100, 30), (100, 27), (90, 27)], [(95, 27), (100, 27), (100, 24), (95, 24)],

            # Denmark
            [(87, 31), (89, 40), (100, 40), (100, 31)], [(89, 41), (87, 50), (97, 60), (100, 60), (100, 0)],

            # Norway and Sweden
            [(60, 99), (100, 99), (100, 96), (60, 96)], [(61, 95), (100, 95), (100, 95)],
            [(61, 91), (61, 95), (100, 95), (100, 91)],
            [(61, 84), (61, 90), (94, 90), (94, 84)], [(64, 81), (64, 84), (89, 84), (89, 81)],
            [(70, 65), (64, 80), (94, 84), (80, 65)], [(95, 83), (95, 84), (95, 85)], [(96, 86), (95, 86), (97, 86)],
            [(96, 90), (95, 90), (95, 90)]
        ]

        # Convert to polygons
        land_polygons = [Polygon(region) for region in land_regions]

        # Initialize matrix with 'water'
        matrix = [['water' for _ in range(height)] for _ in range(width)]

        # Determine which cells are land
        for x in range(width):
            for y in range(height):
                point = Point(x, y)
                if any(polygon.covers(point) for polygon in land_polygons):
                    matrix[x][y] = 'land'

        # cache the result
        try:
            with open(cache_filename, 'wb') as f:
                pickle.dump(matrix, f)
        except:
            pass
        return matrix

    def _get_ship_types_to_destinations(self, filter_type='all'):
        """Collect data for top 5 ship types to destinations visualization
        
        Args:
            filter_type (str): Filter ships by type - 'all', 'scrubber', or 'non-scrubber'
        """
        # Create a dictionary to count ship types going to each destination
        ship_type_destination_counts = {}
        
        try:
            for agent in self.schedule.agents:
                if isinstance(agent, Ship) and hasattr(agent, 'route') and hasattr(agent, 'ship_type'):
                    # Filter by ship scrubber status if needed
                    is_scrubber = getattr(agent, 'is_scrubber', False)
                    if (filter_type == 'scrubber' and not is_scrubber) or \
                       (filter_type == 'non-scrubber' and is_scrubber):
                        continue
                        
                    # Only consider ships with valid routes and destinations
                    if agent.route and agent.current_target_index < len(agent.route):
                        ship_type = agent.ship_type
                        next_port = agent.route[agent.current_target_index]
                        
                        if hasattr(next_port, 'name'):
                            destination = next_port.name
                            
                            # Create the key for our counter
                            key = (ship_type, destination, str(is_scrubber))
                            if key not in ship_type_destination_counts:
                                ship_type_destination_counts[key] = 0
                            ship_type_destination_counts[key] += 1
            
            # If no data, return empty list
            if not ship_type_destination_counts:
                return []
                
            # Convert to list of tuples (source, target, value) for Sankey diagram
            sankey_data = [
                {
                    "source": ship_type,
                    "target": destination,
                    "value": count,
                    "metadata": {"isScrubber": is_scrubber == "True"}
                }
                for (ship_type, destination, is_scrubber), count in ship_type_destination_counts.items()
            ]
            
            # Sort by value (count) in descending order and take top matches
            sankey_data.sort(key=lambda x: x["value"], reverse=True)
            
            # Get top 5 ship types and top 5 destinations
            top_ship_types = list(set([item["source"] for item in sankey_data[:10]]))
            top_destinations = list(set([item["target"] for item in sankey_data[:10]]))
            
            # Limit to top 5 of each (if we have that many)
            top_ship_types = top_ship_types[:5]
            top_destinations = top_destinations[:5]
            
            # Filter data to only include top ship types and destinations
            filtered_sankey_data = [
                item for item in sankey_data 
                if item["source"] in top_ship_types and item["target"] in top_destinations
            ]
            
            return filtered_sankey_data
        except Exception as e:
            print(f"Error in _get_ship_types_to_destinations: {e}")
            return []
    
    def _get_port_country_mapping(self):
        """Helper method to map port names to countries"""
        port_to_country = {}
        for agent in self.schedule.agents:
            if isinstance(agent, Port) and hasattr(agent, 'name') and hasattr(agent, 'port_data'):
                # Country is stored in port_data dictionary, not directly on the Port object
                if 'country' in agent.port_data:
                    port_to_country[agent.name] = agent.port_data['country']
        return port_to_country
    
    def _get_country_revenues(self):
        """Collect revenue data by country for visualization"""
        try:
            # Get port-to-country mapping
            port_to_country = self._get_port_country_mapping()
            
            # Initialize country revenues
            country_revenues = {}
            
            # Aggregate revenues by country
            for agent in self.schedule.agents:
                if isinstance(agent, Port) and hasattr(agent, 'name') and hasattr(agent, 'revenue'):
                    port_name = agent.name
                    revenue = agent.revenue
                    
                    # Get country for this port
                    country = port_to_country.get(port_name, 'Unknown')
                    
                    # Initialize country entry if needed
                    if country not in country_revenues:
                        country_revenues[country] = 0
                    
                    # Add port revenue to country total
                    country_revenues[country] += revenue
            
            # Initialize revenue history if it doesn't exist
            if not hasattr(self, 'revenue_history'):
                self.revenue_history = {}
                
            # Update historical data if step count exists on the model
            if hasattr(self, 'step_count'):
                step = self.step_count
                
                # Initialize step entry for each country
                for country, revenue in country_revenues.items():
                    if country not in self.revenue_history:
                        self.revenue_history[country] = []
                    
                    # Store current revenue for this step
                    self.revenue_history[country].append({
                        "step": step,
                        "revenue": revenue
                    })
                    
                    # Keep only the most recent 100 steps to limit memory usage
                    if len(self.revenue_history[country]) > 100:
                        self.revenue_history[country] = self.revenue_history[country][-100:]
            
            return self.revenue_history
        except Exception as e:
            print(f"Error in _get_country_revenues: {e}")
            return {}
    
    def _get_port_revenue_by_name(self, port_name):
        """Get revenue for a specific port by name"""
        for agent in self.schedule.agents:
            if isinstance(agent, Port) and hasattr(agent, 'name') and agent.name == port_name:
                return getattr(agent, 'revenue', 0)
        return 0
        
    def _get_port_scrubber_revenue_by_name(self, port_name):
        """Get scrubber-specific revenue for a specific port by name"""
        for agent in self.schedule.agents:
            if isinstance(agent, Port) and hasattr(agent, 'name') and agent.name == port_name:
                return getattr(agent, 'scrubber_revenue', 0)
        return 0
        
    def _get_port_non_scrubber_revenue_by_name(self, port_name):
        """Get non-scrubber-specific revenue for a specific port by name"""
        for agent in self.schedule.agents:
            if isinstance(agent, Port) and hasattr(agent, 'name') and agent.name == port_name:
                return getattr(agent, 'non_scrubber_revenue', 0)
        return 0
        
    def _get_port_revenues(self):
        """Collect revenue data by port for visualization"""
        try:
            # Initialize port revenues dictionary
            port_revenues = {}
            port_scrubber_revenues = {}
            port_non_scrubber_revenues = {}
            
            # Get revenue for each port
            for agent in self.schedule.agents:
                if isinstance(agent, Port) and hasattr(agent, 'name') and hasattr(agent, 'revenue'):
                    port_name = agent.name
                    revenue = agent.revenue
                    scrubber_revenue = getattr(agent, 'scrubber_revenue', 0)
                    non_scrubber_revenue = getattr(agent, 'non_scrubber_revenue', 0)
                    
                    # Initialize port data with current value, even if no history
                    # This ensures we always have at least one data point
                    current_step = self.step_count if hasattr(self, 'step_count') else 0
                    current_data = [{"step": current_step, "revenue": revenue}]
                    current_scrubber_data = [{"step": current_step, "revenue": scrubber_revenue}]
                    current_non_scrubber_data = [{"step": current_step, "revenue": non_scrubber_revenue}]
                    
                    # Update the history tracking if we have step_count
                    if hasattr(self, 'step_count'):
                        step = self.step_count
                        
                        # Initialize history entries if needed
                        if not hasattr(self, 'port_revenue_history'):
                            self.port_revenue_history = {}
                        if not hasattr(self, 'port_scrubber_revenue_history'):
                            self.port_scrubber_revenue_history = {}
                        if not hasattr(self, 'port_non_scrubber_revenue_history'):
                            self.port_non_scrubber_revenue_history = {}
                            
                        # Initialize port entries if needed
                        if port_name not in self.port_revenue_history:
                            self.port_revenue_history[port_name] = []
                        if port_name not in self.port_scrubber_revenue_history:
                            self.port_scrubber_revenue_history[port_name] = []
                        if port_name not in self.port_non_scrubber_revenue_history:
                            self.port_non_scrubber_revenue_history[port_name] = []
                        
                        # Store current revenue for this step
                        self.port_revenue_history[port_name].append({
                            "step": step,
                            "revenue": revenue
                        })
                        self.port_scrubber_revenue_history[port_name].append({
                            "step": step,
                            "revenue": scrubber_revenue
                        })
                        self.port_non_scrubber_revenue_history[port_name].append({
                            "step": step,
                            "revenue": non_scrubber_revenue
                        })
                        
                        # Keep only the most recent 100 steps to limit memory usage
                        if len(self.port_revenue_history[port_name]) > 100:
                            self.port_revenue_history[port_name] = self.port_revenue_history[port_name][-100:]
                        if len(self.port_scrubber_revenue_history[port_name]) > 100:
                            self.port_scrubber_revenue_history[port_name] = self.port_scrubber_revenue_history[port_name][-100:]
                        if len(self.port_non_scrubber_revenue_history[port_name]) > 100:
                            self.port_non_scrubber_revenue_history[port_name] = self.port_non_scrubber_revenue_history[port_name][-100:]
                        
                        # Use history if available
                        if len(self.port_revenue_history[port_name]) > 0:
                            current_data = self.port_revenue_history[port_name]
                        if len(self.port_scrubber_revenue_history[port_name]) > 0:
                            current_scrubber_data = self.port_scrubber_revenue_history[port_name]
                        if len(self.port_non_scrubber_revenue_history[port_name]) > 0:
                            current_non_scrubber_data = self.port_non_scrubber_revenue_history[port_name]
                    
                    # Always provide at least current data
                    port_revenues[port_name] = current_data
                    port_scrubber_revenues[port_name] = current_scrubber_data
                    port_non_scrubber_revenues[port_name] = current_non_scrubber_data
            
            return port_revenues, port_scrubber_revenues, port_non_scrubber_revenues
        except Exception as e:
            print(f"Error in _get_port_revenues: {e}")
            return {}, {}, {}
            
    def step(self):
        """
        Advance the model by one step.
        """
        try:
            # If we've reached the maximum steps, stop to prevent runaway simulations
            if hasattr(self, 'step_count') and self.step_count >= 400:
                print(f"Maximum steps reached ({self.step_count}), stopping simulation")
                return False  # Signal to stop the simulation
                
            # Increment step count
            if hasattr(self, 'step_count'):
                self.step_count += 1
            else:
                self.step_count = 1
            
            # Collect data at the start of the step
            self.datacollector.collect(self)
            
            # Spawn additional ships over time if we have any remaining
            if self.remaining_ships > 0 and self.schedule.time < self.spawn_duration:
                # Calculate how many ships to spawn in this step
                ships_per_step = max(1, self.remaining_ships // (self.spawn_duration - self.schedule.time))
                ships_to_spawn = min(ships_per_step, self.remaining_ships)
                
                # Spawn the ships
                for _ in range(ships_to_spawn):
                    try:
                        self.spawn_ship(self.next_ship_id)
                        self.next_ship_id += 1
                        self.remaining_ships -= 1
                    except Exception as spawn_error:
                        print(f"Error spawning ship: {spawn_error}")
            
            # Step all agents - ONLY CALL THIS ONCE PER STEP
            # This was previously called twice which caused the agent duplication error
            self.schedule.step()
            
            return True  # Indicate successful step
        except Exception as e:
            print(f"Error in simulation step: {e}")
            # Log more details for debugging
            import traceback
            traceback.print_exc()
            return False  # Signal to stop the simulation


def agent_portrayal(agent):
    if isinstance(agent, Port):
        if hasattr(agent, 'scrubber_policy'):
            if agent.scrubber_policy == "ban":
                color = "green"
            elif agent.scrubber_policy == "tax":
                color = "yellow"
            elif agent.scrubber_policy == "subsidy":
                color = "blue"
            else:  # "allow" is the default
                color = "black"
        else:
            # For backwards compatibility with older model versions
            # Convert old boolean allow_scrubber to new policy colors
            color = "green" if agent.allow_scrubber else "red"
            
        grid_port_size = 2.4 if agent.port_capacity == 5 else 3

        #port information
        port_info = f"{agent.name} | Policy: {getattr(agent, 'scrubber_policy', 'allow')} | Capacity: {agent.current_capacity}/{agent.port_capacity}"

        return {
            "Shape": "rect",
            "Color": color,
            "Filled": "true",
            "Layer": 1,
            "w": grid_port_size,
            "h": grid_port_size,
            "port_name": agent.name,
            "text_color": "white",
            "max_capacity": agent.port_capacity,
            "current_capacity": agent.current_capacity,
            "port_info": port_info,  # Keep for backward compatibility
            "country": agent.port_data.get('country', 'Unknown'),  # Add country information
            "policy": getattr(agent, 'scrubber_policy', 'allow')  # Add policy separately
        }
    elif isinstance(agent, Ship):
        # Define color mapping for each ship type.
        # These must match the CSS classes in the frontend
        ship_colors = {
            "cargo": "blue",
            "tanker": "navy",
            "fishing": "yellow",
            "other": "gray",
            "tug": "orange",
            "passenger": "pink",
            "hsc": "purple",
            "dredging": "brown",
            "search": "green"
        }
        # Select color based on ship type.
        color = ship_colors.get(agent.ship_type, "gray")
        # Optional override: if the ship is a scrubber then color it red.
        if agent.is_scrubber:
            color = "red"
            
        # Create portrayal with full ship information
        portrayal = {
            "Shape": "circle",
            "Color": color,
            "Filled": "true",
            "Layer": 1,
            "r": 1,
            "ship_id": agent.unique_id,
            "ship_type": agent.ship_type,
            "is_scrubber": agent.is_scrubber
        }
        
        # Add docked status
        if hasattr(agent, 'docked'):
            portrayal["docked"] = agent.docked
            
        # Add exiting status
        if hasattr(agent, 'exiting'):
            portrayal["exiting"] = agent.exiting
            
        # Add wait time information
        if hasattr(agent, 'wait_time'):
            portrayal["wait_time"] = agent.wait_time
            
        # Add route information
        if hasattr(agent, 'route') and hasattr(agent, 'current_target_index'):
            portrayal["route_progress"] = f"{agent.current_target_index}/{len(agent.route)}"
            # Add next destination if available
            if agent.route and agent.current_target_index < len(agent.route):
                next_port = agent.route[agent.current_target_index]
                if hasattr(next_port, 'name'):
                    portrayal["next_port"] = next_port.name
                    
        return portrayal
    elif isinstance(agent, ScrubberTrail):
        return {
            "Shape": "circle",
            "Color": "orange",
            "Filled": "true",
            "Layer": 0,
            "r": 0.5
        }
    elif isinstance(agent, Terrain):
        if agent.terrain_type == 'water':
            return {
                "Shape": "rect",
                "Color": "lightblue",
                "Filled": "true",
                "Layer": 0,
                "w": 1,
                "h": 1
            }
        else:
            return {
                "Shape": "rect",
                "Color": "silver",
                "Filled": "true",
                "Layer": 0,
                "w": 1,
                "h": 1
            }


if __name__ == "__main__":
    # grid set up
    grid = CanvasGrid(agent_portrayal, 100, 100, 500, 500)
    
    # Define the model parameters that can be set by the user
    model_params = {
        'selected_port': UserSettableParameter('choice', 'Select Port to Configure',
                                             value="None",
                                             choices=["None"] + [port_data["name"] for port_data in Port.raw_port_data]),
        'national_ban': UserSettableParameter('choice', 'National Ban',
                                              value="None",
                                              choices=["None", "DE", "NL",
                                                       "GB", "NO"])
    }

    server = ModularServer(
        ShipPortModel,
        [grid],
        'North Sea Watch',
        model_params
    )
    server.port = 8521  # example port
    server.launch()