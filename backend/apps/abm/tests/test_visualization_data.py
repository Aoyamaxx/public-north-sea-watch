import unittest
from ..mesa.mesa_model import ShipPortModel
from ..mesa.port import Port

class MesaVisualizationDataTest(unittest.TestCase):
    """Test the visualization data collection in the ABM model directly"""
    
    def setUp(self):
        # Create a small model instance for testing
        self.model = ShipPortModel(
            width=100, 
            height=100, 
            num_ships=10,  # Using a small number of ships for faster tests
            ship_wait_time=10
        )
        
        # Force step to populate data
        self.model.step_count = 0
        self.model.step()
    
    def test_ship_types_to_destinations_data(self):
        """Test that the ShipTypesToDestinations method returns data in the expected format"""
        # Get the visualization data
        sankey_data = self.model._get_ship_types_to_destinations()
        
        # Verify it's a list
        self.assertIsInstance(sankey_data, list)
        
        # It might be empty if no ships have routes yet, but we can still check the structure
        # if there are elements
        if sankey_data:
            first_item = sankey_data[0]
            self.assertIn('source', first_item)
            self.assertIn('target', first_item)
            self.assertIn('value', first_item)
            
            # Check that value is a number
            self.assertIsInstance(first_item['value'], (int, float))
    
    def test_port_country_mapping(self):
        """Test that the port to country mapping function works correctly"""
        # Get the port-country mapping
        port_country_mapping = self.model._get_port_country_mapping()
        
        # Verify it's a dictionary
        self.assertIsInstance(port_country_mapping, dict)
        
        # There should be at least some ports with countries
        self.assertGreater(len(port_country_mapping), 0)
        
        # Check entries have the right structure
        for port_name, country in port_country_mapping.items():
            self.assertIsInstance(port_name, str)
            self.assertIsInstance(country, str)
    
    def test_country_revenues_data(self):
        """Test that the CountryRevenues method returns data in the expected format"""
        # Initialize revenue history (normally done in _setup_data_collector)
        if not hasattr(self.model, 'revenue_history'):
            self.model.revenue_history = {}
            
        # Make sure step_count is set (for history tracking)
        self.model.step_count = 1
        
        # Get the visualization data
        country_revenues = self.model._get_country_revenues()
        
        # Verify it's a dictionary
        self.assertIsInstance(country_revenues, dict)
        
        # If there are entries, check the structure
        if country_revenues:
            # Get the first country
            first_country = list(country_revenues.keys())[0]
            country_data = country_revenues[first_country]
            
            # Should be a list of step data
            self.assertIsInstance(country_data, list)
            
            # If there are steps, check the structure
            if country_data:
                step_data = country_data[0]
                self.assertIn('step', step_data)
                self.assertIn('revenue', step_data)
                
                # Check that step and revenue are numbers
                self.assertIsInstance(step_data['step'], (int, float))
                self.assertIsInstance(step_data['revenue'], (int, float))
    
    def test_port_revenue_by_name(self):
        """Test that the port revenue by name method returns the expected data type"""
        # Test with Amsterdam (should exist in the model)
        amsterdam_revenue = self.model._get_port_revenue_by_name('Amsterdam')
        
        # Verify it's a number (int or float)
        self.assertIsInstance(amsterdam_revenue, (int, float))
        
        # Test with a port that doesn't exist
        nonexistent_revenue = self.model._get_port_revenue_by_name('NonexistentPort')
        self.assertEqual(nonexistent_revenue, 0)  # Should return 0 for nonexistent ports

if __name__ == '__main__':
    unittest.main()
