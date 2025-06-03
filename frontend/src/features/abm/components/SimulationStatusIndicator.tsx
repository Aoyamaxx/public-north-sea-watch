import React from 'react';
import { LoadingStage } from '../types';
import './SimulationStatusIndicator.css';

interface SimulationStatusIndicatorProps {
  loadingStage: LoadingStage;
  isRunning: boolean;
  error: string | null;
}

/**
 * A component to display the current status of the simulation
 * Green/Red blinking: Running - The simulation is currently running
 * Green: Ready - The simulation is loaded and ready to start
 * Red: Failed - The simulation failed to load
 * Blue: Loading - The simulation is currently loading
 */
const SimulationStatusIndicator: React.FC<SimulationStatusIndicatorProps> = ({ 
  loadingStage, 
  isRunning, 
  error 
}) => {
  // Determine the current status
  const getStatus = () => {
    if (loadingStage === LoadingStage.FAILED) {
      return {
        type: 'failed',
        color: '#e74c3c',
        text: 'Failed',
        description: error || 'Simulation failed to load.'
      };
    } else if (isRunning) {
      return {
        type: 'running',
        color: null,  // No inline style for running - CSS handles the animation
        text: 'Running',
        description: 'Simulation is active.'
      };
    } else if (loadingStage === LoadingStage.COMPLETE) {
      return {
        type: 'ready',
        color: '#2ecc71',
        text: 'Ready',
        description: 'Simulation is loaded and ready to start.'
      };
    } else {
      return {
        type: 'loading',
        color: '#3498db',
        text: 'Loading',
        description: 'Simulation is loading...'
      };
    }
  };

  const status = getStatus();

  return (
    <div className={`simulation-status-indicator status-${status.type}`}>
      <div 
        className="status-indicator" 
        style={status.color ? { backgroundColor: status.color } : undefined}
      ></div>
      <div className="status-text">
        <span className="status-label">{status.text}</span>
        {!isRunning && loadingStage === LoadingStage.COMPLETE && (
          <span className="status-message">Ready to start</span>
        )}
        {isRunning && (
          <span className="status-message">Simulation active</span>
        )}
      </div>
    </div>
  );
};

export default SimulationStatusIndicator; 