import logging
import traceback
from django.http import HttpResponse

logger = logging.getLogger(__name__)

class AdminDebugMiddleware:
    """
    Middleware to help debug admin page issues in production.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        logger.info("AdminDebugMiddleware initialized")

    def __call__(self, request):
        # Process the request
        if request.path.startswith('/admin/'):
            logger.info(f"Admin request received: {request.path}")
            logger.info(f"Request method: {request.method}")
            logger.info(f"Request headers: {dict(request.headers)}")
            logger.info(f"Request GET params: {dict(request.GET)}")
            logger.info(f"Host: {request.get_host()}")
            logger.info(f"ALLOWED_HOSTS setting: {request.META.get('ALLOWED_HOSTS', 'Not available')}")
            
            # Log static file related headers
            if 'Accept' in request.headers:
                logger.info(f"Accept header: {request.headers['Accept']}")
            if 'Content-Type' in request.headers:
                logger.info(f"Content-Type header: {request.headers['Content-Type']}")
            
            # Log cookies
            logger.info(f"Request cookies: {request.COOKIES}")
            
            # Log session info if available
            if hasattr(request, 'session'):
                logger.info(f"Session keys: {list(request.session.keys())}")
        
        try:
            response = self.get_response(request)
            
            # Log response info for admin requests
            if request.path.startswith('/admin/'):
                logger.info(f"Admin response status: {response.status_code}")
                logger.info(f"Admin response headers: {dict(response.headers)}")
                
                # If response is empty or suspiciously small, log it
                if response.status_code == 200 and len(response.content) < 1000:
                    logger.warning(f"Admin response content is suspiciously small: {len(response.content)} bytes")
                    logger.warning(f"Response content preview: {response.content[:200]}")
                    
                    # If it's HTML, check for specific patterns
                    if 'text/html' in response.get('Content-Type', ''):
                        content_str = response.content.decode('utf-8', errors='ignore')
                        if '<html' not in content_str:
                            logger.error("Response doesn't contain HTML tag")
                        if '<head' not in content_str:
                            logger.error("Response doesn't contain HEAD tag")
                        if '<body' not in content_str:
                            logger.error("Response doesn't contain BODY tag")
                        if 'static' in content_str:
                            logger.info("Response contains references to static files")
                
                # Check for redirects
                if response.status_code in (301, 302, 303, 307, 308):
                    logger.info(f"Redirect detected to: {response.get('Location', 'unknown')}")
            
            return response
        except Exception as e:
            logger.error(f"Exception in AdminDebugMiddleware: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Only in admin pages, return debug info
            if request.path.startswith('/admin/'):
                return HttpResponse(
                    f"Admin page error: {str(e)}<br><pre>{traceback.format_exc()}</pre>", 
                    content_type="text/html"
                )
            raise 