/**
 * User tracking service for North Sea Watch
 * 
 * This module provides functionality to track user behavior and page visits
 * and sends the data to the backend tracking API.
 */

import { API_BASE_URL } from '../config/api';

// Debug mode - set to true to enable console logs
const DEBUG_MODE = true;

// Only track on production environment (northseawatch.org)
const SHOULD_TRACK = () => {
  const hostname = window.location.hostname;
  return hostname.includes('northseawatch.org');
};

// Interface for tracking data
interface TrackingData {
  /**
   * The User Agent string from the browser
   */
  user_agent: string;
  
  /**
   * Type of device (mobile/desktop/unknown)
   * Will be determined on the server if not provided
   */
  device_type?: string;
  
  /**
   * Current page URL (must start with https://northseawatch.org/)
   */
  page_url: string;
  
  /**
   * The referring URL that led to the current page
   */
  referer?: string;
  
  /**
   * A unique identifier for the current session
   */
  session_id: string;
}

/**
 * Get or create a session ID for tracking
 * Uses sessionStorage to persist the ID during the browser session
 */
const getSessionId = (): string => {
  const storageKey = 'nsw_session_id';
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    // Generate a simple session ID (timestamp + random string)
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
};

/**
 * Track page view - collects user data and sends it to the tracking API
 * @param forceTrack - Force tracking regardless of environment
 * @param retryCount - Number of retry attempts (internal use only)
 */
export const trackPageView = async (forceTrack = false, retryCount = 0): Promise<void> => {
  const maxRetries = 2; // Maximum number of retry attempts
  
  // Skip tracking in development/test environments unless forced
  if (!forceTrack && !SHOULD_TRACK()) {
    DEBUG_MODE && console.log('[Tracking] Skipped in non-production environment');
    return;
  }
  
  try {
    // Current page URL must start with https://northseawatch.org/
    const pageUrl = window.location.href;
    
    // For testing/debugging purposes, allow tracking from any URL in development mode
    const isValidUrl = process.env.NODE_ENV === 'development' || pageUrl.startsWith('https://northseawatch.org/');
    
    if (!isValidUrl && !forceTrack) {
      DEBUG_MODE && console.log('[Tracking] Invalid page URL format, skipping tracking');
      return;
    }
    
    // Collect tracking data
    const trackingData: TrackingData = {
      user_agent: navigator.userAgent,
      page_url: pageUrl,
      referer: document.referrer || undefined,
      session_id: getSessionId()
    };
    
    // Log tracking data if debug mode is enabled
    if (DEBUG_MODE) {
      console.log('[Tracking] Sending tracking data:', trackingData);
    }
    
    // Send tracking data to the backend API
    const response = await fetch(`${API_BASE_URL}/api/v1/tracking/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trackingData),
      // Don't send cookies by default
      credentials: 'omit'
    });
    
    // Enhanced error reporting
    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      
      try {
        // Try to parse error response
        const errorData = await response.json();
        errorDetails += ` - ${JSON.stringify(errorData)}`;
      } catch (e) {
        // If response can't be parsed as JSON, use text
        try {
          const textError = await response.text();
          errorDetails += ` - ${textError.substring(0, 100)}${textError.length > 100 ? '...' : ''}`;
        } catch (e2) {
          // If all fails, just log what we have
          errorDetails += ' (Could not parse error details)';
        }
      }
      
      throw new Error(`Tracking API error - ${errorDetails}`);
    }
    
    const result = await response.json();
    
    if (DEBUG_MODE) {
      console.log('[Tracking] API response:', result);
    }
  } catch (error) {
    // Don't let tracking errors affect the user experience
    if (DEBUG_MODE) {
      console.error('[Tracking] Error:', error);
      // Log additional information that might help debug
      console.info('[Tracking] Debug info:', {
        apiUrl: `${API_BASE_URL}/api/v1/tracking/`,
        environment: process.env.NODE_ENV,
        hostname: window.location.hostname,
        userAgent: navigator.userAgent.substring(0, 100),
        retryCount
      });
    }
    
    // Implement retry logic for transient errors
    if (retryCount < maxRetries) {
      const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s, etc.
      DEBUG_MODE && console.log(`[Tracking] Retrying in ${retryDelay/1000}s... (Attempt ${retryCount + 1}/${maxRetries})`);
      
      // Wait and retry
      setTimeout(() => {
        trackPageView(forceTrack, retryCount + 1);
      }, retryDelay);
    }
  }
};

/**
 * Enable or disable debug mode for tracking
 */
export const setTrackingDebugMode = (enabled: boolean): void => {
  (window as any).__NSWTrackingDebug = enabled;
};

/**
 * Check if debug mode is enabled
 */
export const isTrackingDebugEnabled = (): boolean => {
  return (window as any).__NSWTrackingDebug || DEBUG_MODE;
}; 