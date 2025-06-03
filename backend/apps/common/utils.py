"""
Utility functions for the North Sea Watch project.
"""
import ipaddress
import logging
import re

logger = logging.getLogger(__name__)

# List of trusted proxy IP patterns (can be expanded as needed)
TRUSTED_PROXIES = [
    # GCP load balancers
    r'^35\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}$',  # GCP load balancer IPs
    # Internal proxy server IPs
    r'^10\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}$',
    r'^172\.(1[6-9]|2[0-9]|3[0-1])\.[\d]{1,3}\.[\d]{1,3}$',
    r'^192\.168\.[\d]{1,3}\.[\d]{1,3}$',
    # Localhost
    r'^127\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}$',
    r'^::1$'
]

def get_real_client_ip(request):
    """
    Extract the real client IP address from the request.
    
    This function attempts to determine the client's real IP address by examining
    the X-Forwarded-For header, which is typically set by proxies and load balancers.
    
    The function implements multiple fallback strategies:
    1. Parse X-Forwarded-For header for the first non-internal IP
    2. Try other common IP headers if X-Forwarded-For is not available
    3. Fall back to REMOTE_ADDR if no proxy headers are available
    
    Args:
        request: The Django request object
        
    Returns:
        str: The identified client IP address or "Unknown" if none could be determined
    """
    # Initialize with fallback value
    ip_address = "Unknown"
    
    try:
        # Check for X-Forwarded-For header (most common for proxies)
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        
        if forwarded_for:
            # Clean and validate the header
            if len(forwarded_for) > 1000:  # Protect against abnormally long headers
                logger.warning("Suspiciously long X-Forwarded-For header received")
                forwarded_for = None
            else:
                # Clean the forwarded_for string and split into IPs
                forwarded_for = re.sub(r'[^0-9a-fA-F:.,]', '', forwarded_for)
                ip_list = [ip.strip() for ip in forwarded_for.split(',') if ip.strip()]
                
                # If we have IPs in the list, process them
                if ip_list:
                    # Strategy 1: Get the first non-trusted proxy IP (from left to right)
                    for ip in ip_list:
                        if not _is_trusted_proxy(ip) and _is_valid_ip(ip):
                            ip_address = ip
                            break
                    
                    # Strategy 2: If all IPs are trusted or invalid, take the leftmost one
                    if ip_address == "Unknown" and ip_list:
                        ip_address = ip_list[0]
        
        # If X-Forwarded-For doesn't yield a result, try alternative headers
        if ip_address == "Unknown":
            # Try other common proxy headers
            for header in ['HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'HTTP_X_CLIENT_IP', 'HTTP_X_CLUSTER_CLIENT_IP']:
                if header in request.META:
                    potential_ip = request.META[header].strip()
                    if _is_valid_ip(potential_ip) and not _is_internal_ip(potential_ip):
                        ip_address = potential_ip
                        break
        
        # Last resort: REMOTE_ADDR (direct connection IP)
        if ip_address == "Unknown" and 'REMOTE_ADDR' in request.META:
            remote_addr = request.META['REMOTE_ADDR'].strip()
            if _is_valid_ip(remote_addr):
                # For REMOTE_ADDR, we accept internal IPs since it might be a direct connection
                ip_address = remote_addr
        
        # Final validation
        if ip_address != "Unknown":
            # Standardize IP format
            ip_address = ip_address.strip()
            
            # For internal IPs in production, we might want to mark them as unknown
            if _is_internal_ip(ip_address):
                logger.info(f"Internal IP detected: {ip_address}")
                # Uncomment below if you want to mask internal IPs
                # ip_address = "Unknown"
    
    except Exception as e:
        logger.exception(f"Error determining client IP: {str(e)}")
        ip_address = "Unknown"
    
    return ip_address

def _is_trusted_proxy(ip):
    """
    Check if an IP belongs to a trusted proxy.
    
    Args:
        ip (str): The IP address to check
        
    Returns:
        bool: True if the IP is from a trusted proxy, False otherwise
    """
    try:
        for pattern in TRUSTED_PROXIES:
            if re.match(pattern, ip):
                return True
        return False
    except Exception:
        return False

def _is_valid_ip(ip):
    """
    Validate if a string is a properly formatted IP address.
    
    Args:
        ip (str): The IP string to validate
        
    Returns:
        bool: True if the IP is valid, False otherwise
    """
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False

def _is_internal_ip(ip):
    """
    Check if an IP is an internal/private network address.
    
    Args:
        ip (str): The IP address to check
        
    Returns:
        bool: True if the IP is internal, False otherwise
    """
    try:
        ip_obj = ipaddress.ip_address(ip)
        return (
            ip_obj.is_private or
            ip_obj.is_loopback or
            ip_obj.is_link_local or
            ip_obj.is_reserved
        )
    except ValueError:
        return False 