// API configuration
const isDevelopment = process.env.NODE_ENV === 'development';

// Base API URL based on environment
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:8000' 
  : 'https://api.northseawatch.org';

// API endpoints
export const API_ENDPOINTS = {
  server: API_BASE_URL,
  PORTS: `${API_BASE_URL}/api/v1/all-ports/`,
  ACTIVE_SHIPS: `${API_BASE_URL}/api/v1/active-ships/`,
  SHIP_PATH: (imoNumber: string) => `${API_BASE_URL}/api/v1/ship-path/${imoNumber}/`,
  PORT_CONTENT: (portName: string, country: string) => `${API_BASE_URL}/api/v1/port-content/${encodeURIComponent(portName)}/${country}/`,
  TRACKING: `${API_BASE_URL}/api/v1/tracking/`,
  SCRUBBER_VESSELS: `${API_BASE_URL}/api/v1/ais_data/icct_scrubber_march_2025/`,
  ENGINE_DATA: `${API_BASE_URL}/api/v1/ais_data/icct_wfr_combined/`,
  PAST_SCRUBBER_DISTRIBUTION: `${API_BASE_URL}/api/v1/past-scrubber-distribution/`,
  NAVIGATIONAL_STATUS: `${API_BASE_URL}/api/v1/navigational-status/`
}; 