import React, { useState, useEffect, useRef } from 'react';
import { SimulationParams, DEFAULT_SIMULATION_PARAMS } from '../types';
import { useABMContext } from '../hooks/useABMContext';
import './SimulationControls.css';

interface SimulationControlsProps {
  stepCount: number;
  isRunning: boolean;
  loading: boolean;
  onStart: () => void;
  onStop: () => void;
  onStep: () => void;
  onReset: (params: SimulationParams) => void;
  onCreateNew: (params: SimulationParams) => void;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
  stepCount,
  isRunning,
  loading,
  onStart,
  onStop,
  onStep,
  onReset,
  onCreateNew,
}) => {
  const { state, setFps } = useABMContext();
  const [params, setParams] = useState<SimulationParams>(DEFAULT_SIMULATION_PARAMS);
  // Initialize isParametersOpen based on screen width - open by default on desktop (> 1024px)
  const [isParametersOpen, setIsParametersOpen] = useState(() => {
    return window.innerWidth > 1024;
  });
  const [localFps, setLocalFps] = useState<number>(state.fps); // Use FPS from context state
  const [localState, setLocalState] = useState({ 
    isStartingSimulation: false,
    startButtonClickTime: 0,
    isStopping: false,
    isCreatingOrResetting: false // New state flag to track when creation or reset is in progress
  });
  
  // Add a debounce reference to track operation debouncing
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When state.fps changes, update our localFps
  useEffect(() => {
    setLocalFps(state.fps);
  }, [state.fps]);
  
  // Reset starting state if simulation is running
  useEffect(() => {
    if (isRunning) {
      setLocalState(prev => ({ ...prev, isStartingSimulation: false }));
    }
  }, [isRunning]);
  
  // Reset UI state when simulation fails
  useEffect(() => {
    if (state.loadingStage === 'FAILED') {
      console.log('Simulation is in FAILED state, resetting UI controls');
      setLocalState(prev => ({ 
        ...prev, 
        isStartingSimulation: false,
        isStopping: false
      }));
    }
  }, [state.loadingStage]);

  // Add effect to update isParametersOpen state when window is resized
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth > 1024;
      // Only auto-open on desktop if not already manually toggled by user
      if (!localStorage.getItem('parameters_toggled')) {
        setIsParametersOpen(isDesktop);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let parsedValue: any = value;
    
    // Parse numeric values
    if (name === 'width' || name === 'height' || name === 'num_ships' || name === 'ship_wait_time') {
      parsedValue = parseInt(value, 10);
    } else if (name === 'fps') {
      parsedValue = parseFloat(value);
    }
    
    // Update the params state
    setParams(prevParams => ({
      ...prevParams,
      [name]: parsedValue
    }));
    
    // Special case for fps which needs to be updated immediately
    if (name === 'fps') {
      setLocalFps(parsedValue);
      handleFpsChange(parsedValue);
    }

    // Update slider progress if needed
    const sliderElement = document.getElementById('port_policy_dropdown') as HTMLElement;
    if (sliderElement && name === 'port_policy') {
      // Additional logic for port policy if needed
    }
  };

  // Effect to initialize slider progress when component mounts and when probability value changes
  useEffect(() => {
    // Remove the updateSliderProgress call for prob_allow_scrubbers
  }, []);

  // Debounce FPS changes to avoid sending too many requests
  const handleFpsChange = (newFps: number) => {
    // Update the FPS on the backend
    setFps(newFps);
    
    // Also update params for consistency
    setParams(prev => ({
      ...prev,
      fps: newFps
    }));
  };

  // Handle parameters toggle with tracking 
  const handleParametersToggle = () => {
    setIsParametersOpen(!isParametersOpen);
    // Mark that parameters were manually toggled by user
    localStorage.setItem('parameters_toggled', 'true');
  };

  const handleCreateNew = () => {
    // If already in the process of creating or resetting, ignore duplicate clicks
    if (localState.isCreatingOrResetting) {
      console.log('Already creating or resetting, ignoring duplicate request');
      return;
    }
    
    // Generate a brand new client ID for new simulation
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newClientId = `client_${timestamp}_${randomString}`;
    localStorage.setItem('abm_client_id', newClientId);
    
    // Check if this is a developer test simulation (based on URL)
    const urlParams = new URLSearchParams(window.location.search);
    const isDevTest = urlParams.get('timeout') === 'false';
    
    // Include all current parameters in the new simulation
    const paramsWithFpsAndClientId = {
      ...params,
      fps: localFps,
      client_id: newClientId,
      is_developer_test: isDevTest // Add developer testing flag
    };
    
    // Update UI state
    setLocalState(prev => ({ 
      ...prev, 
      isStartingSimulation: true,
      isCreatingOrResetting: true // Set flag to indicate creation in progress
    }));
    
    // Set protection flag to prevent cleanup during creation
    window._simulationActiveFlag = true;
    console.log('Set protection flag to prevent cleanup during creation');
    
    // Delay sending request by 2 seconds to ensure frontend state and protection flags are properly set
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current);
    }
    
    operationTimeoutRef.current = setTimeout(() => {
      // Create simulation after a delay
      console.log('Creating new simulation with client ID:', newClientId, 'developer testing mode:', isDevTest);
      onCreateNew(paramsWithFpsAndClientId);
      
      // Reset starting state after a delay
      setTimeout(() => {
        console.log('Create new simulation operation should be complete by now');
        setLocalState(prev => ({ 
          ...prev, 
          isStartingSimulation: false,
          isCreatingOrResetting: false // Reset processing state
        }));
        
        // Reset the protection flag
        setTimeout(() => {
          console.log('Resetting protection flag after create new operation');
          window._simulationActiveFlag = false;
        }, 1000);
      }, 5000);
    }, 2000); // Delay creation operation by 2 seconds
  };
  
  const handleReset = () => {
    // If already in the process of creating or resetting, ignore duplicate clicks
    if (localState.isCreatingOrResetting) {
      console.log('Already creating or resetting, ignoring duplicate request');
      return;
    }
    
    // Generate a new client ID for reset
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const resetClientId = `client_${timestamp}_${randomString}`;
    localStorage.setItem('abm_client_id', resetClientId);
    
    // Check if this is a developer test simulation (based on URL)
    const urlParams = new URLSearchParams(window.location.search);
    const isDevTest = urlParams.get('timeout') === 'false';
    
    // Use default parameters with the current FPS and new client ID for the reset
    const resetParams = {
      ...DEFAULT_SIMULATION_PARAMS,  // Use default parameters for a clean reset
      fps: localFps,                // Keep the current FPS setting
      client_id: resetClientId,     // Use the new client ID
      is_developer_test: isDevTest  // Add developer testing flag
    };
    
    // Update UI state
    setLocalState(prev => ({ 
      ...prev, 
      isStartingSimulation: true,
      isCreatingOrResetting: true // Set flag to indicate reset in progress
    }));
    
    // Set protection flag to prevent cleanup during reset
    window._simulationActiveFlag = true;
    console.log('Set protection flag to prevent cleanup during reset');
    
    // Clear any previous delayed operations
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current);
    }
    
    // Delay the actual reset by 2 seconds to ensure frontend state and protection flags are properly set
    operationTimeoutRef.current = setTimeout(() => {
      try {
        // Execute reset operation
        console.log('Resetting simulation with default parameters and new client ID:', resetClientId, 'developer testing mode:', isDevTest);
        onReset(resetParams);
        
        // Reset starting state after a delay
        setTimeout(() => {
          console.log('Reset operation should be complete by now');
          setLocalState(prev => ({ 
            ...prev, 
            isStartingSimulation: false,
            isCreatingOrResetting: false // Reset processing state
          }));
          
          // Reset the protection flag
          setTimeout(() => {
            console.log('Resetting protection flag after reset operation');
            window._simulationActiveFlag = false;
          }, 3000); // Increased from 1000 to 3000 ms for better stability
        }, 5000); // Consider operation complete after 5 seconds
      } catch (error) {
        console.error('Error during reset execution:', error);
        
        // Reset UI state if there's an error
        setLocalState(prev => ({ 
          ...prev, 
          isStartingSimulation: false,
          isCreatingOrResetting: false 
        }));
        
        // Reset the protection flag
        setTimeout(() => {
          window._simulationActiveFlag = false;
        }, 1000);
      }
    }, 2000); // Delay reset operation by 2 seconds
  };

  const handleResetToDefaults = () => {
    // Reset to default parameters
    const defaultParams = {
      ...DEFAULT_SIMULATION_PARAMS,
      fps: localFps // Keep the current FPS
    };
    setParams(defaultParams);
  };
  
  const handleStart = () => {
    // If the simulation has been started recently, do nothing
    const now = Date.now();
    if (now - localState.startButtonClickTime < 2000) { // Debounce for 2 seconds
      console.log('Button clicked too recently, debouncing');
      return;
    }
    
    // If simulation state is FAILED, don't even try to start it
    if (state.loadingStage === 'FAILED') {
      console.log('Cannot start failed simulation, resetting UI state');
      setLocalState(prev => ({ 
        ...prev, 
        isStartingSimulation: false
      }));
      return;
    }
    
    // Update UI state
    setLocalState(prev => ({ 
      ...prev, 
      isStartingSimulation: true,
      startButtonClickTime: now
    }));
    
    // Invoke the start simulation handler
    onStart();
  };
  
  const handleStop = () => {
    // Prevent multiple stops in quick succession
    if (localState.isStopping) {
      return;
    }
    
    // Update UI state to indicate stopping
    setLocalState(prev => ({ ...prev, isStopping: true }));
    
    // Invoke the stop handler
    onStop();
    
    // Reset the stopping state after a delay
    setTimeout(() => {
      setLocalState(prev => ({ ...prev, isStopping: false }));
    }, 2000);
  };
  
  const handleStep = () => {
    // Only allow stepping if simulation isn't running and isn't starting
    if (isRunning || localState.isStartingSimulation) {
      return;
    }
    
    // Invoke the step handler
    onStep();
  };

  // The return statement
  const isProcessing = loading || localState.isStartingSimulation || localState.isStopping || localState.isCreatingOrResetting;
  const canStart = state.loadingStage === 'COMPLETE' && !isProcessing;
  const showStartingState = localState.isStartingSimulation;

  return (
    <div className="simulation-controls">
      <div className="control-info">
        <span className="step-counter">Step: {stepCount}</span>
        <span className="fps-control">
          <label htmlFor="fps">Speed:</label>
          <input
            type="range"
            id="fps"
            name="fps"
            min="0.5"
            max="10"
            step="0.5"
            value={localFps}
            onChange={handleChange}
            disabled={loading || isProcessing}
          />
          <span className="fps-value">{localFps}x</span>
        </span>
      </div>
      
      <div className="control-buttons">
        {isRunning ? (
          <button 
            className="btn btn-stop" 
            onClick={handleStop}
            disabled={loading || isProcessing}
          >
            Stop Simulation
          </button>
        ) : (
          <>
            <button 
              className={`btn btn-start ${showStartingState ? 'btn-starting' : ''}`}
              onClick={handleStart}
              disabled={!canStart || isProcessing}
              title={state.loadingStage !== 'COMPLETE' 
                ? `Wait for simulation to complete loading (${state.loadingStage})` 
                : (showStartingState ? 'Starting...' : 'Start simulation')}
            >
              {showStartingState ? 'Starting...' : 'Start Simulation'}
            </button>
            
            <button 
              className="btn btn-step" 
              onClick={handleStep}
              disabled={loading || state.loadingStage !== 'COMPLETE' || showStartingState || isProcessing}
              title={state.loadingStage !== 'COMPLETE' 
                ? `Wait for simulation to finish loading (${state.loadingStage})` 
                : (showStartingState ? 'Starting...' : 'Step simulation')}
            >
              Step
            </button>
          </>
        )}
        
        <button 
          className="btn btn-reset" 
          onClick={handleReset}
          disabled={loading || isProcessing}
        >
          {isProcessing && showStartingState ? 'Resetting...' : 'Reset'}
        </button>
        
        <button 
          className="btn btn-params" 
          onClick={handleParametersToggle}
          disabled={loading || isProcessing}
        >
          {isParametersOpen ? 'Close Parameters' : 'Parameters'}
        </button>
      </div>
      
      {isParametersOpen && (
        <div className="simulation-parameters">
          <h3>Simulation Parameters</h3>

          <div className="param-group">
            <label htmlFor="national_ban"><strong>National Ban</strong>:</label>
            <select
              id="national_ban"
              name="national_ban"
              value={params.national_ban || 'None'}
              onChange={handleChange}
            >
              <option value="None">None</option>
              <option value="DE">🇩🇪 Germany </option>
              <option value="NL">🇳🇱 Netherlands </option>
              <option value="GB">🇬🇧 UK </option>
              <option value="NO">🇳🇴 Norway </option>
            </select>
          </div>

          <div className="param-group">
            <label htmlFor="custom_port_policies"><strong>Port Policies</strong></label>
            <p>Please choose a port and assign a policy to it using the format: <strong>port:policy</strong>.
              You can enter multiple policies separated by commas (e.g., <em>Rotterdam:ban, Hamburg:tax</em>).</p>
            <p>Available policy options: <strong>ban</strong>, <strong>tax</strong>, <strong>subsidy</strong>.</p>
            <input
            type="text"
              id="custom_port_policies"
              name="custom_port_policies"
              value={params.custom_port_policies || ''}
              onChange={handleChange}
              placeholder="e.g. rotterdam:ban, amsterdam:tax"/>
            <small>Example: rotterdam:ban, amsterdam:tax, hamburg:subsidy</small>
          </div>

          <div className="param-actions">
            <button 
              className="param-btn reset-defaults-btn" 
              onClick={handleResetToDefaults}
              disabled={loading || isProcessing}
            >
              Reset to Defaults
            </button>
            
            <button 
              className="param-btn new-btn" 
              onClick={handleCreateNew}
              disabled={loading || isProcessing}
            >
              {isProcessing && showStartingState ? 'Creating...' : 'Create New Simulation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationControls;