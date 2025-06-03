import axios from 'axios';
import { SimulationParams, SimulationResponse, SimulationState } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Function to build API URL paths intelligently
const buildApiPath = (path: string): string => {
  // Check if API_BASE_URL already ends with /api/v1
  if (API_BASE_URL.endsWith('/api/v1')) {
    // Remove leading /api/v1 from path if present
    return `${API_BASE_URL}${path.startsWith('/api/v1') ? path.substring(7) : path}`;
  }
  // If API_BASE_URL doesn't end with /api/v1, ensure path has the /api/v1 prefix
  return `${API_BASE_URL}${path.startsWith('/api/v1') ? path : `/api/v1${path}`}`;
};

// Default axios instance with timeout
const api = axios.create({
  timeout: 30000 // 30 seconds
});

// Create a new simulation
export const createSimulation = async (
  params: SimulationParams & { client_id?: string }, 
  options?: { signal?: AbortSignal }
): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath('/api/v1/abm/simulations/create/'), 
    params,
    options
  );
  return response.data;
};

// Get current state of a simulation
export const getSimulationState = async (simulationId: string, options?: { signal?: AbortSignal }): Promise<SimulationState> => {
  const response = await api.get<SimulationState>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/`),
    options
  );
  return response.data;
};

// Start a simulation
export const startSimulation = async (simulationId: string, options?: { signal?: AbortSignal }): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/start/`),
    null,
    options
  );
  return response.data;
};

// Stop a simulation
export const stopSimulation = async (simulationId: string, options?: { signal?: AbortSignal }): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/stop/`),
    null,
    options
  );
  return response.data;
};

// Step a simulation
export const stepSimulation = async (simulationId: string, options?: { signal?: AbortSignal }): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/step/`),
    null,
    options
  );
  return response.data;
};

// Set the simulation FPS (frames per second)
export const setSimulationFps = async (simulationId: string, fps: number, options?: { signal?: AbortSignal }): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/fps/`), 
    { fps },
    options
  );
  return response.data;
};

// Reset a simulation
export const resetSimulation = async (simulationId: string, params: SimulationParams, options?: { signal?: AbortSignal }): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/reset/`), 
    params,
    options
  );
  return response.data;
};

// Delete a simulation
export const deleteSimulation = async (simulationId: string, options?: { signal?: AbortSignal }): Promise<SimulationResponse> => {
  const response = await api.post<SimulationResponse>(
    buildApiPath(`/api/v1/abm/simulations/${simulationId}/delete/`),
    null,
    options
  );
  return response.data;
}; 