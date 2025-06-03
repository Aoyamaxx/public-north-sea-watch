// ABM Simulation types

// Loading stages for the simulation
export enum LoadingStage {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  LOADING_DATA = 'LOADING_DATA',
  CREATING_AGENTS = 'CREATING_AGENTS',
  ESTABLISHING_ROUTES = 'ESTABLISHING_ROUTES',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED'
}

export interface SimulationParams {
  national_ban?: string;
  custom_port_policies?: string;
  fps?: number;
  client_id?: string;
  is_developer_test?: boolean; // Flag to indicate this is a developer test simulation with extended timeout
}

export interface SimulationPortrayal {
  Shape: string;
  Color: string;
  Filled: string;
  Layer: number;
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
  port_name?: string;
  text_color?: string;
  max_capacity?: number;
  current_capacity?: number;
  port_info?: string; // Keep for backward compatibility
  country?: string; // Add country information for flag display
  policy?: string; // Add policy information for better formatting
}

export interface SimulationResponse {
  status: string;
  message: string;
  simulation_id?: string;
  fps?: number;
  loading_stage?: LoadingStage;
  loading_progress?: number;
}

export interface SimulationState {
  status: string;
  running: boolean;
  step_count: number;
  fps: number;
  grid_state: SimulationPortrayal[];
  model_data: {
    NumScrubberShips: number;
    NumScrubberTrails: number;
    TotalScrubberWater: number;
    NumShips: number;
    TotalDockedShips: number;
    AvgPortPopularity: number;
    NumPortsBan: number;
    NumPortsTax?: number;
    NumPortsSubsidy?: number;
    NumPortsAllow?: number;
    TotalPortRevenue?: number;
    AvgPortRevenue?: number;
    PortRevenues?: {[portName: string]: number};
    PortDocking?: {[portName: string]: number};
    [key: string]: any;
  };
  loading_stage?: LoadingStage;
  loading_progress?: number;
  message?: string;
}

export interface ABMState {
  simulationId: string | null;
  isRunning: boolean;
  stepCount: number;
  fps: number;
  gridState: SimulationPortrayal[];
  modelData: {
    NumScrubberShips: number;
    NumScrubberTrails: number;
    TotalScrubberWater: number;
    NumShips: number;
    TotalDockedShips: number;
    AvgPortPopularity: number;
    NumPortsBan: number;
    NumPortsTax?: number;
    NumPortsSubsidy?: number;
    NumPortsAllow?: number;
    TotalPortRevenue?: number;
    AvgPortRevenue?: number;
    PortRevenues?: {[portName: string]: number};
    PortDocking?: {[portName: string]: number};
    [key: string]: any;
  };
  error: string | null;
  loading: boolean;
  loadingStage: LoadingStage;
  loadingProgress: number;
}

export interface ABMContextType {
  state: ABMState;
  createSimulation: (params: SimulationParams) => Promise<void>;
  startSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  stepSimulation: () => Promise<void>;
  setFps: (fps: number) => Promise<void>;
  resetSimulation: (params: SimulationParams) => Promise<void>;
  getSimulationState: () => Promise<void>;
  cleanupSimulation: () => Promise<void>;
}

export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  national_ban: 'None',
  custom_port_policies: 'None',
  fps: 1.0
}; 