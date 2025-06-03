import React, { useRef, useEffect, useCallback, useState } from 'react';
import { SimulationPortrayal } from '../types';
import './SimulationRenderer.css';

interface SimulationRendererProps {
  gridState: SimulationPortrayal[];
  width: number;
  height: number;
}

interface PortTooltipData {
  port: SimulationPortrayal;
  x: number;
  y: number;
  visible: boolean;
  sticky: boolean; // For click-to-keep functionality
}

// Utility function to get country full name
const getCountryFullName = (countryCode: string): string => {
  const countryMap: { [key: string]: string } = {
    'GB': 'United Kingdom',
    'UK': 'United Kingdom', // Alternative for United Kingdom
    'NL': 'Netherlands',
    'DE': 'Germany',
    'NO': 'Norway',
    'DK': 'Denmark',
    'BE': 'Belgium',
    'FR': 'France',
    'SE': 'Sweden',
  };
  
  return countryMap[countryCode?.toUpperCase()] || 'Unknown';
};

// Utility function to format policy display
const formatPolicy = (policy: string): string => {
  const policyMap: { [key: string]: string } = {
    'allow': 'Allow',
    'ban': 'Ban',
    'tax': 'Tax',
    'subsidy': 'Subsidy'
  };
  
  return policyMap[policy?.toLowerCase()] || policy || 'Unknown';
};

const SimulationRenderer: React.FC<SimulationRendererProps> = ({ gridState, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const lastGridStateRef = useRef<SimulationPortrayal[]>([]);
  const [tooltip, setTooltip] = useState<PortTooltipData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device on component mount
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  // Cache valid grid state to prevent flickering
  useEffect(() => {
    if (gridState && gridState.length > 0) {
      lastGridStateRef.current = gridState;
    }
  }, [gridState]);
  
  // Calculate the canvas size based on the parent container - memoize with useCallback
  const calculateCanvasSize = useCallback(() => {
    if (!canvasRef.current) return { width: 0, height: 0 };
    
    const container = canvasRef.current.parentElement;
    if (!container) return { width: 0, height: 0 };
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Determine the smaller dimension to maintain aspect ratio
    const cellSize = Math.min(containerWidth / width, containerHeight / height);
    
    return {
      width: cellSize * width,
      height: cellSize * height
    };
  }, [width, height]);
  
  // Function to get port at specific canvas coordinates
  const getPortAtPosition = useCallback((canvasX: number, canvasY: number, portrayal: SimulationPortrayal[]): SimulationPortrayal | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const { width: canvasWidth, height: canvasHeight } = calculateCanvasSize();
    const cellWidth = canvasWidth / width;
    const cellHeight = canvasHeight / height;
    
    // Find port agents that might be at this position
    const ports = portrayal.filter(agent => 
      agent.Shape === 'rect' && agent.port_name && agent.port_info
    );
    
    for (const port of ports) {
      // Flip Y coordinate to match our rendering
      const portX = port.x * cellWidth;
      const portY = (height - 1 - port.y) * cellHeight;
      
      const portWidth = port.w ? port.w * cellWidth : cellWidth;
      const portHeight = port.h ? port.h * cellHeight : cellHeight;
      
      // Check if click/hover is within port bounds
      if (canvasX >= portX + (cellWidth - portWidth) / 2 && 
          canvasX <= portX + (cellWidth - portWidth) / 2 + portWidth &&
          canvasY >= portY + (cellHeight - portHeight) / 2 && 
          canvasY <= portY + (cellHeight - portHeight) / 2 + portHeight) {
        return port;
      }
    }
    
    return null;
  }, [calculateCanvasSize, width, height]);
  
  // Handle mouse move for desktop hover
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMobile || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    const effectiveGridState = (gridState && gridState.length > 0) 
      ? gridState 
      : lastGridStateRef.current;
      
    const hoveredPort = getPortAtPosition(canvasX, canvasY, effectiveGridState);
    
    if (hoveredPort && !tooltip?.sticky) {
      // Show tooltip on hover (only if not sticky)
      setTooltip({
        port: hoveredPort,
        x: event.clientX,
        y: event.clientY,
        visible: true,
        sticky: false
      });
    } else if (!hoveredPort && !tooltip?.sticky) {
      // Hide tooltip when not hovering over port and not sticky
      setTooltip(null);
    }
  }, [isMobile, tooltip?.sticky, gridState, getPortAtPosition]);
  
  // Handle mouse leave for desktop
  const handleMouseLeave = useCallback(() => {
    if (!tooltip?.sticky) {
      setTooltip(null);
    }
  }, [tooltip?.sticky]);
  
  // Handle click for both desktop and mobile
  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    const effectiveGridState = (gridState && gridState.length > 0) 
      ? gridState 
      : lastGridStateRef.current;
      
    const clickedPort = getPortAtPosition(canvasX, canvasY, effectiveGridState);
    
    if (clickedPort) {
      // Toggle sticky tooltip
      if (tooltip?.sticky && tooltip.port.port_name === clickedPort.port_name) {
        // Hide if clicking the same port again
        setTooltip(null);
      } else {
        // Show sticky tooltip
        setTooltip({
          port: clickedPort,
          x: event.clientX,
          y: event.clientY,
          visible: true,
          sticky: true
        });
      }
    } else {
      // Hide tooltip when clicking outside ports
      setTooltip(null);
    }
  }, [gridState, getPortAtPosition, tooltip]);
  
  // Function to draw grid state on the canvas
  const drawCanvas = useCallback((portrayal: SimulationPortrayal[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      // Set canvas size
      const { width: canvasWidth, height: canvasHeight } = calculateCanvasSize();
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Calculate cell size
      const cellWidth = canvasWidth / width;
      const cellHeight = canvasHeight / height;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw grid background (optional)
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw grid lines (optional)
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      
      // Horizontal lines
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellHeight);
        ctx.lineTo(canvasWidth, y * cellHeight);
        ctx.stroke();
      }
      
      // Vertical lines
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth, 0);
        ctx.lineTo(x * cellWidth, canvasHeight);
        ctx.stroke();
      }
      
      // Sort agents by layer (lower layers get drawn first)
      const sortedAgents = [...portrayal].sort((a, b) => a.Layer - b.Layer);
      
      // Draw each agent
      sortedAgents.forEach((agent) => {
        // Flip Y coordinate to fix the upside-down issue
        const x = agent.x * cellWidth;
        const y = (height - 1 - agent.y) * cellHeight; // Flip Y-axis
        
        ctx.save();
        
        // Set colors
        ctx.fillStyle = agent.Color;
        ctx.strokeStyle = agent.Color;
        
        // Draw based on shape
        switch (agent.Shape) {
          case 'circle':
            const radius = agent.r ? agent.r * Math.min(cellWidth, cellHeight) / 2 : Math.min(cellWidth, cellHeight) / 2;
            ctx.beginPath();
            ctx.arc(x + cellWidth / 2, y + cellHeight / 2, radius, 0, Math.PI * 2);
            if (agent.Filled === 'true') {
              ctx.fill();
            } else {
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            break;
            
          case 'rect':
            const w = agent.w ? agent.w * cellWidth : cellWidth;
            const h = agent.h ? agent.h * cellHeight : cellHeight;
            if (agent.Filled === 'true') {
              ctx.fillRect(x + (cellWidth - w) / 2, y + (cellHeight - h) / 2, w, h);
            } else {
              ctx.lineWidth = 2;
              ctx.strokeRect(x + (cellWidth - w) / 2, y + (cellHeight - h) / 2, w, h);
            }
            break;
            
          case 'triangle':
            ctx.beginPath();
            ctx.moveTo(x + cellWidth / 2, y);
            ctx.lineTo(x, y + cellHeight);
            ctx.lineTo(x + cellWidth, y + cellHeight);
            ctx.closePath();
            if (agent.Filled === 'true') {
              ctx.fill();
            } else {
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            break;
            
          default:
            // Default to a square if shape is unknown
            if (agent.Filled === 'true') {
              ctx.fillRect(x, y, cellWidth, cellHeight);
            } else {
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, cellWidth, cellHeight);
            }
        }
        
        // Only show capacity indicators without port names
        if (agent.current_capacity !== undefined && agent.max_capacity !== undefined) {
          ctx.font = '8px Arial';
          ctx.fillStyle = agent.text_color || '#000';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${agent.current_capacity}/${agent.max_capacity}`,
            x + cellWidth / 2,
            y + cellHeight / 2
          );
        }
        
        ctx.restore();
      });
    } catch (error) {
      console.error('Error rendering simulation:', error);
      setRenderError(`Rendering error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [calculateCanvasSize, height, width]);
  
  // Draw the grid state on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Use the current grid state or the last valid one if current is empty
    const effectiveGridState = (gridState && gridState.length > 0) 
      ? gridState 
      : lastGridStateRef.current;
    
    // If we have no grid state to render, show error
    if (!effectiveGridState || effectiveGridState.length === 0) {
      setRenderError('No grid state available to render');
      return;
    } else {
      setRenderError(null);
    }
    
    // Draw the canvas with the effective grid state
    drawCanvas(effectiveGridState, canvas);
    
  }, [gridState, drawCanvas]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      
      // Use the current grid state or the last valid one if current is empty
      const effectiveGridState = (gridState && gridState.length > 0) 
        ? gridState 
        : lastGridStateRef.current;
      
      if (effectiveGridState && effectiveGridState.length > 0) {
        drawCanvas(effectiveGridState, canvasRef.current);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas, gridState]);
  
  return (
    <div className="simulation-renderer">
      {renderError ? (
        <div className="renderer-error">{renderError}</div>
      ) : null}
      <canvas 
        ref={canvasRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />
      
      {/* Port Information Tooltip */}
      {tooltip && tooltip.visible && (
        <div 
          className={`port-tooltip ${tooltip.sticky ? 'sticky' : ''} ${isMobile ? 'mobile' : 'desktop'}`}
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 10, window.innerWidth - 250),
            top: Math.max(10, tooltip.y - 10),
            zIndex: 1000,
            pointerEvents: tooltip.sticky ? 'auto' : 'none'
          }}
        >
          <div className="tooltip-content">
            <div className="tooltip-header">
              <h4>{tooltip.port.port_name}</h4>
              {tooltip.sticky && (
                <button 
                  className="close-btn"
                  onClick={() => setTooltip(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>
            
            <div className="tooltip-body">
              {/* Country information with flag */}
              {tooltip.port.country && (
                <div className="country-info">
                  <span className="country-label">Country:</span>
                  <span className="country-name">
                    {getCountryFullName(tooltip.port.country)}, {tooltip.port.country}
                  </span>
                </div>
              )}
              
              {/* Policy information */}
              <div className="policy-info">
                <span className="policy-label">Policy:</span>
                <span className={`policy-value policy-${tooltip.port.policy?.toLowerCase()}`}>
                  {formatPolicy(tooltip.port.policy || 'unknown')}
                </span>
              </div>
              
              {/* Capacity information */}
              {tooltip.port.current_capacity !== undefined && tooltip.port.max_capacity !== undefined && (
                <div className="capacity-info">
                  <span className="capacity-label">Capacity:</span>
                  <span className="capacity-value">
                    {tooltip.port.current_capacity}/{tooltip.port.max_capacity}
                  </span>
                </div>
              )}
            </div>
            
            {isMobile && !tooltip.sticky && (
              <div className="mobile-hint">
                <small>Tap to keep this information visible</small>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationRenderer; 