import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import Layout from '../../../components/layout/Layout';
import SEO from '../../../components/ui/SEO';
import './MapPage.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { API_ENDPOINTS} from '../../../config';
import { MapPopup } from '../../map-popup/MapPopup';
import { useLocation } from 'react-router-dom';
import PsdTimelineSlider from './PsdTimelineSlider';

// Import SVG icons
import portsIcon from '../../../assets/images/ports32.svg';
import shipIcon from '../../../assets/images/ship32.svg';
import portsIconPartialBan from '../../../assets/images/ports32_partial_ban_dash_outline.svg';
import portsIconTotalBan from '../../../assets/images/ports32_total_ban_dash_outline.svg';

// Updated scrubber vessel icon import - using SVG instead of PNG
import warningYellowScrubberIcon from '../../../assets/images/warning_yellow_outline_yellow_scrubbers.svg';

// Mapbox access token (public)
mapboxgl.accessToken = 'pk.eyJ1IjoiYW95YW1heHgiLCJhIjoiY203bXNycXJuMG9pNzJrczJuenJhaTM1bCJ9.WdsZnB4oQe3CSmOWfqcmyA';

// Ship type categories
enum ShipCategory {
  WIG = 'Wing In Ground',
  FISHING = 'Fishing',
  TOWING = 'Towing',
  DREDGING = 'Dredging',
  DIVING = 'Diving',
  MILITARY = 'Military',
  SAILING = 'Sailing',
  PLEASURE = 'Pleasure',
  HSC = 'High Speed Craft',
  PILOT = 'Pilot',
  SAR = 'Search and Rescue',
  TUG = 'Tug',
  PORT_TENDER = 'Port Tender',
  ANTI_POLLUTION = 'AT-pollution',
  LAW_ENFORCEMENT = 'Law Enforcement',
  SPARE_LOCAL = 'Spare',
  MEDICAL = 'Medical',
  NONCOMBATANT = 'N-combat',
  PASSENGER = 'Passenger',
  CARGO = 'Cargo',
  TANKER = 'Tanker',
  OTHER = 'Other'
}

// Ship type color mapping
const SHIP_COLORS = {
  [ShipCategory.WIG]: '#FFC266',
  [ShipCategory.FISHING]: '#90EE90',
  [ShipCategory.TOWING]: '#CD853F',
  [ShipCategory.DREDGING]: '#CD5C5C',
  [ShipCategory.DIVING]: '#AFEEEE',
  [ShipCategory.MILITARY]: '#A9A9A9',
  [ShipCategory.SAILING]: '#87CEFA',
  [ShipCategory.PLEASURE]: '#B0E2FF',
  [ShipCategory.HSC]: '#FFC0CB',
  [ShipCategory.PILOT]: '#FFFFE0',
  [ShipCategory.SAR]: '#FF6347',
  [ShipCategory.TUG]: '#DEB887',
  [ShipCategory.PORT_TENDER]: '#B19CD9',
  [ShipCategory.ANTI_POLLUTION]: '#66CDAA',
  [ShipCategory.LAW_ENFORCEMENT]: '#4682B4',
  [ShipCategory.SPARE_LOCAL]: '#B0C4DE',
  [ShipCategory.MEDICAL]: '#F0F8FF',
  [ShipCategory.NONCOMBATANT]: '#D3D3D3',
  [ShipCategory.PASSENGER]: '#6495ED',
  [ShipCategory.CARGO]: '#DC143C',
  [ShipCategory.TANKER]: '#BA55D3',
  [ShipCategory.OTHER]: '#696969',
};

// Determine ship category based on AIS ship type code
const getShipCategory = (shipType: number | null | string): ShipCategory => {
  // Convert string to number if needed
  const shipTypeNum = typeof shipType === 'string' ? parseInt(shipType, 10) : shipType;
  
  // Default to OTHER for null or NaN values
  if (shipTypeNum === null || (typeof shipTypeNum === 'number' && isNaN(shipTypeNum))) {
    return ShipCategory.OTHER;
  }
  
  // AIS ship type classification based on international standards
  if (shipTypeNum >= 20 && shipTypeNum <= 29) return ShipCategory.WIG;
  if (shipTypeNum === 30) return ShipCategory.FISHING;
  if (shipTypeNum === 31 || shipTypeNum === 32) return ShipCategory.TOWING;
  if (shipTypeNum === 33) return ShipCategory.DREDGING;
  if (shipTypeNum === 34) return ShipCategory.DIVING;
  if (shipTypeNum === 35) return ShipCategory.MILITARY;
  if (shipTypeNum === 36) return ShipCategory.SAILING;
  if (shipTypeNum === 37) return ShipCategory.PLEASURE;
  if (shipTypeNum >= 40 && shipTypeNum <= 49) return ShipCategory.HSC;
  if (shipTypeNum === 50) return ShipCategory.PILOT;
  if (shipTypeNum === 51) return ShipCategory.SAR;
  if (shipTypeNum === 52) return ShipCategory.TUG;
  if (shipTypeNum === 53) return ShipCategory.PORT_TENDER;
  if (shipTypeNum === 54) return ShipCategory.ANTI_POLLUTION;
  if (shipTypeNum === 55) return ShipCategory.LAW_ENFORCEMENT;
  if (shipTypeNum === 56 || shipTypeNum === 57) return ShipCategory.SPARE_LOCAL;
  if (shipTypeNum === 58) return ShipCategory.MEDICAL;
  if (shipTypeNum === 59) return ShipCategory.NONCOMBATANT;
  if (shipTypeNum >= 60 && shipTypeNum <= 69) return ShipCategory.PASSENGER;
  if (shipTypeNum >= 70 && shipTypeNum <= 79) return ShipCategory.CARGO;
  if (shipTypeNum >= 80 && shipTypeNum <= 89) return ShipCategory.TANKER;
  
  return ShipCategory.OTHER;
};

// Get ship color based on ship type
const getShipColor = (shipType: string | number | null): string => {
  const category = getShipCategory(shipType);
  return SHIP_COLORS[category];
};

// Get ship border color (darker than fill color)
const getShipBorderColor = (shipType: string | number | null): string => {
  const color = getShipColor(shipType);
  // Convert color to RGB, then reduce brightness
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  // Reduce brightness by 30%
  const darkerR = Math.floor(r * 0.7).toString(16).padStart(2, '0');
  const darkerG = Math.floor(g * 0.7).toString(16).padStart(2, '0');
  const darkerB = Math.floor(b * 0.7).toString(16).padStart(2, '0');
  
  return `#${darkerR}${darkerG}${darkerB}`;
};

// Message types for user notifications
enum MessageType {
  INFO = 'info',
  SUCCESS = 'success',
  ERROR = 'error'
}

// Message structure
interface Message {
  text: string;
  type: MessageType;
  timeout?: number;
}

// Port data structure
interface Port {
  port_name: string;
  country: string;
  latitude: number;
  longitude: number;
  scrubber_status: number; // Add scrubber_status field
}

// Port content structure for sidebar display
interface PortContent {
  port_name: string;
  country: string;
  details: string | null;
  policy_status: string | null;
  infrastructure_capacity: string | null;
  operational_statistics: string | null;
  additional_features: string | null;
  last_updated: string | null;
}

// Ship position data
interface ShipPosition {
  imo_number: string;
  timestamp_ais: string;
  latitude: number;
  longitude: number;
  destination: string | null;
  navigational_status_code: number | null;
  navigational_status: string | null; // Optional field from database - now computed from code using lookup table
  true_heading: number | null;
  rate_of_turn: number | null;
  cog: number | null;
  sog: number | null;
}

// Ship data structure
interface Ship {
  imo_number: string;
  mmsi: string | null;
  name: string;
  ship_type: string | number | null;
  length: number | null;
  width: number | null;
  max_draught: number | null;
  type_name: string | null;
  type_remark: string | null;
  latest_position: ShipPosition;
  // Pre-calculated discharge rates from backend (kg/h) - only for scrubber vessels
  emission_berth: number | null;
  emission_anchor: number | null;
  emission_maneuver: number | null;
  emission_cruise: number | null;
  // Runtime calculated fields for display
  scrubberDischargeRate?: number;
  operationMode?: string;
  // Additional calculation fields for debugging/display
  displacementVolume?: number;
  displacementWeight?: number;
  dwt?: number;
  dwtCategory?: number;
  baseEmissionRate?: number; // kW (AE power)
  boilerPower?: number; // kW (BO power)
  totalPower?: number; // kW (AE + BO power)
  blockCoef?: number;
  lightweightFactor?: number;
  dischargeMultiplier?: number;
}

// Zoom level thresholds for ship display modes
const ZOOM_THRESHOLD_MIN = 9; 
const ZOOM_THRESHOLD_MAX = 15;

// Ship type legend component props - renamed to Legends
interface LegendsProps {
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const Legends: React.FC<LegendsProps> = ({ isOpen, onToggle, disabled = false }) => {
  const legendItems = Object.entries(ShipCategory).map(([key, value]) => ({
    category: value,
    color: SHIP_COLORS[value as ShipCategory]
  }));

  // Port legend items with their icons and descriptions
  const portLegendItems = [
    {
      icon: portsIcon,
      description: 'Regular Ports',
      detail: 'No scrubber restrictions'
    },
    {
      icon: portsIconPartialBan,
      description: 'Partial Restrictions',
      detail: 'Conditional scrubber regulations'
    },
    {
      icon: portsIconTotalBan,
      description: 'Strict Bans',
      detail: 'Scrubber discharge prohibited'
    }
  ];

  return (
    <div className={`ship-legend ${isOpen ? 'open' : ''}`}>
      <button 
        className="legend-toggle" 
        onClick={onToggle}
        disabled={disabled}
      >
        {isOpen ? 'Hide Legends' : 'Legends'}
      </button>
      
      {isOpen && (
        <div className="legend-content">
          <h3>Ship Types</h3>
          <div className="legend-items">
            {legendItems.map((item, index) => (
              <div key={index} className="legend-item">
                <span className="color-box" style={{ backgroundColor: item.color }}></span>
                <span className="category-name">{item.category}</span>
              </div>
            ))}
          </div>
          
          <h3>Ports</h3>
          <div className="port-legend-items">
            {portLegendItems.map((item, index) => (
              <div key={index} className="port-legend-item">
                <img 
                  src={item.icon} 
                  alt={item.description}
                  className="port-icon"
                />
                <div className="port-legend-text">
                  <span className="port-description">{item.description}</span>
                  <span className="port-detail">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Utility to detect mobile devices
const isMobileDevice = (): boolean => {
  return window.innerWidth <= 1500; 
};

// Settings button component props
interface SettingsButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button 
      className="settings-button" 
      onClick={onClick}
      disabled={disabled}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      Settings
    </button>
  );
};

// Questionmark / tutorial button component props
interface TutorialButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const TutorialButton: React.FC<TutorialButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button 
      className="tutorial-button" 
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title="Open tutorial"
      aria-label="Open tutorial"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="28" height="28">
        <path d="M400,741.52c186.5,0,341.52-154.69,341.52-341.52S586.16,58.48,399.66,58.48,58.48,213.5,58.48,400s154.69,341.52,341.52,341.52ZM393.64,472.66c-18.42,0-28.13-9.37-28.13-27.45v-4.69c0-34.49,18.42-53.24,43.86-70.65,31.14-21.09,45.53-33.15,45.53-57.25,0-26.45-20.76-44.53-52.9-44.53-23.1,0-40.85,11.72-51.56,30.8-11.38,13.39-14.73,23.77-34.82,23.77-11.38,0-24.11-8.37-24.11-24.11,0-6.03,1.34-11.72,3.01-17.41,9.04-32.48,49.55-60.6,109.82-60.6s111.83,31.14,111.83,89.4c0,42.19-24.44,62.28-58.59,85.38-24.11,16.41-36.16,28.46-36.16,48.21v4.35c0,13.73-10.38,24.78-27.79,24.78ZM394.64,573.44c-19.08,0-37.5-15.4-37.5-36.16s18.08-36.16,37.5-36.16,37.5,15.07,37.5,36.16-18.08,36.16-37.5,36.16Z" fill="#FFFFFF"/>
      </svg>
    </button>
  );
};

// Control panel component props
interface ControlPanelProps {
  isOpen: boolean;
  heatmapEnabled: boolean;
  onHeatmapToggle: (enabled: boolean) => void;
  scrubberHeatmapEnabled: boolean;
  onScrubberHeatmapToggle: (enabled: boolean) => void;
  onShowTutorial: () => void;
  disabled?: boolean;
  trackScrubberVessels: boolean;
  onTrackScrubberVesselsToggle: (enabled: boolean) => void;
  showOnlyScrubberVessels: boolean;
  onShowOnlyScrubberVesselsToggle: (enabled: boolean) => void;
  pastScrubberValue?: number;
  onPastScrubberValueChange?: (value: number) => void;
  pastScrubberTimeUnit?: string;
  onPastScrubberTimeUnitChange?: (unit: string) => void;
  onViewPastScrubberDistribution?: () => void;
  isLoading?: boolean;
  pastScrubberVisualizationEnabled?: boolean;
  onStopPastScrubberVisualization?: () => void;
  onCancelLoading?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  isOpen, 
  heatmapEnabled, 
  onHeatmapToggle, 
  scrubberHeatmapEnabled,
  onScrubberHeatmapToggle,
  onShowTutorial, 
  disabled = false,
  trackScrubberVessels,
  onTrackScrubberVesselsToggle,
  showOnlyScrubberVessels,
  onShowOnlyScrubberVesselsToggle,
  pastScrubberValue = 1,
  onPastScrubberValueChange = () => {},
  pastScrubberTimeUnit = 'Hour',
  onPastScrubberTimeUnitChange = () => {},
  onViewPastScrubberDistribution = () => {},
  isLoading = false,
  pastScrubberVisualizationEnabled = false,
  onStopPastScrubberVisualization = () => {},
  onCancelLoading = () => {}
}) => {
  // Handle number input validation
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow any input, including empty values
    const value = e.target.value;
    
    // If empty, just set to empty string temporarily
    if (value === '') {
      onPastScrubberValueChange('' as any);
      return;
    }
    
    // Filter out any non-digit characters (ensures only positive integers)
    const filteredValue = value.replace(/[^0-9]/g, '');
    
    // If the filtered value is different from the input, reject the change
    if (filteredValue !== value) {
      return;
    }
    
    // Try to parse as a number without validation - allow any numeric input
    const numValue = parseInt(value, 10);
    
    // Only update if it's a valid number (not doing validation for positive here)
    if (!isNaN(numValue)) {
      onPastScrubberValueChange(numValue);
    }
  };

  // Handle keydown to prevent entering invalid characters
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent keystrokes for: '.', '+', '-', 'e', 'E' and any other non-numeric except for navigation keys
    const invalidKeys = ['.', '+', '-', 'e', 'E'];
    
    // Allow navigation keys: backspace, delete, arrow keys, home, end, tab
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'];
    
    if (invalidKeys.includes(e.key) || 
        (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key))) {
      e.preventDefault();
    }
    
    // Check if Enter key was pressed and not disabled
    if (e.key === 'Enter' && !disabled && !pastScrubberVisualizationEnabled && !isLoading) {
      handleViewConfirm();
    }
  };

  // Handle time unit change
  const handleTimeUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPastScrubberTimeUnitChange(e.target.value);
  };
  
  // Handle keydown for select element to capture Enter key
  const handleSelectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    // Check if Enter key was pressed and not disabled
    if (e.key === 'Enter' && !disabled && !pastScrubberVisualizationEnabled && !isLoading) {
      handleViewConfirm();
    }
  };

  // Handle view confirmation button click
  const handleViewConfirm = () => {
    // Add validation here - check if the current value is a positive integer
    const numValue = typeof pastScrubberValue === 'string' 
      ? parseInt(pastScrubberValue, 10) 
      : pastScrubberValue;
      
    if (isNaN(numValue) || numValue <= 0) {
      alert("Please enter a positive integer value before viewing data");
      return;
    }
    
    // Only proceed if validation passes
    onViewPastScrubberDistribution();
  };

  return (
    <div className={`control-panel ${isOpen ? 'open' : ''}`}>
      <h3>Map Settings</h3>
      <div className="control-option">
        <input 
          type="checkbox" 
          id="track-scrubber-toggle" 
          checked={trackScrubberVessels} 
          onChange={(e) => {
            onTrackScrubberVesselsToggle(e.target.checked);
            // If turning off tracking, also turn off only showing
            if (!e.target.checked) {
              onShowOnlyScrubberVesselsToggle(false);
            }
          }} 
          disabled={disabled || pastScrubberVisualizationEnabled}
        />
        <label htmlFor="track-scrubber-toggle">
          Track Scrubber Vessels
          <img 
            src={warningYellowScrubberIcon} 
            alt="Scrubber vessel icon" 
            style={{ 
              width: '16px', 
              height: '16px', 
              marginLeft: '6px',
              verticalAlign: 'middle'
            }} 
          />
        </label>
      </div>
      <div className="control-option">
        <input 
          type="checkbox" 
          id="only-scrubber-toggle" 
          checked={showOnlyScrubberVessels} 
          onChange={(e) => {
            // If enabling this option, ensure track scrubbers is also enabled
            if (e.target.checked && !trackScrubberVessels) {
              onTrackScrubberVesselsToggle(true);
            }
            onShowOnlyScrubberVesselsToggle(e.target.checked);
          }} 
          disabled={disabled || pastScrubberVisualizationEnabled}
        />
        <label htmlFor="only-scrubber-toggle">
          Only Show Scrubber Vessels
        </label>
      </div>

      <div className="control-option">
        <input 
          type="checkbox" 
          id="scrubber-heatmap-toggle" 
          checked={scrubberHeatmapEnabled} 
          onChange={(e) => {
            // If enabling this heatmap, disable the size heatmap first
            if (e.target.checked && heatmapEnabled) {
              onHeatmapToggle(false);
            }
            onScrubberHeatmapToggle(e.target.checked);
          }} 
          disabled={disabled || pastScrubberVisualizationEnabled}
        />
        <label htmlFor="scrubber-heatmap-toggle">Scrubber Water Discharge Heatmap</label>
      </div>
      
      {/* Past Scrubber Distribution section - Updated for better responsive design */}
      <div className="control-section">
        <h4>Past Scrubber Distribution</h4>
        <div className="past-scrubber-container">
          <div className="past-scrubber-controls">
            <input
              type="number"
              id="past-scrubber-value"
              min="1"
              value={pastScrubberValue}
              onChange={handleValueChange}
              onKeyDown={handleKeyDown}
              disabled={disabled || pastScrubberVisualizationEnabled || isLoading}
              className="past-scrubber-input"
            />
            <select
              id="past-scrubber-unit"
              value={pastScrubberTimeUnit}
              onChange={handleTimeUnitChange}
              onKeyDown={handleSelectKeyDown}
              disabled={disabled || pastScrubberVisualizationEnabled || isLoading}
              className="past-scrubber-select"
            >
              <option value="Hour">Hour</option>
              <option value="Day">Day</option>
              <option value="Week">Week</option>
              <option value="Month">Month</option>
              <option value="Year">Year</option>
            </select>
          </div>
          {pastScrubberVisualizationEnabled ? (
            <button 
              className="past-scrubber-stop-btn"
              onClick={onStopPastScrubberVisualization}
              disabled={disabled}
            >
              Stop
            </button>
          ) : isLoading ? (
            <button 
              className="past-scrubber-cancel-btn"
              onClick={onCancelLoading}
              disabled={false} // Always enabled when loading
            >
              Cancel
            </button>
          ) : (
            <button 
              className="past-scrubber-view-btn"
              onClick={handleViewConfirm}
              disabled={disabled}
            >
              View
            </button>
          )}
        </div>
      </div>
      
      <div className="tutorial-option">
        <p>Forgot how to use the map? <span className={`tutorial-link ${(disabled || pastScrubberVisualizationEnabled) ? 'disabled' : ''}`} onClick={!disabled && !pastScrubberVisualizationEnabled ? onShowTutorial : undefined}>Click here</span> to watch the tutorial again.</p>
      </div>
    </div>
  );
};

// Back to North Sea button component props
interface BackToNorthSeaButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const BackToNorthSeaButton: React.FC<BackToNorthSeaButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button 
      className="back-to-center-button" 
      onClick={onClick}
      disabled={disabled}
    >
      Back to North Sea
    </button>
  );
};

// Map container styles
const mapContainerStyle = {
  height: '100%',
  width: '100%',
  position: 'relative' as const
};

const mapPageStyle = {
  height: '100%',
  overflow: 'hidden',
  position: 'relative' as const
};

// Search result structure
interface SearchResult {
  type: 'port' | 'vessel';
  id: string;
  name: string;
  details: string;
  color?: string;
  matchPriority: number;
  onClick: () => void;
  isScrubber?: boolean;
  scrubberType?: string;
  iconSrc?: string;
  banStatus?: 'partial' | 'total'; // Add banStatus field
}

// Search Bar component props
interface MapSearchBarProps {
  ports: Port[];
  ships: Ship[];
  onSelectPort: (port: Port) => void;
  onSelectShip: (ship: Ship) => void;
  isDisabled?: boolean;
  searchBarRef?: React.RefObject<{
    addShipToResults?: (ship: Ship) => void;
    addPortToResults?: (port: Port) => void;
    clearResults?: () => void;
    clearSearchResultsOnly?: () => void;
  }>;
  onInputFocus?: () => void;
  isScrubberVessel?: (imoNumber: string) => boolean;
  scrubberVessels?: {[key: string]: {status: string; technology_type: string;}};
}

const MapSearchBar: React.FC<MapSearchBarProps> = ({ 
  ports, 
  ships, 
  onSelectPort, 
  onSelectShip, 
  isDisabled = false,
  searchBarRef,
  onInputFocus,
  isScrubberVessel,
  scrubberVessels
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // Method to directly add a ship to search results when clicking on map
  const addShipToResults = useCallback((ship: Ship) => {
    if (isDisabled) return;
    
    const shipIsScrubber = isScrubberVessel && isScrubberVessel(ship.imo_number);
    const shipScrubberInfo = shipIsScrubber && scrubberVessels && scrubberVessels[ship.imo_number] ? 
                       scrubberVessels[ship.imo_number] : null;
    const shipScrubberType = shipScrubberInfo ? 
                       (shipScrubberInfo.technology_type.toLowerCase() === 'tbc' ? 
                        'scrubber' : 
                        shipScrubberInfo.technology_type.toLowerCase()) : 
                       '';
    
    const shipResult: SearchResult = {
      id: `ship-${ship.imo_number}`,
      type: 'vessel',
      name: ship.name,
      details: ship.type_name || getShipCategory(ship.ship_type),
      color: getShipColor(ship.ship_type),
      isScrubber: shipIsScrubber,
      scrubberType: shipScrubberType,
      matchPriority: 3, // Default priority for directly selected ships
      onClick: () => {
        if (!isDisabled) {
          onSelectShip(ship);
        }
      },
      iconSrc: shipIsScrubber ? warningYellowScrubberIcon : undefined
    };
    
    // Stop any ongoing searches
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    setIsSearching(false);
    
    // Clear search text and results if there's active search text
    if (searchValue.trim().length > 0) {
      // Clear the search input and existing results first
      setSearchValue('');
      setSearchResults([]);
      
      // Small delay to ensure UI updates before showing the new result
      setTimeout(() => {
        setSearchResults([shipResult]);
        setShowResults(true);
      }, 10);
    } else {
      // No active search, just show the ship
      setSearchResults([shipResult]);
      setShowResults(true);
    }
    
    // Explicitly focus away from the search input to prevent search-related UI issues
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [isDisabled, onSelectShip, searchValue, isScrubberVessel, scrubberVessels]);
  
  // Method to directly add a port to search results when clicking on map
  const addPortToResults = useCallback((port: Port) => {
    if (isDisabled) return;
    
    // Determine icon source based on scrubber_status
    let iconSource = portsIcon; // Default icon
    let banStatus: 'partial' | 'total' | undefined = undefined; // Initialize banStatus

    if (port.scrubber_status === 1) {
      iconSource = portsIconPartialBan;
      banStatus = 'partial'; // Set banStatus for partial ban
    } else if (port.scrubber_status === 2) {
      iconSource = portsIconTotalBan;
      banStatus = 'total'; // Set banStatus for total ban
    }
    
    const portResult: SearchResult = {
      id: `port-${port.port_name}-${port.country}`,
      type: 'port',
      name: port.port_name,
      details: port.country,
      matchPriority: 3, // Default priority for directly selected ports
      iconSrc: iconSource,
      banStatus: banStatus, // Add banStatus to the result object
      onClick: () => {
        if (!isDisabled) {
          onSelectPort(port);
        }
      }
    };
    
    // Stop any ongoing searches
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    setIsSearching(false);
    
    // Create ID for this port result
    const portId = `port-${port.port_name}-${port.country}`;
    
    // Set as selected result
    setSelectedResultId(portId);
    
    // Clear search text and results if there's active search text
    if (searchValue.trim().length > 0) {
      // Clear the search input and existing results first
      setSearchValue('');
      setSearchResults([]);
      
      // Small delay to ensure UI updates before showing the new result
      setTimeout(() => {
        setSearchResults([portResult]);
        setShowResults(true);
      }, 10);
    } else {
      // No active search, just show the port
      setSearchResults([portResult]);
      setShowResults(true);
    }
    
    // Explicitly focus away from the search input to prevent search-related UI issues
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [isDisabled, onSelectPort, searchValue]);
  
  // Method to clear all search results
  const clearResults = useCallback(() => {
    // Reset all search-related states
    setSearchResults([]);
    setShowResults(false);
    setIsSearching(false);
    setSearchValue('');
    setIsSearchFocused(false); // Clear search focus state
    setSelectedResultId(null); // Clear selected result state
    
    // Directly hide search results container using DOM manipulation for immediate effect
    const searchResultsElement = document.querySelector('.map-search-results') as HTMLDivElement | null;
    if (searchResultsElement) {
      searchResultsElement.style.display = 'none';
    }
    
    // Remove this automatic focus which causes the issue
    // const searchInput = document.querySelector('.map-search-input') as HTMLInputElement;
    // if (searchInput) {
    //   searchInput.focus();
    // }
  }, []);
  
  // Method to clear only search results but keep search input value
  const clearSearchResultsOnly = useCallback(() => {
    // Clear results but keep search text
    setSearchResults([]);
    setShowResults(false);
    setIsSearching(false);
    setIsSearchFocused(false); // Clear search focus state
    setSelectedResultId(null); // Clear selected result ID
    
    // Directly hide search results container using DOM manipulation for immediate effect
    const searchResultsElement = document.querySelector('.map-search-results') as HTMLDivElement | null;
    if (searchResultsElement) {
      searchResultsElement.style.display = 'none';
    }
  }, []);
  
  // Expose methods via ref to parent component
  useEffect(() => {
    if (searchBarRef?.current) {
      searchBarRef.current.addShipToResults = addShipToResults;
      searchBarRef.current.addPortToResults = addPortToResults;
      searchBarRef.current.clearResults = clearResults;
      searchBarRef.current.clearSearchResultsOnly = clearSearchResultsOnly;
    }
  }, [addShipToResults, addPortToResults, clearResults, clearSearchResultsOnly, searchBarRef]);
  
  // Check screen size for responsive placeholder text
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth <= 480);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // Handle input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDisabled) {
      setSearchValue(e.target.value);
      // Set search focused state when typing
      setIsSearchFocused(true);
    }
  };

  // Handle search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDisabled) {
      console.log('Search submitted:', searchValue);
      setIsSearchFocused(true); // Explicitly set search as focused on submit
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (!isDisabled) {
      // Call the provided onInputFocus handler if available
      if (onInputFocus) {
        onInputFocus();
      }
      
      // Reset selected result state
      setSelectedResultId(null);
      
      // Set search as focused
      setIsSearchFocused(true);
      
      // Show results immediately if text exists
      if (searchValue.trim().length >= 2) {
        if (searchTimeoutRef.current) {
          window.clearTimeout(searchTimeoutRef.current);
        }
        
        setIsSearching(true);
        performSearch(searchValue);
        setShowResults(true);
      } else {
        // For empty or very short search text, clear results
        setSearchResults([]);
        setShowResults(false);
        setIsSearching(false);
      }
    }
  };
  
  // Handle input blur
  const handleInputBlur = () => {
  };
  
  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isClickInSearchArea = target.closest('.map-search-container') || 
                                 target.closest('.map-search-results');
      
      // Check if the click is in the map container
      const isClickInMapArea = target.closest('.map-container') || 
                              target.closest('.mapboxgl-canvas') ||
                              target.classList.contains('mapboxgl-canvas');
                                 
      if (!isClickInSearchArea) {
        // Check if the current search results are from a direct user search or from a map click
        if (searchValue.trim().length > 0) {
          // Search results from direct user search - hide results
          setShowResults(false);
          setIsSearchFocused(false);
        } else {
          // Results likely from a map click (selected ship/port)
          // Only hide when clicking outside of map AND search areas
          if (!isClickInMapArea) {
            setShowResults(false);
          }
          // Always unfocus the search when clicking outside search area
          setIsSearchFocused(false);
        }
        
        // Also stop any ongoing search and search animation
        if (searchTimeoutRef.current) {
          window.clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        setIsSearching(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchValue]);
  
  // Search function to find matching ports and ships
  const performSearch = useCallback((searchText: string) => {
    const normalizedSearch = searchText.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Calculate match priority for better sorting
    const getMatchPriority = (name: string, searchTerm: string): number => {
      const normalizedName = name.toLowerCase();
      if (normalizedName === searchTerm) return 4;         // Exact match
      if (normalizedName.startsWith(searchTerm)) return 3; // Starts with search term
      if (new RegExp(`\\b${searchTerm}\\b`).test(normalizedName)) return 2; // Contains as whole word
      return 1; // Contains substring
    };

    // Search ports
    ports.forEach(port => {
      let matchFound = false;
      let matchPriority = 0;
      
      // Check port name match
      if (port.port_name.toLowerCase().includes(normalizedSearch)) {
        matchFound = true;
        matchPriority = getMatchPriority(port.port_name, normalizedSearch);
      }
      
      // Check country match
      if (port.country.toLowerCase().includes(normalizedSearch)) {
        matchFound = true;
        // Keep higher priority if already matched by name
        if (matchPriority < getMatchPriority(port.country, normalizedSearch)) {
          matchPriority = getMatchPriority(port.country, normalizedSearch);
        }
      }

      if (matchFound) {
        const portId = `port-${port.port_name}-${port.country}`;
        
        // Determine icon source based on scrubber_status
        let iconSource = portsIcon; // Default icon
        let banStatus: 'partial' | 'total' | undefined = undefined; // Initialize banStatus

        if (port.scrubber_status === 1) {
          iconSource = portsIconPartialBan;
          banStatus = 'partial'; // Set banStatus for partial ban
        } else if (port.scrubber_status === 2) {
          iconSource = portsIconTotalBan;
          banStatus = 'total'; // Set banStatus for total ban
        }
        
        results.push({
          type: 'port',
          id: portId,
          name: port.port_name,
          details: port.country,
          matchPriority,
          iconSrc: iconSource,
          banStatus: banStatus, // Add banStatus to the result object
          onClick: () => {
            setSelectedResultId(portId); // Set this result as selected
            onSelectPort(port);
          }
        });
      }
    });

    // Search ships
    ships.forEach(ship => {
      let matchFound = false;
      let matchPriority = 0;
      
      // Check ship name match
      if (ship.name.toLowerCase().includes(normalizedSearch)) {
        matchFound = true;
        matchPriority = getMatchPriority(ship.name, normalizedSearch);
      }
      
      // Check IMO number match
      if (ship.imo_number && String(ship.imo_number).toLowerCase().includes(normalizedSearch)) {
        matchFound = true;
        const imoMatchPriority = getMatchPriority(String(ship.imo_number), normalizedSearch);
        if (matchPriority < imoMatchPriority) {
          matchPriority = imoMatchPriority;
        }
      }
      
      // Check ship type match
      if (ship.type_name && ship.type_name.toLowerCase().includes(normalizedSearch)) {
        matchFound = true;
        const typeMatchPriority = getMatchPriority(ship.type_name, normalizedSearch);
        if (matchPriority < typeMatchPriority) {
          matchPriority = typeMatchPriority;
        }
      }

      if (matchFound) {
        const shipId = `vessel-${ship.imo_number}`;
        
        // Check if ship is a scrubber vessel
        const shipIsScrubber = isScrubberVessel && isScrubberVessel(ship.imo_number);
        const shipScrubberInfo = shipIsScrubber && scrubberVessels && scrubberVessels[ship.imo_number] ? 
                           scrubberVessels[ship.imo_number] : null;
        const shipScrubberType = shipScrubberInfo ? 
                           (shipScrubberInfo.technology_type.toLowerCase() === 'tbc' ? 
                            'scrubber' : 
                            shipScrubberInfo.technology_type.toLowerCase()) : 
                           '';
        
        results.push({
          type: 'vessel',
          id: shipId,
          name: ship.name,
          details: `${ship.type_name || 'Unknown type'}, IMO: ${ship.imo_number || 'Unknown'}`,
          color: getShipColor(ship.ship_type),
          matchPriority,
          isScrubber: shipIsScrubber,
          scrubberType: shipScrubberType,
          onClick: () => {
            setSelectedResultId(shipId); // Set this result as selected
            onSelectShip(ship);
          },
          iconSrc: shipIsScrubber ? warningYellowScrubberIcon : undefined
        });
      }
    });

    // Sort results by relevance
    results.sort((a, b) => {
      // 0. Currently selected item first
      if (selectedResultId !== null) {
        if (a.id === selectedResultId) return -1;
        if (b.id === selectedResultId) return 1;
      }
      
      // 1. Type: ports first, then vessels
      if (a.type !== b.type) {
        return a.type === 'port' ? -1 : 1;
      }
      
      // 2. Match priority: higher priority first
      if (a.matchPriority !== b.matchPriority) {
        return b.matchPriority - a.matchPriority;
      }
      
      // 3. Name (alphabetical)
      return a.name.localeCompare(b.name);
    });

    // Store total count before limiting results
    const totalResults = results.length;
    
    // Limit to maximum 10 results
    const limitedResults = results.slice(0, 10);

    // Update search results and show them
    setSearchResults(limitedResults);
    setShowResults(limitedResults.length > 0);
    
    // Add metadata for display
    (limitedResults as any).hasMoreResults = totalResults > 10;
    (limitedResults as any).totalResults = totalResults;
    
    setIsSearching(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ports, ships, onSelectPort, onSelectShip, isScrubberVessel, scrubberVessels]);

  // Debounced search implementation
  useEffect(() => {
    // Only proceed with search if search is focused
    if (!isSearchFocused) {
      return;
    }
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    // Only search with 2+ characters
    if (searchValue.length < 2) {
      // Don't clear results immediately if searchValue is empty
      // This allows ships added via map clicks to remain visible
      if (searchValue.length === 0) {
        // Just clear the loading state
        setIsSearching(false);
      } else {
        // For searchValue length 1, clear results since it's not enough for search
        setSearchResults([]);
        setShowResults(false);
        setIsSearching(false);
      }
      return;
    }

    // Show loading indicator
    setIsSearching(true);

    // Create debounce timer
    searchTimeoutRef.current = window.setTimeout(() => {
      performSearch(searchValue);
    }, 300); // 300ms debounce

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue, isSearchFocused, ports, ships, onSelectPort, onSelectShip, performSearch, selectedResultId]);

  // Handle search clear button click
  const handleClearSearch = (e: React.MouseEvent) => {
    // Stop event propagation to prevent any parent handlers from firing
    e.stopPropagation();

    if (!isDisabled) {
      // Use the clearResults method to ensure consistent behavior
      clearResults();
      
      // Also call the parent's onInputFocus to clear any paths
      if (onInputFocus) {
        onInputFocus();
      }
    }
  };

  return (
    <>
      <div className={`map-search-container ${isDisabled ? 'disabled' : ''}`} ref={searchContainerRef}>
        <form onSubmit={handleSearchSubmit}>
          <div className="map-search-bar">
            <div className="map-search-icon">
              {isSearching ? (
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ 
                    display: 'block', 
                    margin: 0, 
                    padding: 0,
                    animation: 'spin 1.5s linear infinite',
                    transformOrigin: 'center center'
                  }}
                >
                  <path 
                    d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" 
                    stroke="#9AA0A6" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 18 18" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: 'block', margin: 0, padding: 0 }}
                >
                  <path 
                    fillRule="evenodd" 
                    clipRule="evenodd" 
                    d="M11.76 10.27L17.49 16L16 17.49L10.27 11.76C9.2 12.53 7.91 13 6.5 13C2.91 13 0 10.09 0 6.5C0 2.91 2.91 0 6.5 0C10.09 0 13 2.91 13 6.5C13 7.91 12.53 9.2 11.76 10.27ZM6.5 2C4.01 2 2 4.01 2 6.5C2 8.99 4.01 11 6.5 11C8.99 11 11 8.99 11 6.5C11 4.01 8.99 2 6.5 2Z" 
                    fill="#9AA0A6"
                  />
                </svg>
              )}
            </div>
            <input
              type="text"
              className="map-search-input"
              placeholder={isSmallScreen ? "Enter name to search" : "Enter name to search"}
              value={searchValue}
              onChange={handleSearchChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={isDisabled} // Disable input when isDisabled is true
              style={isDisabled ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
            />
            {searchValue && (
              <div 
                className="map-search-clear" 
                onClick={!isDisabled ? (e) => handleClearSearch(e) : undefined}
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: 'block', margin: 0, padding: 0 }}
                >
                  <path 
                    d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" 
                    fill="#9AA0A6"
                  />
                </svg>
              </div>
            )}
          </div>
        </form>
      </div>
      
      {/* Show results when showResults is true, regardless of search focus state */}
      {showResults && !isDisabled && (
        <div className="map-search-results">
          {searchResults.length > 0 ? (
            <>
              {searchResults.map(result => (
                <div 
                  key={result.id} 
                  className={`search-result-item ${result.type}`}
                  onClick={(e) => {
                    // Immediately highlight this item for better visual feedback
                    setSelectedResultId(result.id);
                    
                    // Apply highlight immediately via DOM for responsive feedback
                    const allResults = document.querySelectorAll('.search-result-item');
                    allResults.forEach(item => {
                      if (item instanceof HTMLElement) {
                        item.style.backgroundColor = '';
                      }
                    });
                    
                    const currentTarget = e.currentTarget;
                    if (currentTarget instanceof HTMLElement) {
                      currentTarget.style.backgroundColor = 'rgba(173, 216, 230, 0.7)';
                    }
                    
                    // Then call the original onClick handler
                    result.onClick();
                  }}
                  style={{
                    backgroundColor: result.id === selectedResultId ? 'rgba(173, 216, 230, 0.5)' : undefined,
                    transition: 'background-color 0.1s ease'
                  }}
                >
                  {result.type === 'vessel' && (
                    <div className="search-result-background" style={{ backgroundColor: result.color }}></div>
                  )}
                  <div className="search-result-icon">
                    <img 
                      src={result.type === 'port' ? (result.iconSrc || portsIcon) : shipIcon} 
                      alt={result.type} 
                    />
                  </div>
                  <div className="search-result-content">
                    <div className="search-result-info">
                      <div className="search-result-name">{result.name}</div>
                      <div className="search-result-details">{result.details}</div>
                    </div>
                    <div className="search-result-tags">
                      <div className="search-result-tag">
                        {result.type === 'port' ? 'ports' : 'vessels'}
                      </div>
                      {/* Conditionally render ban tag for ports */}
                      {result.type === 'port' && result.banStatus === 'partial' && (
                        <div className="search-result-tag search-result-ban-tag-partial">
                          ban
                        </div>
                      )}
                      {result.type === 'port' && result.banStatus === 'total' && (
                        <div className="search-result-tag search-result-ban-tag-total">
                          ban
                        </div>
                      )}
                      {result.type === 'vessel' && result.isScrubber && (
                        <>
                          {result.scrubberType && (
                            <div className="search-result-scrubber-type">
                              {result.scrubberType.toLowerCase() === 'tbc' ? 'scrubber' : result.scrubberType}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(searchResults as any).hasMoreResults && (
                <div className="search-max-results">
                  Showing 10 of {(searchResults as any).totalResults} results. Refine your search for more specific results.
                </div>
              )}
            </>
          ) : (
            searchValue.length >= 2 ? (
              <div className="search-no-results">
                No matches found for "{searchValue}"
              </div>
            ) : null
          )}
        </div>
      )}
    </>
  );
};

// Block coefficients for displacement calculation
const CARGO_BLOCK_COEF = 0.625;
const TANKER_BLOCK_COEF = 0.825;

// Navigation status to operation mode mapping for emission calculation
const NAV_STATUS_TO_MODE: {[key: number]: string} = {
  0: 'Cruise',  // Under way using engine
  1: 'Anchor',  // At anchor
  2: 'Anchor',  // Not under command
  3: 'Maneuver',  // Restricted manoeuverability
  4: 'Maneuver',  // Constrained by her draught
  5: 'Berth',  // Moored
  6: 'Berth',  // Aground
  7: 'Cruise',  // Engaged in Fishing
  8: 'Cruise',  // Under way sailing
  9: 'Cruise',  // Reserved (default to Cruise)
  10: 'Cruise',  // Reserved (default to Cruise)
  11: 'Cruise',  // Reserved (default to Cruise)
  12: 'Cruise',  // Reserved (default to Cruise)
  13: 'Cruise',  // Reserved (default to Cruise)
  14: 'Cruise',  // Reserved (default to Cruise)
  15: 'Cruise',  // Not defined (default to Cruise)
};

// State variable to store navigational status mappings from ais_database
let navigationStatusMappings: {[key: number]: string} = {};

/**
 * Fetch navigational status mappings from ais_database.navigational_status table
 * @returns Promise that resolves when mappings are loaded
 */
const fetchNavigationalStatusMappings = async (): Promise<void> => {
  try {
    const response = await fetch(API_ENDPOINTS.NAVIGATIONAL_STATUS);
    if (response.ok) {
      const data = await response.json();
      // Convert array of {navigational_status_code, navigational_status} to lookup object
      navigationStatusMappings = data.reduce((acc: {[key: number]: string}, item: any) => {
        acc[item.navigational_status_code] = item.navigational_status;
        return acc;
      }, {});
      console.log('Navigational status mappings loaded:', Object.keys(navigationStatusMappings).length, 'entries');
    } else {
      console.warn('Failed to fetch navigational status mappings, using fallback');
    }
  } catch (error) {
    console.warn('Error fetching navigational status mappings:', error);
  }
};

/**
 * Get navigational status text from code using the loaded mappings
 * @param statusCode - The navigational status code
 * @returns The corresponding navigational status text or 'Unknown'
 */
const getNavigationalStatusText = (statusCode: number | null): string => {
  if (statusCode === null || statusCode === undefined) {
    return 'Unknown';
  }
  
  // First try to use the loaded mappings from ais_database
  if (Object.keys(navigationStatusMappings).length > 0 && navigationStatusMappings[statusCode]) {
    return navigationStatusMappings[statusCode];
  }
  
  // Fallback to basic descriptions based on NAV_STATUS_TO_MODE for common codes
  const statusDescriptions: {[key: number]: string} = {
    0: 'Under way using engine',
    1: 'At anchor',
    2: 'Not under command',
    3: 'Restricted manoeuverability',
    4: 'Constrained by her draught',
    5: 'Moored',
    6: 'Aground',
    7: 'Engaged in fishing',
    8: 'Under way sailing',
    9: 'Reserved for future amendment',
    10: 'Reserved for future amendment',
    11: 'Reserved for future use',
    12: 'Reserved for future use',
    13: 'Reserved for future use',
    14: 'AIS-SART (Search and Rescue Transmitter)',
    15: 'Not defined (default)'
  };
  
  return statusDescriptions[statusCode] || 'Unknown';
};

// Cargo AE power by DWT category and operation mode (kW)
const CARGO_EMISSION_SPECS: {[key: number]: {[key: string]: number}} = {
  1: { 'Berth': 90, 'Anchor': 50, 'Maneuver': 180, 'Cruise': 60 },
  2: { 'Berth': 240, 'Anchor': 130, 'Maneuver': 490, 'Cruise': 180 },
  3: { 'Berth': 720, 'Anchor': 370, 'Maneuver': 1450, 'Cruise': 520 },
  4: { 'Berth': 720, 'Anchor': 370, 'Maneuver': 1450, 'Cruise': 520 }
};

// Tanker AE power by DWT category and operation mode (kW)
const TANKER_EMISSION_SPECS: {[key: number]: {[key: string]: number}} = {
  1: { 'Berth': 250, 'Anchor': 250, 'Maneuver': 375, 'Cruise': 250 },
  2: { 'Berth': 375, 'Anchor': 375, 'Maneuver': 560, 'Cruise': 375 },
  3: { 'Berth': 690, 'Anchor': 500, 'Maneuver': 580, 'Cruise': 490 },
  4: { 'Berth': 720, 'Anchor': 520, 'Maneuver': 600, 'Cruise': 510 },
  5: { 'Berth': 620, 'Anchor': 490, 'Maneuver': 770, 'Cruise': 560 },
  6: { 'Berth': 800, 'Anchor': 640, 'Maneuver': 910, 'Cruise': 690 },
  7: { 'Berth': 2500, 'Anchor': 770, 'Maneuver': 1300, 'Cruise': 860 },
  8: { 'Berth': 2500, 'Anchor': 770, 'Maneuver': 1300, 'Cruise': 860 }
};

// Cargo BO (Boiler) power by DWT category and operation mode (kW)
const CARGO_BO_SPECS: {[key: number]: {[key: string]: number}} = {
  1: { 'Berth': 0, 'Anchor': 0, 'Maneuver': 0, 'Cruise': 0 },
  2: { 'Berth': 110, 'Anchor': 110, 'Maneuver': 100, 'Cruise': 0 },
  3: { 'Berth': 150, 'Anchor': 150, 'Maneuver': 130, 'Cruise': 0 },
  4: { 'Berth': 150, 'Anchor': 150, 'Maneuver': 130, 'Cruise': 0 }
};

// Tanker BO (Boiler) power by DWT category and operation mode (kW)
const TANKER_BO_SPECS: {[key: number]: {[key: string]: number}} = {
  1: { 'Berth': 500, 'Anchor': 100, 'Maneuver': 100, 'Cruise': 0 },
  2: { 'Berth': 750, 'Anchor': 150, 'Maneuver': 150, 'Cruise': 0 },
  3: { 'Berth': 1250, 'Anchor': 250, 'Maneuver': 250, 'Cruise': 0 },
  4: { 'Berth': 2700, 'Anchor': 270, 'Maneuver': 270, 'Cruise': 270 },
  5: { 'Berth': 3250, 'Anchor': 360, 'Maneuver': 360, 'Cruise': 280 },
  6: { 'Berth': 4000, 'Anchor': 400, 'Maneuver': 400, 'Cruise': 280 },
  7: { 'Berth': 6500, 'Anchor': 500, 'Maneuver': 500, 'Cruise': 300 },
  8: { 'Berth': 7000, 'Anchor': 600, 'Maneuver': 600, 'Cruise': 300 }
};

// Default AE power value for unknown ship types/categories (kW)
const DEFAULT_EMISSION_VALUE = 500;
// Default BO power value for unknown ship types/categories (kW)
const DEFAULT_BO_VALUE = 0;

/**
 * Calculate theoretical scrubber water discharge rate based on ship data and scrubber type
 * @param ship - Ship object with ship dimensions and operation mode
 * @param scrubberType - Type of scrubber technology
 * @returns Discharge rate in kilograms per hour (kg/h)
 */
const calculateScrubberDischargeRate = (ship: Ship, scrubberType: string): number => {
  // Default discharge rate if calculation fails
  const defaultDischargeRate = 45;
  
  // Get operation mode based on navigational status for backend data lookup
  const navStatusCode = ship.latest_position.navigational_status_code;
  const operationMode = navStatusCode !== null ? NAV_STATUS_TO_MODE[navStatusCode] || 'Cruise' : 'Cruise';
  
  // Store operation mode for display
  ship.operationMode = operationMode;
  
  // Always calculate debugging fields regardless of whether we use backend or frontend rate
  let calculatedDischargeRate = defaultDischargeRate;
  
  // Check if we have the required ship dimensions for calculation
  if (ship.length && ship.width && ship.max_draught) {
    try {
      // Step 1: Calculate ship displacement volume
      const blockCoef = ship.type_name === 'Tanker' ? TANKER_BLOCK_COEF : CARGO_BLOCK_COEF;
      const displacementVolume = ship.length * ship.width * ship.max_draught * blockCoef;
      
      // Step 2: Calculate displacement weight (tonnage)
      const seawaterDensity = 1.025; // t/m³
      const displacementWeight = displacementVolume * seawaterDensity;
      
      // Step 3: Calculate DWT (Deadweight Tonnage)
      const lightweightFactor = ship.type_name === 'Tanker' ? 0.16 : 0.32;
      const dwt = displacementWeight - (displacementWeight * lightweightFactor);
      
      // Step 4: Determine DWT category
      let dwtCategory = 1;
      const aeSpecs = ship.type_name === 'Tanker' ? TANKER_EMISSION_SPECS : CARGO_EMISSION_SPECS;
      const boSpecs = ship.type_name === 'Tanker' ? TANKER_BO_SPECS : CARGO_BO_SPECS;
      
      // Use DWT category mapping based on ranges from notebook
      if (ship.type_name === 'Cargo') {
        // Cargo capacity ranges from notebook
        if (dwt <= 4999) dwtCategory = 1;
        else if (dwt <= 9999) dwtCategory = 2;
        else if (dwt <= 19999) dwtCategory = 3;
        else dwtCategory = 4; // 20000+
      } else if (ship.type_name === 'Tanker') {
        // Tanker capacity ranges from notebook
        if (dwt <= 4999) dwtCategory = 1;
        else if (dwt <= 9999) dwtCategory = 2;
        else if (dwt <= 19999) dwtCategory = 3;
        else if (dwt <= 59999) dwtCategory = 4;
        else if (dwt <= 79999) dwtCategory = 5;
        else if (dwt <= 119999) dwtCategory = 6;
        else if (dwt <= 199999) dwtCategory = 7;
        else dwtCategory = 8; // 200000+
      }
      
      // Step 5: Get AE and BO power based on DWT category and operation mode
      const aePower = aeSpecs[dwtCategory]?.[operationMode] || DEFAULT_EMISSION_VALUE;
      const boPower = boSpecs[dwtCategory]?.[operationMode] || DEFAULT_BO_VALUE;
      const totalPower = aePower + boPower;
      
      // Step 6: Calculate scrubber discharge rate using updated formula
      // Discharge rate (kg/h) = (AE + BO) (kW) × multiplier (kg/kWh)
      let dischargeMultiplier = 0;
      
      if (scrubberType.toLowerCase().includes('open') || scrubberType.toLowerCase().includes('hybrid')) {
        dischargeMultiplier = 45; // Updated discharge rate for Open Loop and Hybrid
      } else if (scrubberType.toLowerCase().includes('closed')) {
        dischargeMultiplier = 0.1; // Updated discharge rate for Closed Loop
      } else {
        dischargeMultiplier = 45; // Default to Open Loop behavior for unknown types
      }
      
      // Calculate discharge rate using updated formula: Discharge rate (kg/h) = (AE + BO) (kW) × multiplier (kg/kWh)
      calculatedDischargeRate = totalPower * dischargeMultiplier;
      
      // Save all calculation values to ship object for debugging/display
      ship.blockCoef = blockCoef;
      ship.displacementVolume = Math.round(displacementVolume * 10) / 10; // m³
      ship.displacementWeight = Math.round(displacementWeight * 10) / 10; // t
      ship.lightweightFactor = lightweightFactor;
      ship.dwt = Math.round(dwt * 10) / 10; // t
      ship.dwtCategory = dwtCategory;
      ship.baseEmissionRate = aePower; // kW (AE power)
      ship.boilerPower = boPower; // kW (BO power)
      ship.totalPower = totalPower; // kW (AE + BO power)
      ship.dischargeMultiplier = dischargeMultiplier;
      
    } catch (error) {
      console.error('Error calculating debugging fields:', error);
    }
  }
  
  // Now check if we should use pre-calculated discharge rates from backend
  const backendRates = {
    'Berth': ship.emission_berth,
    'Anchor': ship.emission_anchor,
    'Maneuver': ship.emission_maneuver,
    'Cruise': ship.emission_cruise
  };
  
  const backendRate = backendRates[operationMode as keyof typeof backendRates];
  
  if (backendRate !== null && backendRate !== undefined && backendRate > 0) {
    // Use pre-calculated rate from backend
    console.log(`Using backend discharge rate for ${ship.imo_number} (${operationMode}): ${backendRate} kg/h`);
    return Number(backendRate);
  } else {
    // Use frontend calculated rate
    console.log(`Using frontend calculated discharge rate for ${ship.imo_number} (${operationMode}): ${calculatedDischargeRate} kg/h`);
    return Math.round(calculatedDischargeRate * 10) / 10; // Round to 1 decimal place
  }
};

// Utility function to calculate distance between two geographical points (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

const MapPage = () => {
  // Map references and basic state
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  
  // Data state
  const [ports, setPorts] = useState<Port[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [portsLoaded, setPortsLoaded] = useState(false);
  const [shipsLoaded, setShipsLoaded] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Scrubber vessels state
  const [trackScrubberVessels, setTrackScrubberVessels] = useState(true);
  const [scrubberVessels, setScrubberVessels] = useState<{[key: string]: {status: string; technology_type: string;}}>({}); 
  const [scrubberVesselsLoaded, setScrubberVesselsLoaded] = useState(false);
  const [loadingScrubberVessels, setLoadingScrubberVessels] = useState(false);
  const [engineDataAvailability, setEngineDataAvailability] = useState<{[key: string]: boolean}>({});
  
  // Map interaction state
  const [isMapAnimating, setIsMapAnimating] = useState(false);
  const currentShipPathRef = useRef<string | null>(null);
  const [highlightedPortId, setHighlightedPortId] = useState<string | null>(null);
  const [highlightedShipId, setHighlightedShipId] = useState<string | null>(null);
  
  // UI state
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState<'port' | 'ship'>('port');
  const [portContent, setPortContent] = useState<PortContent | null>(null);
  const [portContentLoading, setPortContentLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showSearchBar, setShowSearchBar] = useState(true);
  const searchBarRef = useRef<{
    addShipToResults?: (ship: Ship) => void;
    addPortToResults?: (port: Port) => void;
    clearResults?: () => void;
    clearSearchResultsOnly?: () => void;
  }>({});
  
  // URL parameter state
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tutorialParam = searchParams.get('tutorial');
  
  // Tutorial state
  const [showPopup, setShowPopup] = useState(false);
  
  // Mobile device ship info button state (used in event handlers)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showShipInfoButton, setShowShipInfoButton] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shipForInfoButton, setShipForInfoButton] = useState<Ship | null>(null);
  
  // Control panel state
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [scrubberHeatmapEnabled, setScrubberHeatmapEnabled] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [showOnlyScrubberVessels, setShowOnlyScrubberVessels] = useState(false);
  
  // Past Scrubber Distribution state
  const [pastScrubberValue, setPastScrubberValue] = useState<number>(1);
  const [pastScrubberTimeUnit, setPastScrubberTimeUnit] = useState<string>("Hour");
  const [pastScrubberData, setPastScrubberData] = useState<any[]>([]);
  const [pastScrubberVisualizationEnabled, setPastScrubberVisualizationEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Message system state
  const [message, setMessage] = useState<Message | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);
  
  // 添加新的状态变量来存储查询参数
  const [pastScrubberQueryParams, setPastScrubberQueryParams] = useState<any>(null);
  
  // Navigational status mappings state
  const [navigationStatusMappingsLoaded, setNavigationStatusMappingsLoaded] = useState(false);
  
  // Function to add a message to the UI
  const addMessage = useCallback((newMessage: Message) => {
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    
    // Set the new message
    setMessage(newMessage);
    
    // Set a timeout to clear the message
    const timeout = newMessage.timeout || 3000; // Default to 3 seconds
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimeoutRef.current = null;
    }, timeout);
  }, []);

  // Display message to user
  const showMessage = useCallback((text: string, type: MessageType, timeout: number = 3000) => {
    // Skip path-related messages on mobile
    if (isMobileDevice() && (
      text.includes('path') || 
      text.includes('Path') || 
      text.includes('route') || 
      text.includes('Route') ||
      text.includes('ship')
    )) {
      return;
    }
    
    // Clear previous timer and message - always clear any existing message first
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    
    // Clear any existing message before setting new one
    setMessage(null);
    
    // Small delay to ensure previous message is cleared before showing new one
    setTimeout(() => {
      // Set new message
      setMessage({ text, type, timeout });
      
      // Set auto-clear timer
      if (timeout > 0) {
        messageTimeoutRef.current = window.setTimeout(() => {
          setMessage(null);
          messageTimeoutRef.current = null;
        }, timeout);
      }
    }, 10);
  }, []);

  // Clear active message
  const clearMessage = useCallback(() => {
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    setMessage(null);
  }, []);

  // Cleanup message timeout on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  // Handle tutorial display based on URL parameters and localStorage
  useEffect(() => {
    // Always show tutorial if URL parameter is set
    if (tutorialParam === 'true') {
      setShowPopup(true);
      return;
    }
    
    // Check localStorage for tutorial history
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    const lastSeenTimestamp = localStorage.getItem('tutorialLastSeen');
    
    const currentTime = new Date().getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Show tutorial if user hasn't seen it or it's been more than 24 hours
    if (!hasSeenTutorial || 
        (lastSeenTimestamp && currentTime - parseInt(lastSeenTimestamp) > twentyFourHours)) {
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  }, [tutorialParam]);
  
  // Handle tutorial close and update localStorage
  const handleTutorialClose = useCallback(() => {
    setShowPopup(false);
    
    // Update localStorage
    localStorage.setItem('hasSeenTutorial', 'true');
    localStorage.setItem('tutorialLastSeen', new Date().getTime().toString());
  }, []);
  
  // Function to manually show tutorial
  const showTutorial = useCallback(() => {
    // Close the settings panel and legend panel if they are open
    if (controlPanelOpen) {
      setControlPanelOpen(false);
    }
    if (legendOpen) {
      setLegendOpen(false);
    }
    // Close the sidebar if it's open
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
    // Clear the search input and results
    if (searchBarRef.current && searchBarRef.current.clearResults) {
      searchBarRef.current.clearResults();
    }
    // Show the tutorial popup
    setShowPopup(true);
  }, [controlPanelOpen, legendOpen, sidebarOpen, searchBarRef]);

  // Remove ship path from map
  const removeShipPath = useCallback((imoNumber: string) => {
    if (!map.current) {
      return;
    }

    try {
      const pathLayerId = `ship-path-${imoNumber}`;
      const unreliablePathLayerId = `ship-path-unreliable-${imoNumber}`;
      const trailLayerId = `scrubber-trail-${imoNumber}`;
      const trailPointsLayerId = `scrubber-trail-points-${imoNumber}`;
      const unreliableTrailLayerId = `scrubber-trail-unreliable-${imoNumber}`;
      
      // Remove both traditional path layers and scrubber trail layers
      const layersToRemove = [pathLayerId, unreliablePathLayerId, trailLayerId, trailPointsLayerId, unreliableTrailLayerId];
      layersToRemove.forEach(layerId => {
        // Check if layer exists, if exists then remove
        if (map.current && map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        
        // Check if data source exists, if exists then remove
        if (map.current && map.current.getSource(layerId)) {
          map.current.removeSource(layerId);
        }
      });

      // If current displayed path is removed path, clear reference
      if (currentShipPathRef.current === imoNumber) {
        currentShipPathRef.current = null;
      }

      console.log(`Removed path/trail for ship IMO ${imoNumber}`);
    } catch (error) {
      console.error('Error removing ship path/trail from map:', error);
    }
  }, []);
  
  // Toggle legend visibility (updated version)
  const toggleLegend = useCallback(() => {
    // Clear search results
    if (searchBarRef.current && searchBarRef.current.clearResults) {
      searchBarRef.current.clearResults();
    }
    
    // Clear any ship path and message
    if (currentShipPathRef.current) {
      removeShipPath(currentShipPathRef.current);
      clearMessage();
    }
    
    // If opening the legend, ensure control panel is closed
    if (!legendOpen) {
      setControlPanelOpen(false);
    }
    
    setLegendOpen(prev => !prev);
  }, [searchBarRef, currentShipPathRef, removeShipPath, clearMessage, legendOpen, setControlPanelOpen]);

  // Fetch ports data from API
  useEffect(() => {
    const fetchPorts = async () => {
      try {
        console.log('Fetching ports data...');
        setPortsLoaded(false);
        const response = await fetch(API_ENDPOINTS.PORTS);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Ports data received:', data);
        setPorts(data);
        setPortsLoaded(true);
      } catch (error) {
        console.error('Error fetching ports:', error);
        setMapError(`Failed to load ports data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setPortsLoaded(false);
      }
    };

    fetchPorts();
  }, []);

  // Fetch navigational status mappings from ais_database on component mount
  useEffect(() => {
    const loadNavigationalStatusMappings = async () => {
      await fetchNavigationalStatusMappings();
      setNavigationStatusMappingsLoaded(true);
    };

    loadNavigationalStatusMappings();
  }, []);

  // Fetch active ships data from API
  useEffect(() => {
    const fetchShips = async () => {
      try {
        console.log('Fetching active ships data...');
        setShipsLoaded(false);
        const response = await fetch(API_ENDPOINTS.ACTIVE_SHIPS);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Ships data received:', data.length);
        setShips(data);
        setShipsLoaded(true);
      } catch (error) {
        console.error('Error fetching ships:', error);
        setMapError(`Failed to load ships data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setShipsLoaded(false);
      }
    };

    fetchShips();
    
    // Set up interval to refresh ship data every 5 minutes
    const intervalId = setInterval(fetchShips, 5 * 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Update data loading status and track initial load completion
  useEffect(() => {
    if (mapLoaded && portsLoaded && shipsLoaded && navigationStatusMappingsLoaded) {
      setDataLoading(false);
      
      // Set a timer to allow the ships and ports to render before enabling interaction
      const timer = setTimeout(() => {
        // Only set initialLoadComplete to true if it's currently false
        // This prevents triggering useEffects again unnecessarily
        if (!initialLoadComplete) {
          setInitialLoadComplete(true);
          console.log('Initial map load complete, enabling user interaction');
        }
        
        // Add a timer to silently select and deselect random ships after map is fully loaded
        // Only do this the first time map loads completely
        if (!initialLoadComplete && ships.length > 0 && map.current && !isMapAnimating) {
          setTimeout(() => {
            // Only proceed if ships data and map are ready
            if (ships.length > 0 && map.current && !dataLoading && !isMapAnimating) {
              // Step 1: Select first random ship
              const randomIndex1 = Math.floor(Math.random() * ships.length);
              const randomShip1 = ships[randomIndex1];
              
              // Silently set the selected ship (without triggering animations or UI changes)
              setHighlightedShipId(randomShip1.imo_number);
              
              // Step 2: After 100ms, show the sidebar but make it invisible
              setTimeout(() => {
                // Set selected ship to trigger sidebar, but make it invisible
                setSelectedShip(randomShip1);
                setSidebarType('ship');
                
                // Make sidebar invisible but still functional
                const sidebarElement = document.querySelector('.sidebar');
                if (sidebarElement instanceof HTMLElement) {
                  sidebarElement.style.opacity = '0';
                  sidebarElement.style.pointerEvents = 'none';
                }
                setSidebarOpen(true);
                
                // Step 3: After 100ms, select another random ship
                setTimeout(() => {
                  // Find a different random ship
                  let randomIndex2;
                  let randomShip2;
                  do {
                    randomIndex2 = Math.floor(Math.random() * ships.length);
                    randomShip2 = ships[randomIndex2];
                  } while (randomShip2.imo_number === randomShip1.imo_number && ships.length > 1);
                  
                  // Set the second random ship as highlighted
                  setHighlightedShipId(randomShip2.imo_number);
                  
                  // Step 4: After 100ms, clear selection (simulate click on empty area)
                  setTimeout(() => {
                    // Clear ship selection
                    setHighlightedShipId(null);
                    
                    // Close invisible sidebar
                    setSidebarOpen(false);
                    
                    // Reset sidebar styles when closed
                    setTimeout(() => {
                      const sidebarElement = document.querySelector('.sidebar');
                      if (sidebarElement instanceof HTMLElement) {
                        sidebarElement.style.opacity = '';
                        sidebarElement.style.pointerEvents = '';
                      }
                    }, 300); // After sidebar close animation
                    
                    // Update ship data to reflect the change
                    if (map.current && map.current.getSource('ships-circle')) {
                      (map.current.getSource('ships-circle') as mapboxgl.GeoJSONSource).setData({
                        type: 'FeatureCollection',
                        features: ships.map(ship => ({
                          type: 'Feature',
                          geometry: {
                            type: 'Point',
                            coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
                          },
                          properties: {
                            imo_number: ship.imo_number,
                            name: ship.name,
                            ship_type: ship.ship_type,
                            color: getShipColor(ship.ship_type),
                            borderColor: getShipBorderColor(ship.ship_type),
                            category: getShipCategory(ship.ship_type),
                            isHighlighted: false,
                            // Important: Always keep isScrubber property when trackScrubberVessels is true
                            // This ensures scrubber icons remain visible after map clicks
                            isScrubber: trackScrubberVessels && scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
                            scrubberType: trackScrubberVessels && scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
                              (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
                              scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
                          }
                        }))
                      });
                    }
                    
                    // Also update detailed ship shapes if source exists
                    if (map.current && map.current.getSource('ships-detailed')) {
                      // Create updated ship shape features
                      const updatedShipShapeFeatures = ships.map(ship => {
                        const { longitude, latitude } = ship.latest_position;
                        const length = ship.length || 50; // Default length, if no data
                        const width = ship.width || 10;   // Default width, if no data
                        
                        // Create rectangular coordinates (centered on ship location)
                        const sizeFactor = 1; // No highlighting
                        const lengthInDegrees = (length * sizeFactor) / 111000; // Rough conversion from meters to degrees
                        const widthInDegrees = (width * sizeFactor) / 111000;   // Rough conversion from meters to degrees
                        
                        // Create rectangle's four corners
                        const rectangle = [
                          [longitude - lengthInDegrees/2, latitude - widthInDegrees/2],
                          [longitude + lengthInDegrees/2, latitude - widthInDegrees/2],
                          [longitude + lengthInDegrees/2, latitude + widthInDegrees/2],
                          [longitude - lengthInDegrees/2, latitude + widthInDegrees/2],
                          [longitude - lengthInDegrees/2, latitude - widthInDegrees/2] // Closed polygon
                        ];
                        
                        return {
                          type: 'Feature' as const,
                          geometry: {
                            type: 'Polygon' as const,
                            coordinates: [rectangle]
                          },
                          properties: {
                            imo_number: ship.imo_number,
                            name: ship.name,
                            ship_type: ship.ship_type,
                            color: getShipColor(ship.ship_type),
                            borderColor: getShipBorderColor(ship.ship_type),
                            category: getShipCategory(ship.ship_type),
                            isHighlighted: false,
                            // Important: Always keep isScrubber property when trackScrubberVessels is true
                            // This ensures scrubber icons remain visible after map clicks
                            isScrubber: trackScrubberVessels && scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
                            scrubberType: trackScrubberVessels && scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
                              (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
                              scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
                          }
                        };
                      });
                      
                      // Update the source data
                      (map.current.getSource('ships-detailed') as mapboxgl.GeoJSONSource).setData({
                        type: 'FeatureCollection',
                        features: updatedShipShapeFeatures
                      });
                    }
                  }, 100); // Wait 100ms to clear selection
                }, 100); // Wait 100ms to select the second ship
              }, 100); // Wait 100ms to show invisible sidebar
            }
          }, 100); // Wait 100ms after initial load to perform the first random ship selection
        }
      }, 500); // 500ms delay after data is loaded
      
      return () => clearTimeout(timer);
    } else {
      setDataLoading(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, portsLoaded, shipsLoaded, ships, isMapAnimating, dataLoading, initialLoadComplete, navigationStatusMappingsLoaded]);

  // Adjust map container size after component mount and when header changes
  useEffect(() => {
    const adjustMapHeight = () => {
      if (mapContainer.current) {
        const headerElement = document.querySelector('.header');
        const isCollapsed = headerElement?.classList.contains('collapsed');
        const headerHeight = isCollapsed ? 0 : (headerElement?.clientHeight || 60);
        
        // Update CSS variable
        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
        
        // Trigger resize event if map is initialized
        if (map.current) {
          // Delay resize to ensure transition completes
          setTimeout(() => {
            map.current?.resize();
          }, 300); // Matches the transition timing
        }
      }
    };

    // Initial adjustment
    adjustMapHeight();
    
    // Observer for monitoring changes to header
    const headerObserver = new MutationObserver(adjustMapHeight);
    const headerElement = document.querySelector('.header');
    
    if (headerElement) {
      headerObserver.observe(headerElement, { 
        attributes: true, 
        attributeFilter: ['class'],
        childList: false, 
        subtree: false 
      });
    }
    
    // Listen for window resize events
    window.addEventListener('resize', adjustMapHeight);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', adjustMapHeight);
      headerObserver.disconnect();
    };
  }, []);

  // Function to add ports to the map
  const addPortsToMap = useCallback(() => {
    if (!map.current || !styleLoaded) {
      console.log('Cannot add ports: map or style not ready', { map: !!map.current, styleLoaded });
      return;
    }

    if (!ports || ports.length === 0) {
      console.log('No ports data to add');
      return;
    }

    console.log('Adding ports to map, ports count:', ports.length);

    try {
      // Check if source already exists
      let sourceExists = false;
      if (map.current.getSource('ports')) {
        sourceExists = true;
        // Check if properties have actually changed before updating
        const hasHighlightChanged = map.current.querySourceFeatures('ports').some(feature => {
          const portId = feature.properties?.portId;
          const isHighlighted = feature.properties?.isHighlighted;
          const shouldBeHighlighted = highlightedPortId === portId;
          return isHighlighted !== shouldBeHighlighted;
        });

        // Only update if highlight state has changed
        if (hasHighlightChanged) {
          // Update the data to reflect highlighted state
          (map.current.getSource('ports') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: ports.map(port => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [port.longitude, port.latitude]
              },
              properties: {
                port_name: port.port_name,
                country: port.country,
                icon: 'ports32',
                portId: `${port.port_name}-${port.country}`,
                isHighlighted: highlightedPortId === `${port.port_name}-${port.country}`,
                scrubber_status: port.scrubber_status
              }
            }))
          });
          
          // If port layer exists, ensure it's on top
          if (map.current.getLayer('ports-layer')) {
            map.current.moveLayer('ports-layer');
          }
          console.log('Ports source updated with highlighted state');
        }
      }

      // Only add source and layer if they don't exist yet
      if (!sourceExists) {
        // Add source with ports data
        map.current.addSource('ports', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: ports.map(port => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [port.longitude, port.latitude]
              },
              properties: {
                port_name: port.port_name,
                country: port.country,
                icon: 'ports32',
                portId: `${port.port_name}-${port.country}`,
                isHighlighted: highlightedPortId === `${port.port_name}-${port.country}`,
                scrubber_status: port.scrubber_status
              }
            }))
          }
        });

        // Add layer with custom icon
        map.current.addLayer({
          id: 'ports-layer',
          type: 'symbol',
          source: 'ports',
          layout: {
            'icon-image': [
              'match',
              ['get', 'scrubber_status'], // Get the scrubber_status property
              1, 'ports32_partial_ban_dash_outline',  // If status is 1, use partial ban icon
              2, 'ports32_total_ban_dash_outline',   // If status is 2, use total ban icon
              // Default case for status 0 or any other value
              'ports32' 
            ],
            'icon-size': [
              'case',
              ['get', 'isHighlighted'], 
              1.6, // Increased size for highlighted ports
              1.3  // Regular size for non-highlighted ports
            ],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          },
          paint: {
            'icon-opacity': [
              'case',
              ['get', 'isHighlighted'], 
              1.0, // Full opacity for highlighted ports
              0.8  // Slightly transparent for non-highlighted ports
            ]
          }
        });

        // Ensure port layer is on top
        if (map.current.getLayer('ports-layer')) {
          // Check for heatmap layers
          const heatmapLayers = ['size-heatmap-layer', 'scrubber-heatmap-layer'];
          const existingHeatmaps = heatmapLayers.filter(layer => map.current?.getLayer(layer));

          // First move heatmap layers above ship layers
          existingHeatmaps.forEach(layer => {
            map.current?.moveLayer(layer);
          });

          // Then move port layer to the very top
          map.current.moveLayer('ports-layer');
        }

        console.log('Added port click handlers');
        console.log('Successfully added ports to map with custom icon');
      }

      // Add click event
      map.current.on('click', 'ports-layer', (e) => {
        // Only process if map is loaded and initialized
        if (!map.current || !styleLoaded || !initialLoadComplete) return;
        
        if (e.features && e.features[0]) {
          const properties = e.features[0].properties;
          if (properties) {
            const port = {
              port_name: properties.port_name,
              country: properties.country,
              latitude: e.lngLat.lat,
              longitude: e.lngLat.lng,
              scrubber_status: properties.scrubber_status
            };
            
            // Add port to search results first to ensure it's visible throughout the process
            if (searchBarRef.current && searchBarRef.current.addPortToResults) {
              // Remove focus from any active element (including search box)
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              
              // Add to search results
              searchBarRef.current.addPortToResults(port);
            }
            
            // If current displayed ship path exists, remove
            if (currentShipPathRef.current) {
              removeShipPath(currentShipPathRef.current);
              clearMessage();
            }
            
            // On mobile devices, hide ship info button when clicking port
            if (isMobileDevice()) {
              setShowShipInfoButton(false);
              setShipForInfoButton(null);
            }
            
            // Set highlighted port
            const portId = `${properties.port_name}-${properties.country}`;
            setHighlightedPortId(portId);
            
            // Clear highlighted ship
            setHighlightedShipId(null);
            
            // If sidebar is open, close it after adding search results
            if (sidebarOpen) {
              setSidebarOpen(false);
            }
            
            // Close settings panel and legend
            setControlPanelOpen(false);
            setLegendOpen(false);

            // Stop the event from propagating to underlying layers (like ships)
            e.originalEvent.stopPropagation();
          }
        }
      });

      // Add click event on map to clear highlighted port (only on mobile)
      map.current.on('click', (e) => {
        // Only process if map is loaded and initialized
        if (!map.current || !styleLoaded || !initialLoadComplete) return;
        
        // Check if the required layers exist before querying them
        const layersToQuery = ['ports-layer', 'ships-layer-circle', 'ships-layer-detailed-shapes'].filter(
          layer => map.current?.getLayer(layer)
        );
        
        // If no queryable layers exist yet, return early
        if (layersToQuery.length === 0) return;
        
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: layersToQuery
        });
        
        // If no features were clicked but there's a highlighted port
        if (features.length === 0 && highlightedPortId) {
          // Always clear when clicking empty space
          setHighlightedPortId(null);
          // Clear search results
          if (searchBarRef.current && searchBarRef.current.clearResults) {
            searchBarRef.current.clearResults();
          }
          
          // Close sidebar if it's open
          if (sidebarOpen) {
            setSidebarOpen(false);
          }
          
          // Close settings panel and legend
          setControlPanelOpen(false);
          setLegendOpen(false);
          
          // Clear any ship path and message
          if (currentShipPathRef.current) {
            removeShipPath(currentShipPathRef.current);
            clearMessage();
          }
          
          // Update port data to reflect the change
          if (map.current && map.current.getSource('ports')) {
            (map.current.getSource('ports') as mapboxgl.GeoJSONSource).setData({
              type: 'FeatureCollection',
              features: ports.map(port => ({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [port.longitude, port.latitude]
                },
                properties: {
                  port_name: port.port_name,
                  country: port.country,
                  icon: 'ports32',
                  portId: `${port.port_name}-${port.country}`,
                  isHighlighted: false,
                  scrubber_status: port.scrubber_status
                }
              }))
            });
          }
        } else if (features.length === 0) {
          // Even if no highlighted port, still close settings and legend when clicking empty space
          setControlPanelOpen(false);
          setLegendOpen(false);
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'ports-layer', () => {
        if (map.current && styleLoaded) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'ports-layer', () => {
        if (map.current && styleLoaded) {
          map.current.getCanvas().style.cursor = '';
        }
      });

      console.log('Added port click handlers');
      console.log('Successfully added ports to map with custom icon');
    } catch (error) {
      console.error('Error adding ports to map:', error);
      setMapError(`Error adding ports to map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [styleLoaded, ports, initialLoadComplete, highlightedPortId, sidebarOpen, removeShipPath, clearMessage, setControlPanelOpen, setLegendOpen]);

  // Add ship path to map
  const addShipPathToMap = useCallback((pathData: ShipPosition[], imoNumber: string, shipName: string) => {
    if (!map.current || pathData.length < 2) {
      showMessage(`No path data available for ${shipName}`, MessageType.ERROR);
      return;
    }

    try {
      // If current displayed ship path exists and is not current path, remove
      if (currentShipPathRef.current && currentShipPathRef.current !== imoNumber) {
        removeShipPath(currentShipPathRef.current);
      }

      // Set current displayed path
      currentShipPathRef.current = imoNumber;

      const pathLayerId = `ship-path-${imoNumber}`;
      const unreliablePathLayerId = `ship-path-unreliable-${imoNumber}`;
      
      // Remove existing layers and sources
      const layersToRemove = [pathLayerId, unreliablePathLayerId];
      layersToRemove.forEach(layerId => {
        if (map.current && map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current && map.current.getSource(layerId)) {
          map.current.removeSource(layerId);
        }
      });

      // Create separate path segments based on time and distance thresholds
      const reliableSegments: number[][][] = [];
      const unreliableSegments: number[][][] = [];
      
      const TIME_THRESHOLD = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
      const DISTANCE_THRESHOLD = 100; // 100 kilometers

      let currentSegment: number[][] = [[pathData[0].longitude, pathData[0].latitude]];
      let isCurrentSegmentReliable = true;

      for (let i = 1; i < pathData.length; i++) {
        const prevPoint = pathData[i - 1];
        const currentPoint = pathData[i];
        
        // Calculate time difference in milliseconds
        const timeDiff = new Date(currentPoint.timestamp_ais).getTime() - new Date(prevPoint.timestamp_ais).getTime();
        
        // Calculate distance between points
        const distance = calculateDistance(
          prevPoint.latitude, prevPoint.longitude,
          currentPoint.latitude, currentPoint.longitude
        );

        // Determine if this segment is unreliable (exceeds thresholds)
        const isUnreliable = timeDiff > TIME_THRESHOLD || distance > DISTANCE_THRESHOLD;

        // If reliability changes, finish current segment and start new one
        if (isUnreliable !== !isCurrentSegmentReliable) {
          // Add current point to finish the current segment
          currentSegment.push([currentPoint.longitude, currentPoint.latitude]);
          
          // Store the completed segment
          if (isCurrentSegmentReliable) {
            reliableSegments.push([...currentSegment]);
          } else {
            unreliableSegments.push([...currentSegment]);
          }
          
          // Start new segment with current point
          currentSegment = [[currentPoint.longitude, currentPoint.latitude]];
          isCurrentSegmentReliable = !isUnreliable;
        } else {
          // Continue current segment
          currentSegment.push([currentPoint.longitude, currentPoint.latitude]);
        }
      }

      // Add the final segment
      if (currentSegment.length > 1) {
        if (isCurrentSegmentReliable) {
          reliableSegments.push(currentSegment);
        } else {
          unreliableSegments.push(currentSegment);
        }
      }

      // Add reliable path segments (solid lines)
      if (reliableSegments.length > 0) {
        map.current.addSource(pathLayerId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: reliableSegments.map(segment => ({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: segment
              }
            }))
          }
        });

        map.current.addLayer({
          id: pathLayerId,
          type: 'line',
          source: pathLayerId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#000',
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
      }

      // Add unreliable path segments (dashed lines)
      if (unreliableSegments.length > 0) {
        map.current.addSource(unreliablePathLayerId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: unreliableSegments.map(segment => ({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: segment
              }
            }))
          }
        });

        map.current.addLayer({
          id: unreliablePathLayerId,
          type: 'line',
          source: unreliablePathLayerId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#000',
            'line-width': 3,
            'line-opacity': 0.6,
            'line-dasharray': [2, 2] // Dashed line pattern
          }
        });
      }

      // Ensure port layer is above ship paths
      if (map.current.getLayer('ports-layer')) {
        map.current.moveLayer('ports-layer');
      }

      console.log(`Successfully added path for ship IMO ${imoNumber} (${reliableSegments.length} reliable segments, ${unreliableSegments.length} unreliable segments)`);
      showMessage(`Path loaded for ${shipName}`, MessageType.SUCCESS);
    } catch (error) {
      console.error('Error adding ship path to map:', error);
      showMessage(`Failed to display path for ${shipName}`, MessageType.ERROR);
    }
  }, [removeShipPath, showMessage]);

  // Add scrubber discharge trail to map (for scrubber vessels)
  const addScrubberDischargeTrailToMap = useCallback((pathData: ShipPosition[], imoNumber: string, shipName: string, scrubberType: string, dischargeRate: number) => {
    if (!map.current || pathData.length < 2) {
      showMessage(`No path data available for ${shipName}`, MessageType.ERROR);
      return;
    }

    try {
      // If current displayed ship path exists and is not current path, remove
      if (currentShipPathRef.current && currentShipPathRef.current !== imoNumber) {
        removeShipPath(currentShipPathRef.current);
      }

      // Set current displayed path
      currentShipPathRef.current = imoNumber;

      const trailLayerId = `scrubber-trail-${imoNumber}`;
      const trailPointsLayerId = `scrubber-trail-points-${imoNumber}`;
      
      // Remove existing layers and sources
      const layersToRemove = [trailLayerId, trailPointsLayerId];
      layersToRemove.forEach(layerId => {
        if (map.current && map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current && map.current.getSource(layerId)) {
          map.current.removeSource(layerId);
        }
      });

      // Create trail segments with discharge intensity visualization
      const trailSegments: any[] = [];
      const unreliableTrailSegments: any[] = [];
      const trailPoints: any[] = [];
      
      // Normalize discharge rate for visual intensity (0.1 to 1.0)
      const maxExpectedRate = 200; // Maximum expected discharge rate for normalization
      const normalizedIntensity = Math.min(Math.max(dischargeRate / maxExpectedRate, 0.1), 1.0);
      
      // Color based on scrubber type and discharge rate intensity
      let trailColor = '#FF6B6B'; // Default red for open-loop (high discharge)
      let trailOpacity = 0.6 + (normalizedIntensity * 0.4); // 0.6 to 1.0 opacity
      
      if (scrubberType.toLowerCase().includes('closed')) {
        trailColor = '#FFE66D'; // Yellow for closed-loop (lowest discharge)
        trailOpacity = 0.4 + (normalizedIntensity * 0.3); // Lower opacity for closed systems
      } else if (scrubberType.toLowerCase().includes('hybrid')) {
        trailColor = '#FF8C42'; // Orange for hybrid systems (medium discharge)
        trailOpacity = 0.5 + (normalizedIntensity * 0.35);
      }
      
      // Calculate trail width based on discharge rate
      const baseWidth = 2;
      const maxWidth = 8;
      const trailWidth = baseWidth + (normalizedIntensity * (maxWidth - baseWidth));

      // Process path data to create trail segments
      for (let i = 1; i < pathData.length; i++) {
        const prevPoint = pathData[i - 1];
        const currentPoint = pathData[i];
        
        // Calculate time difference for segment intensity
        const timeDiff = new Date(currentPoint.timestamp_ais).getTime() - new Date(prevPoint.timestamp_ais).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60); // Convert to hours
        
        // Calculate segment discharge amount (discharge rate * time)
        const segmentDischarge = dischargeRate * hoursDiff;
        const segmentIntensity = Math.min(segmentDischarge / 50, 1.0); // Normalize segment intensity
        
        // Create trail segment
        const segment = {
          type: 'Feature',
          properties: {
            discharge_rate: dischargeRate,
            segment_discharge: segmentDischarge,
            intensity: segmentIntensity,
            time_hours: hoursDiff,
            scrubber_type: scrubberType
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [prevPoint.longitude, prevPoint.latitude],
              [currentPoint.longitude, currentPoint.latitude]
            ]
          }
        };
        
        // Determine if this segment is unreliable (exceeds 6 hour threshold)
        if (hoursDiff > 6) {
          // Add to unreliable segments (will be drawn with dashed line)
          unreliableTrailSegments.push(segment);
        } else {
          // Add to reliable segments (will be drawn with solid line)
          trailSegments.push(segment);
          
          // Only add discharge points for reliable segments
          const pointIntensity = segmentIntensity * normalizedIntensity;
          if (pointIntensity > 0.2) { // Only show significant discharge points
            const trailPoint = {
              type: 'Feature',
              properties: {
                discharge_rate: dischargeRate,
                intensity: pointIntensity,
                timestamp: currentPoint.timestamp_ais,
                scrubber_type: scrubberType
              },
              geometry: {
                type: 'Point',
                coordinates: [currentPoint.longitude, currentPoint.latitude]
              }
            };
            
            trailPoints.push(trailPoint);
          }
        }
      }

      // Add reliable trail line layer (solid lines)
      if (trailSegments.length > 0) {
        map.current.addSource(trailLayerId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: trailSegments
          }
        });

        map.current.addLayer({
          id: trailLayerId,
          type: 'line',
          source: trailLayerId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, trailColor,
              0.5, trailColor,
              1, trailColor
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, trailWidth * 0.5,
              12, trailWidth,
              16, trailWidth * 1.5
            ],
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, trailOpacity * 0.3,
              0.5, trailOpacity * 0.7,
              1, trailOpacity
            ],
            'line-blur': 1 // Add slight blur for discharge effect
          }
        });
      }

      // Add unreliable trail line layer (dashed lines for data gaps > 6 hours)
      const unreliableTrailLayerId = `scrubber-trail-unreliable-${imoNumber}`;
      if (unreliableTrailSegments.length > 0) {
        map.current.addSource(unreliableTrailLayerId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: unreliableTrailSegments
          }
        });

        map.current.addLayer({
          id: unreliableTrailLayerId,
          type: 'line',
          source: unreliableTrailLayerId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': trailColor,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, trailWidth * 0.4, // Slightly thinner for unreliable segments
              12, trailWidth * 0.8,
              16, trailWidth * 1.2
            ],
            'line-opacity': trailOpacity * 0.6, // Lower opacity for unreliable segments
            'line-dasharray': [3, 3], // Dashed line pattern to indicate unreliable data
            'line-blur': 1
          }
        });
      }

      // Add discharge points layer (showing discharge intensity)
      if (trailPoints.length > 0) {
        map.current.addSource(trailPointsLayerId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: trailPoints
          }
        });

        map.current.addLayer({
          id: trailPointsLayerId,
          type: 'circle',
          source: trailPointsLayerId,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, ['interpolate', ['linear'], ['get', 'intensity'], 0, 2, 1, 4],
              12, ['interpolate', ['linear'], ['get', 'intensity'], 0, 3, 1, 6],
              16, ['interpolate', ['linear'], ['get', 'intensity'], 0, 4, 1, 8]
            ],
            'circle-color': trailColor,
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0.3,
              1, 0.8
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.5
          }
        });
      }

      // Ensure port layer is above scrubber trails
      if (map.current.getLayer('ports-layer')) {
        map.current.moveLayer('ports-layer');
      }

      console.log(`Successfully added scrubber discharge trail for ship IMO ${imoNumber} (${trailSegments.length} reliable segments, ${unreliableTrailSegments.length} unreliable segments, ${trailPoints.length} discharge points)`);
      showMessage(`Path loaded for ${shipName}`, MessageType.SUCCESS);
    } catch (error) {
      console.error('Error adding scrubber discharge trail to map:', error);
      showMessage(`Failed to display path for ${shipName}`, MessageType.ERROR);
    }
  }, [removeShipPath, showMessage]);

  // Fetch ship path data
  const fetchShipPath = useCallback(async (imoNumber: string, shipName: string) => {
    // Skip if already loading this ship's path
    if (currentShipPathRef.current === imoNumber) {
      console.log(`Already displaying path for ship IMO ${imoNumber}, skipping new request`);
      return;
    }
    
    // Variable to track if this request is still valid
    let isCurrentRequest = true;
    // Track the IMO number being loaded to prevent race conditions
    const requestedShip = imoNumber;
    
    try {
      // Show loading message
      // showMessage(`Loading path for ${shipName}...`, MessageType.INFO); // Temporarily disabled loading message
      
      console.log(`Fetching path data for ship IMO ${imoNumber}...`);
      
      // Cancel any previous requests if different ship
      if (currentShipPathRef.current && currentShipPathRef.current !== imoNumber) {
        console.log(`Removing previous path for ship IMO ${currentShipPathRef.current} before loading new path`);
        removeShipPath(currentShipPathRef.current);
      }
      
      // Mark the current ship path being loaded (do this before the fetch to prevent race conditions)
      currentShipPathRef.current = imoNumber;
      
      const response = await fetch(API_ENDPOINTS.SHIP_PATH(imoNumber));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Path data received for ship IMO ${imoNumber}:`, data.length);
      
      // Only add to map if this is still the current request and not superseded by another request
      if (isCurrentRequest && currentShipPathRef.current === requestedShip) {
        // Check if this is a scrubber vessel and use appropriate visualization
        const ship = ships.find(s => s.imo_number === imoNumber);
        const isScrubberShip = scrubberVesselsLoaded && !!scrubberVessels[imoNumber];
        
        if (isScrubberShip && ship) {
          // Use scrubber discharge trail for scrubber vessels
          const scrubberType = scrubberVessels[imoNumber]?.technology_type || 'unknown';
          
          // Calculate discharge rate if not already calculated
          if (!ship.scrubberDischargeRate) {
            ship.scrubberDischargeRate = calculateScrubberDischargeRate(ship, scrubberType);
          }
          
          console.log(`Using scrubber discharge trail for vessel ${shipName} (${scrubberType}, ${ship.scrubberDischargeRate} kg/h)`);
          addScrubberDischargeTrailToMap(data, imoNumber, shipName, scrubberType, ship.scrubberDischargeRate);
        } else {
          // Use traditional path visualization for regular vessels
          console.log(`Using traditional path for regular vessel ${shipName}`);
          addShipPathToMap(data, imoNumber, shipName);
        }
      } else {
        console.log(`Ignoring completed path load for ${imoNumber} as another ship was selected`);
        // Clear the loading message if this request is being ignored
        clearMessage();
      }
    } catch (error) {
      console.error('Error fetching ship path:', error);
      showMessage(`Failed to load path for ${shipName}: ${error instanceof Error ? error.message : 'Unknown error'}`, MessageType.ERROR);
      // If this was the current request and it failed, clear the current path reference
      if (isCurrentRequest && currentShipPathRef.current === requestedShip) {
        currentShipPathRef.current = null;
      }
    }
    
    // Function to cancel this request if a new one comes in
    return () => {
      isCurrentRequest = false;
    };
  }, [addShipPathToMap, showMessage, removeShipPath, clearMessage, scrubberVesselsLoaded, ships, scrubberVessels, addScrubberDischargeTrailToMap]);

  // Function to add ships to the map
  const addShipsToMap = useCallback(() => {
    if (!map.current || !styleLoaded || ships.length === 0) {
      console.log('Cannot add ships: map or style not ready or no ships data', { 
        map: !!map.current, 
        styleLoaded, 
        shipsCount: ships.length 
      });
      return;
    }

    const isInitialAdd = !map.current.getSource('ships-circle');

    let skipDataUpdate = false;
    if (!isInitialAdd && highlightedShipId === null) {
      const currentShipFeatures = map.current.querySourceFeatures('ships-circle');
      
      if (currentShipFeatures.length > 0 && 
          !currentShipFeatures.some(f => f.properties?.isHighlighted)) {
        // Skip data update but still process events
        skipDataUpdate = true;
        console.log('Skipping ship data update, no highlight changes');
      }
    }

    if (!skipDataUpdate) {
      console.log('Adding ships to map, ships count:', ships.length);

      try {
        // Clean up existing ship layers and data sources
        const layersToRemove = [
          'ships-layer-circle', 
          'ships-layer-detailed', 
          'ships-layer-detailed-shapes', 
          'ships-layer-detailed-outlines',
          'scrubber-icon-layer'
        ];
        const sourcesToRemove = ['ships-circle', 'ships-detailed'];
        
        // Remove layers
        layersToRemove.forEach(layerId => {
          if (map.current && map.current.getLayer(layerId)) {
            try {
              map.current.removeLayer(layerId);
            } catch (e) {
              console.warn(`Could not remove layer ${layerId}:`, e);
            }
          }
        });
        
        // Remove data sources
        sourcesToRemove.forEach(sourceId => {
          if (map.current && map.current.getSource(sourceId)) {
            try {
              map.current.removeSource(sourceId);
            } catch (e) {
              console.warn(`Could not remove source ${sourceId}:`, e);
            }
          }
        });

        // 1. Add circular ship data source and layer (for small zoom levels)
        // Check if source exists before adding
        if (!map.current.getSource('ships-circle')) {
          map.current.addSource('ships-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: ships.map(ship => ({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
                },
                properties: {
                  imo_number: ship.imo_number,
                  name: ship.name,
                  ship_type: ship.ship_type,
                  color: getShipColor(ship.ship_type),
                  borderColor: getShipBorderColor(ship.ship_type),
                  category: getShipCategory(ship.ship_type),
                  isHighlighted: highlightedShipId === ship.imo_number,
                  // Add scrubber properties with default false to prevent showing as scrubber before data loads
                  isScrubber: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
                  scrubberType: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
                    (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
                    scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
                }
              }))
            }
          });
        } else {
          // Update existing source instead of creating a new one
          (map.current.getSource('ships-circle') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: ships.map(ship => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
              },
              properties: {
                imo_number: ship.imo_number,
                name: ship.name,
                ship_type: ship.ship_type,
                color: getShipColor(ship.ship_type),
                borderColor: getShipBorderColor(ship.ship_type),
                category: getShipCategory(ship.ship_type),
                isHighlighted: highlightedShipId === ship.imo_number,
                // Add scrubber properties with default false to prevent showing as scrubber before data loads
                isScrubber: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
                scrubberType: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
                  (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
                  scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
              }
            }))
          });
        }

        // Add circular layer (for small zoom levels)
        map.current.addLayer({
          id: 'ships-layer-circle',
          type: 'circle',
          source: 'ships-circle',
          paint: {
            // Dynamic adjustment of circle size based on zoom level
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              5, ['case', ['get', 'isHighlighted'], 5, 3],    // Radius at zoom level 5
              8, ['case', ['get', 'isHighlighted'], 8, 5],    // Radius at zoom level 8
              11, ['case', ['get', 'isHighlighted'], 12, 8],  // Radius at zoom level 11
              14, ['case', ['get', 'isHighlighted'], 15, 10]  // Radius at zoom level 14
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': [
              'case',
              ['get', 'isHighlighted'], 
              2.5, // Thicker border for highlighted ships
              1    // Normal border for non-highlighted ships
            ],
            'circle-stroke-color': ['get', 'borderColor'],
            'circle-opacity': [
              'case',
              ['get', 'isHighlighted'], 
              1.0, // Full opacity for highlighted ships
              0.8  // Slightly transparent for non-highlighted ships
            ]
          },
          filter: ['<', ['zoom'], ZOOM_THRESHOLD_MAX]
        });

        // 2. Prepare detailed ship shapes for large zoom levels
        // Create ship rectangular shape GeoJSON features
        const shipShapeFeatures = ships.map(ship => {
          const { longitude, latitude } = ship.latest_position;
          const length = ship.length || 50; // Default length, if no data
          const width = ship.width || 10;   // Default width, if no data
          
          // Create rectangular coordinates (centered on ship location)
          // Dynamic adjustment of size factor based on zoom level to ensure ship shape large enough at small zoom levels
          const sizeFactor = ship.imo_number === highlightedShipId ? 1.3 : 1; // Increased size for highlighted ships
          const lengthInDegrees = (length * sizeFactor) / 111000; // Rough conversion from meters to degrees
          const widthInDegrees = (width * sizeFactor) / 111000;   // Rough conversion from meters to degrees
          
          // Create rectangle's four corners
          const rectangle = [
            [longitude - lengthInDegrees/2, latitude - widthInDegrees/2],
            [longitude + lengthInDegrees/2, latitude - widthInDegrees/2],
            [longitude + lengthInDegrees/2, latitude + widthInDegrees/2],
            [longitude - lengthInDegrees/2, latitude + widthInDegrees/2],
            [longitude - lengthInDegrees/2, latitude - widthInDegrees/2] // Closed polygon
          ];
          
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [rectangle]
            },
            properties: {
              imo_number: ship.imo_number,
              name: ship.name,
              ship_type: ship.ship_type,
              color: getShipColor(ship.ship_type),
              borderColor: getShipBorderColor(ship.ship_type),
              category: getShipCategory(ship.ship_type),
              isHighlighted: highlightedShipId === ship.imo_number,
              // Add scrubber properties with default false to prevent showing as scrubber before data loads
              isScrubber: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
              scrubberType: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
                (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
                scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
            }
          };
        });

        // Add detailed ship shape data source
        if (!map.current.getSource('ships-detailed')) {
          map.current.addSource('ships-detailed', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection' as const,
              features: shipShapeFeatures
            }
          });
        } else {
          // Update existing source instead of creating a new one
          (map.current.getSource('ships-detailed') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection' as const,
            features: shipShapeFeatures
          });
        }
        
        // Add detailed ship fill layer
        map.current.addLayer({
          id: 'ships-layer-detailed-shapes',
          type: 'fill',
          source: 'ships-detailed',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['get', 'isHighlighted'], 
              0.9, // Higher opacity for highlighted ships
              0.8  // Normal opacity for non-highlighted ships
            ],
            'fill-outline-color': ['get', 'borderColor']
          },
          filter: ['>=', ['zoom'], ZOOM_THRESHOLD_MIN]
        });
        
        // Add detailed ship outline layer
        map.current.addLayer({
          id: 'ships-layer-detailed-outlines',
          type: 'line',
          source: 'ships-detailed',
          paint: {
            'line-color': ['get', 'borderColor'],
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              9, ['case', ['get', 'isHighlighted'], 2, 1],    // Line width at zoom level 9
              12, ['case', ['get', 'isHighlighted'], 3, 1.5], // Line width at zoom level 12
              15, ['case', ['get', 'isHighlighted'], 4, 2]    // Line width at zoom level 15
            ]
          },
          filter: ['>=', ['zoom'], ZOOM_THRESHOLD_MIN]
        });
      } catch (error) {
        console.error('Error adding ships to map:', error);
        setMapError(`Error adding ships to map: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return; // Return early on error
      }
    }
    
    // Always add click handlers (regardless of skipDataUpdate)
    // This ensures ship click functionality always works
    
    // 3. Add click event handling
    // Add click event for small zoom level circular layer
    if (map.current.getLayer('ships-layer-circle')) {
      map.current.on('click', 'ships-layer-circle', (e) => {
        // Only process if map is loaded and initialized
        if (!map.current || !styleLoaded || !initialLoadComplete) return;
        
        if (e.features && e.features[0]) {
          const properties = e.features[0].properties;
          if (properties) {
            const imoNumber = properties.imo_number;
            const shipName = properties.name;
            const ship = ships.find(s => s.imo_number === imoNumber);
            
            if (ship) {
              // Add ship to search results first to ensure it's visible throughout the process
              if (searchBarRef.current && searchBarRef.current.addShipToResults) {
                // Remove focus from any active element (including search box)
                // to prevent issues with search results
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                
                // Add to search results
                searchBarRef.current.addShipToResults(ship);
              }
              
              // Set highlighted ship
              setHighlightedShipId(imoNumber);
              
              // Clear highlighted port
              setHighlightedPortId(null);
              
              // First clear existing ship path if different from current ship
              if (currentShipPathRef.current && currentShipPathRef.current !== imoNumber) {
                removeShipPath(currentShipPathRef.current);
              }
              
              // If sidebar is open, close it after adding search results
              if (sidebarOpen) {
                setSidebarOpen(false);
              }
              
              // Close settings panel and legend
              setControlPanelOpen(false);
              setLegendOpen(false);
              
              // Fetch path in the background for better UX
              fetchShipPath(imoNumber, shipName);
            }
          }
        }
      });
    }
    
    // Add click event for large zoom level detailed shape layer
    if (map.current.getLayer('ships-layer-detailed-shapes')) {
      map.current.on('click', 'ships-layer-detailed-shapes', (e) => {
        // Only process if map is loaded and initialized
        if (!map.current || !styleLoaded || !initialLoadComplete) return;
        
        if (e.features && e.features[0]) {
          const properties = e.features[0].properties;
          if (properties) {
            const imoNumber = properties.imo_number;
            const shipName = properties.name;
            const ship = ships.find(s => s.imo_number === imoNumber);
            
            if (ship) {
              // Add ship to search results first to ensure it's visible throughout the process
              if (searchBarRef.current && searchBarRef.current.addShipToResults) {
                // Remove focus from any active element (including search box)
                // to prevent issues with search results
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                
                // Add to search results
                searchBarRef.current.addShipToResults(ship);
              }
              
              // Set highlighted ship
              setHighlightedShipId(imoNumber);
              
              // Clear highlighted port
              setHighlightedPortId(null);
              
              // First clear existing ship path if different from current ship
              if (currentShipPathRef.current && currentShipPathRef.current !== imoNumber) {
                removeShipPath(currentShipPathRef.current);
              }
              
              // If sidebar is open, close it after adding search results
              if (sidebarOpen) {
                setSidebarOpen(false);
              }
              
              // Close settings panel and legend
              setControlPanelOpen(false);
              setLegendOpen(false);
              
              // Fetch path in the background for better UX
              fetchShipPath(imoNumber, shipName);
            }
          }
        }
      });
    }

    // Add click event on map to clear highlighted ship (only on mobile)
    map.current.on('click', (e) => {
      // Only process if map is loaded and initialized
      if (!map.current || !styleLoaded || !initialLoadComplete) return;
      
      // Check if the required layers exist before querying them
      const layersToQuery = ['ports-layer', 'ships-layer-circle', 'ships-layer-detailed-shapes'].filter(
        layer => map.current?.getLayer(layer)
      );
      
      // If no queryable layers exist yet, return early
      if (layersToQuery.length === 0) return;
      
      // Only process if it's not a click on a port or ship
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: layersToQuery
      });
      
      // Local function to check if a ship is a scrubber vessel
      const checkScrubberVessel = (imoNumber: string) => {
        return !!scrubberVessels[imoNumber];
      };

      // If no features were clicked but there's a highlighted ship
      if (features.length === 0 && highlightedShipId) {
        setHighlightedShipId(null);
        
        // Close sidebar if it's open
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
        
        // Close settings panel and legend
        setControlPanelOpen(false);
        setLegendOpen(false);
        
        // Clear search results
        if (searchBarRef.current && searchBarRef.current.clearResults) {
          searchBarRef.current.clearResults();
        }
        
        // Clear any path loading message
        if (currentShipPathRef.current) {
          removeShipPath(currentShipPathRef.current);
          clearMessage();
        }
        
        // Update ship data to reflect the change
        if (map.current && map.current.getSource('ships-circle')) {
          (map.current.getSource('ships-circle') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: ships.map(ship => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
              },
              properties: {
                imo_number: ship.imo_number,
                name: ship.name,
                ship_type: ship.ship_type,
                color: getShipColor(ship.ship_type),
                borderColor: getShipBorderColor(ship.ship_type),
                category: getShipCategory(ship.ship_type),
                isHighlighted: false,
                // Add scrubber properties with default false to prevent showing as scrubber before data loads
                isScrubber: scrubberVesselsLoaded ? checkScrubberVessel(ship.imo_number) : false,
                scrubberType: scrubberVesselsLoaded && checkScrubberVessel(ship.imo_number) && scrubberVessels[ship.imo_number] 
                  ? (scrubberVessels[ship.imo_number].technology_type.toLowerCase() === 'tbc' 
                      ? 'scrubber' 
                      : scrubberVessels[ship.imo_number].technology_type.toLowerCase())
                  : null
              }
            }))
          });
        }
        
        if (map.current && map.current.getSource('ships-detailed')) {
          (map.current.getSource('ships-detailed') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: ships.map(ship => {
              const { longitude, latitude } = ship.latest_position;
              const length = ship.length || 50;
              const width = ship.width || 10;
              
              const sizeFactor = 1; // No highlighting
              const lengthInDegrees = (length * sizeFactor) / 111000;
              const widthInDegrees = (width * sizeFactor) / 111000;
              
              const rectangle = [
                [longitude - lengthInDegrees/2, latitude - widthInDegrees/2],
                [longitude + lengthInDegrees/2, latitude - widthInDegrees/2],
                [longitude + lengthInDegrees/2, latitude + widthInDegrees/2],
                [longitude - lengthInDegrees/2, latitude + widthInDegrees/2],
                [longitude - lengthInDegrees/2, latitude - widthInDegrees/2]
              ];
              
              return {
                type: 'Feature' as const,
                geometry: {
                  type: 'Polygon' as const,
                  coordinates: [rectangle]
                },
                properties: {
                  imo_number: ship.imo_number,
                  name: ship.name,
                  ship_type: ship.ship_type,
                  color: getShipColor(ship.ship_type),
                  borderColor: getShipBorderColor(ship.ship_type),
                  category: getShipCategory(ship.ship_type),
                  isHighlighted: false,
                  // Add scrubber properties with default false to prevent showing as scrubber before data loads
                  isScrubber: scrubberVesselsLoaded ? checkScrubberVessel(ship.imo_number) : false,
                  scrubberType: scrubberVesselsLoaded && checkScrubberVessel(ship.imo_number) && scrubberVessels[ship.imo_number] 
                    ? (scrubberVessels[ship.imo_number].technology_type.toLowerCase() === 'tbc' 
                        ? 'scrubber' 
                        : scrubberVessels[ship.imo_number].technology_type.toLowerCase())
                    : null
                }
              };
            })
          });
        }
        
        // If there's a path, also remove it
        if (currentShipPathRef.current) {
          removeShipPath(currentShipPathRef.current);
        }
      } else if (features.length === 0) {
        // Even if no highlighted ship, still close settings and legend when clicking empty space
        setControlPanelOpen(false);
        setLegendOpen(false);
      }
    });

    // 4. Add mouse hover effect
    // Small zoom level
    if (map.current.getLayer('ships-layer-circle')) {
      map.current.on('mouseenter', 'ships-layer-circle', () => {
        if (map.current && styleLoaded) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      
      map.current.on('mouseleave', 'ships-layer-circle', () => {
        if (map.current && styleLoaded) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }
    
    // Large zoom level
    if (map.current.getLayer('ships-layer-detailed-shapes')) {
      map.current.on('mouseenter', 'ships-layer-detailed-shapes', () => {
        if (map.current && styleLoaded) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      
      map.current.on('mouseleave', 'ships-layer-detailed-shapes', () => {
        if (map.current && styleLoaded) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }

    // Finally ensure port layer is above all ship layers
    if (map.current.getLayer('ports-layer')) {
      // Check for heatmap layers
      const heatmapLayers = ['size-heatmap-layer', 'scrubber-heatmap-layer'];
      const existingHeatmaps = heatmapLayers.filter(layer => map.current?.getLayer(layer));

      // First move heatmap layers above ship layers
      existingHeatmaps.forEach(layer => {
        map.current?.moveLayer(layer);
      });

      // Then move port layer to the very top
      map.current.moveLayer('ports-layer');
      console.log('Moved ports layer to top, with heatmaps between ships and ports');
    }

    console.log('Successfully added ships to map with custom styling');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleLoaded, ships, fetchShipPath, removeShipPath, highlightedShipId, sidebarOpen, initialLoadComplete, searchBarRef, trackScrubberVessels, scrubberVessels, setControlPanelOpen, setLegendOpen]);

  // Default map center and zoom level - wrapped in useMemo to avoid re-creation on each render
  const defaultCenter = useMemo(() => [3, 55.6] as [number, number], []); // North Sea center position
  const defaultZoom = 4.4;

  // Handle reset map view to default center and zoom
  const handleResetMapView = useCallback(() => {
    if (!map.current || isMapAnimating) return;
    
    // Lock map interactions during animation
    setIsMapAnimating(true);
    
    if (map.current) {
      // Disable map interactions
      map.current.dragPan.disable();
      map.current.scrollZoom.disable();
      map.current.doubleClickZoom.disable();
      map.current.touchZoomRotate.disable();
    }
    
    // Clear any selected entities and UI states
    setSelectedShip(null);
    setSelectedPort(null);
    setHighlightedShipId(null);
    setHighlightedPortId(null);
    setSidebarOpen(false);
    
    // Close settings panel and legend
    setControlPanelOpen(false);
    setLegendOpen(false);
    
    // Clear search input and results
    if (searchBarRef.current && searchBarRef.current.clearResults) {
      searchBarRef.current.clearResults();
    }
    
    // Remove any ship paths from the map
    if (currentShipPathRef.current) {
      removeShipPath(currentShipPathRef.current);
      clearMessage();
    }
    
    const isMobile = window.innerWidth <= 520;
    const targetZoom = isMobile ? 4 : defaultZoom;
    
    // Use flyTo to simultaneously animate both center and zoom in a single animation
    map.current.flyTo({
      center: defaultCenter,
      zoom: targetZoom,
      duration: 2000,
      essential: true // Animation will not be interrupted by user input
    });
    
    // Re-enable map interactions after animation completes
    setTimeout(() => {
      if (map.current) {
        map.current.dragPan.enable();
        map.current.scrollZoom.enable();
        map.current.doubleClickZoom.enable();
        map.current.touchZoomRotate.enable();
        setIsMapAnimating(false);
      }
    }, 2100); // Slightly longer than animation to ensure completion
  }, [defaultCenter, defaultZoom, isMapAnimating, removeShipPath, clearMessage, setSelectedShip, setSelectedPort, 
      setHighlightedShipId, setHighlightedPortId, setSidebarOpen, searchBarRef, currentShipPathRef, setControlPanelOpen, setLegendOpen]);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Exit if map is already initialized
    
    if (mapContainer.current) {
      try {
        console.log('Initializing map...');
        
        // Set higher initial zoom level for mobile devices
        const isMobile = window.innerWidth <= 520;
        const initialZoom = isMobile ? 4 : 4.4;
        
        // Initialize map with interactivity disabled during initial loading
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/aoyamaxx/cm81eps4z00vs01qs7nqo8ooi',
          center: defaultCenter,
          zoom: initialZoom,
          interactive: false, // Disable interactivity during initial loading
          attributionControl: true
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Add fullscreen control
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        
        // Add scale control
        map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

        // Listen for zoom level changes
        map.current.on('zoom', () => {
          const currentZoom = map.current?.getZoom() || 0;
          // Only record zoom level in debug mode
          if (process.env.NODE_ENV === 'development') {
            console.log('Current zoom level:', currentZoom);
          }
        });

        // Style load event (more specific than 'load')
        map.current.on('style.load', () => {
          console.log('Map style loaded successfully');
          
          // Load custom icon images for ports after style is loaded
          if (map.current) {
            // Define all the icons that need to be loaded
            const iconsToLoad = [
              { id: 'ports32', src: portsIcon },
              { id: 'ports32_partial_ban_dash_outline', src: portsIconPartialBan },
              { id: 'ports32_total_ban_dash_outline', src: portsIconTotalBan },
              { id: 'warning_yellow_outline_yellow_scrubbers', src: warningYellowScrubberIcon }
            ];
            
            // Load each icon safely with verification
            const loadPromises = iconsToLoad.map(icon => {
              return new Promise<void>((resolve) => {
                // First check if the image already exists to prevent errors
                if (map.current && !map.current.hasImage(icon.id)) {
                  const img = new Image();
                  img.onload = () => {
                    // Double-check to make sure image still doesn't exist
                    // This prevents race conditions where the image might have been added
                    // between our first check and when the image loads
                    if (map.current && !map.current.hasImage(icon.id)) {
                      try {
                        map.current.addImage(icon.id, img);
                        console.log(`Image ${icon.id} loaded successfully`);
                      } catch (error) {
                        console.error(`Error adding image ${icon.id}:`, error);
                      }
                    } else {
                      console.log(`Image ${icon.id} already exists or map is not available, skipping add`);
                    }
                    resolve();
                  };
                  img.onerror = () => {
                    console.error(`Failed to load image: ${icon.id}`);
                    resolve(); // Resolve anyway to not block other operations
                  };
                  img.src = icon.src;
                } else {
                  console.log(`Image ${icon.id} already exists or map is not available, skipping load`);
                  resolve(); // Resolve immediately if image already exists
                }
              });
            });
            
            // Wait for all icons to load (or fail)
            Promise.all(loadPromises)
              .then(() => {
                console.log('All icons loaded or verified successfully');
              })
              .catch(error => {
                console.error('Error during icon loading process:', error);
              });
          }
          
          setStyleLoaded(true);
        });

        // Map load complete event
        map.current.on('load', () => {
          console.log('Map fully loaded');
          setMapLoaded(true);
        });

        // Map error event
        map.current.on('error', (e) => {
          console.error('Map error:', e.error);
          setMapError(`Map loading error: ${e.error?.message || 'Unknown error'}`);
        });
      } catch (error) {
        console.error('Map initialization error:', error);
        setMapError(`Map initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Cleanup map when component unmounts
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [defaultCenter]); // Add defaultCenter as dependency

  // Enable map interactivity once loading is complete
  useEffect(() => {
    if (initialLoadComplete && map.current && !isMapAnimating) {
      // Enable map interactivity
      map.current.dragPan.enable();
      map.current.scrollZoom.enable();
      map.current.doubleClickZoom.enable();
      map.current.touchZoomRotate.enable();
      
      console.log('Map interactivity enabled');
    }
  }, [initialLoadComplete, isMapAnimating]);

  // Add meta tag to disable zoom
  useEffect(() => {
    // Create or update viewport meta tag to disable user scaling/zooming
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalContent = viewportMeta?.getAttribute('content') || '';
    
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    
    // Set viewport to disable user scaling
    viewportMeta.setAttribute(
      'content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    );
    
    // Modify touch event handlers to prevent pinch zoom ONLY on the body and header, not on the map or sidebar or popup
    const preventZoom = (e: TouchEvent) => {
      // Get the target element
      const target = e.target as HTMLElement;
      
      // Check if the event is on the map container or sidebar or their children
      const isMapElement = target.closest('.mapboxgl-map') || 
                           target.closest('.mapboxgl-canvas-container') ||
                           target.closest('.mapboxgl-control-container');
      
      const isSidebarElement = target.closest('.sidebar') ||
                               target.closest('.sidebar-content') ||
                               target.closest('.port-details') ||
                               target.closest('.port-policy') ||
                               target.closest('.port-infrastructure') ||
                               target.closest('.port-operational') ||
                               target.closest('.port-additional') ||
                               target.closest('.ship-details') ||
                               target.closest('.map-search-results');
      
      // Check if the event is on the map popup
      const isPopupElement = target.closest('.map-popup') ||
                             target.closest('.map-popup-content') ||
                             target.closest('.map-popup-page');
      
      // Only prevent default for non-map/non-sidebar/non-popup elements and when there are multiple touch points
      if (!isMapElement && !isSidebarElement && !isPopupElement && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // Handle event during capture phase to ensure it's caught before browser default behavior
    document.addEventListener('touchstart', preventZoom, { passive: false, capture: true });
    document.addEventListener('touchmove', preventZoom, { passive: false, capture: true });
    
    // Cleanup function to restore original viewport settings
    return () => {
      if (viewportMeta && originalContent) {
        viewportMeta.setAttribute('content', originalContent);
      } else if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
      
      document.removeEventListener('touchstart', preventZoom, { capture: true });
      document.removeEventListener('touchmove', preventZoom, { capture: true });
    };
  }, []);

  // Prevent scrolling on entire page when map is active, but allow scrolling in sidebar
  useEffect(() => {
    // Add class to body to prevent scrolling
    document.body.classList.add('map-page-active');
    
    // Function to prevent default scroll behavior except for sidebar and map
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      
      // Allow scrolling in the sidebar and map
      const isMapElement = target.closest('.mapboxgl-map') || 
                           target.closest('.mapboxgl-canvas-container') ||
                           target.closest('.mapboxgl-control-container');
                           
      const isSidebarElement = target.closest('.sidebar') ||
                               target.closest('.sidebar-content') ||
                               target.closest('.port-details') ||
                               target.closest('.port-policy') ||
                               target.closest('.port-infrastructure') ||
                               target.closest('.port-operational') ||
                               target.closest('.port-additional') ||
                               target.closest('.ship-details') ||
                               target.closest('.map-search-results');
      
      // Allow scrolling in map popup
      const isPopupElement = target.closest('.map-popup') ||
                             target.closest('.map-popup-content') ||
                             target.closest('.map-popup-page');
      
      // Only prevent scrolling for non-map, non-sidebar, and non-popup elements
      if (!isMapElement && !isSidebarElement && !isPopupElement) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    };

    // Function to prevent touchmove events (mobile scroll) except for sidebar and map
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Allow scrolling in the sidebar and map
      const isMapElement = target.closest('.mapboxgl-map') || 
                           target.closest('.mapboxgl-canvas-container') ||
                           target.closest('.mapboxgl-control-container');
                           
      const isSidebarElement = target.closest('.sidebar') ||
                               target.closest('.sidebar-content') ||
                               target.closest('.port-details') ||
                               target.closest('.port-policy') ||
                               target.closest('.port-infrastructure') ||
                               target.closest('.port-operational') ||
                               target.closest('.port-additional') ||
                               target.closest('.ship-details') ||
                               target.closest('.map-search-results');
      
      // Allow scrolling in map popup
      const isPopupElement = target.closest('.map-popup') ||
                             target.closest('.map-popup-content') ||
                             target.closest('.map-popup-page');
      
      // Only prevent scrolling for non-map, non-sidebar, and non-popup elements
      if (!isMapElement && !isSidebarElement && !isPopupElement) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    };

    // Get all elements that need to prevent scrolling
    const body = document.body;
    const header = document.querySelector('header');
    
    // Add event listeners to prevent scrolling
    body.addEventListener('wheel', preventScroll, { passive: false });
    body.addEventListener('touchmove', preventTouchMove, { passive: false });
    
    // Also prevent scrolling in header
    if (header) {
      header.addEventListener('wheel', preventScroll, { passive: false });
      header.addEventListener('touchmove', preventTouchMove, { passive: false });
    }

    // Cleanup function to remove event listeners when component unmounts
    return () => {
      // Remove class from body
      document.body.classList.remove('map-page-active');
      
      body.removeEventListener('wheel', preventScroll);
      body.removeEventListener('touchmove', preventTouchMove);
      
      if (header) {
        header.removeEventListener('wheel', preventScroll);
        header.removeEventListener('touchmove', preventTouchMove);
      }
    };
  }, []);

  // Ensure page scrolls to top on component mount
  useEffect(() => {
    // Scroll to top when the component mounts
    window.scrollTo(0, 0);
  }, []);

  // Add ports to map when both style is loaded and ports data is available
  useEffect(() => {
    if (styleLoaded && ports.length > 0 && map.current) {
      console.log('Style loaded and ports available, adding ports to map');
      
      // Only proceed if ports haven't been added yet OR highlight state has changed
      const portsSource = map.current.getSource('ports');
      const isInitialAdd = !portsSource;
      
      if (isInitialAdd) {
        // First time adding ports
        addPortsToMap();
      } else {
        // Always add click handlers for ports, even if no highlight state changed
        // This ensures port clicks always work properly
        addPortsToMap();
      }
    }
  }, [styleLoaded, ports.length, addPortsToMap, highlightedPortId]);

  // Add ships to map when both style is loaded and ships data is available
  useEffect(() => {
    if (styleLoaded && ships.length > 0 && map.current) {
      console.log('Style loaded and ships available, adding ships to map');
      
      // Check if ships source already exists
      const shipsSource = map.current.getSource('ships-circle');
      const isInitialAdd = !shipsSource;
      
      // Either add ships for the first time, or only update when highlight state changes
      if (isInitialAdd) {
        // First time adding ships
        addShipsToMap();
        
        // Ensure port layer is above ship layers
        if (map.current.getLayer('ports-layer')) {
          // Move port layer to the top
          map.current.moveLayer('ports-layer');
          console.log('Moved ports layer to top');
        }
      } else if (highlightedShipId !== null) {
        // Ships already exist, check if highlight state needs updating
        const shipFeatures = map.current.querySourceFeatures('ships-circle');
        const hasHighlightChanged = shipFeatures.some(feature => {
          const shipId = feature.properties?.imo_number;
          const isHighlighted = feature.properties?.isHighlighted;
          const shouldBeHighlighted = highlightedShipId === shipId;
          return isHighlighted !== shouldBeHighlighted;
        });
        
        if (hasHighlightChanged) {
          addShipsToMap();
          
          // Ensure port layer is above ship layers
          if (map.current.getLayer('ports-layer')) {
            // Move port layer to the top
            map.current.moveLayer('ports-layer');
            console.log('Moved ports layer to top');
          }
        }
      }
    }
  }, [styleLoaded, ships.length, addShipsToMap, highlightedShipId]);

  // Handle sidebar close - when sidebar is closed, remove paths
  useEffect(() => {
    // When sidebar is closed and there's a current ship path, remove it
    if (!sidebarOpen && currentShipPathRef.current) {
      removeShipPath(currentShipPathRef.current);
    }
  }, [sidebarOpen, removeShipPath, currentShipPathRef]);

  // Close sidebar
  const closeSidebar = useCallback(() => {
    // Clear highlighted ship and port
    setHighlightedShipId(null);
    setHighlightedPortId(null);
    
    // First close the sidebar to ensure UI updates immediately
    setSidebarOpen(false);
    
    // Also close control panel and legend panel to ensure consistency
    setControlPanelOpen(false);
    setLegendOpen(false);
    
    // Then re-run the search with current search term to restore search results order
    if (searchBarRef.current && document.querySelector('.map-search-input')) {
      const searchInput = document.querySelector('.map-search-input') as HTMLInputElement;
      if (searchInput && searchInput.value.trim().length >= 2) {
        // Reset the search results immediately to prevent showing old order temporarily
        if (searchBarRef.current.clearSearchResultsOnly) {
          searchBarRef.current.clearSearchResultsOnly();
        }
        
        // Force search to run again with current value (without artificial delay)
        searchInput.focus();
        const event = new Event('focus', { 
          bubbles: true,
          cancelable: true 
        });
        searchInput.dispatchEvent(event);
      }
    }
  }, [searchBarRef, setControlPanelOpen, setLegendOpen, setHighlightedShipId, setHighlightedPortId]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Create or update heatmap
  const updateHeatmap = useCallback((type?: 'size' | 'scrubber', enabled?: boolean) => {
    if (!map.current || !styleLoaded || ships.length === 0) {
      return;
    }

    // Determine which heatmap to update and its state
    const heatmapType = type || (scrubberHeatmapEnabled ? 'scrubber' : 'size');
    const isEnabled = enabled !== undefined ? enabled : (heatmapType === 'scrubber' ? scrubberHeatmapEnabled : heatmapEnabled);

    try {
      // Define source and layer IDs based on heatmap type
      const heatmapSourceId = heatmapType === 'scrubber' ? 'scrubber-heatmap-source' : 'size-heatmap-source';
      const heatmapLayerId = heatmapType === 'scrubber' ? 'scrubber-heatmap-layer' : 'size-heatmap-layer';

      // Clear any existing heatmap layers first
      ['size-heatmap-layer', 'scrubber-heatmap-layer'].forEach(layerId => {
        if (map.current && map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });

      // Clear any existing heatmap sources
      ['size-heatmap-source', 'scrubber-heatmap-source'].forEach(sourceId => {
        if (map.current && map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      // If heatmap is enabled, create or update heatmap
      if (isEnabled) {
        // Prepare heatmap data based on type
        let heatmapData;
        
        if (heatmapType === 'scrubber') {
          // Only include scrubber vessels in the heatmap
          heatmapData = {
            type: 'FeatureCollection',
            features: ships
              .filter(ship => scrubberVessels[ship.imo_number]) // Only scrubber vessels
              .map(ship => {
                // Calculate scrubber discharge rate if not already calculated
                if (!ship.scrubberDischargeRate) {
                  const scrubberType = scrubberVessels[ship.imo_number]?.technology_type || 'unknown';
                  ship.scrubberDischargeRate = calculateScrubberDischargeRate(ship, scrubberType);
                }
                
                return {
                  type: 'Feature',
                  properties: {
                    // Use the calculated discharge rate for heatmap intensity
                    // This creates a heatmap based on theoretical pollution levels
                    intensity: ship.scrubberDischargeRate || 45 // Default to 45 kg/h if calculation fails
                  },
                  geometry: {
                    type: 'Point',
                    coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
                  }
                };
              })
          };
        } else {
          // Size-based heatmap (all vessels)
          heatmapData = {
            type: 'FeatureCollection',
            features: ships.map(ship => ({
              type: 'Feature',
              properties: {
                // Use max_draught as intensity, use default if not available
                intensity: (ship.max_draught || 5) * 2
              },
              geometry: {
                type: 'Point',
                coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
              }
            }))
          };
        }

        // Add new data source
        map.current.addSource(heatmapSourceId, {
          type: 'geojson',
          data: heatmapData as any
        });

        // Add heatmap layer with appropriate style
        map.current.addLayer({
          id: heatmapLayerId,
          type: 'heatmap',
          source: heatmapSourceId,
          paint: {
            // Modify heatmap weight to use logarithmic transformation
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              // Apply logarithmic transformation to intensity to handle large data ranges
              ['log10', ['+', 1, ['get', 'intensity']]],
              0, 0,
              1, 0.2, // log10(1+10) = 1, lower base weight
              2, 0.6, // log10(1+100) = 2, medium weight
              3, 1    // log10(1+1000) = 3, maximum weight
            ],
            // Dynamic heatmap intensity based on zoom level and data volume
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              5, 2,
              9, 3
            ],
            // Enhanced color gradient with more intermediate steps for better visualization
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0,0,0,0)',        // Transparent
              0.1, 'rgba(0,255,0,0.2)',  // Light green - very low
              0.2, 'rgba(0,255,0,0.3)',  // Light green - low
              0.3, 'rgba(0,255,0,0.5)',  // Medium green
              0.4, 'rgba(180,255,0,0.6)', // Lime green
              0.5, 'rgba(255,255,0,0.7)', // Yellow
              0.6, 'rgba(255,180,0,0.75)', // Light orange
              0.7, 'rgba(255,128,0,0.8)', // Orange
              0.8, 'rgba(255,64,0,0.85)', // Dark orange
              0.9, 'rgba(255,0,0,0.9)',  // Red
              0.95, 'rgba(204,0,0,0.95)', // Deep red
              1, 'rgba(153,0,0,1)'       // Darkest red - high
            ],
            // Adaptive radius based on zoom level
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 10, // Smaller base radius
              5, 25,
              9, 50  // Slightly reduced maximum radius
            ],
            // Slightly reduced opacity for better visualization with high data volume
            'heatmap-opacity': 0.75
          }
        });

        // Ensure proper layer ordering after adding heatmap
        if (map.current.getLayer('ports-layer')) {
          map.current.moveLayer('ports-layer'); // Move ports to top
        }

        console.log(`${heatmapType} heatmap updated with ship data`);
      } else {
        // If heatmap is disabled, remove heatmap layer and data source
        if (map.current.getLayer(heatmapLayerId)) {
          map.current.removeLayer(heatmapLayerId);
        }
        if (map.current.getSource(heatmapSourceId)) {
          map.current.removeSource(heatmapSourceId);
        }
        console.log('Heatmap removed');
      }
    } catch (error) {
      console.error('Error updating heatmap:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubberHeatmapEnabled, styleLoaded, ships, scrubberVessels]);

  // Listen for heatmap state changes
  useEffect(() => {
    if (styleLoaded && ships.length > 0 && map.current) {
      // Check if any heatmap source exists
      const scrubberHeatmapExists = map.current.getSource('scrubber-heatmap-source') !== undefined;
      
      // Update scrubber heatmap if needed
      if ((scrubberHeatmapEnabled && !scrubberHeatmapExists) || (!scrubberHeatmapEnabled && scrubberHeatmapExists)) {
        updateHeatmap('scrubber');
      }
    }
  }, [scrubberHeatmapEnabled, styleLoaded, ships, updateHeatmap]);

  // Handle scrubber heatmap toggle
  const handleScrubberHeatmapToggle = useCallback((enabled: boolean) => {
    setScrubberHeatmapEnabled(enabled);
    updateHeatmap('scrubber', enabled);
  }, [updateHeatmap]);

  // After the ships are fetched, fetch the scrubber vessel data
  const fetchScrubberVessels = useCallback(async () => {
    if (!shipsLoaded || ships.length === 0) return;
    
    try {
      setLoadingScrubberVessels(true);
      
      // Fetch scrubber vessels data
      const scrubberResponse = await fetch(API_ENDPOINTS.SCRUBBER_VESSELS);
      if (!scrubberResponse.ok) {
        throw new Error(`Failed to fetch scrubber vessels: ${scrubberResponse.status}`);
      }
      
      const scrubberData = await scrubberResponse.json();
      const scrubberMap: {[key: string]: {status: string; technology_type: string;}} = {};
      
      // Create a map of IMO number to scrubber data for easy lookup
      scrubberData.forEach((vessel: any) => {
        scrubberMap[vessel.imo_number] = {
          status: vessel.sox_scrubber_status || 'Unknown',
          technology_type: vessel.sox_scrubber_1_technology_type || 'Unknown'
        };
      });
      
      setScrubberVessels(scrubberMap);
      
      // Check engine data availability
      const engineResponse = await fetch(API_ENDPOINTS.ENGINE_DATA);
      if (!engineResponse.ok) {
        throw new Error(`Failed to fetch engine data: ${engineResponse.status}`);
      }
      
      const engineData = await engineResponse.json();
      const engineMap: {[key: string]: boolean} = {};
      
      // Create a map of IMO number to engine data availability
      engineData.forEach((vessel: any) => {
        engineMap[vessel.imo_number] = true;
      });
      
      setEngineDataAvailability(engineMap);
      setScrubberVesselsLoaded(true);
      
      // Update map to show scrubber vessels if needed
      if (trackScrubberVessels && map.current && styleLoaded) {
        updateMapFeatures();
      }
    } catch (error) {
      console.error('Error fetching past scrubber distribution data:', error);
    } finally {
      setLoadingScrubberVessels(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipsLoaded, ships, trackScrubberVessels, styleLoaded]);

  // Update map features to reflect scrubber vessels
  const updateMapFeatures = useCallback(() => {
    if (!map.current || !styleLoaded || !scrubberVesselsLoaded) return;
    
    // Force refresh ship layer data to update the display with scrubber vessel changes
    if (map.current.getSource('ships-circle')) {
      // Will be updated in the next rendering cycle
      setHighlightedShipId(highlightedShipId);
    }
  }, [styleLoaded, scrubberVesselsLoaded, highlightedShipId]);

  // Handle scrubber vessels toggle
  const handleScrubberVesselsToggle = useCallback((enabled: boolean) => {
    setTrackScrubberVessels(enabled);
    
    // Update map to show/hide scrubber vessel icons
    if (map.current && styleLoaded) {
      if (ships.length > 0) {
        updateMapFeatures();
      }
    }
  }, [map, styleLoaded, ships, updateMapFeatures]);

  // Toggle control panel visibility - always active regardless of loading or visualization state
  const handleSettingsClick = useCallback(() => {
    // Clear search results if available
    if (searchBarRef.current && searchBarRef.current.clearResults) {
      searchBarRef.current.clearResults();
    }
    
    // Clear any ship path and message
    if (currentShipPathRef.current) {
      removeShipPath(currentShipPathRef.current);
      clearMessage();
    }
    
    // If opening the control panel, ensure legend is closed
    if (!controlPanelOpen) {
      setLegendOpen(false);
    }
    
    setControlPanelOpen(prev => !prev);
  }, [searchBarRef, currentShipPathRef, removeShipPath, clearMessage, controlPanelOpen, setLegendOpen]);

  // Handle tutorial button click
  const handleTutorialClick = useCallback(() => {
    // Clear search results if available
    if (searchBarRef.current && searchBarRef.current.clearResults) {
      searchBarRef.current.clearResults();
    }
    
    // Clear any ship path and message
    if (currentShipPathRef.current) {
      removeShipPath(currentShipPathRef.current);
      clearMessage();
    }
    
    // Open tutorial page
    setShowPopup(true);
    
  }, [setShowPopup, searchBarRef, currentShipPathRef, removeShipPath, clearMessage]);

  // Handle sidebar open/close - control body scroll
  useEffect(() => {
    if (sidebarOpen) {
      // When the sidebar is open, add a class to the body to prevent scrolling
      document.body.classList.add('sidebar-open');
    } else {
      // When the sidebar is closed, remove the class from the body to allow scrolling
      document.body.classList.remove('sidebar-open');
    }
  }, [sidebarOpen]);

  // Fetch port content when a port is selected
  useEffect(() => {
    const fetchPortContent = async () => {
      if (!selectedPort) {
        setPortContent(null);
        return;
      }
      
      setPortContentLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.PORT_CONTENT(selectedPort.port_name, selectedPort.country));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Port content received:', data);
        setPortContent(data);
      } catch (error) {
        console.error('Error fetching port content:', error);
        setPortContent(null);
      } finally {
        setPortContentLoading(false);
      }
    };

    if (selectedPort && sidebarType === 'port' && sidebarOpen) {
      fetchPortContent();
    }
  }, [selectedPort, sidebarType, sidebarOpen]);

  // Check if the device is small screen (mobile)
  const isSmallScreen = useCallback(() => {
    return window.innerWidth <= 480;
  }, []);

  // Calculate if Back to North Sea button should be hidden on small screens
  // Hide button when control panel or legend is open on small screens
  const shouldHideBackButton = useMemo(() => {
    return isSmallScreen() && (controlPanelOpen || legendOpen);
  }, [isSmallScreen, controlPanelOpen, legendOpen]);

  // Handle search input focus - clear current ship path and selected ship
  const handleSearchInputFocus = useCallback(() => {
    // If there's a current ship path, remove it
    if (currentShipPathRef.current) {
      removeShipPath(currentShipPathRef.current);
      clearMessage();
    }
    
    // Clear selected ship/port and close sidebar if open
    if (sidebarOpen) {
      closeSidebar();
    }
    
    // Clear highlighted ship and port
    setHighlightedShipId(null);
    setHighlightedPortId(null);
    
    // Close settings panel and legend
    setControlPanelOpen(false);
    setLegendOpen(false);
    
  }, [closeSidebar, currentShipPathRef, removeShipPath, sidebarOpen, clearMessage, setControlPanelOpen, setLegendOpen]);

  // Update highlighted states when they change
  useEffect(() => {
    if (!map.current || !styleLoaded) return;

    // Update port highlights
    if (map.current.getSource('ports')) {
      (map.current.getSource('ports') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: ports.map(port => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [port.longitude, port.latitude]
          },
          properties: {
            port_name: port.port_name,
            country: port.country,
            icon: 'ports32',
            portId: `${port.port_name}-${port.country}`,
            isHighlighted: highlightedPortId === `${port.port_name}-${port.country}`,
            scrubber_status: port.scrubber_status
          }
        }))
      });
    }

    // Update ship highlights (circle)
    if (map.current.getSource('ships-circle')) {
      (map.current.getSource('ships-circle') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: ships.map(ship => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
          },
          properties: {
            imo_number: ship.imo_number,
            name: ship.name,
            ship_type: ship.ship_type,
            color: getShipColor(ship.ship_type),
            borderColor: getShipBorderColor(ship.ship_type),
            category: getShipCategory(ship.ship_type),
            isHighlighted: highlightedShipId === ship.imo_number,
            // Add scrubber properties with default false to prevent showing as scrubber before data loads
            isScrubber: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
            scrubberType: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
              (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
              scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
          }
        }))
      });
    }

    // Update ship highlights (detailed)
    if (map.current.getSource('ships-detailed')) {
      // Prepare detailed ship shapes
      const shipShapeFeatures = ships.map(ship => {
        const { longitude, latitude } = ship.latest_position;
        const length = ship.length || 50; // Default length, if no data
        const width = ship.width || 10;   // Default width, if no data
        
        // Increase size for highlighted ships
        const isHighlighted = ship.imo_number === highlightedShipId;
        const sizeFactor = isHighlighted ? 1.3 : 1;
        const lengthInDegrees = (length * sizeFactor) / 111000; // Rough conversion from meters to degrees
        const widthInDegrees = (width * sizeFactor) / 111000;   // Rough conversion from meters to degrees
        
        // Create rectangle's four corners
        const rectangle = [
          [longitude - lengthInDegrees/2, latitude - widthInDegrees/2],
          [longitude + lengthInDegrees/2, latitude - widthInDegrees/2],
          [longitude + lengthInDegrees/2, latitude + widthInDegrees/2],
          [longitude - lengthInDegrees/2, latitude + widthInDegrees/2],
          [longitude - lengthInDegrees/2, latitude - widthInDegrees/2] // Closed polygon
        ];
        
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [rectangle]
          },
          properties: {
            imo_number: ship.imo_number,
            name: ship.name,
            ship_type: ship.ship_type,
            color: getShipColor(ship.ship_type),
            borderColor: getShipBorderColor(ship.ship_type),
            category: getShipCategory(ship.ship_type),
            isHighlighted: isHighlighted,
            // Add scrubber properties with default false to prevent showing as scrubber before data loads
            isScrubber: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number],
            scrubberType: scrubberVesselsLoaded && !!scrubberVessels[ship.imo_number] ? 
              (scrubberVessels[ship.imo_number]?.technology_type.toLowerCase() === 'tbc' ? 'scrubber' : 
              scrubberVessels[ship.imo_number]?.technology_type.toLowerCase()) : null
          }
        };
      });

      (map.current.getSource('ships-detailed') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: shipShapeFeatures
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPortId, highlightedShipId, styleLoaded, ports, ships]);

  // Handle map control clicks to clear search box and results
  useEffect(() => {
    const handleMapControlClick = (event: MouseEvent) => {
      // Skip if map is not initialized or loaded yet
      if (!map.current || !mapLoaded) return;
      
      // Check if the click is on a mapbox control
      const target = event.target as HTMLElement;
      const isMapControl = target.closest('.mapboxgl-control-container') || 
                           target.closest('.mapboxgl-ctrl-icon') ||
                           target.closest('.mapboxgl-ctrl-group') ||
                           target.closest('.mapboxgl-ctrl');
      
      if (isMapControl) {
        // Clear search results when clicking on map controls
        if (searchBarRef.current && searchBarRef.current.clearResults) {
          searchBarRef.current.clearResults();
        }
      }
    };

    // Add event listener for map control clicks
    document.addEventListener('click', handleMapControlClick);
    
    // Cleanup function
    return () => {
      document.removeEventListener('click', handleMapControlClick);
    };
  }, [searchBarRef, mapLoaded]);

  // Effect to trigger scrubber vessel loading after ships are loaded
  useEffect(() => {
    if (shipsLoaded && ships.length > 0 && !scrubberVesselsLoaded && !loadingScrubberVessels) {
      fetchScrubberVessels();
    }
  }, [shipsLoaded, ships, scrubberVesselsLoaded, loadingScrubberVessels, fetchScrubberVessels]);

  // Function to check if a ship is a scrubber vessel
  const isScrubberVessel = useCallback((imoNumber: string) => {
    return !!scrubberVessels[imoNumber];
  }, [scrubberVessels]);

  // Update ship layers based on isScrubberVessel and showOnlyScrubberVessels
  useEffect(() => {
    if (!map.current || !styleLoaded || !scrubberVesselsLoaded || ships.length === 0) return;

    // Update ship circles with scrubber vessel information
    if (map.current.getSource('ships-circle')) {
      (map.current.getSource('ships-circle') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: ships.map(ship => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [ship.latest_position.longitude, ship.latest_position.latitude]
          },
          properties: {
            imo_number: ship.imo_number,
            name: ship.name,
            ship_type: ship.ship_type,
            color: getShipColor(ship.ship_type),
            borderColor: getShipBorderColor(ship.ship_type),
            category: getShipCategory(ship.ship_type),
            isHighlighted: highlightedShipId === ship.imo_number,
            isScrubber: isScrubberVessel(ship.imo_number),
            scrubberType: isScrubberVessel(ship.imo_number) ? scrubberVessels[ship.imo_number].technology_type.toLowerCase() : null
          }
        }))
      });

      // Update ship circle layer to make scrubber vessels larger and apply filters
      try {
        if (map.current && map.current.getLayer('ships-layer-circle')) {
          // Update circle size
          map.current.setPaintProperty('ships-layer-circle', 'circle-radius', [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, [
              'case',
              ['==', ['get', 'isHighlighted'], true], [
                'case',
                ['all', ['==', ['get', 'isScrubber'], true], trackScrubberVessels], 10,
                6 // Half size for highlighted regular ships
              ],
              ['all', ['==', ['get', 'isScrubber'], true], trackScrubberVessels], 8,
              4 // Regular ships
            ],
            10, [
              'case',
              ['==', ['get', 'isHighlighted'], true], [
                'case',
                ['all', ['==', ['get', 'isScrubber'], true], trackScrubberVessels], 14,
                10 // Half size for highlighted regular ships
              ],
              ['all', ['==', ['get', 'isScrubber'], true], trackScrubberVessels], 12,
              8 // Regular ships
            ],
            14, [
              'case',
              ['==', ['get', 'isHighlighted'], true], [
                'case',
                ['all', ['==', ['get', 'isScrubber'], true], trackScrubberVessels], 18,
                12 // Half size for highlighted regular ships
              ],
              ['all', ['==', ['get', 'isScrubber'], true], trackScrubberVessels], 16,
              10 // Regular ships
            ]
          ]);
          
          // Apply filter based on showOnlyScrubberVessels setting
          if (showOnlyScrubberVessels) {
            // Only show scrubber vessels
            map.current.setFilter('ships-layer-circle', ['==', ['get', 'isScrubber'], true]);
          } else {
            // Show all vessels (no filter)
            map.current.setFilter('ships-layer-circle', null);
          }
        }
        
        // Also update detailed ship layers filters
        if (map.current.getLayer('ships-layer-detailed-shapes')) {
          if (showOnlyScrubberVessels) {
            map.current.setFilter('ships-layer-detailed-shapes', ['==', ['get', 'isScrubber'], true]);
          } else {
            map.current.setFilter('ships-layer-detailed-shapes', ['>=', ['zoom'], ZOOM_THRESHOLD_MIN]);
          }
        }
        
        if (map.current.getLayer('ships-layer-detailed-outlines')) {
          if (showOnlyScrubberVessels) {
            map.current.setFilter('ships-layer-detailed-outlines', ['==', ['get', 'isScrubber'], true]);
          } else {
            map.current.setFilter('ships-layer-detailed-outlines', ['>=', ['zoom'], ZOOM_THRESHOLD_MIN]);
          }
        }
      } catch (error) {
        console.error('Error updating ship layers:', error);
      }
    }

    // Add pollution icon for scrubber vessels when tracking is enabled
    if (trackScrubberVessels && map.current) {
      try {
        // Add a special layer for scrubber vessel icons if it doesn't exist
        const scrubberIconLayerId = 'scrubber-icon-layer';
        
        // Check if the source exists before proceeding
        if (!map.current.getSource('ships-circle')) {
          console.warn('Ships circle source not found, cannot add scrubber layer');
          return;
        }
        
        if (!map.current.getLayer(scrubberIconLayerId)) {
          // Check if the icon layer doesn't exist but the image is already loaded
          // This prevents "An image with this name already exist" errors on map refresh
          if (map.current.hasImage('warning_yellow_outline_yellow_scrubbers')) {
            // Image already loaded during initialization, just add the layer
            try {
              map.current.addLayer({
                id: scrubberIconLayerId,
                type: 'symbol',
                source: 'ships-circle',
                layout: {
                  'icon-image': 'warning_yellow_outline_yellow_scrubbers',
                  'icon-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6, ['case', ['==', ['get', 'isHighlighted'], true], 0.35, 0.30],
                    10, ['case', ['==', ['get', 'isHighlighted'], true], 0.40, 0.35],
                    14, ['case', ['==', ['get', 'isHighlighted'], true], 0.45, 0.40]
                  ],
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true
                },
                filter: ['all', 
                  ['==', ['get', 'isScrubber'], true],
                  ['==', ['literal', true], true]
                ]
              });
              
              // Set layer order immediately after adding
              // Ensure scrubber icon layer is above ship layers but below port layer
              if (map.current.getLayer('ships-layer-detailed-outlines')) {
                map.current.moveLayer(scrubberIconLayerId, 'ships-layer-detailed-outlines');
              }
              
              // Ensure ports layer is above the scrubber icon layer
              if (map.current.getLayer('ports-layer')) {
                map.current.moveLayer('ports-layer');  // Move to top
              }
              
              console.log('Added scrubber icon layer using existing image');
            } catch (error) {
              console.error('Error adding scrubber icon layer with existing image:', error);
            }
          } else {
            // Image not loaded yet, load it and then add the layer
            try {
              // Import scrubber warning icon
              import('../../../assets/images/warning_yellow_outline_yellow_scrubbers.svg').then(scrubberIcon => {
                if (map.current) {
                  const img = new Image();
                  img.onload = () => {
                    if (map.current) {
                      try {
                        // Add the icon image to the map - first check if it already exists
                        if (!map.current.hasImage('warning_yellow_outline_yellow_scrubbers')) {
                          map.current.addImage('warning_yellow_outline_yellow_scrubbers', img);
                          console.log('warning_yellow_outline_yellow_scrubbers image added successfully');
                        } else {
                          console.log('warning_yellow_outline_yellow_scrubbers image already exists, skipping add');
                        }
                        
                        // Add symbol layer for scrubber vessels if it doesn't already exist
                        if (!map.current.getLayer(scrubberIconLayerId)) {
                          map.current.addLayer({
                            id: scrubberIconLayerId,
                            type: 'symbol',
                            source: 'ships-circle',
                            layout: {
                              'icon-image': 'warning_yellow_outline_yellow_scrubbers',
                              'icon-size': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                6, ['case', ['==', ['get', 'isHighlighted'], true], 0.35, 0.30],
                                10, ['case', ['==', ['get', 'isHighlighted'], true], 0.40, 0.35],
                                14, ['case', ['==', ['get', 'isHighlighted'], true], 0.45, 0.40]
                              ],
                              'icon-allow-overlap': true,
                              'icon-ignore-placement': true
                            },
                            filter: ['all', 
                              ['==', ['get', 'isScrubber'], true],
                              ['==', ['literal', true], true]
                            ]
                          });
                          
                          // Set layer order after ensuring all layers exist
                          setTimeout(() => {
                            if (map.current) {
                              try {
                                // Ensure scrubber icon layer is above ship layers but below port layer
                                if (map.current.getLayer(scrubberIconLayerId)) {
                                  try {
                                    // First, move the scrubber icon layer above ship layers
                                    if (map.current.getLayer('ships-layer-detailed-outlines')) {
                                      map.current.moveLayer(scrubberIconLayerId, 'ships-layer-detailed-outlines');
                                    }
                                    
                                    // Then, ensure ports layer is above the scrubber icon layer
                                    if (map.current.getLayer('ports-layer')) {
                                      // In mapboxgl, the second parameter is the layer ID that the moved layer should be directly above
                                      map.current.moveLayer('ports-layer');  // Move to top first
                                    }
                                  } catch (err) {
                                    console.warn('Error reordering map layers:', err);
                                  }
                                }
                              } catch (error) {
                                console.error('Error setting layer order:', error);
                              }
                            }
                          }, 100); // Small delay to ensure layer is added
                        }
                      } catch (error) {
                        console.error('Error adding scrubber icon layer:', error);
                      }
                    }
                  };
                  // Add error handling for image loading
                  img.onerror = () => {
                    console.error('Failed to load warning_yellow_outline_yellow_scrubbers image');
                  };
                  img.src = scrubberIcon.default;
                }
              }).catch(error => {
                console.error('Error loading scrubber icon:', error);
              });
            } catch (error) {
              console.error('Error importing scrubber icon:', error);
            }
          }
        } else {
          try {
            // Update the filter to respect the trackScrubberVessels setting
            map.current.setFilter(scrubberIconLayerId, [
              'all', 
              ['==', ['get', 'isScrubber'], true],
              ['==', ['literal', true], true]
            ]);
            
            // Ensure the layer order is correct after filter update
            setTimeout(() => {
              if (map.current) {
                // Ensure the layer order is correct (above ships, below ports)
                // Only move layers if they exist to avoid errors
                if (map.current.getLayer(scrubberIconLayerId)) {
                  try {
                    // First, move the scrubber icon layer above ship layers
                    if (map.current.getLayer('ships-layer-detailed-outlines')) {
                      map.current.moveLayer(scrubberIconLayerId, 'ships-layer-detailed-outlines');
                    }
                    
                    // Then, ensure ports layer is above the scrubber icon layer
                    if (map.current.getLayer('ports-layer')) {
                      // Move ports layer to the top
                      map.current.moveLayer('ports-layer');  // Move to top
                    }
                  } catch (err) {
                    console.warn('Error reordering map layers:', err);
                  }
                }
              }
            }, 100);
          } catch (error) {
            console.error('Error updating scrubber icon layer filter:', error);
          }
        }
      } catch (mainError) {
        console.error('Error in scrubber vessel tracking logic:', mainError);
      }
    } else {
      // If tracking is disabled, remove the icon layer if it exists
      try {
        const scrubberIconLayerId = 'scrubber-icon-layer';
        if (map.current && map.current.getLayer(scrubberIconLayerId)) {
          map.current.removeLayer(scrubberIconLayerId);
        }
      } catch (error) {
        console.error('Error removing scrubber icon layer:', error);
      }
    }
  }, [styleLoaded, scrubberVesselsLoaded, ships, highlightedShipId, isScrubberVessel, trackScrubberVessels, scrubberVessels, showOnlyScrubberVessels]);

  // Add flyToLocation function to the MapPage component  
  // Helper function to fly to a location
  const flyToLocation = useCallback((lng: number, lat: number) => {
    if (!map.current) return;
  
    // Lock map interactions during animation
    setIsMapAnimating(true);
    
    // Disable map interactions during animation
    map.current.dragPan.disable();
    map.current.scrollZoom.disable();
    map.current.doubleClickZoom.disable();
    map.current.touchZoomRotate.disable();
    
    // Get current zoom level
    const currentZoom = map.current.getZoom();
    
    // Fly to location while maintaining zoom level
    map.current.flyTo({
      center: [lng, lat],
      zoom: currentZoom, // Maintain current zoom
      duration: 800, // Animation duration
      essential: true // Make animation essential
    });
    
    // Re-enable map interactions after animation completes
    setTimeout(() => {
      if (map.current) {
        map.current.dragPan.enable();
        map.current.scrollZoom.enable();
        map.current.doubleClickZoom.enable();
        map.current.touchZoomRotate.enable();
        setIsMapAnimating(false);
      }
    }, 900); // Slightly longer than animation to ensure completion
  }, [map]);

  // Handle Past Scrubber Distribution value change
  const handlePastScrubberValueChange = useCallback((value: number) => {
    setPastScrubberValue(value);
    // Additional logic for applying the value can be added here
  }, []);
  
  // Handle Past Scrubber Distribution time unit change
  const handlePastScrubberTimeUnitChange = useCallback((unit: string) => {
    setPastScrubberTimeUnit(unit);
    // Additional logic for applying the time unit can be added here
  }, []);
  
  // Helper function to restore map state after stopping visualization
  const restoreMapState = useCallback(() => {
    // Restore ship layers
    if (map.current) {
      // Show regular ship markers
      if (map.current.getLayer('ships-layer-circle')) {
        map.current.setLayoutProperty('ships-layer-circle', 'visibility', 'visible');
      }
      if (map.current.getLayer('scrubber-icon-layer') && trackScrubberVessels) {
        map.current.setLayoutProperty('scrubber-icon-layer', 'visibility', 'visible');
      }
      if (map.current.getLayer('ships-layer-detailed')) {
        map.current.setLayoutProperty('ships-layer-detailed', 'visibility', 'visible');
      }
      if (map.current.getLayer('ships-layer-detailed-outlines')) {
        map.current.setLayoutProperty('ships-layer-detailed-outlines', 'visibility', 'visible');
      }
      
      // Restore heatmaps if they were enabled
      if (map.current.getLayer('size-heatmap-layer') && heatmapEnabled) {
        map.current.setLayoutProperty('size-heatmap-layer', 'visibility', 'visible');
      }
      if (map.current.getLayer('scrubber-heatmap-layer') && scrubberHeatmapEnabled) {
        map.current.setLayoutProperty('scrubber-heatmap-layer', 'visibility', 'visible');
      }
    }
    
    // Restore UI elements
    // Show search bar if it's defined in component state
    setShowSearchBar(true);
  }, [map, trackScrubberVessels, heatmapEnabled, scrubberHeatmapEnabled]);
  
  // Handle view past scrubber distribution button click
  const handleViewPastScrubberDistribution = useCallback(() => {
    // Ensure pastScrubberValue is a valid number before proceeding
    const numValue = typeof pastScrubberValue === 'string' 
      ? parseInt(pastScrubberValue, 10) 
      : pastScrubberValue;
      
    if (isNaN(numValue) || numValue <= 0) {
      alert("Please enter a positive integer value before viewing data");
      return;
    }
    
    console.log("View confirmed with value:", numValue, pastScrubberTimeUnit);
    
    // Clear any existing messages to prevent overlap
    clearMessage();
    
    // Set loading state immediately to disable UI elements
    setIsLoading(true);
    
    // Close settings panel immediately
    setControlPanelOpen(false);
    
    // Disable other heatmap options
    if (heatmapEnabled) {
      setHeatmapEnabled(false);
    }
    if (scrubberHeatmapEnabled) {
      setScrubberHeatmapEnabled(false);
    }
    
    // Hide all other ships on the map before showing scrubber distribution
    if (map.current) {
      // Hide regular ship markers
      if (map.current.getLayer('ships-layer-circle')) {
        map.current.setLayoutProperty('ships-layer-circle', 'visibility', 'none');
      }
      if (map.current.getLayer('scrubber-icon-layer')) {
        map.current.setLayoutProperty('scrubber-icon-layer', 'visibility', 'none');
      }
      if (map.current.getLayer('ships-layer-detailed')) {
        map.current.setLayoutProperty('ships-layer-detailed', 'visibility', 'none');
      }
      if (map.current.getLayer('ships-layer-detailed-outlines')) {
        map.current.setLayoutProperty('ships-layer-detailed-outlines', 'visibility', 'none');
      }
      
      // Hide ship paths if visible
      if (map.current.getLayer('ship-path')) {
        map.current.setLayoutProperty('ship-path', 'visibility', 'none');
      }
      
      // Hide other heatmap layers
      if (map.current.getLayer('size-heatmap-layer')) {
        map.current.setLayoutProperty('size-heatmap-layer', 'visibility', 'none');
      }
      if (map.current.getLayer('scrubber-heatmap-layer')) {
        map.current.setLayoutProperty('scrubber-heatmap-layer', 'visibility', 'none');
      }
    }
    
    // Hide UI elements
    // Close search bar if it's defined in component state
    setShowSearchBar(false);
    
    // Close legend panel
    setLegendOpen(false);
    
    // Close any open sidebar
    setSidebarOpen(false);
    
    // Reset to North Sea view (without re-enabling map interactions)
    if (map.current) {
      const isMobile = window.innerWidth <= 520;
      const targetZoom = isMobile ? 4 : defaultZoom;
      
      // Use flyTo to animate to default center view
      map.current.flyTo({
        center: defaultCenter,
        zoom: targetZoom,
        duration: 2000,
        essential: true // Animation will not be interrupted by user input
      });
    }
    
    // Setup abort controller for fetch request
    const abortController = new AbortController();
    currentFetchRef.current = abortController;
    
    // Call the past scrubber distribution API with the validated number value
    const currentTime = new Date().toISOString();
    
    fetch(`${API_ENDPOINTS.PAST_SCRUBBER_DISTRIBUTION}?time_value=${numValue}&time_unit=${pastScrubberTimeUnit}&user_current_time=${currentTime}`, {
      signal: abortController.signal
    })
      .then(response => {
        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("text/html")) {
            throw new Error(`Server error: Received HTML instead of JSON (status ${response.status})`);
          }
          throw new Error(`API request failed with status ${response.status}`);
        }
        return response.json().catch(error => {
          // Handle JSON parsing errors
          console.error("Error parsing JSON response:", error);
          throw new Error("Invalid response format from server. Please try again later.");
        });
      })
      .then(data => {
        console.log("Received past scrubber distribution data:", data);
        if (data && data.time_groups) {
          if (data.query_params) {
            setPastScrubberQueryParams(data.query_params);
          }
          
          if (data.time_groups.length > 0) {
            setPastScrubberData(data.time_groups);
            
            // Show success message
            addMessage({
              text: `Loaded ${data.time_groups.length} past scrubber distribution data`,
              type: MessageType.SUCCESS,
              timeout: 3000 // Use 3 second timeout
            });
            
            setPastScrubberVisualizationEnabled(true);
          } else {
            setPastScrubberData([]);
            
            // Show no data message
            addMessage({
              text: "No past scrubber distribution data found for the selected time period",
              type: MessageType.INFO,
              timeout: 3000 // Use 3 second timeout
            });
            
            if (map.current) {
              map.current.dragPan.enable();
              map.current.scrollZoom.enable();
              map.current.doubleClickZoom.enable();
              map.current.touchZoomRotate.enable();
            }
            
            restoreMapState();
          }
        } else {
          // No time_groups field in response
          addMessage({
            text: "No past scrubber distribution data found for the selected time period",
            type: MessageType.INFO,
            timeout: 3000 // Use 3 second timeout
          });
          
          // Re-enable map interactions if no data to visualize
          if (map.current) {
            map.current.dragPan.enable();
            map.current.scrollZoom.enable();
            map.current.doubleClickZoom.enable();
            map.current.touchZoomRotate.enable();
          }
          
          restoreMapState();
        }
        
        // Clear the ref after successful completion
        currentFetchRef.current = null;
      })
      .catch(error => {
        // Only show error if not aborted
        if (error.name !== 'AbortError') {
          console.error("Error fetching past scrubber distribution:", error);
          addMessage({
            text: `Error loading scrubber data: ${error.message}`,
            type: MessageType.ERROR,
            timeout: 3000 // Use 3 second timeout
          });
        }
        
        // Re-enable map interactions
        if (map.current) {
          map.current.dragPan.enable();
          map.current.scrollZoom.enable();
          map.current.doubleClickZoom.enable();
          map.current.touchZoomRotate.enable();
        }
        
        // Show UI elements again
        restoreMapState();
        
        // Clear the ref
        currentFetchRef.current = null;
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [defaultCenter, defaultZoom, pastScrubberValue, pastScrubberTimeUnit, addMessage, clearMessage, map, setShowSearchBar, setLegendOpen, setSidebarOpen, setControlPanelOpen, restoreMapState, scrubberHeatmapEnabled, setScrubberHeatmapEnabled, heatmapEnabled]);
  
  // Handle cancel loading button click - Now with actual cancellation
  const handleCancelLoading = useCallback(() => {
    console.log("Canceling data loading");
    
    // Abort the fetch request if it exists
    if (currentFetchRef.current) {
      currentFetchRef.current.abort();
      currentFetchRef.current = null;
    }
    
    setIsLoading(false);
    
    // Display canceled message
    addMessage({
      text: "Past scrubber distribution data loading canceled",
      type: MessageType.INFO,
      timeout: 3000 // Use 3 second timeout
    });
    
    // Re-enable map interactions
    if (map.current) {
      map.current.dragPan.enable();
      map.current.scrollZoom.enable();
      map.current.doubleClickZoom.enable();
      map.current.touchZoomRotate.enable();
    }
    
    // Restore map state to show ships and UI elements
    restoreMapState();
  }, [addMessage, restoreMapState]);

  // Effect to handle Escape key to cancel loading (desktop only)
  useEffect(() => {
    // Only set up listener when loading is in progress
    if (!isLoading) return;
    
    // Handler for keydown events
    const handleEscKey = (e: KeyboardEvent) => {
      // Check if Escape key was pressed during loading
      if (e.key === 'Escape' || e.key === 'Esc') {
        // Cancel loading when Escape is pressed
        handleCancelLoading();
      }
    };
    
    // Add global event listener
    window.addEventListener('keydown', handleEscKey);
    
    // Cleanup function to remove event listener
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isLoading, handleCancelLoading]);

  // Handle stop past scrubber visualization button click
  const handleStopPastScrubberVisualization = useCallback(() => {
    console.log("Stopping past scrubber visualization");
    setPastScrubberVisualizationEnabled(false);
    setPastScrubberQueryParams(null);
    
    // Display stopped message instead of clearing message
    addMessage({
      text: "Past scrubber distribution visualization stopped",
      type: MessageType.INFO,
      timeout: 3000 // Use 3 second timeout
    });
    
    // Remove past scrubber heatmap layer if it exists
    if (map.current) {
      if (map.current.getLayer('past-scrubber-heatmap')) {
        map.current.removeLayer('past-scrubber-heatmap');
      }
      if (map.current.getSource('past-scrubber-data')) {
        map.current.removeSource('past-scrubber-data');
      }
    }
    
    // Re-enable map interactions
    if (map.current) {
      map.current.dragPan.enable();
      map.current.scrollZoom.enable();
      map.current.doubleClickZoom.enable();
      map.current.touchZoomRotate.enable();
    }
    
    // Restore map state to show ships and UI elements
    restoreMapState();
  }, [addMessage, restoreMapState]);

  // Toggle control panel visibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleControlPanel = useCallback(() => {
    setControlPanelOpen(prev => !prev);
  }, []);

  // Effect to show past scrubber distribution when data is loaded and visualization is enabled
  useEffect(() => {
    if (!map.current || !styleLoaded || !pastScrubberVisualizationEnabled || pastScrubberData.length === 0) {
      return;
    }
    
    console.log("Visualizing past scrubber distribution with data:", pastScrubberData);
    
    const hasPositionData = pastScrubberData.some(group => 
      group.positions && Array.isArray(group.positions) && group.positions.length > 0
    );
    
    if (!hasPositionData) {
      console.warn("No position data found in any time group");
      addMessage({
        text: "No position data found for the selected time period",
        type: MessageType.INFO
      });
      setPastScrubberVisualizationEnabled(false);
      return;
    }
    
    // Add source for past scrubber data if not exists
    if (!map.current.getSource('past-scrubber-data')) {
      map.current.addSource('past-scrubber-data', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }
    
    // Add heatmap layer if not exists
    if (!map.current.getLayer('past-scrubber-heatmap')) {
      // Determine time granularity scale factor for heatmap parameters
      const timeUnit = pastScrubberQueryParams?.actual_unit?.toLowerCase() || 'hour';
      console.log(`Applying heatmap settings for time unit: ${timeUnit}`);
      
      // Calculate scale factors based on time granularity
      let intensityScaleFactor = 1.0;
      let radiusScaleFactor = 1.0;
      let weightValue = 1.0;
      
      // Adjust scale factors based on time unit
      if (timeUnit === 'day') {
        // For day level data - medium data volume adjustment
        intensityScaleFactor = 0.7;  // Reduce intensity by 30%
        radiusScaleFactor = 0.9;     // Slightly reduce radius
        weightValue = 0.7;           // Reduce weight to prevent overplotting
      } else if (timeUnit === 'month' || timeUnit === 'year') {
        // For month/year level data - heavy data volume adjustment
        intensityScaleFactor = 0.5;  // Significantly reduce intensity
        radiusScaleFactor = 0.8;     // Reduce radius more
        weightValue = 0.4;           // Greatly reduce weight to prevent overplotting
      } else {
        // For hour level data - low data volume adjustment
        intensityScaleFactor = 1.2;  // Slightly increase intensity to highlight patterns
        radiusScaleFactor = 1.1;     // Slightly increase radius
        weightValue = 1.3;           // Increase weight to emphasize sparse data
      }
      
      map.current.addLayer({
        id: 'past-scrubber-heatmap',
        type: 'heatmap',
        source: 'past-scrubber-data',
        paint: {
          // Use dynamic weight based on time granularity
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            // Apply logarithmic transformation to count
            ['log10', ['+', 1, ['get', 'count']]],
            0, 0,
            0.5, weightValue * 0.3, // Low count (log10(1+3) ≈ 0.5)
            1, weightValue * 0.7,   // Medium count (log10(1+10) = 1)
            2, weightValue,         // High count (log10(1+100) = 2)
            3, weightValue          // Very high count (log10(1+1000) = 3)
          ],
          // Scale intensity based on time granularity and zoom level
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1 * intensityScaleFactor,
            5, 2 * intensityScaleFactor,
            9, 3 * intensityScaleFactor
          ],
          
          // Enhanced color gradient with more intermediate steps
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',        // Transparent
            0.1, 'rgba(0,255,0,0.2)',  // Light green - very low
            0.2, 'rgba(0,255,0,0.3)',  // Light green - low
            0.3, 'rgba(0,255,0,0.5)',  // Medium green
            0.4, 'rgba(180,255,0,0.6)', // Lime green
            0.5, 'rgba(255,255,0,0.7)', // Yellow
            0.6, 'rgba(255,180,0,0.75)', // Light orange
            0.7, 'rgba(255,128,0,0.8)', // Orange
            0.8, 'rgba(255,64,0,0.85)', // Dark orange
            0.9, 'rgba(255,0,0,0.9)',  // Red
            0.95, 'rgba(204,0,0,0.95)', // Deep red
            1, 'rgba(153,0,0,1)'       // Darkest red - high
          ],
          
          // Scale radius based on time granularity and zoom level
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 10 * radiusScaleFactor, // Smaller base radius
            5, 25 * radiusScaleFactor,
            9, 50 * radiusScaleFactor  // Slightly reduced maximum radius
          ],
          
          // Slightly reduced opacity
          'heatmap-opacity': 0.75
        }
      });
      
      console.log(`Applied past scrubber heatmap with time unit: ${timeUnit}, intensity scale: ${intensityScaleFactor}, radius scale: ${radiusScaleFactor}, weight: ${weightValue}`);
    }
    
    // Show the first time group immediately
    updateTimeGroup(0);
    
    // Clean up when component unmounts or visualization is disabled
    return () => {
      if (map.current) {
        // Remove the layer and source when cleaning up
        if (map.current.getLayer('past-scrubber-heatmap')) {
          map.current.removeLayer('past-scrubber-heatmap');
        }
        if (map.current.getSource('past-scrubber-data')) {
          map.current.removeSource('past-scrubber-data');
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleLoaded, pastScrubberData, pastScrubberVisualizationEnabled, addMessage, pastScrubberQueryParams]);
  
  // Function to update the displayed time group
  const updateTimeGroup = useCallback((timeGroupIndex: number) => {
    if (!map.current || !pastScrubberData.length || timeGroupIndex >= pastScrubberData.length) {
      return;
    }
    
    const timeGroup = pastScrubberData[timeGroupIndex];
    // Validate timeGroup structure to avoid runtime errors
    if (!timeGroup || !timeGroup.positions || !Array.isArray(timeGroup.positions)) {
      console.warn(`Invalid time group data at index ${timeGroupIndex}`);
      return;
    }
    
    // Determine the time unit for density calculations
    const timeUnit = pastScrubberQueryParams?.actual_unit?.toLowerCase() || 'hour';
    
    // Create a grid-based density map to identify clusters of vessels
    const gridSize = 0.05; // Grid size in degrees (approximately 5km at equator)
    const gridCells: {[key: string]: number} = {};
    
    // Count vessels in each grid cell
    timeGroup.positions.forEach((position: any) => {
      // Create grid key based on rounded coordinates
      const gridX = Math.floor(position.longitude / gridSize) * gridSize;
      const gridY = Math.floor(position.latitude / gridSize) * gridSize;
      const gridKey = `${gridX},${gridY}`;
      
      // Increment counter for this cell
      if (!gridCells[gridKey]) {
        gridCells[gridKey] = 1;
      } else {
        gridCells[gridKey]++;
      }
    });
    
    // Generate features with density information
    const features = timeGroup.positions.map((position: any) => {
      // Get the grid cell this position belongs to
      const gridX = Math.floor(position.longitude / gridSize) * gridSize;
      const gridY = Math.floor(position.latitude / gridSize) * gridSize;
      const gridKey = `${gridX},${gridY}`;
      
      // Get count from the grid cell
      const count = gridCells[gridKey] || 1;
      
      // Apply time unit specific scaling factor to count
      let countScaleFactor = 1.0;
      if (timeUnit === 'day') {
        countScaleFactor = 0.6; // Reduce count weight for day-level data
      } else if (timeUnit === 'month' || timeUnit === 'year') {
        countScaleFactor = 0.3; // Significantly reduce count weight for month/year-level data
      } else {
        countScaleFactor = 1.2; // Slightly increase count weight for hour-level data to emphasize patterns
      }
      
      // Calculate adjusted count value
      const adjustedCount = Math.ceil(count * countScaleFactor);
      
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [position.longitude, position.latitude]
        },
        properties: {
          imo_number: position.imo_number,
          count: adjustedCount // Add count property for heatmap density calculation
        }
      };
    });
    
    // Log statistics about the data for debugging
    const totalPositions = features.length;
    const uniqueGridCells = Object.keys(gridCells).length;
    const maxDensity = Math.max(...Object.values(gridCells));
    console.log(`Time group ${timeGroupIndex} visualization stats:`, {
      timeUnit,
      totalPositions,
      uniqueGridCells,
      maxDensity,
      averageDensity: totalPositions / Math.max(1, uniqueGridCells)
    });
    
    // Update the source data with animation
    if (map.current && map.current.getSource('past-scrubber-data')) {
      // Use requestAnimationFrame for smoother transition
      requestAnimationFrame(() => {
        if (map.current) {
          (map.current.getSource('past-scrubber-data') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features
          });
        }
      });
    }
  }, [pastScrubberData, map, pastScrubberQueryParams]);

  // Effect to control map interactivity based on pastScrubberVisualizationEnabled
  useEffect(() => {
    if (!map.current) return;
    
    if (pastScrubberVisualizationEnabled) {
      // Disable map interactions during past scrubber visualization
      map.current.dragPan.disable();
      map.current.scrollZoom.disable();
      map.current.doubleClickZoom.disable();
      map.current.touchZoomRotate.disable();
      
      // Disable port layer interactivity during PSD visualization
      if (map.current.getLayer('ports-layer')) {
        // Set the layer's interactivity to none
        map.current.setLayoutProperty('ports-layer', 'visibility', 'visible');
        // Ensure port layer is always on top of the heatmap
        map.current.moveLayer('ports-layer');
      }
      
      console.log("Map interactions and port interactivity disabled for past scrubber visualization");
    } else if (initialLoadComplete && !isMapAnimating) {
      // Enable map interactions when not in past scrubber visualization mode
      map.current.dragPan.enable();
      map.current.scrollZoom.enable();
      map.current.doubleClickZoom.enable();
      map.current.touchZoomRotate.enable();
      
      // Re-add click handlers for ports by re-initializing ports
      addPortsToMap();
      
      console.log("Map interactions re-enabled");
    }
  }, [pastScrubberVisualizationEnabled, initialLoadComplete, isMapAnimating, addPortsToMap]);

  // Add a ref to track current fetch request
  const currentFetchRef = useRef<AbortController | null>(null);

  // Calculate scrubber discharge rates for selected ship
  useEffect(() => {
    if (selectedShip && isScrubberVessel(selectedShip.imo_number) && scrubberVessels) {
      const scrubberType = scrubberVessels[selectedShip.imo_number]?.technology_type || 'unknown';
      selectedShip.scrubberDischargeRate = calculateScrubberDischargeRate(selectedShip, scrubberType);
    }
  }, [selectedShip, isScrubberVessel, scrubberVessels]);

  return (
    <Layout className="map-layout no-footer">
      <SEO 
        title="Interactive Ship Tracking Map - North Sea Watch" 
        description="Explore real-time ship tracking data in the North Sea. See vessel movements, port policies, and monitor the environmental impact of shipping routes."
        canonicalUrl="/map"
        jsonLd={{
          organization: {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "North Sea Watch",
            "url": "https://northseawatch.org",
            "logo": "https://northseawatch.org/logo512.png",
            "description": "North Sea Watch is dedicated to monitoring and researching the environmental impact of shipping in the North Sea region."
          },
          website: {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "North Sea Watch",
            "url": "https://northseawatch.org"
          },
          webpage: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "url": "https://northseawatch.org/map",
            "name": "Interactive Ship Tracking Map - North Sea Watch",
            "description": "Explore real-time ship tracking data in the North Sea. See vessel movements, port policies, and monitor the environmental impact of shipping routes.",
            "isPartOf": {
              "@type": "WebSite",
              "name": "North Sea Watch",
              "url": "https://northseawatch.org"
            }
          },
          dataset: {
            "@context": "https://schema.org",
            "@type": "Dataset",
            "name": "North Sea Ship Tracking Data",
            "description": "Real-time and historical AIS ship tracking data for vessels in the North Sea region, including vessel details, routes, and port visits.",
            "keywords": ["ship tracking", "maritime data", "vessel movements", "AIS data", "North Sea"],
            "license": "https://creativecommons.org/licenses/by/4.0/",
            "creator": {
              "@type": "Organization",
              "name": "North Sea Watch"
            },
            "temporalCoverage": "2023/2024"
          }
        }}
      />
      <div className="popup-tutorial">
        {showPopup && <MapPopup onClose={handleTutorialClose}></MapPopup>}
      </div>
      <div className="map-page" style={mapPageStyle}>
        {/* Map error notification */}
        {mapError && (
          <div className="map-error">
            <p>{mapError}</p>
            <p>Please check Mapbox service status and network connection.</p>
          </div>
        )}
        
        {/* Map loading indicator */}
        {(dataLoading || isLoading) && !mapError && (
          <div className="map-loading">
            <svg 
              width="22" 
              height="22" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" 
                stroke="#3498db" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <p>
              {!mapLoaded ? "Loading map" : 
               !portsLoaded ? "Loading port data" : 
               !shipsLoaded ? "Loading vessel data" : 
               loadingScrubberVessels ? "Loading scrubber vessel data" :
               isLoading ? (
                 <span>
                   Loading PSD for the past <span className="highlighted-time">{pastScrubberValue} {pastScrubberTimeUnit}{pastScrubberValue > 1 ? 's' : ''}</span>
                 </span>
               ) :
               "Loading data..."}
            </p>
          </div>
        )}
        
        <div className="map-container" ref={mapContainer} style={mapContainerStyle}>
          {/* MapBox container - will be populated by MapBox GL JS */}
        </div>

        {/* Map search bar - hide if not needed or when showing PSD timeline */}
        {showSearchBar && !pastScrubberVisualizationEnabled && (
          <MapSearchBar 
            ports={ports} 
            ships={ships} 
            onSelectPort={(port) => {
              if (!dataLoading && !isMapAnimating) {
                // Close any existing sidebar first to ensure clean state
                if (sidebarOpen) {
                  // First add port to search results to ensure it stays visible during transition
                  // Removed call to searchBarRef.current.addPortToResults(port);
                  
                  // Then close sidebar
                  setSidebarOpen(false);
                  
                  // Close with a tiny delay to allow animation to start before opening new
                  setTimeout(() => {
                    // Lock map interactions during animation
                    setIsMapAnimating(true);
                    
                    // Set selected port and update UI state
                    setSelectedPort(port);
                    setSelectedShip(null);
                    setSidebarType('port');
                    setSidebarOpen(true);
                    
                    // Set highlighted port
                    setHighlightedPortId(`${port.port_name}-${port.country}`);
                    
                    // Clear highlighted ship
                    setHighlightedShipId(null);
                    
                    // Close settings panel and legend panel if they are open
                    setControlPanelOpen(false);
                    setLegendOpen(false);
                    
                    // Fly to port location without changing zoom level
                    const [lng, lat] = [port.longitude, port.latitude];
                    if (map.current) {
                      // Disable map interactions during animation
                      map.current.dragPan.disable();
                      map.current.scrollZoom.disable();
                      map.current.doubleClickZoom.disable();
                      map.current.touchZoomRotate.disable();
                      
                      // Get current zoom level
                      const currentZoom = map.current.getZoom();
                      
                      // Fly to port while maintaining zoom level
                      map.current.flyTo({
                        center: [lng, lat],
                        zoom: currentZoom, // Maintain current zoom
                        duration: 800, // Faster animation to match sidebar opening
                        essential: true // Make animation essential
                      });
                      
                      // Re-enable map interactions after animation completes
                      setTimeout(() => {
                        if (map.current) {
                          map.current.dragPan.enable();
                          map.current.scrollZoom.enable();
                          map.current.doubleClickZoom.enable();
                          map.current.touchZoomRotate.enable();
                          setIsMapAnimating(false);
                        }
                      }, 900); // Slightly longer than animation to ensure completion
                    }
                  }, 50); // Small delay to create smoother transition
                } else {
                  // No sidebar open, proceed directly
                  
                  // Set selected port and update UI state
                  setSelectedPort(port);
                  setSelectedShip(null);
                  setSidebarType('port');
                  setSidebarOpen(true);
                  
                  // Set highlighted port
                  setHighlightedPortId(`${port.port_name}-${port.country}`);
                  
                  // Clear highlighted ship
                  setHighlightedShipId(null);
                  
                  // Close settings panel and legend panel if they are open
                  setControlPanelOpen(false);
                  setLegendOpen(false);
                  
                  // Fly to port location
                  const [lng, lat] = [port.longitude, port.latitude];
                  flyToLocation(lng, lat);
                }
              }
            }}
            onSelectShip={(ship) => {
              if (!dataLoading && !isMapAnimating) {
                // Immediately set highlighted ship to improve responsiveness
                setHighlightedShipId(ship.imo_number);
                
                // Clear highlighted port
                setHighlightedPortId(null);
                
                // Close any existing sidebar first to ensure clean state
                if (sidebarOpen) {
                  // First close sidebar
                  setSidebarOpen(false);
                  
                  // Immediately prepare next actions without delay
                  // Lock map interactions during animation
                  setIsMapAnimating(true);
                  
                  // Set selected ship and update UI state
                  setSelectedShip(ship);
                  setSelectedPort(null);
                  setSidebarType('ship');
                  
                  // Immediately reopen the sidebar
                  setSidebarOpen(true);
                  
                  // Close settings panel and legend panel if they are open
                  setControlPanelOpen(false);
                  setLegendOpen(false);
                  
                  // If there's a current ship path for a different ship, remove it
                  if (currentShipPathRef.current && currentShipPathRef.current !== ship.imo_number) {
                    removeShipPath(currentShipPathRef.current);
                  }
                  
                  // Fetch and display ship path
                  fetchShipPath(ship.imo_number, ship.name);
                  
                  // Fly to ship location without changing zoom level much
                  const [lng, lat] = [ship.latest_position.longitude, ship.latest_position.latitude];
                  flyToLocation(lng, lat);
                } else {
                  // No sidebar open, proceed directly
                  
                  // Set selected ship and update UI state
                  setSelectedShip(ship);
                  setSelectedPort(null);
                  setSidebarType('ship');
                  setSidebarOpen(true);
                  
                  // Close settings panel and legend panel if they are open
                  setControlPanelOpen(false);
                  setLegendOpen(false);
                  
                  // If there's a current ship path for a different ship, remove it
                  if (currentShipPathRef.current && currentShipPathRef.current !== ship.imo_number) {
                    removeShipPath(currentShipPathRef.current);
                  }
                  
                  // Fetch and display ship path
                  fetchShipPath(ship.imo_number, ship.name);
                  
                  // Fly to ship location
                  const [lng, lat] = [ship.latest_position.longitude, ship.latest_position.latitude];
                  flyToLocation(lng, lat);
                }
              }
            }}
            isDisabled={dataLoading || isLoading || pastScrubberVisualizationEnabled}
            searchBarRef={searchBarRef}
            onInputFocus={handleSearchInputFocus}
            isScrubberVessel={isScrubberVessel}
            scrubberVessels={scrubberVessels}
          />
        )}
        
        {/* PSD Timeline Slider - only visible during PSD visualization */}
        {pastScrubberVisualizationEnabled && pastScrubberData.length > 0 && (
          <PsdTimelineSlider 
            timeGroups={pastScrubberData}
            onTimeGroupChange={updateTimeGroup}
            isLoading={isLoading}
            onClose={handleStopPastScrubberVisualization}
            timeUnit={pastScrubberTimeUnit}
            pastScrubberValue={pastScrubberValue.toString()}
            queryParams={pastScrubberQueryParams}
          />
        )}

        {/* Wrap all controls in a separate layer to ensure they stay on top */}
        <div className="map-controls-layer">
          {/* Legends component (ship types and ports) - hide during past scrubber visualization or loading */}
          {!pastScrubberVisualizationEnabled && !isLoading ? (
            <Legends 
              isOpen={legendOpen} 
              onToggle={!dataLoading && !isMapAnimating && !isLoading ? toggleLegend : () => {}} // Disable toggle when loading
              disabled={dataLoading || isMapAnimating || isLoading} // Add disabled prop
            />
          ) : null}
          
          {/* Settings button - only enabled during Past Scrubber Distribution, still disabled in other scenarios */}
          <SettingsButton 
            onClick={handleSettingsClick}
            disabled={dataLoading || isMapAnimating} // Only disable for general loading and animations, but not for Past Scrubber Distribution
          />
          
          {/* Control panel - always visible, but controls disabled during loading or visualization */}
          <ControlPanel 
            isOpen={controlPanelOpen} 
            heatmapEnabled={false} 
            onHeatmapToggle={() => {}}
            scrubberHeatmapEnabled={scrubberHeatmapEnabled}
            onScrubberHeatmapToggle={(enabled) => {
              if (!dataLoading && !isMapAnimating && !isLoading && !pastScrubberVisualizationEnabled) {
                handleScrubberHeatmapToggle(enabled);
              }
            }}
            onShowTutorial={() => {
              if (!dataLoading && !isMapAnimating && !isLoading && !pastScrubberVisualizationEnabled) {
                showTutorial();
              }
            }}
            disabled={dataLoading || isMapAnimating || isLoading}
            trackScrubberVessels={trackScrubberVessels}
            onTrackScrubberVesselsToggle={(enabled) => {
              if (!dataLoading && !isMapAnimating && !isLoading && !pastScrubberVisualizationEnabled) {
                handleScrubberVesselsToggle(enabled);
              }
            }}
            showOnlyScrubberVessels={showOnlyScrubberVessels}
            onShowOnlyScrubberVesselsToggle={(enabled) => {
              if (!dataLoading && !isMapAnimating && !isLoading && !pastScrubberVisualizationEnabled) {
                setShowOnlyScrubberVessels(enabled);
              }
            }}
            pastScrubberValue={pastScrubberValue}
            onPastScrubberValueChange={handlePastScrubberValueChange}
            pastScrubberTimeUnit={pastScrubberTimeUnit}
            onPastScrubberTimeUnitChange={handlePastScrubberTimeUnitChange}
            onViewPastScrubberDistribution={handleViewPastScrubberDistribution}
            isLoading={isLoading}
            pastScrubberVisualizationEnabled={pastScrubberVisualizationEnabled}
            onStopPastScrubberVisualization={handleStopPastScrubberVisualization}
            onCancelLoading={handleCancelLoading}
          />
          
          {/* Tutorial button */}
          <TutorialButton 
            onClick={handleTutorialClick}
            disabled={dataLoading || isMapAnimating || isLoading || pastScrubberVisualizationEnabled}
          />

          {/* Back to North Sea button - hide during past scrubber visualization or loading */}
          {!pastScrubberVisualizationEnabled && !isLoading && !shouldHideBackButton ? (
            <BackToNorthSeaButton 
              onClick={() => {
                if (!dataLoading && !isMapAnimating && !isLoading && !pastScrubberVisualizationEnabled) {
                  handleResetMapView();
                }
              }}
              disabled={dataLoading || isMapAnimating || isLoading || pastScrubberVisualizationEnabled}
            />
          ) : null}
        </div>
        
        {/* Message prompt */}
        {message && (
          <div className={`map-message ${message.type} ${
            (message.text.includes('path') || message.text.includes('Path')) && 
            !message.text.includes('period') && 
            !message.text.includes('Showing data from') ? 
            'path-loading-notification' : 
            'center-message'}`}
          >
            <p>{message.text}</p>
          </div>
        )}
        
        {/* Sidebar (Port or Ship Information) */}
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h2>{sidebarType === 'port' ? 'Port Information' : 'Ship Information'}</h2>
            <button className="close-button" onClick={closeSidebar}>×</button>
          </div>
          
          {/* Port Information */}
          {sidebarType === 'port' && selectedPort && (
            <div className="sidebar-content">
              <h3>{selectedPort.port_name}</h3>
              <p className="port-country">{selectedPort.country}</p>
              
              {portContentLoading ? (
                <div className="loading-indicator">Loading port content...</div>
              ) : (
                <>
                  <div className="port-policy">
                    <h4>Policy Status</h4>
                    {portContent && portContent.policy_status ? (
                      <div className="content-text" dangerouslySetInnerHTML={{ __html: portContent.policy_status }}></div>
                    ) : (
                      <div className="empty-content">No policy information available</div>
                    )}
                  </div>
                  <div className="port-details">
                    <h4>Port Details</h4>
                    {portContent && portContent.details ? (
                      <div className="content-text" dangerouslySetInnerHTML={{ __html: portContent.details }}></div>
                    ) : (
                      <div className="empty-content">No details available</div>
                    )}
                  </div>
                  {portContent && portContent.last_updated && (
                    <div className="content-last-updated">
                      Last updated: {new Date(portContent.last_updated).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Ship Information */}
          {sidebarType === 'ship' && selectedShip && (
            <div className="sidebar-content">
              <h3>{selectedShip.name}</h3>
              <p className="ship-destination">
                {selectedShip.latest_position.destination ? 
                  `Destination: ${selectedShip.latest_position.destination}` : 
                  'No destination specified'}
              </p>
              
              <div className="ship-details">
                <h4>Ship Details</h4>
                <div className="detail-item">
                  <span className="detail-label">IMO Number:</span>
                  <span className="detail-value">{selectedShip.imo_number}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">MMSI:</span>
                  <span className="detail-value">{selectedShip.mmsi || 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ship Type Code:</span>
                  <span className="detail-value">{selectedShip.ship_type || 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ship Type:</span>
                  <span className="detail-value">{selectedShip.type_name || 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Type Remark:</span>
                  <span className="detail-value">{selectedShip.type_remark || 'Unknown'}</span>
                </div>
                {isScrubberVessel(selectedShip.imo_number) ? (
                  <>
                    <div className="detail-item">
                      <span className="detail-label">Scrubber Status:</span>
                      <span className="detail-value">{scrubberVessels[selectedShip.imo_number]?.status || 'Unknown'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Scrubber Type:</span>
                      <span className="detail-value">{scrubberVessels[selectedShip.imo_number]?.technology_type || 'Unknown'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Engine Data:</span>
                      <span className="detail-value">{engineDataAvailability[selectedShip.imo_number] ? 'Available' : 'Unavailable'}</span>
                    </div>
                    
                    {/* Emission Calculation Parameters */}
                    <div className="detail-item">
                      <span className="detail-label">Operation Mode:</span>
                      <span className="detail-value">{selectedShip.operationMode || 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Block Coefficient:</span>
                      <span className="detail-value">
                        {selectedShip.blockCoef ? 
                          `${selectedShip.blockCoef.toFixed(3)} (${selectedShip.type_name === 'Tanker' ? 'Tanker' : 'Cargo'})` : 
                          'Unknown'}
                      </span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Displacement Volume:</span>
                      <span className="detail-value">{selectedShip.displacementVolume ? `${selectedShip.displacementVolume.toFixed(2)} m³` : 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Displacement Weight:</span>
                      <span className="detail-value">{selectedShip.displacementWeight ? `${selectedShip.displacementWeight.toFixed(2)} t` : 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Lightweight Factor:</span>
                      <span className="detail-value">
                        {selectedShip.lightweightFactor ?
                          `${selectedShip.lightweightFactor.toFixed(2)} (${selectedShip.type_name === 'Tanker' ? 'Tanker' : 'Cargo'})` :
                          'Unknown'}
                      </span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">DWT (Deadweight Tonnage):</span>
                      <span className="detail-value">{selectedShip.dwt ? `${selectedShip.dwt.toFixed(2)} t` : 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">DWT Category:</span>
                      <span className="detail-value">{selectedShip.dwtCategory || 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">AE Power:</span>
                      <span className="detail-value">{selectedShip.baseEmissionRate ? `${selectedShip.baseEmissionRate.toFixed(2)} kW` : 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">BO Power:</span>
                      <span className="detail-value">{selectedShip.boilerPower !== undefined ? `${selectedShip.boilerPower.toFixed(2)} kW` : 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Total Power (AE + BO):</span>
                      <span className="detail-value">{selectedShip.totalPower !== undefined ? `${selectedShip.totalPower.toFixed(2)} kW` : 'Unknown'}</span>
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Discharge Multiplier:</span>
                      <span className="detail-value">
                        {selectedShip.dischargeMultiplier !== undefined ? 
                          `${Math.round(selectedShip.dischargeMultiplier)} kg/kWh` : 
                          'Unknown'}
                      </span>
                    </div>
                    
                    <div className="detail-item scrubber-discharge">
                      <span className="detail-label">Total Scrubber Water Discharge Rate (Th.):</span>
                      <span className="detail-value">{selectedShip.scrubberDischargeRate ? `${selectedShip.scrubberDischargeRate} kg/h` : 'Unknown'}</span>
                    </div>
                  </>
                ) : (
                  <div className="detail-item">
                    <span className="detail-label">Scrubber Status:</span>
                    <span className="detail-value">Unknown</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">Length:</span>
                  <span className="detail-value">{selectedShip.length ? `${selectedShip.length} m` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Width:</span>
                  <span className="detail-value">{selectedShip.width ? `${selectedShip.width} m` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Max Draught:</span>
                  <span className="detail-value">{selectedShip.max_draught ? `${selectedShip.max_draught} m` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Current Position:</span>
                  <span className="detail-value">
                    {`${selectedShip.latest_position.latitude.toFixed(6)}, ${selectedShip.latest_position.longitude.toFixed(6)}`}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Navigational Status Code:</span>
                  <span className="detail-value">{selectedShip.latest_position.navigational_status_code !== null && selectedShip.latest_position.navigational_status_code !== undefined ? selectedShip.latest_position.navigational_status_code : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Navigational Status:</span>
                  <span className="detail-value">{getNavigationalStatusText(selectedShip.latest_position.navigational_status_code)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">True Heading:</span>
                  <span className="detail-value">{selectedShip.latest_position.true_heading !== null ? `${selectedShip.latest_position.true_heading}°` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Course Over Ground:</span>
                  <span className="detail-value">{selectedShip.latest_position.cog !== null ? `${selectedShip.latest_position.cog}°` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Rate of Turn:</span>
                  <span className="detail-value">{selectedShip.latest_position.rate_of_turn !== null ? `${selectedShip.latest_position.rate_of_turn}°/min` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Speed Over Ground:</span>
                  <span className="detail-value">{selectedShip.latest_position.sog !== null ? `${selectedShip.latest_position.sog} knots` : 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Last Update:</span>
                  <span className="detail-value">{formatDate(selectedShip.latest_position.timestamp_ais)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MapPage;