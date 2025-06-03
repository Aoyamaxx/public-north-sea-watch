import React, { useEffect, useState, useRef, useCallback } from 'react';

// Add playback speed constants for different time units
const PLAYBACK_SPEEDS = {
  HOUR: 800,
  DAY: 1000,
  WEEK: 5000,
  MONTH: 10000,
  YEAR: 10000
};

// Add CSS styles as a string to be injected
const cssStyles = `
.psd-timeline-container {
  transition: all 0.3s ease-in-out;
  transform-origin: top center;
}

.psd-timeline-container.psd-minimized {
  transform: scale(1);
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.85) !important; /* White transparent background like main component */
  border: 3px solid white; /* Default white border */
}

.psd-timeline-container.psd-minimized.playing {
  animation: borderColorChange 2s infinite alternate; /* Color changing animation for border when playing */
}

.psd-mini-waveform-canvas {
  border-radius: 50%;
}

.psd-timeline-minimize, .psd-timeline-close {
  transition: opacity 0.2s ease;
  color: #777777 !important; /* Gray button color */
  font-size: 22px !important; /* Slightly smaller font size */
}

.psd-timeline-minimize:hover, .psd-timeline-close:hover {
  opacity: 0.8;
}

/* .psd-minimized-indicator {
  position: absolute;
  bottom: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: rgba(255, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  animation: pulse 1.5s infinite;
} */

/* Define animation for border color change (red to green) */
@keyframes borderColorChange {
  0% {
    border-color: rgba(255, 0, 0, 0.7); /* Red */
  }
  50% {
    border-color: rgba(255, 150, 0, 0.7); /* Orange as transition */
  }
  100% {
    border-color: rgba(0, 175, 0, 0.7); /* Green */
  }
}

/* Remove previous animation */
/* @keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.5);
  }
  
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 5px rgba(255, 0, 0, 0);
  }
  
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0);
  }
} */

/* Responsive adjustments */
@media screen and (max-width: 768px) {
  .psd-timeline-container:not(.psd-minimized) {
    max-width: 95vw;
  }
  
  .psd-timeline-title {
    font-size: 14px;
  }
  
  .psd-minimized {
    top: 30px !important;
    width: 50px !important;
    height: 50px !important;
  }
}

@media screen and (max-width: 1024px) {
  .psd-timeline-container {
    left: 47.3% !important;
    top: 60px !important;
  }
}

@media screen and (max-width: 820px) {
  .psd-timeline-container {
    left: 46.5% !important;
    top: 60px !important;
  }
}

@media screen and (max-width: 768px) {
  .psd-timeline-container {
    left: 47% !important;
    top: 40px !important;
  }
}

@media screen and (max-width: 480px) {
  .psd-timeline-container:not(.psd-minimized) {
    max-width: 98vw;
  }
  
  .psd-timeline-title {
    font-size: 12px;
    max-width: 70%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .psd-minimized {
    top: 30px !important;
    width: 45px !important;
    height: 45px !important;
  }

  @media screen and (max-width: 375px) {
  .psd-timeline-container {
    left: 44.6% !important;
    top: 25px !important;
  }

  @media screen and (max-width: 320px) {
  .psd-timeline-container {
    left: 43.6% !important;
    top: 25px !important;
  }
}
}
`;

interface TimeGroup {
  interval_start: string;
  interval_end: string;
  positions: any[];
  vessel_count?: number; // Count of vessels in this timeframe
}

interface QueryParams {
  time_value: number;
  time_unit: string;
  actual_unit: string;
  target_start_time: string;
  adjusted_start_time: string;
  end_time: string;
  data_availability?: {
    earliest_record: string | null;
    start_adjusted: boolean;
  };
}

interface PsdTimelineSliderProps {
  timeGroups: TimeGroup[];
  onTimeGroupChange: (index: number) => void;
  isLoading?: boolean;
  onClose: () => void;
  timeUnit: string;
  pastScrubberValue: string;
  queryParams?: QueryParams;
}

const PsdTimelineSlider: React.FC<PsdTimelineSliderProps> = ({ 
  timeGroups, 
  onTimeGroupChange, 
  isLoading = false,
  onClose,
  timeUnit,
  pastScrubberValue,
  queryParams
}) => {
  // currentIndex now represents the DATA index (0 = Past/Left, timeGroups.length - 1 = Now/Right)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [maxVesselCount, setMaxVesselCount] = useState(0);
  const [maxUniqueVesselCount, setMaxUniqueVesselCount] = useState(0);
  const [showAdjustmentMessage, setShowAdjustmentMessage] = useState(true);
  const [minimized, setMinimized] = useState(false);  // State to track if component is minimized
  const [forceRedraw, setForceRedraw] = useState(0); // State to force redraw of waveform
  const intervalRef = useRef<number | null>(null);
  const navIntervalRef = useRef<number | null>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const miniWaveformRef = useRef<HTMLCanvasElement>(null);  // Ref for mini waveform canvas
  const [isPrevButtonHeld, setIsPrevButtonHeld] = useState(false);
  const [isNextButtonHeld, setIsNextButtonHeld] = useState(false);
  const buttonPressTimerRef = useRef<number | null>(null);
  const lastActionTimeRef = useRef<number>(0); // Track the time of last action to prevent duplicates
  
  // Get window size for responsive design
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Update window size on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Determine minimized position based on screen size
  const getMinimizedPosition = () => {
    const isMobile = windowSize.width <= 768;
    const isSmallMobile = windowSize.width <= 480;
    
    return {
      top: isSmallMobile ? '30px' : isMobile ? '40px' : '40px',
      right: isSmallMobile ? '5px' : isMobile ? '10px' : '20px',
      width: isSmallMobile ? '45px' : isMobile ? '50px' : '60px',
      height: isSmallMobile ? '45px' : isMobile ? '50px' : '60px',
    };
  };
  
  // Calculate max vessel count and ensure vessel_count is properly set for all time groups
  useEffect(() => {
    if (timeGroups.length > 0) {
      console.debug(`Processing ${timeGroups.length} time groups from ${timeUnit} (${pastScrubberValue}) query`);
      // Output detailed JSON of first group for debugging
      console.debug('Sample time group data:', JSON.stringify(timeGroups[0], null, 2));
      
      // Ensure all timeGroups have vessel_count calculated correctly
      const processedTimeGroups = timeGroups.map(group => {
        // Deep clone to avoid modifying original data
        const processedGroup = { ...group };
        
        // If vessel_count is missing or seems incorrect (e.g. 0), calculate it from positions
        if (!processedGroup.vessel_count || processedGroup.vessel_count === 0) {
          // Calculate unique IMOs in this time group
          const uniqueImos = new Set();
          processedGroup.positions.forEach(position => {
            if (position.imo_number) {
              uniqueImos.add(position.imo_number);
            }
          });
          
          // Set vessel_count to the number of unique IMOs
          processedGroup.vessel_count = uniqueImos.size;
          
          console.debug(`Had to calculate vessel_count for interval ${processedGroup.interval_start}: ${processedGroup.vessel_count} unique IMOs from ${processedGroup.positions.length} positions`);
        }
        return processedGroup;
      });
      
      // Collect all unique IMOs across all time groups
      const allUniqueImos = new Set();
      processedTimeGroups.forEach(group => {
        group.positions.forEach(position => {
          if (position.imo_number) {
            allUniqueImos.add(position.imo_number);
          }
        });
      });
      console.debug(`Total unique IMOs across all time groups: ${allUniqueImos.size}`);
      
      // Use positions.length for waveform visualization to reflect all data points
      // This ensures the waveform represents the total distribution including duplicates
      const maxCount = Math.max(...processedTimeGroups.map(group => group.positions.length));
      setMaxVesselCount(maxCount > 0 ? maxCount : 1);
      
      // Calculate maximum unique vessel count (from vessel_count field)
      const maxUniqueCount = Math.max(...processedTimeGroups.map(group => group.vessel_count || 1));
      setMaxUniqueVesselCount(maxUniqueCount > 0 ? maxUniqueCount : 1);
      
      // Log information to help debug the issue
      console.debug('Time Groups Summary:');
      console.debug(`Time unit: ${timeUnit}, Actual unit: ${queryParams?.actual_unit || 'unknown'}, Past Scrubber Value: ${pastScrubberValue}`);
      console.debug(`Number of time groups: ${processedTimeGroups.length}`);
      console.debug(`Average records per group: ${(processedTimeGroups.reduce((sum, group) => sum + group.positions.length, 0) / processedTimeGroups.length).toFixed(2)}`);
      console.debug(`Average unique vessels per group: ${(processedTimeGroups.reduce((sum, group) => sum + (group.vessel_count || 0), 0) / processedTimeGroups.length).toFixed(2)}`);
      console.debug(`Max records in a group: ${maxCount}`);
      console.debug(`Max unique vessels in a group: ${maxUniqueCount}`);
      
      // Add comparison between first and last time group
      if (processedTimeGroups.length > 1) {
        const firstGroup = processedTimeGroups[0];
        const lastGroup = processedTimeGroups[processedTimeGroups.length - 1];
        console.debug('First time group:', {
          interval: firstGroup.interval_start,
          records: firstGroup.positions.length,
          uniqueVessels: firstGroup.vessel_count
        });
        console.debug('Last time group:', {
          interval: lastGroup.interval_start,
          records: lastGroup.positions.length,
          uniqueVessels: lastGroup.vessel_count
        });
      }
    }
  }, [timeGroups, timeUnit, pastScrubberValue, queryParams]);
  
  // Get playback speed based on time unit
  const getPlaybackSpeed = useCallback(() => {
    // Get the actual unit from query params, default to "Hour" if not available
    const actualUnit = (queryParams?.actual_unit || 'Hour').toUpperCase();
    
    // Return the appropriate playback speed based on time unit
    switch(actualUnit) {
      case 'HOUR':
        return PLAYBACK_SPEEDS.HOUR;
      case 'DAY':
        return PLAYBACK_SPEEDS.DAY;
      case 'WEEK':
        return PLAYBACK_SPEEDS.WEEK;
      case 'MONTH':
        return PLAYBACK_SPEEDS.MONTH;
      case 'YEAR':
        return PLAYBACK_SPEEDS.YEAR;
      default:
        return PLAYBACK_SPEEDS.HOUR; // Default to Hour speed
    }
  }, [queryParams]);
  
  // Start continuous navigation (when holding left/right arrows)
  const startContinuousNavigation = useCallback((direction: 'prev' | 'next') => {
    if (navIntervalRef.current !== null) return;
    
    // First immediate step
    if (direction === 'prev') {
      // "Previous" in UI (left arrow) means going left (towards Past) - DECREASING index
      const newDataIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setCurrentIndex(newDataIndex);
      onTimeGroupChange(newDataIndex);
    } else {
      // "Next" in UI (right arrow) means going right (towards Now) - INCREASING index
      const newDataIndex = currentIndex < timeGroups.length - 1 ? currentIndex + 1 : timeGroups.length - 1;
      setCurrentIndex(newDataIndex);
      onTimeGroupChange(newDataIndex);
    }
    
    // Get appropriate navigation speed based on time unit (half the playback speed for smoother navigation)
    const navigationSpeed = getPlaybackSpeed() / 2;
    
    // Then continuous steps every interval
    navIntervalRef.current = window.setInterval(() => {
      if (direction === 'prev') {
        setCurrentIndex(prevIndex => {
          // Move left (towards Past) - DECREASING index
          const newDataIndex = prevIndex > 0 ? prevIndex - 1 : 0;
          if (newDataIndex !== prevIndex) {
            onTimeGroupChange(newDataIndex);
          }
          return newDataIndex;
        });
      } else {
        setCurrentIndex(prevIndex => {
          // Move right (towards Now) - INCREASING index
          const newDataIndex = prevIndex < timeGroups.length - 1 ? prevIndex + 1 : timeGroups.length - 1;
          if (newDataIndex !== prevIndex) {
            onTimeGroupChange(newDataIndex);
          }
          return newDataIndex;
        });
      }
    }, navigationSpeed); // Use navigation speed based on time unit
  }, [currentIndex, timeGroups.length, onTimeGroupChange, getPlaybackSpeed]);
  
  // Handle button press start for navigation buttons with debounce
  const handleNavButtonPress = useCallback((direction: 'prev' | 'next', eventType: 'mouse' | 'touch') => {
    // Prevent double-firing from touch events also triggering mouse events on mobile
    const now = Date.now();
    
    // If this event happens too soon after the last one (within 100ms), ignore it
    if (now - lastActionTimeRef.current < 100) {
      return;
    }
    
    // Update the last action time
    lastActionTimeRef.current = now;
    
    // Clear any existing timers
    if (buttonPressTimerRef.current !== null) {
      window.clearTimeout(buttonPressTimerRef.current);
      buttonPressTimerRef.current = null;
    }
    
    // Set the appropriate button state
    if (direction === 'prev') {
      setIsPrevButtonHeld(true);
    } else {
      setIsNextButtonHeld(true);
    }
    
    // Start a timer to detect long press (100ms)
    buttonPressTimerRef.current = window.setTimeout(() => {
      startContinuousNavigation(direction);
    }, 100);
    
    // Also do the immediate single step
    if (direction === 'prev') {
      // "Previous" in UI (left arrow) means going left (towards Past) - DECREASING index
      if (currentIndex > 0) {
        const newDataIndex = currentIndex - 1;
        setCurrentIndex(newDataIndex);
        onTimeGroupChange(newDataIndex);
      }
    } else {
      // "Next" in UI (right arrow) means going right (towards Now) - INCREASING index
      if (currentIndex < timeGroups.length - 1) {
        const newDataIndex = currentIndex + 1;
        setCurrentIndex(newDataIndex);
        onTimeGroupChange(newDataIndex);
      }
    }
  }, [currentIndex, timeGroups.length, onTimeGroupChange, startContinuousNavigation]);
  
  // Handle button release with debounce
  const handleNavButtonRelease = useCallback((eventType: 'mouse' | 'touch') => {
    // Update the last action time
    lastActionTimeRef.current = Date.now();
    
    // Clear the long press timer
    if (buttonPressTimerRef.current !== null) {
      window.clearTimeout(buttonPressTimerRef.current);
      buttonPressTimerRef.current = null;
    }
    
    // Reset button states
    setIsPrevButtonHeld(false);
    setIsNextButtonHeld(false);
    
    // Stop continuous navigation if it was started
    stopContinuousNavigation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Stop continuous navigation
  const stopContinuousNavigation = useCallback(() => {
    if (navIntervalRef.current !== null) {
      window.clearInterval(navIntervalRef.current);
      navIntervalRef.current = null;
    }
  }, []);
  
  // Clean up navigation interval on unmount
  useEffect(() => {
    return () => {
      if (navIntervalRef.current !== null) {
        window.clearInterval(navIntervalRef.current);
      }
      if (buttonPressTimerRef.current !== null) {
        window.clearTimeout(buttonPressTimerRef.current);
      }
    };
  }, []);
  
  // Draw waveform on canvas when data changes or component mounts
  useEffect(() => {
    if (!waveformRef.current || timeGroups.length <= 1) return;
    
    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Wait a bit to ensure the canvas has its final dimensions
    const drawWaveform = () => {
      // Get the latest canvas dimensions
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // If dimensions are not ready yet, try again after a short delay
        console.debug('Canvas dimensions not ready, retrying...');
        setTimeout(drawWaveform, 50);
        return;
      }
      
      // Setup canvas with the correct dimensions
      const dpr = window.devicePixelRatio || 1;
      
      // Set the canvas dimensions considering device pixel ratio for sharper rendering
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Calculate horizontal inset to align with slider thumb
      // This is a critical value for perfect alignment
      const thumbRadius = 8; // Should match the thumb radius in CSS
      const totalWidth = rect.width;
      
      // Calculate points array for drawing waveform
      // Points array index now directly matches data index (0 = Past/Left, max = Now/Right)
      const points: [number, number][] = timeGroups.map((group, index) => {
        // For waveform visualization, use positions.length to show distribution of all data points
        // including repeated positions from the same vessel
        const count = group.positions.length;
        
        // For perfect alignment with range input thumbs:
        // If single point (index 0 of 1), center it
        // Otherwise space between the edges with proper insets
        let x;
        if (timeGroups.length === 1) {
          x = totalWidth / 2; // Center the single point
        } else {
          // First point is at thumbRadius, last point is at width-thumbRadius
          const usableWidth = totalWidth - (thumbRadius * 2);
          
          // Calculate position from left (Past) to right (Now)
          // Index directly maps to position now
          x = thumbRadius + (index / (timeGroups.length - 1)) * usableWidth;
        }
        
        // Invert Y because canvas 0,0 is top-left
        const y = rect.height - (count / maxVesselCount) * rect.height * 0.8;
        return [x, y];
      });
      
      // Draw waveform as a curved line
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        
        // Add gradient for the line
        const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
        gradient.addColorStop(0, 'rgba(153,0,0,0.9)');     // Deep red - high
        gradient.addColorStop(0.2, 'rgba(255,0,0,0.9)');   // Red
        gradient.addColorStop(0.4, 'rgba(255,128,0,0.8)'); // Orange
        gradient.addColorStop(0.6, 'rgba(255,255,0,0.7)'); // Yellow
        gradient.addColorStop(0.8, 'rgba(0,255,0,0.5)');   // Medium green
        gradient.addColorStop(1, 'rgba(0,255,0,0.2)');     // Light green - low
        
        // Draw curves between points
        for (let i = 1; i < points.length; i++) {
          const [x1, y1] = points[i-1];
          const [x2, y2] = points[i];
          const xc = (x1 + x2) / 2;
          const yc = (y1 + y2) / 2;
          ctx.quadraticCurveTo(x1, y1, xc, yc);
        }
        
        // Complete the curve to the last point
        const lastPoint = points[points.length - 1];
        ctx.quadraticCurveTo(lastPoint[0], lastPoint[1], lastPoint[0], lastPoint[1]);
        
        // Stroke the line
        ctx.lineWidth = 2;
        ctx.strokeStyle = gradient;
        ctx.stroke();
        
        // Fill the area below the curve
        ctx.lineTo(points[points.length - 1][0], rect.height);
        ctx.lineTo(points[0][0], rect.height);
        ctx.closePath();
        
        // Create gradient fill under the curve
        const fillGradient = ctx.createLinearGradient(0, 0, 0, rect.height);
        fillGradient.addColorStop(0, 'rgba(153,0,0,0.3)');     // Deep red - high
        fillGradient.addColorStop(0.2, 'rgba(255,0,0,0.3)');   // Red
        fillGradient.addColorStop(0.4, 'rgba(255,128,0,0.3)'); // Orange
        fillGradient.addColorStop(0.6, 'rgba(255,255,0,0.3)'); // Yellow
        fillGradient.addColorStop(0.8, 'rgba(0,255,0,0.2)');   // Medium green
        fillGradient.addColorStop(1, 'rgba(0,255,0,0.1)');     // Light green - low
        
        ctx.fillStyle = fillGradient;
        ctx.fill();
        
        // Highlight current point
        if (currentIndex < timeGroups.length) {
          // The currentIndex is now the data index, which directly matches the points array index
          const pointIndex = currentIndex;
          const [x, y] = points[pointIndex];
          
          // Get the data index (which is just currentIndex)
          const dataIndex = currentIndex;
          
          // Get color for current point based on value
          // Calculate the color based on the position data count (not vessel_count)
          // to maintain visual consistency with the waveform
          const count = timeGroups[dataIndex].positions.length;
          const normalizedValue = count / maxVesselCount; // 0 to 1 value
          
          // Determine color based on the same gradient used for waveform
          let pointColor;
          if (normalizedValue > 0.8) {
            pointColor = 'rgba(153,0,0,0.7)'; // Deep red
          } else if (normalizedValue > 0.6) {
            pointColor = 'rgba(255,0,0,0.7)'; // Red
          } else if (normalizedValue > 0.4) {
            pointColor = 'rgba(255,128,0,0.7)'; // Orange
          } else if (normalizedValue > 0.2) {
            pointColor = 'rgba(255,255,0,0.7)'; // Yellow
          } else {
            pointColor = 'rgba(0,255,0,0.7)'; // Green
          }
          
          // Draw outer glow with color matching the data value
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = pointColor;
          ctx.fill();
          
          // Draw inner circle
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = pointColor;
          ctx.fill();
          
          // Add a white center for better visibility
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = 'white';
          ctx.fill();
          
          // Add a small line down to the time axis with matching color
          ctx.beginPath();
          ctx.moveTo(x, y + 4);
          ctx.lineTo(x, rect.height - 5);
          ctx.strokeStyle = pointColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    };
    
    // Start the drawing process
    drawWaveform();
    
  }, [timeGroups, maxVesselCount, currentIndex, forceRedraw]);
  
  // Calculate fixed position for the vessel count display
  const calculateFixedDisplayPosition = useCallback(() => {
    // Return position that aligns with the slider (center of slider)
    return 50;
  }, []);

  // Get the optimal vessel count position
  const vesselCountPosition = calculateFixedDisplayPosition();
  
  // Format datetime based on actual time unit granularity
  const formatDateTimeByGranularity = (dateString: string, granularity?: string) => {
    try {
      let date: Date;
      
      if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('T')) {
        date = new Date(dateString);
      } else {

        const isoString = dateString.replace(' ', 'T') + 'Z';
        date = new Date(isoString);
      }
      
      const day = date.getUTCDate().toString().padStart(2, '0');
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = date.getUTCFullYear();
      const hour = date.getUTCHours().toString().padStart(2, '0');
      const minute = date.getUTCMinutes().toString().padStart(2, '0');
      
      // Get the actual granularity - either from parameter or from queryParams
      let actualUnit = granularity || (queryParams?.actual_unit || 'Hour');
      
      // Convert to lowercase for case-insensitive comparison
      const unitLower = actualUnit.toLowerCase();
      
      // Format according to granularity
      if (unitLower === 'hour') {
        // Full format with time and UTC indicator for hourly data
        return `${day}-${month}-${year} ${hour}:${minute} UTC`;
      } else if (unitLower === 'day' || unitLower === 'week') {
        // Only date for daily and weekly data - no time component
        return `${day}-${month}-${year}`;
      } else if (unitLower === 'month' || unitLower === 'year') {
        // Only month and year for monthly/yearly data
        return `${month}-${year}`;
      } else {
        // Default to full format
        return `${day}-${month}-${year} ${hour}:${minute}`;
      }
    } catch (e) {
      console.error("Error formatting date:", e, dateString);
      return dateString;
    }
  };
  
  // Get display message for time range
  const getTimeRangeMessage = () => {
    if (!queryParams) return null;
    
    const { end_time, adjusted_start_time, data_availability, actual_unit } = queryParams;
    
    // Format the dates using granularity-aware function
    const endTimeFormatted = formatDateTimeByGranularity(end_time, actual_unit);
    const startTimeFormatted = formatDateTimeByGranularity(adjusted_start_time, actual_unit);
    
    let adjustmentText = '';
    
    // Add adjustment info if applicable
    if (data_availability?.start_adjusted && data_availability?.earliest_record) {
      adjustmentText = ' (adjusted)';
    }
    
    return `Currently showing: ${startTimeFormatted} to ${endTimeFormatted}${adjustmentText}`;
  };
  
  // Handle closing the adjustment message
  const handleCloseAdjustmentMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAdjustmentMessage(false);
  };
  
  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setCurrentIndex(index); // index is now the data index
    
    // Call change handler with the data index
    onTimeGroupChange(index);
    
    // If currently playing, stop it when user manually changes slider
    if (isPlaying) {
      stopPlayback();
    }
  };
  
  // Toggle play/pause
  const togglePlayback = () => {
    // Use a timestamp to prevent duplicate event firing
    const now = Date.now();
    if (now - lastActionTimeRef.current < 100) {
      return;
    }
    lastActionTimeRef.current = now;
    
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };
  
  // Start playback interval with appropriate speed for the time unit
  const startPlayback = useCallback(() => {
    if (intervalRef.current !== null) return;
    
    setIsPlaying(true);
    
    // Get the appropriate playback speed based on time unit
    const playbackSpeed = getPlaybackSpeed();
    console.log(`Starting playback with ${playbackSpeed}ms interval for ${queryParams?.actual_unit || 'Hour'} data`);
    
    intervalRef.current = window.setInterval(() => {
      setCurrentIndex(prevIndex => {
        // Move forward in the data array (Past to Now) - INCREASING index
        const nextIndex = prevIndex < timeGroups.length - 1 ? prevIndex + 1 : 0;
        
        // Call change handler with the new data index
        onTimeGroupChange(nextIndex);
        
        return nextIndex;
      });
    }, playbackSpeed);
  }, [timeGroups.length, onTimeGroupChange, getPlaybackSpeed, queryParams]);
  
  // Stop playback interval
  const stopPlayback = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Update slider position when index changes
  useEffect(() => {
    if (sliderRef.current) {
      sliderRef.current.value = currentIndex.toString();
    }
    
    // Update mini waveform when minimized and playing
    if (minimized && miniWaveformRef.current) {
      const canvas = miniWaveformRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && timeGroups.length > 0) {
        // This will trigger the draw mini waveform effect
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [currentIndex, minimized, timeGroups.length]);
  
  // Generate ticks for the slider - adjusting position to match waveform
  const renderTicks = () => {
    if (timeGroups.length <= 1) return null;
    
    // Calculate insets as percentages to match waveform drawing
    const thumbRadius = 8; // Should match the thumbRadius in waveform drawing
    const totalWidth = waveformRef.current?.clientWidth || 100;
    
    return (
      <div className="psd-ticks-container">
        {timeGroups.map((_, index) => {
          // Calculate position to exactly match waveform points
          let position;
          if (timeGroups.length === 1) {
            position = 50;
          } else {
            // Calculate percentage that matches the canvas drawing logic
            const insetPercent = (thumbRadius / totalWidth) * 100;
            const usableWidthPercent = 100 - (insetPercent * 2);
            
            // Calculate position from left (Past) to right (Now)
            // Index directly maps to position now
            position = insetPercent + (index / (timeGroups.length - 1)) * usableWidthPercent;
          }
          
          const isMajor = index === 0 || index === timeGroups.length - 1 || 
                         index % Math.max(1, Math.floor(timeGroups.length / 5)) === 0;
          
          return (
            <div 
              key={index}
              className={`psd-tick ${isMajor ? 'major' : ''}`}
              style={{ left: `${position}%` }}
            />
          );
        })}
      </div>
    );
  };
  
  // Inject CSS styles when component mounts
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    // Add the CSS as text content
    styleEl.textContent = cssStyles;
    // Append to head
    document.head.appendChild(styleEl);
    
    // Cleanup on unmount
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  // Draw mini waveform for minimized state
  useEffect(() => {
    if (!miniWaveformRef.current || timeGroups.length <= 1 || !minimized) return;
    
    const canvas = miniWaveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Wait a bit to ensure the canvas has its final dimensions
    const drawMiniWaveform = () => {
      // Get the latest canvas dimensions
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // If dimensions are not ready yet, try again after a short delay
        console.debug('Mini canvas dimensions not ready, retrying...');
        setTimeout(drawMiniWaveform, 50);
        return;
      }
      
      // Setup canvas with the correct dimensions
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Calculate points for mini waveform
      const points: [number, number][] = timeGroups.map((group, index) => {
        const count = group.positions.length;
        const x = (index / (timeGroups.length - 1)) * rect.width;
        const y = rect.height - (count / maxVesselCount) * rect.height * 0.8;
        return [x, y];
      });
      
      // Draw simplified waveform
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        
        for (let i = 1; i < points.length; i++) {
          const [x, y] = points[i];
          ctx.lineTo(x, y);
        }
        
        // Stroke the line
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.stroke();
        
        // Fill the area below the curve
        ctx.lineTo(points[points.length - 1][0], rect.height);
        ctx.lineTo(points[0][0], rect.height);
        ctx.closePath();
        
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fill();
        
        // Highlight current point
        if (currentIndex < timeGroups.length) {
          const [x, y] = points[currentIndex];
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
          ctx.fill();
        }
      }
    };
    
    // Start the drawing process
    drawMiniWaveform();
    
    // Also redraw when the current index changes
    // This ensures the highlighted point is always in the correct position
    const redrawInterval = setInterval(() => {
      if (minimized && miniWaveformRef.current) {
        drawMiniWaveform();
      } else {
        clearInterval(redrawInterval);
      }
    }, 500);
    
    return () => {
      clearInterval(redrawInterval);
    };
    
  }, [timeGroups, maxVesselCount, currentIndex, minimized]);

  // Toggle minimized state
  const toggleMinimize = useCallback(() => {
    // First update state
    setMinimized(prev => !prev);
    
    // Then trigger a redraw of the waveform canvas when expanding
    // This needs to be deferred to the next render cycle when the component is expanded
    setTimeout(() => {
      // If expanding (minimized was true but will be false after state update)
      if (minimized) {
        // Trigger a resize event to ensure all elements are properly rendered
        window.dispatchEvent(new Event('resize'));
        
        // Force redraw by incrementing the forceRedraw state
        setForceRedraw(prev => prev + 1);
        
        // Add additional redraws with increasing delays to ensure proper rendering
        // after DOM has fully updated with the new dimensions
        setTimeout(() => {
          if (waveformRef.current) {
            const canvas = waveformRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Force a redraw by clearing
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              setForceRedraw(prev => prev + 1);
            }
          }
        }, 100);
        
        setTimeout(() => {
          // Trigger another resize event and force redraw
          window.dispatchEvent(new Event('resize'));
          setForceRedraw(prev => prev + 1);
        }, 300);
      } else {
        // If minimizing, make sure the mini waveform is drawn correctly
        setTimeout(() => {
          if (miniWaveformRef.current) {
            const canvas = miniWaveformRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Force a redraw by clearing
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }, 100);
      }
    }, 50); // Small delay to ensure state has updated
    
    // No need to stop playback when minimizing
    // This allows the slider to continue running when minimized
  }, [minimized]);

  // If no time groups, don't render the component
  if (timeGroups.length === 0) {
    return null;
  }
  
  // Get the current time group based on UI index, mapping to actual data index
  // currentIndex is now the data index
  const dataIndex = currentIndex;
  const currentTimeGroup = timeGroups[dataIndex] || {};
  const formattedStartTime = formatDateTimeByGranularity(currentTimeGroup.interval_start || '', queryParams?.actual_unit);
  
  // Helper function to pluralize time units if needed
  const getPluralizedTimeUnit = (value: string, unit: string): string => {
    const numValue = parseInt(value, 10);
    if (numValue === 1) {
      return unit;
    }
    return `${unit}s`;
  };
  
  // Get display unit based on actual time unit from query params
  const getActualDisplayUnit = () => {
    // Get the actual unit from query params, default to "Hour" if not available
    const actualUnit = queryParams?.actual_unit || 'Hour';
    
    // Capitalize the first letter to ensure consistent display format
    // This converts 'day' to 'Day', 'hour' to 'Hour', etc.
    return actualUnit.charAt(0).toUpperCase() + actualUnit.slice(1).toLowerCase();
  };
  
  const getUniqueVesselCount = (timeGroup: TimeGroup): number => {
    // If vessel_count is already correctly set, use it
    if (timeGroup.vessel_count && timeGroup.vessel_count > 0) {
      return timeGroup.vessel_count;
    }
    
    // Otherwise calculate it from positions
    const uniqueImos = new Set();
    timeGroup.positions.forEach(position => {
      if (position.imo_number) {
        uniqueImos.add(position.imo_number);
      }
    });
    return uniqueImos.size;
  };
  
  // Add styles
  const styles = {
    adjustmentMessage: {
      margin: '5px 0',
      padding: '8px 12px',
      backgroundColor: 'rgba(249, 220, 92, 0.15)',
      border: '1px solid rgba(249, 220, 92, 0.5)',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#855500',
      textAlign: 'left' as const,
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      width: '100%',
      boxSizing: 'border-box' as const
    },
    closeButton: {
      background: 'none',
      border: 'none',
      color: '#855500',
      fontSize: '14px',
      cursor: 'pointer',
      padding: '0 0 0 10px',
      margin: '0',
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      width: '20px',
      height: '20px'
    },
    mainCloseButton: {
      fontSize: '25px',  // Increased from default
      padding: '4px 8px'
    },
    minimizeButton: {
      fontSize: '22px',
      padding: '4px 8px',
      marginRight: '5px',
      background: 'none',
      border: 'none',
      color: '#777777',
      cursor: 'pointer'
    },
    timelineInfoContainer: {
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'stretch' as const,
      width: '100%' as const,
      paddingLeft: '5px',
      paddingRight: '5px',
      paddingBottom: '5px',
      marginTop: '-10px',
      boxSizing: 'border-box' as const
    },
    timeDisplay: {
      whiteSpace: 'nowrap', // Prevent line breaks in date display
      display: 'inline-block',
      minWidth: '80px', // Ensure enough space for the date
    },
    minimizedContainer: {
      position: 'absolute' as 'absolute',
      ...getMinimizedPosition(),
      borderRadius: '50%',
      padding: '0px',
      boxSizing: 'border-box' as const,
      cursor: 'pointer',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      display: 'flex' as const,
      flexDirection: 'column' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      zIndex: 1000,
      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      transformOrigin: 'center top',
      overflow: 'hidden' as const
    },
    miniHeader: {
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: '5px'
    },
    miniTitle: {
      margin: '0',
      fontSize: '10px',
      color: 'white',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      maxWidth: '70px'
    },
    miniStats: {
      fontSize: '9px',
      color: 'white',
      textAlign: 'center' as const
    },
    hiddenSlider: {
      position: 'absolute' as 'absolute',
      opacity: 0,
      pointerEvents: 'none' as const,
      visibility: 'hidden' as const,
      zIndex: -1
    }
  };
  
  // Get time display style based on actual unit
  const getTimeDisplayStyle = () => {
    // Get actual unit (lowercase for comparison)
    const actualUnit = (queryParams?.actual_unit || 'Hour').toLowerCase();
    
    if (actualUnit === 'hour') {
      return {
        display: 'inline-block',
        wordBreak: 'break-word' as const,
        whiteSpace: 'normal' as const, // Allow normal wrapping
        minWidth: '50px',
      };
    }
    
    // For Day, Month, Year - prevent wrapping with nowrap
    return styles.timeDisplay;
  };
  
  // Render different views based on minimized state
  if (minimized) {
    return (
      <>
        {/* Visible minimized component */}
        <div 
          className={`psd-timeline-container psd-minimized transparent ${isPlaying ? 'playing' : ''}`}
          style={styles.minimizedContainer}
          onClick={toggleMinimize}
          title="Expand Past Scrubber"
        >
          <canvas 
            ref={miniWaveformRef}
            className="psd-mini-waveform-canvas"
            width="50"
            height="50"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        
        {/* Hidden component that continues to work in the background */}
        <div className="psd-timeline-container hidden-player" style={styles.hiddenSlider}>
          <div className="psd-slider-container">
            <input 
              ref={sliderRef}
              type="range"
              className="psd-slider"
              min="0"
              max={timeGroups.length - 1}
              value={currentIndex}
              disabled={isLoading}
            />
          </div>
        </div>
      </>
    );
  }
  
  return (
    <div className="psd-timeline-container transparent">
      <div className="psd-timeline-header">
        <h3 className="psd-timeline-title">Past Scrubber Distribution: {pastScrubberValue} {getPluralizedTimeUnit(pastScrubberValue, timeUnit)}</h3>
        <div className="psd-header-controls">
          <button 
            className="psd-timeline-minimize" 
            onClick={toggleMinimize} 
            style={styles.minimizeButton}
            title="Minimize"
          >
            −
          </button>
          <button 
            className="psd-timeline-close" 
            onClick={onClose} 
            style={styles.mainCloseButton}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Time range message */}
      {showAdjustmentMessage && getTimeRangeMessage() && (
        <div className="psd-timeline-info-container" style={styles.timelineInfoContainer}>
          <div className="psd-adjustment-message" style={styles.adjustmentMessage}>
            <span>{getTimeRangeMessage()}</span>
            <button 
              onClick={handleCloseAdjustmentMessage} 
              style={styles.closeButton}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <div className="psd-waveform-container">
        {/* Vertical scale for waveform - now showing unique vessel counts */}
        <div className="psd-scale-container">
          <div className="psd-scale-gradient"></div>
          <div className="psd-scale-value psd-scale-max">
            {maxUniqueVesselCount}
          </div>
          <div className="psd-scale-value psd-scale-min">0</div>
        </div>
        
        {/* Dynamic value indicator that shows unique vessel count */}
        {currentIndex < timeGroups.length && (
          <div 
            className="psd-current-value" 
            style={{ 
              top: `${vesselCountPosition}%`,
              left: '0'
            }}
          >
            {getUniqueVesselCount(timeGroups[dataIndex])}
          </div>
        )}
        
        <canvas 
          ref={waveformRef} 
          className="psd-waveform-canvas"
        />
        
        {/* Time labels for Now and Past - Reversed */}
        <div className="psd-time-labels">
          <div className="psd-time-label-left">
            <span className="psd-time-past">Past</span>
          </div>
          {/* Records counter in the middle - showing total data points */}
          <div className="psd-time-label-center">
            {currentIndex < timeGroups.length && (
              <span className="psd-time-records">
                Records: {timeGroups[dataIndex].positions.length}
              </span>
            )}
          </div>
          <div className="psd-time-label-right">
            <span className="psd-time-now">Now</span>
          </div>
        </div>
        
        <div className="psd-slider-container">
          <input 
            ref={sliderRef}
            type="range"
            className="psd-slider"
            min="0"
            max={timeGroups.length - 1}
            value={currentIndex}
            onChange={handleSliderChange}
            disabled={isLoading}
          />
          {renderTicks()}
        </div>
      </div>
      
      <div className="psd-info-controls">
        <div className="psd-unit-time">
          <span className="psd-unit">Unit: {getActualDisplayUnit()}</span>
          <span className="psd-time" style={getTimeDisplayStyle()}>{formattedStartTime}</span>
        </div>
        
        <div className="psd-navigation-controls">
          <div className="psd-controls-wrapper">
            <div className="psd-controls-group">
              <button 
                className={`psd-nav-button psd-prev ${isPrevButtonHeld ? 'active' : ''}`}
                onMouseDown={() => handleNavButtonPress('prev', 'mouse')}
                onMouseUp={() => handleNavButtonRelease('mouse')}
                onMouseLeave={() => handleNavButtonRelease('mouse')}
                onTouchStart={(e) => {
                  // Prevent mouse events from also firing
                  e.preventDefault();
                  handleNavButtonPress('prev', 'touch');
                }}
                onTouchEnd={(e) => {
                  // Prevent mouse events from also firing
                  e.preventDefault();
                  handleNavButtonRelease('touch');
                }}
                disabled={isLoading || currentIndex <= 0}
              >
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" fill="currentColor" />
                </svg>
              </button>
              
              <span className="psd-time-display">
                {currentIndex + 1}/{timeGroups.length}
              </span>
              
              <button 
                className={`psd-nav-button psd-next ${isNextButtonHeld ? 'active' : ''}`}
                onMouseDown={() => handleNavButtonPress('next', 'mouse')}
                onMouseUp={() => handleNavButtonRelease('mouse')}
                onMouseLeave={() => handleNavButtonRelease('mouse')}
                onTouchStart={(e) => {
                  // Prevent mouse events from also firing
                  e.preventDefault();
                  handleNavButtonPress('next', 'touch');
                }}
                onTouchEnd={(e) => {
                  // Prevent mouse events from also firing
                  e.preventDefault();
                  handleNavButtonRelease('touch');
                }}
                disabled={isLoading || currentIndex >= timeGroups.length - 1}
              >
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
          
          <button 
            className="psd-play-pause" 
            onClick={togglePlayback}
            onTouchStart={(e) => {
              // Prevent mouse events from also firing on mobile
              e.preventDefault();
            }}
            disabled={isLoading}
          >
            {isPlaying ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '0.3em' }}>
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '0.3em' }}>
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
                Play
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PsdTimelineSlider; 