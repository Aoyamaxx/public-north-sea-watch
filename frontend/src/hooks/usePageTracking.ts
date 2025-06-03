/**
 * Hook for tracking page views
 * 
 * This hook will automatically track page views when the component mounts
 * or when the location changes.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/tracking';

/**
 * React hook to track page views
 * Tracks when component mounts and when location changes
 */
export const usePageTracking = (): void => {
  const location = useLocation();
  
  useEffect(() => {
    // Track page view on component mount and location changes
    trackPageView();
    
    // Return a cleanup function (not used but follows React hooks pattern)
    return () => {
      // No cleanup needed
    };
  }, [location.pathname]); // Re-run when the path changes
}; 