import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  ABMState, 
  ABMContextType, 
  SimulationParams, 
  DEFAULT_SIMULATION_PARAMS,
  LoadingStage
} from '../types';
import * as api from '../services/api';

// Add global type declarations for our custom properties
declare global {
  interface Window {
    _simulationActiveFlag?: boolean;
    _unmountingPage?: boolean;
    _protectionFlagTimeoutId?: NodeJS.Timeout;
    _activeOperations?: Set<string>;
  }
}

// Initial state
const initialState: ABMState = {
  simulationId: null,
  isRunning: false,
  stepCount: 0,
  fps: 1.0,
  gridState: [],
  modelData: {
    NumScrubberShips: 0,
    NumScrubberTrails: 0,
    TotalScrubberWater: 0,
    NumShips: 0,
    TotalDockedShips: 0,
    AvgPortPopularity: 0,
    NumPortsBan: 0
  },
  error: null,
  loading: false,
  loadingStage: LoadingStage.IDLE,
  loadingProgress: 0
};

// Action types
type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SIMULATION_ID'; payload: string }
  | { type: 'SET_RUNNING'; payload: boolean }
  | { type: 'SET_STEP_COUNT'; payload: number }
  | { type: 'SET_FPS'; payload: number }
  | { type: 'SET_GRID_STATE'; payload: any[] }
  | { type: 'SET_MODEL_DATA'; payload: any }
  | { type: 'SET_LOADING_STAGE'; payload: LoadingStage }
  | { type: 'SET_LOADING_PROGRESS'; payload: number }
  | { type: 'CLEAR_SIMULATION' };

// Reducer function
const reducer = (state: ABMState, action: Action): ABMState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      // Don't change loading stage to FAILED if current stage is INITIALIZING and there's an "initialization started" message
      // This is because "initialization started" is not a real error, it's just how the API tells us a simulation is being created
      if (action.payload && typeof action.payload === 'string' && 
          action.payload.includes('initialization started') && 
          state.loadingStage === LoadingStage.INITIALIZING) {
        // Keep the current loading stage
        return { ...state, error: action.payload, loading: true };
      }
      // Skip setting to FAILED stage if protection flag is active
      if (window._simulationActiveFlag) {
        console.log('Protection flag active, keeping current loading stage despite error:', action.payload);
        return { ...state, error: action.payload };
      }
      // Otherwise, set to FAILED as usual for errors
      return { ...state, error: action.payload, loading: false, loadingStage: LoadingStage.FAILED };
    case 'SET_SIMULATION_ID':
      return { ...state, simulationId: action.payload };
    case 'SET_RUNNING':
      return { ...state, isRunning: action.payload };
    case 'SET_STEP_COUNT':
      return { ...state, stepCount: action.payload };
    case 'SET_FPS':
      return { ...state, fps: action.payload };
    case 'SET_GRID_STATE':
      return { ...state, gridState: action.payload };
    case 'SET_MODEL_DATA':
      return { ...state, modelData: action.payload };
    case 'SET_LOADING_STAGE':
      return { ...state, loadingStage: action.payload };
    case 'SET_LOADING_PROGRESS':
      return { ...state, loadingProgress: action.payload };
    case 'CLEAR_SIMULATION':
      return {
        ...initialState,
        error: state.error // Preserve any errors
      };
    default:
      return state;
  }
};

// Create context
const ABMContext = createContext<ABMContextType | undefined>(undefined);

// Loading stage descriptions
// const loadingStageDescriptions = {
//   [LoadingStage.IDLE]: 'Ready to start simulation',
//   [LoadingStage.INITIALIZING]: 'Initializing simulation...',
//   [LoadingStage.LOADING_DATA]: 'Loading geographical data...',
//   [LoadingStage.CREATING_AGENTS]: 'Creating ships and ports...',
//   [LoadingStage.ESTABLISHING_ROUTES]: 'Establishing shipping routes...',
//   [LoadingStage.COMPLETE]: 'Simulation loaded successfully',
//   [LoadingStage.FAILED]: 'Failed to load simulation'
// };

// Request timeout constants
const REQUEST_TIMEOUT = 60000; // 1 minute
const MAX_RETRIES = 3;
const MAX_POLL_COUNT = 120;
const POLL_INTERVAL = 2000; // 2 seconds for loading state
const RUNNING_POLL_INTERVAL = 1000; // 1 second for running state

// Check if developer testing mode is enabled via URL parameter
const isDeveloperTestingMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('timeout') === 'false';
};

// Set timeout based on developer testing mode
// Use 5 hours (18000000 ms) for developer testing, 5 minutes (300000 ms) for normal usage
const getInactivityTimeout = () => {
  return isDeveloperTestingMode() ? 18000000 : 300000;
};

// Initial timeout value
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INACTIVITY_TIMEOUT = getInactivityTimeout(); // 5 minutes by default, 5 hours in dev testing mode

// Create a flag to track simulation creation
let isCreatingSimulation = false;

// Flag to track simulation start in progress
let isStartingSimulation = false;

// Keep track of simulations that have been or are being cleaned up
const cleaningUpSimulations = new Set<string>();

// Track when a simulation was last stopped
const recentlyStoppedSimulations = new Map<string, number>();

// Track last activity time for each simulation
const simulationLastActivity = new Map<string, number>();

// Add a clean reset function for global flags
const resetGlobalFlags = (delay = 0) => {
  if (delay > 0) {
    setTimeout(() => {
      console.log(`Resetting global flags after ${delay}ms delay`);
      isCreatingSimulation = false;
      isStartingSimulation = false;
      window._simulationActiveFlag = false;
    }, delay);
  } else {
    console.log('Immediately resetting global flags');
    isCreatingSimulation = false;
    isStartingSimulation = false;
    window._simulationActiveFlag = false;
  }
};

// Function to update simulation activity
const updateSimulationActivity = (simulationId: string) => {
  if (simulationId) {
    simulationLastActivity.set(simulationId, Date.now());
  }
};

// Function to check for inactive simulations
const checkInactiveSimulations = () => {
  const now = Date.now();
  // Re-check the timeout value each time to handle URL changes
  const currentTimeout = getInactivityTimeout();
  
  simulationLastActivity.forEach((lastActivity, simulationId) => {
    if (now - lastActivity > currentTimeout) {
      const timeoutMinutes = isDeveloperTestingMode() ? 300 : 5;
      console.log(`Simulation ${simulationId} inactive for more than ${timeoutMinutes} minutes (${Math.round((now - lastActivity) / 1000)}s), cleaning up`);
      api.deleteSimulation(simulationId).catch(err => {
        console.log(`Error cleaning up inactive simulation ${simulationId}:`, err);
      });
      simulationLastActivity.delete(simulationId);
    }
  });
};

// Start inactivity checker interval
setInterval(checkInactiveSimulations, 60000); // Check every minute

// Add error handling middleware for API calls
const safeApiCall = async (apiCall: () => Promise<any>, errorMessage: string, resetFlagsOnError = true) => {
  try {
    return await apiCall();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    if (resetFlagsOnError) {
      resetGlobalFlags();
    }
    throw error;
  }
};

// Modify error messages to reflect the correct timeout
const getTimeoutErrorMessage = () => {
  const timeoutMinutes = isDeveloperTestingMode() ? 300 : 5;
  return `The simulation has been deleted due to ${timeoutMinutes} minutes of inactivity. Please click Reset or refresh the page to create a new simulation.`;
};

// Provider component
export const ABMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Get the current simulation state - Define with useCallback to avoid dependency cycles
  const getSimulationState = useCallback(async () => {
    if (!state.simulationId) return;
    
    // Check if component is still mounted/active
    if (state.simulationId === null) {
      console.log('Simulation ID is null, skipping getSimulationState');
      return;
    }
    
    try {
      const response = await api.getSimulationState(state.simulationId);
      console.log(`Got simulation state: ${JSON.stringify({
        status: response.status,
        loading_stage: response.loading_stage,
        progress: response.loading_progress,
        running: response.running,
        gridLength: response.grid_state ? response.grid_state.length : 0
      })}`);
      
      if (response.status === 'success') {
        dispatch({ type: 'SET_STEP_COUNT', payload: response.step_count });
        dispatch({ type: 'SET_RUNNING', payload: response.running });
        
        // Always set grid state if it's available, regardless of loading stage
        if (response.grid_state && response.grid_state.length > 0) {
          console.log(`Setting grid state with ${response.grid_state.length} elements`);
          dispatch({ type: 'SET_GRID_STATE', payload: response.grid_state });
        }
        
        // Always set model data if it's available
        if (response.model_data) {
          dispatch({ type: 'SET_MODEL_DATA', payload: response.model_data });
        }
        
        if (response.fps) {
          dispatch({ type: 'SET_FPS', payload: response.fps });
        }
        
        // Update loading stage and progress if provided
        if (response.loading_stage) {
          dispatch({ type: 'SET_LOADING_STAGE', payload: response.loading_stage });
          
          // If loading is complete, set loading to false
          if (response.loading_stage === LoadingStage.COMPLETE) {
            dispatch({ type: 'SET_LOADING', payload: false });
            console.log('Simulation loading complete');
          } else if (response.loading_stage !== LoadingStage.FAILED) {
            dispatch({ type: 'SET_LOADING', payload: true });
          }
        }
        
        if (response.loading_progress !== undefined) {
          dispatch({ type: 'SET_LOADING_PROGRESS', payload: response.loading_progress });
        }
      } else if (response.status === 'initializing') {
        // If simulation is still initializing, update the corresponding status
        if (response.loading_stage) {
          dispatch({ type: 'SET_LOADING_STAGE', payload: response.loading_stage });
          console.log(`Simulation is initializing: ${response.loading_stage}, progress: ${response.loading_progress}`);
        }
        
        if (response.loading_progress !== undefined) {
          dispatch({ type: 'SET_LOADING_PROGRESS', payload: response.loading_progress });
        }
        
        dispatch({ type: 'SET_LOADING', payload: true });
      } else if (response.status === 'error') {
        // Handle error status explicitly
        console.error(`Error in simulation: ${response.message}`);
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Error in simulation' });
        
        // If there's a loading stage in the error, update it
        if (response.loading_stage) {
          dispatch({ type: 'SET_LOADING_STAGE', payload: response.loading_stage });
        }
      } else {
        // Use a default error message if status is not recognized
        console.error(`Unexpected status: ${response.status}, message: ${response.message}`);
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to get simulation state' });
      }
    } catch (error) {
      console.error('Error in getSimulationState:', error);
      
      // If it's a 404 error (simulation not found), it might have been cleaned up, reset the state
      if ((error as any)?.response?.status === 404) {
        console.log('Simulation not found (404), it might have been deleted due to inactivity');
        // Instead of just clearing the state, provide an informative error message
        dispatch({ 
          type: 'SET_ERROR', 
          payload: getTimeoutErrorMessage() 
        });
        dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.FAILED });
        return;
      }
      
      // Other errors, just set the error message
      dispatch({ type: 'SET_ERROR', payload: 'Error getting simulation state' });
    }
  }, [state.simulationId, dispatch]);
  
  // Clean up simulation - Define with useCallback to avoid dependency cycles
  const cleanupSimulation = useCallback(async () => {
    if (!state.simulationId) return;
    
    // Check if this simulation is already being cleaned up
    if (cleaningUpSimulations.has(state.simulationId)) {
      console.log(`Skipping duplicate cleanup for simulation ${state.simulationId} - already in progress`);
      return;
    }
    
    // Check if simulation is actively being used or in initialization
    if (window._simulationActiveFlag || state.loadingStage === LoadingStage.INITIALIZING) {
      console.log(`Skipping cleanup for simulation ${state.simulationId} - Active flag: ${window._simulationActiveFlag}, Loading stage: ${state.loadingStage}`);
      return;
    }
    
    // Don't cleanup if we're in the middle of initialization
    if (state.loading && state.loadingStage !== LoadingStage.FAILED) {
      console.log(`Skipping cleanup for simulation ${state.simulationId} - Still loading (${state.loadingStage})`);
      return;
    }
    
    // Check if this simulation is in active operations
    if (window._activeOperations && window._activeOperations.has(state.simulationId)) {
      console.log(`Skipping cleanup for simulation ${state.simulationId} - Active operations in progress`);
      return;
    }
    
    // Check if this simulation was recently stopped (within the last 10 seconds)
    const lastStopTime = recentlyStoppedSimulations.get(state.simulationId);
    if (lastStopTime && Date.now() - lastStopTime < 10000) {
      console.log(`Skipping cleanup for simulation ${state.simulationId} - recently stopped (${Math.round((Date.now() - lastStopTime) / 1000)}s ago)`);
      return;
    }
    
    // Mark this simulation as being cleaned up
    const simulationToCleanup = state.simulationId;
    cleaningUpSimulations.add(simulationToCleanup);
    
    console.log(`Cleaning up simulation ${simulationToCleanup}`);
    
    try {
      // Clear this simulation from active operations
      if (window._activeOperations) {
        window._activeOperations.delete(simulationToCleanup);
        console.log(`Removed simulation ${simulationToCleanup} from active operations during cleanup`);
      }
      
      // Clear context state first to prevent new requests
      dispatch({ type: 'CLEAR_SIMULATION' });
      
      // Small delay to ensure dispatch completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stop simulation if it's running
      if (state.isRunning) {
        try {
          console.log(`Stopping running simulation ${simulationToCleanup}`);
          await api.stopSimulation(simulationToCleanup);
          
          // Record that we just stopped this simulation
          recentlyStoppedSimulations.set(simulationToCleanup, Date.now());
          
          // Add a small delay to ensure stop operation completes before deletion
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (stopError) {
          // Check if error is 404 (simulation already gone)
          if ((stopError as any)?.response?.status === 404) {
            console.log(`Simulation ${simulationToCleanup} already gone, skipping stop`);
          } else {
            console.error('Error stopping simulation during cleanup:', stopError);
          }
          // Continue trying to delete even if stopping fails
        }
      }
      
      // Try to delete the simulation
      try {
        console.log(`Deleting simulation ${simulationToCleanup}`);
        const deleteResponse = await api.deleteSimulation(simulationToCleanup);
        console.log(`Deletion response:`, deleteResponse);
        console.log(`Successfully cleaned up simulation ${simulationToCleanup}`);
        
        // Remove from the recently stopped map if it exists
        recentlyStoppedSimulations.delete(simulationToCleanup);
      } catch (deleteError) {
        // Check if error is 404 (simulation already gone)
        if ((deleteError as any)?.response?.status === 404) {
          console.log(`Simulation ${simulationToCleanup} already gone, no need to delete`);
        } else {
          console.error('Error deleting simulation during cleanup:', deleteError);
        }
        // The local state has been cleared, so this error does not affect the user experience
      }
    } catch (error) {
      console.error('Error in cleanup process:', error);
      // Clear state regardless of any errors
      dispatch({ type: 'CLEAR_SIMULATION' });
    } finally {
      // Reset all flags in case they got stuck
      resetGlobalFlags(500);
      
      // Remove from the cleanup set after a delay to prevent race conditions
      setTimeout(() => {
        cleaningUpSimulations.delete(simulationToCleanup);
        console.log(`Removed simulation ${simulationToCleanup} from cleanup tracking`);
      }, 1000);
    }
  }, [state.simulationId, state.isRunning, state.loadingStage, state.loading, dispatch]);
  
  // Poll for simulation state updates when running or loading
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let pollCount = 0;
    let lastLoadingStage = state.loadingStage;
    let unmounted = false;

    if (state.simulationId) {
      const isValidPollingState = 
        (state.isRunning) || 
        (state.loading && state.loadingStage !== LoadingStage.COMPLETE && state.loadingStage !== LoadingStage.FAILED);
        
      if (isValidPollingState) {
        console.log(`Starting polling for simulation ${state.simulationId}, state: ${state.loadingStage}`);
        const interval = state.isRunning ? RUNNING_POLL_INTERVAL : POLL_INTERVAL;
        
        intervalId = setInterval(() => {
          if (unmounted) {
            if (intervalId) {
              clearInterval(intervalId);
            }
            return;
          }

          // Update activity timestamp
          updateSimulationActivity(state.simulationId!);

          if (state.loading && !state.isRunning) {
            pollCount++;
            
            if (pollCount % 5 === 0) {
              console.log(`Poll count: ${pollCount}/${MAX_POLL_COUNT}, stage: ${state.loadingStage}`);
            }
            
            if (pollCount > MAX_POLL_COUNT && state.loadingStage !== LoadingStage.COMPLETE) {
              console.log(`Poll count exceeded maximum (${MAX_POLL_COUNT}), attempting recovery...`);
              
              // Try to recover by resetting the simulation
              resetSimulation(DEFAULT_SIMULATION_PARAMS).catch(err => {
                console.error('Recovery attempt failed:', err);
                dispatch({ type: 'SET_ERROR', payload: 'Loading timeout. Please refresh the page or click the retry button.' });
                dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.FAILED });
              });
              
              if (intervalId) {
                clearInterval(intervalId);
              }
              return;
            }
          }
          
          if (lastLoadingStage !== LoadingStage.COMPLETE && state.loadingStage === LoadingStage.COMPLETE && !state.isRunning) {
            console.log('🎉 Simulation loaded completely, attempting to auto-start...');
            lastLoadingStage = state.loadingStage;
            
            setTimeout(() => {
              if (!unmounted) {
                tryStartSimulation();
              }
            }, 1000);
          } else {
            lastLoadingStage = state.loadingStage;
          }
          
          // Only poll if we still have a valid simulation ID
          if (state.simulationId) {
            getSimulationState();
          } else {
            // No valid simulation ID, stop polling
            if (intervalId) {
              clearInterval(intervalId);
            }
          }
        }, interval);
      }
    }

    // Create a function to try to start the simulation
    const tryStartSimulation = () => {
      if (unmounted) return; // Don't attempt to start if component is unmounted
      if (state.simulationId && state.loadingStage === LoadingStage.COMPLETE && !state.isRunning && !isStartingSimulation) {
        console.log('Auto-starting simulation...');
        isStartingSimulation = true; // Set flag to prevent duplicate requests
        
        api.startSimulation(state.simulationId)
          .then(response => {
            if (unmounted) return; // Don't update state if component is unmounted
            console.log('Auto-start response:', response);
            if (response.status === 'success') {
              dispatch({ type: 'SET_RUNNING', payload: true });
              console.log('Auto-start successful');
            } else {
              console.error('Auto-start failed:', response.message);
              dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to auto-start simulation' });
            }
          })
          .catch(err => {
            if (unmounted) return; // Don't update state if component is unmounted
            console.error('Auto-start error:', err);
            dispatch({ type: 'SET_ERROR', payload: 'Error during auto-start, please try starting manually' });
          })
          .finally(() => {
            isStartingSimulation = false;
          });
      }
    };

    return () => {
      console.log('Setting unmount flag and cleaning up polling interval');
      unmounted = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.simulationId, state.isRunning, state.loading, state.loadingStage, getSimulationState, dispatch]);
  
  // Clean up simulation when component unmounts
  useEffect(() => {
    return () => {
      console.log(`Component unmounted, cleaning up any resources`);
      
      // Set unmount flag to prevent new operations
      window._unmountingPage = true;
      
      // Ensure all flags are reset
      window._simulationActiveFlag = false;
      isCreatingSimulation = false;
      isStartingSimulation = false;
      
      // Clear any active operations tracking
      if (window._activeOperations) {
        window._activeOperations.clear();
      }
      
      // Clear any protection flag timeouts
      if (window._protectionFlagTimeoutId) {
        clearTimeout(window._protectionFlagTimeoutId);
        window._protectionFlagTimeoutId = undefined;
      }
      
      if (state.simulationId) {
        // Check if this simulation is already being cleaned up
        if (cleaningUpSimulations.has(state.simulationId)) {
          console.log(`Simulation ${state.simulationId} is already being cleaned up, skipping duplicate cleanup on unmount`);
          return;
        }
        
        // Prevent race conditions by storing the simulation ID
        const simId = state.simulationId;
        
        // Mark as being cleaned up
        cleaningUpSimulations.add(simId);
        
        console.log(`Component unmounted, cleaning up simulation ${simId}`);
        
        // Clear the state immediately to prevent further requests
        dispatch({ type: 'CLEAR_SIMULATION' });
        
        // Fire a cleanup request to the backend, but don't wait for it
        try {
          // Background delete request - fire and forget
          api.deleteSimulation(simId)
            .then(response => {
              console.log(`Successfully deleted simulation ${simId} during unmount`);
            })
            .catch(err => {
              if (err?.response?.status === 404) {
                console.log(`Simulation ${simId} already gone during unmount cleanup`);
              } else {
                console.log(`Error in background deletion during unmount (non-critical):`, err);
              }
            })
            .finally(() => {
              // Clean up from tracking after a delay
              setTimeout(() => {
                cleaningUpSimulations.delete(simId);
              }, 1000);
            });
        } catch (error) {
          console.error('Error during unmount cleanup:', error);
          
          // Clean up from tracking even if there's an error
          setTimeout(() => {
            cleaningUpSimulations.delete(simId);
          }, 1000);
        }
      }
      
      // Reset unmount flag after a delay
      setTimeout(() => {
        window._unmountingPage = false;
      }, 5000);
    };
  }, [state.simulationId, dispatch]);
  
  // Create a timeout controller that can be aborted
  const createTimeout = (ms: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timeoutId)
    };
  };
  
  // Create a new simulation
  const createSimulation = async (params: SimulationParams = DEFAULT_SIMULATION_PARAMS, retries = MAX_RETRIES) => {
    // Don't create new simulations while unmounting
    if (window._unmountingPage) {
      console.log('Page is unmounting, ignoring createSimulation request');
      return;
    }
    
    if (isCreatingSimulation) {
      console.log('Already creating a simulation, ignoring duplicate request');
      return;
    }
    
    console.log(`Creating simulation with params: ${JSON.stringify(params)}`);
    
    // Set flag to prevent duplicate requests and cleanup during initialization
    isCreatingSimulation = true;
    window._simulationActiveFlag = true;
    console.log('Set protection flags for creation');
    
    // Set safety timeout to reset flags if something goes wrong
    const safetyTimeoutId = setTimeout(() => {
      console.log('Safety timeout triggered to reset creation flags');
      if (isCreatingSimulation) {
        isCreatingSimulation = false;
        console.log('Reset isCreatingSimulation flag via safety timeout');
      }
      window._simulationActiveFlag = false;
    }, 30000); // 30 second safety timeout
    
    // Create a timeout controller
    const timeoutController = createTimeout(REQUEST_TIMEOUT);
    
    // Generate completely new client ID every time to avoid rate limiting
    let clientParams = { ...params };
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newClientId = `client_${timestamp}_${randomString}`;
    localStorage.setItem('abm_client_id', newClientId);
    clientParams.client_id = newClientId;
    
    // Add a flag for developer testing mode
    const isDevTesting = isDeveloperTestingMode();
    clientParams.is_developer_test = isDevTesting;
    
    // 重试逻辑
    let currentRetry = 0;
    let lastError = null;
    
    while (currentRetry <= retries) {
      try {
        // First, handle any existing simulation
        const existingSimId = state.simulationId;
        if (existingSimId) {
          console.log(`Cleaning up existing simulation ${existingSimId} before creating new one`);
          
          // Stop simulation if running
          if (state.isRunning) {
            try {
              console.log(`Stopping running simulation ${existingSimId} before cleanup`);
              await api.stopSimulation(existingSimId);
            } catch (stopError) {
              console.error('Error stopping existing simulation:', stopError);
              // Continue anyway
            }
          }
          
          // Clear state before making API calls to prevent race conditions
          dispatch({ type: 'CLEAR_SIMULATION' });
          
          // Delete the existing simulation
          try {
            console.log(`Deleting existing simulation ${existingSimId}`);
            await api.deleteSimulation(existingSimId);
            console.log(`Successfully deleted existing simulation ${existingSimId}`);
          } catch (deleteError) {
            console.error('Error deleting existing simulation:', deleteError);
            // Continue with creation even if cleanup fails
          }
          
          // Add a delay to ensure deletion has propagated through backend
          console.log("Waiting for deletion to complete...");
          await new Promise(resolve => setTimeout(resolve, 2500)); // Increased from 2000 to 2500 ms
        }
        
        // Now clear any existing error and state completely
        dispatch({ type: 'CLEAR_SIMULATION' });
        dispatch({ type: 'SET_ERROR', payload: null });
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.INITIALIZING });
        dispatch({ type: 'SET_LOADING_PROGRESS', payload: 0 });
        
        // Small delay before attempting creation - avoid rate limiting
        console.log("Waiting before creating simulation to avoid rate limiting...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1500 to 2000 ms
        
        // Call API to create simulation
        console.log(`Creating simulation with client ID: ${clientParams.client_id}`);
        const response = await api.createSimulation(clientParams, { signal: timeoutController.signal });
        
        // ===== IMPORTANT: Handle "initialization started" as a success case, not an error =====
        // Check if the message indicates initialization started, regardless of status
        const isInitializationStarted = response.message && response.message.includes('initialization started');
        
        if (response.status === 'success' || response.status === 'initializing' || isInitializationStarted) {
          // Save the simulation ID
          const simulationId = response.simulation_id;
          if (!simulationId) {
            throw new Error('No simulation ID returned from server');
          }
          
          console.log(`Simulation created with ID ${simulationId}`);
          dispatch({ type: 'SET_SIMULATION_ID', payload: simulationId });
          
          // Keep protection flags active during initialization
          window._simulationActiveFlag = true;
          
          // Update loading state based on response
          if (response.loading_stage) {
            dispatch({ type: 'SET_LOADING_STAGE', payload: response.loading_stage });
          } else {
            // Default to INITIALIZING if no loading stage is provided
            dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.INITIALIZING });
          }
          
          if (response.loading_progress !== undefined) {
            dispatch({ type: 'SET_LOADING_PROGRESS', payload: response.loading_progress });
          }
          
          // Update FPS if provided
          if (response.fps) {
            dispatch({ type: 'SET_FPS', payload: response.fps });
          }
          
          // Reset protection flags according to the state of the simulation
          if (response.status === 'success' && response.loading_stage === LoadingStage.COMPLETE) {
            // If simulation is already complete, we can reset flags after a short delay
            setTimeout(() => {
              console.log('Simulation is already complete, resetting protection flags');
              window._simulationActiveFlag = false;
            }, 2000);
          } else {
            // For initializing simulations, log but keep flags active
            console.log('Simulation initialization started - this is normal behavior');
            console.log('Polling will continue to track initialization progress');
            console.log('Protection flags will remain active during initialization');
          }
          
          // Clear safety timeout and reset creation flag
          clearTimeout(safetyTimeoutId);
          isCreatingSimulation = false;
          
          console.log('Creation successful - polling for updates');
          return;
        } else {
          // This is a true error case, retry if possible
          console.error(`Unexpected response: ${response.status}, message: ${response.message}`);
          lastError = new Error(`Failed to create simulation: ${response.message}`);
          
          // Increment retry counter
          currentRetry++;
          
          if (currentRetry <= retries) {
            console.log(`Retrying creation (attempt ${currentRetry}/${retries})...`);
            // Short delay before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          } else {
            throw lastError;
          }
        }
      } catch (error) {
        lastError = error;
        
        // Increment retry counter and try again if we haven't reached the retry limit
        currentRetry++;
        
        if (currentRetry <= retries) {
          console.log(`Creation error, retrying (attempt ${currentRetry}/${retries}):`, error);
          // Add increasing delay between retries (1s, 2s, 3s etc)
          // eslint-disable-next-line no-loop-func
          await new Promise(resolve => setTimeout(resolve, currentRetry * 1000));
          continue;
        }
        
        // If we've exhausted all retries, propagate the error
        console.error('Creation failed after all retries:', error);
        break;
      }
    }
    
    // Clean up regardless of outcome
    timeoutController.clear();
    clearTimeout(safetyTimeoutId);
    
    // If we got here, all retries failed
    console.error('All creation attempts failed');
    dispatch({ 
      type: 'SET_ERROR', 
      payload: lastError ? 
        `Creation failed: ${(lastError as Error).message || 'Unknown error'}` : 
        'Creation failed after all retries' 
    });
    dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.FAILED });
    dispatch({ type: 'SET_LOADING', payload: false });
    
    // Reset flags to clean state
    isCreatingSimulation = false;
    window._simulationActiveFlag = false;
  };
  
  // Start a simulation
  const startSimulation = async (retries = MAX_RETRIES) => {
    if (!state.simulationId || isStartingSimulation) {
      return;
    }
    
    console.log(`Starting simulation ${state.simulationId}`);
    
    // Set flag to prevent duplicate requests
    isStartingSimulation = true;
    
    // Create a timeout controller
    const timeoutController = createTimeout(REQUEST_TIMEOUT);
    
    try {
      // Add a protection to prevent cleaning up while starting
      window._simulationActiveFlag = true;
      
      const response = await api.startSimulation(state.simulationId, { signal: timeoutController.signal });
      
      if (response.status === 'success') {
        dispatch({ type: 'SET_RUNNING', payload: true });
        console.log('Simulation started successfully');
        
        // Force a state refresh immediately after starting
        try {
          await getSimulationState();
        } catch (stateError) {
          console.error('Error refreshing state after start:', stateError);
        }
      } else if (response.status === 'error' && response.message.includes('initialization')) {
        // If the error is about initialization not being complete, update loading status
        console.log('Simulation not ready to start, still initializing');
        dispatch({ type: 'SET_LOADING', payload: true });
        
        if (response.loading_stage) {
          dispatch({ type: 'SET_LOADING_STAGE', payload: response.loading_stage });
        }
        
        if (response.loading_progress !== undefined) {
          dispatch({ type: 'SET_LOADING_PROGRESS', payload: response.loading_progress });
        }
      } else {
        console.error(`Failed to start simulation: ${response.message}`);
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to start simulation' });
      }
    } catch (error) {
      console.error('Error starting simulation:', error);
      
      if ((error as any).name === 'AbortError') {
        console.error('Request timeout during simulation start');
        dispatch({ type: 'SET_ERROR', payload: 'Request timeout during simulation start' });
      } else if ((error as any)?.response?.status === 404) {
        // This is the case when the simulation has been deleted due to inactivity
        console.error('Simulation not found (404), it may have been deleted due to inactivity');
        dispatch({ 
          type: 'SET_ERROR', 
          payload: getTimeoutErrorMessage() 
        });
        dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.FAILED });
        
        // Immediately reset the starting flag to ensure the UI doesn't get stuck
        isStartingSimulation = false;
      } else if (retries > 0) {
        // Retry if we have retries left
        const backoffTime = Math.pow(2, MAX_RETRIES - retries) * 1000;
        console.log(`Retrying simulation start after ${backoffTime}ms, ${retries} retries left`);
        
        setTimeout(() => {
          startSimulation(retries - 1);
        }, backoffTime);
        
        return;
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to start simulation after multiple attempts' });
      }
    } finally {
      // Clear timeout
      timeoutController.clear();
      
      // Reset the protection flag after a delay to prevent race conditions
      setTimeout(() => {
        window._simulationActiveFlag = false;
      }, 2000);
      
      // Reset the starting flag after a short delay
      setTimeout(() => {
        isStartingSimulation = false;
      }, 1000);
    }
  };
  
  // Stop the simulation with timeout handling
  const stopSimulation = async (retries = MAX_RETRIES) => {
    if (!state.simulationId) return;
    
    console.log(`Attempting to stop simulation ${state.simulationId}`);
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      // Create a timeout controller
      const timeoutController = createTimeout(REQUEST_TIMEOUT);
      
      try {
        // Add strong protection to prevent simulation cleanup during and after stop
        window._simulationActiveFlag = true;
        
        // Store simulation ID locally to avoid state changes during the operation
        const simulationId = state.simulationId;
        
        // Record that we're stopping this simulation to prevent auto-cleanup
        recentlyStoppedSimulations.set(simulationId, Date.now());
        console.log(`Marked simulation ${simulationId} as recently stopped`);
        
        // Make the API call
        const response = await api.stopSimulation(simulationId, {
          signal: timeoutController.signal
        });
        
        // Check response status
        if (response.status === 'success') {
          console.log(`Successfully stopped simulation ${simulationId}`);
          dispatch({ type: 'SET_RUNNING', payload: false });
          
          // Update the stopped timestamp to prevent cleanup
          recentlyStoppedSimulations.set(simulationId, Date.now());
          
          // Only get the final state, don't trigger cleanup
          try {
            await getSimulationState();
            console.log(`Updated state after stopping simulation ${simulationId}`);
          } catch (stateError) {
            console.error('Error getting state after stop:', stateError);
          }
        } else {
          console.error(`Failed to stop simulation: ${response.message}`);
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to stop simulation' });
        }
      } catch (error) {
        console.error('Error during stop simulation:', error);
        
        // Check if it's a 404 error (simulation not found)
        const is404Error = (error as any)?.response?.status === 404;
        
        if (is404Error) {
          console.log('Simulation not found (404), it may have been deleted already');
          // Just update the UI state without trying to delete again
          dispatch({ type: 'SET_RUNNING', payload: false });
          // Don't clear the simulation here - let the user decide what to do next
        } else if ((error as any).name === 'AbortError') {
          // Handle timeout specifically
          console.error('Request timeout during simulation stop');
          
          if (retries > 0) {
            console.log(`Stop timed out, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
            dispatch({ type: 'SET_ERROR', payload: `Stop request timed out, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})` });
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Clear the timeout
            timeoutController.clear();
            
            // Reset the protection flag
            window._simulationActiveFlag = false;
            
            // Retry with one less retry attempt
            return stopSimulation(retries - 1);
          } else {
            dispatch({ type: 'SET_ERROR', payload: 'Request timeout during simulation stop. Please try again.' });
          }
        } else {
          // For network errors or other issues
          const errorMessage = error instanceof Error ? error.message : 'Error stopping simulation';
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
        }
      } finally {
        // Clear the timeout
        timeoutController.clear();
        
        // Keep protection flag active for longer to prevent immediate cleanup
        // This gives the user time to interact with the stopped simulation
        console.log('Maintaining protection flag after stop operation');
        setTimeout(() => {
          console.log('Releasing protection flag 5 seconds after stop operation');
          window._simulationActiveFlag = false;
        }, 5000);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };
  
  // Set FPS (frames per second) for the simulation with timeout handling
  const setFps = async (fps: number, retries = MAX_RETRIES) => {
    if (!state.simulationId) return;
    
    console.log(`Setting FPS to ${fps} for simulation ${state.simulationId}`);
    
    // Create a timeout controller
    const timeoutController = createTimeout(REQUEST_TIMEOUT);
    
    try {
      // Make the API call with timeout
      const response = await api.setSimulationFps(state.simulationId, fps, {
        signal: timeoutController.signal
      });
      
      if (response.status === 'success' && response.fps) {
        console.log(`Successfully set FPS to ${response.fps}`);
        dispatch({ type: 'SET_FPS', payload: response.fps });
      } else if (response.status !== 'success') {
        console.error(`Error setting FPS: ${response.message || 'Unknown error'}`);
        // Not showing error in UI to avoid disruption for minor issues
      }
    } catch (error) {
      // Handle timeout or other errors
      console.error('Error setting FPS:', error);
      
      // Handle timeout specifically
      if ((error as any).name === 'AbortError') {
        if (retries > 0) {
          console.log(`FPS update timed out, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Clear the timeout
          timeoutController.clear();
          
          // Retry with one less retry attempt
          return setFps(fps, retries - 1);
        }
      }
      
      // Not showing error in UI to avoid disruption
      // This is less critical than other operations
    } finally {
      // Clear the timeout
      timeoutController.clear();
    }
  };
  
  // Step the simulation with timeout handling
  const stepSimulation = async (retries = MAX_RETRIES) => {
    if (!state.simulationId || state.isRunning) return;
    
    const simulationId = state.simulationId; // Use a non-null local variable
    
    console.log(`Stepping simulation ${simulationId}`);
    
    // Create a unique ID for this step operation to prevent race conditions
    const stepOperationId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`Starting step operation ${stepOperationId}`);
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      // Create a timeout controller
      const timeoutController = createTimeout(REQUEST_TIMEOUT);
      
      try {
        // Prevent cleanup during step operation with a stronger protection
        window._simulationActiveFlag = true;
        
        // Record this simulation ID as actively being used to prevent cleanup
        if (!window._activeOperations) {
          window._activeOperations = new Set<string>();
        }
        window._activeOperations.add(simulationId);
        
        // Make the API call
        const response = await api.stepSimulation(simulationId, {
          signal: timeoutController.signal
        });
        
        if (response.status === 'success') {
          console.log(`Successfully stepped simulation ${simulationId}`);
          await getSimulationState(); // Get the updated state
          
          // Update activity timestamp to prevent inactivity cleanup
          updateSimulationActivity(simulationId);
        } else {
          console.error(`Failed to step simulation: ${response.message}`);
          dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to step simulation' });
        }
      } catch (error) {
        console.error('Error during step simulation:', error);
        
        // Handle timeout specifically
        if ((error as any).name === 'AbortError') {
          console.error('Request timeout during simulation step');
          
          if (retries > 0) {
            console.log(`Step timed out, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
            dispatch({ type: 'SET_ERROR', payload: `Step request timed out, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})` });
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Clear the timeout
            timeoutController.clear();
            
            // Reset the protection flag
            window._simulationActiveFlag = false;
            
            // Remove from active operations
            if (window._activeOperations) {
              window._activeOperations.delete(simulationId);
            }
            
            // Retry with one less retry attempt
            return stepSimulation(retries - 1);
          } else {
            dispatch({ type: 'SET_ERROR', payload: 'Request timeout during simulation step. Please try again.' });
          }
        } else {
          // For network errors or other issues
          const errorMessage = error instanceof Error ? error.message : 'Error stepping simulation';
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
          
          // If we got a 404, the simulation might be gone
          if ((error as any)?.response?.status === 404) {
            console.log('Simulation not found (404) during step, likely deleted due to inactivity');
            // Provide a clear message about what happened and what to do next
            dispatch({ 
              type: 'SET_ERROR', 
              payload: getTimeoutErrorMessage() 
            });
            dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.FAILED });
            
            // Make sure to remove from active operations
            if (window._activeOperations) {
              window._activeOperations.delete(simulationId);
            }
            
            // Ensure flag is reset to prevent UI from getting stuck
            window._simulationActiveFlag = false;
          }
        }
      } finally {
        // Clear the timeout
        timeoutController.clear();
        
        console.log(`Completed step operation ${stepOperationId}, scheduling protection release`);
        
        // Only release the protection flag if we're not unmounting
        if (!window._unmountingPage) {
          // Reset the protection flag after a delay, but store the timeout ID
          // so we can clear it if needed
          const timeoutId = setTimeout(() => {
            // Double-check we're not unmounting before releasing the flag
            if (!window._unmountingPage) {
              console.log(`Releasing protection flag after step operation ${stepOperationId}`);
              
              // Remove from active operations
              if (window._activeOperations) {
                window._activeOperations.delete(simulationId);
                console.log(`Removed simulation ${simulationId} from active operations after step ${stepOperationId}`);
              }
              
              // Only release protection flag if no active operations for this simulation
              if (!window._activeOperations?.has(simulationId)) {
                window._simulationActiveFlag = false;
              } else {
                console.log(`Not releasing protection flag - other operations still active for ${simulationId}`);
              }
            } else {
              console.log(`Not releasing protection flag for ${stepOperationId} - page is unmounting`);
            }
          }, 5000);  // Increased from 3000ms to 5000ms to provide more protection
          
          // Store the timeout ID on the window for potential cleanup
          window._protectionFlagTimeoutId = timeoutId;
        } else {
          console.log(`Not scheduling protection flag release for ${stepOperationId} - page is unmounting`);
        }
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      console.log(`Step operation ${stepOperationId} finally block completed`);
    }
  };
  
  // Reset the simulation with timeout handling
  const resetSimulation = async (params: SimulationParams = DEFAULT_SIMULATION_PARAMS, retries = MAX_RETRIES) => {
    // Don't reset simulations while unmounting
    if (window._unmountingPage) {
      console.log('Page is unmounting, ignoring resetSimulation request');
      return;
    }
    
    // If no simulation ID exists, handle as a new creation instead of reset
    if (!state.simulationId) {
      console.log('No existing simulation to reset, creating new simulation instead');
      return createSimulation(params);
    }
    
    console.log(`Resetting simulation with params: ${JSON.stringify(params)}`);
    
    // Reset isCreatingSimulation flag to ensure we can create
    isCreatingSimulation = false;
    
    // Set safety timeout to reset flags if something goes wrong
    const safetyTimeoutId = setTimeout(() => {
      console.log('Safety timeout triggered to reset flags during reset operation');
      resetGlobalFlags();
    }, 30000); // 30 second safety timeout
    
    try {
      // Using the "Reset and Retry" button logic which works reliably
      // Clear all stored IDs, completely reset
      localStorage.removeItem('abm_client_id');
      
      // Store the current simulation ID for cleanup if it exists
      const oldSimulationId = state.simulationId;
      
      // Set flags to prevent cleanup during reset and initialization
      window._simulationActiveFlag = true;
      console.log('Setting protection flags for reset operation');
      
      // Clear previous state and ensure retry logic is clean
      dispatch({ type: 'CLEAR_SIMULATION' });
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.INITIALIZING });
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: 0 });
      
      // Generate a completely new client ID for this reset operation
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const resetClientId = `client_${timestamp}_${randomString}`;
      localStorage.setItem('abm_client_id', resetClientId);
      
      console.log(`Generated new client ID for reset: ${resetClientId}`);
      
      // If there was a previous simulation, try to clean it up
      if (oldSimulationId) {
        try {
          console.log(`Cleaning up existing simulation ${oldSimulationId} before reset`);
          // First try to stop the simulation if it's running
          if (state.isRunning) {
            try {
              console.log(`Stopping running simulation ${oldSimulationId} before reset`);
              await api.stopSimulation(oldSimulationId);
            } catch (stopError) {
              console.log(`Non-critical error stopping simulation before reset: ${stopError}`);
              // Continue with deletion even if stopping fails
            }
          }
          
          await safeApiCall(
            () => api.deleteSimulation(oldSimulationId),
            `Error during simulation cleanup in reset for ${oldSimulationId}`,
            false // Don't reset flags on error here since we're in the middle of reset
          );
          console.log(`Successfully deleted old simulation ${oldSimulationId}`);
        } catch (cleanupError) {
          console.error('Error during simulation cleanup in reset:', cleanupError);
          // Continue even if cleanup fails
        }
      }
      
      // Set a longer delay to ensure cleanup is complete and backend has time to process
      console.log('Waiting for cleanup to complete...');
      await new Promise(resolve => setTimeout(resolve, 2500)); // Increased from 1500 to 2500 ms
      
      // Create new simulation with the new client ID
      const newParams = {
        ...DEFAULT_SIMULATION_PARAMS,
        ...params,
        client_id: resetClientId,
        is_developer_test: isDeveloperTestingMode() // Add developer testing flag
      };
      
      console.log('Creating new simulation after reset with params:', newParams);
      
      // Create the new simulation using the existing function which handles all edge cases
      // Note: createSimulation will maintain the protection flags during initialization
      await createSimulation(newParams, 3); // Ensure we use 3 retries on reset-creation
    } catch (error) {
      console.error('Error during reset:', error);
      
      // Update UI state to reflect the error
      dispatch({ type: 'SET_ERROR', payload: 'Reset failed. Please try again.' });
      dispatch({ type: 'SET_LOADING_STAGE', payload: LoadingStage.FAILED });
      dispatch({ type: 'SET_LOADING', payload: false });
      
      // Reset protection flags in case of error
      resetGlobalFlags();
    } finally {
      // Clear the safety timeout
      clearTimeout(safetyTimeoutId);
    }
    
    // Note: We don't reset _simulationActiveFlag here as createSimulation will handle it
    // based on the initialization state
  };
  
  const contextValue = {
    state,
    createSimulation,
    startSimulation,
    stopSimulation,
    stepSimulation,
    setFps,
    resetSimulation,
    getSimulationState,
    cleanupSimulation
  };
  
  return (
    <ABMContext.Provider value={contextValue}>
      {children}
    </ABMContext.Provider>
  );
};

// Custom hook to use the ABM context
export const useABMContext = (): ABMContextType => {
  const context = useContext(ABMContext);
  if (context === undefined) {
    throw new Error('useABMContext must be used within an ABMProvider');
  }
  return context;
}; 