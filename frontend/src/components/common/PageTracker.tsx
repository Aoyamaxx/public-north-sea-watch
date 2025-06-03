/**
 * PageTracker component
 * 
 * A utility component for tracking page views.
 * Can be placed in any component where tracking is required.
 */

import React, { useEffect } from 'react';
import { trackPageView } from '../../utils/tracking';

interface PageTrackerProps {
  /**
   * The path to track, defaults to current URL
   */
  path?: string;
  
  /**
   * Additional properties to track
   */
  extraProps?: Record<string, any>;
}

/**
 * PageTracker component - tracks page views when mounted
 */
const PageTracker: React.FC<PageTrackerProps> = ({ path, extraProps }) => {
  useEffect(() => {
    // Track the page view when the component mounts
    trackPageView();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // This is an invisible component, so it doesn't render anything
  return null;
};

export default PageTracker; 