"""
Tests for utility functions in the common app.
"""
from unittest.mock import MagicMock
from django.test import TestCase, RequestFactory
from apps.common.utils import (
    get_real_client_ip, 
    _is_trusted_proxy, 
    _is_valid_ip, 
    _is_internal_ip
)

class IPUtilsTestCase(TestCase):
    """Test cases for IP utility functions."""
    
    def setUp(self):
        """Set up test data."""
        self.factory = RequestFactory()
    
    def test_get_real_client_ip_with_x_forwarded_for(self):
        """Test extracting IP from X-Forwarded-For header."""
        # Single IP in X-Forwarded-For
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = '203.0.113.1'
        self.assertEqual(get_real_client_ip(request), '203.0.113.1')
        
        # Multiple IPs in X-Forwarded-For (should get first non-trusted)
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = '203.0.113.1, 10.0.0.1, 192.168.1.1'
        self.assertEqual(get_real_client_ip(request), '203.0.113.1')
        
        # GCP load balancer format (client IP, GCP LB IP)
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = '203.0.113.1, 35.191.0.1'
        self.assertEqual(get_real_client_ip(request), '203.0.113.1')
        
        # All trusted proxies, should take leftmost
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = '10.0.0.1, 192.168.1.1'
        self.assertEqual(get_real_client_ip(request), '10.0.0.1')
    
    def test_get_real_client_ip_with_alternative_headers(self):
        """Test extracting IP from alternative headers."""
        # X-Real-IP
        request = self.factory.get('/')
        request.META['HTTP_X_REAL_IP'] = '203.0.113.1'
        self.assertEqual(get_real_client_ip(request), '203.0.113.1')
        
        # Client-IP
        request = self.factory.get('/')
        request.META['HTTP_CLIENT_IP'] = '203.0.113.1'
        self.assertEqual(get_real_client_ip(request), '203.0.113.1')
    
    def test_get_real_client_ip_with_remote_addr(self):
        """Test fallback to REMOTE_ADDR."""
        request = self.factory.get('/')
        request.META['REMOTE_ADDR'] = '203.0.113.1'
        self.assertEqual(get_real_client_ip(request), '203.0.113.1')
    
    def test_get_real_client_ip_with_invalid_input(self):
        """Test handling of invalid input."""
        # Invalid IP format
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = 'not-an-ip'
        self.assertEqual(get_real_client_ip(request), 'Unknown')
        
        # Overly long header (potential attack)
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = ',' * 2000
        self.assertEqual(get_real_client_ip(request), 'Unknown')
        
        # Missing headers
        request = self.factory.get('/')
        self.assertEqual(get_real_client_ip(request), 'Unknown')
    
    def test_is_trusted_proxy(self):
        """Test identification of trusted proxies."""
        # GCP load balancer
        self.assertTrue(_is_trusted_proxy('35.191.0.1'))
        
        # Internal IP
        self.assertTrue(_is_trusted_proxy('10.0.0.1'))
        self.assertTrue(_is_trusted_proxy('192.168.1.1'))
        self.assertTrue(_is_trusted_proxy('127.0.0.1'))
        
        # Non-trusted IP
        self.assertFalse(_is_trusted_proxy('203.0.113.1'))
    
    def test_is_valid_ip(self):
        """Test IP validation."""
        # Valid IPv4
        self.assertTrue(_is_valid_ip('192.168.1.1'))
        self.assertTrue(_is_valid_ip('0.0.0.0'))
        self.assertTrue(_is_valid_ip('255.255.255.255'))
        
        # Valid IPv6
        self.assertTrue(_is_valid_ip('::1'))
        self.assertTrue(_is_valid_ip('2001:db8::1'))
        
        # Invalid inputs
        self.assertFalse(_is_valid_ip('not-an-ip'))
        self.assertFalse(_is_valid_ip('256.256.256.256'))
        self.assertFalse(_is_valid_ip('192.168.1'))
    
    def test_is_internal_ip(self):
        """Test internal IP detection."""
        # Private IPv4
        self.assertTrue(_is_internal_ip('10.0.0.1'))
        self.assertTrue(_is_internal_ip('172.16.0.1'))
        self.assertTrue(_is_internal_ip('192.168.1.1'))
        
        # Loopback
        self.assertTrue(_is_internal_ip('127.0.0.1'))
        self.assertTrue(_is_internal_ip('::1'))
        
        # Public IP
        self.assertFalse(_is_internal_ip('203.0.113.1'))
        self.assertFalse(_is_internal_ip('2001:db8::1')) 