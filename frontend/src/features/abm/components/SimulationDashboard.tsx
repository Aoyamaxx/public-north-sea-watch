import React, { useState } from 'react';
import './SimulationDashboard.css';
import Plot from 'react-plotly.js';
import { Data, Layout } from 'plotly.js';

interface SimulationDashboardProps {
  modelData: {
    // Original model data fields
    NumScrubberShips?: number;
    NumScrubberTrails?: number;
    TotalScrubberWater?: number;
    NumShips?: number;
    TotalDockedShips?: number;
    AvgPortPopularity?: number;
    NumPortsBan?: number;
    NumPortsTax?: number;
    NumPortsSubsidy?: number;
    NumPortsAllow?: number;
    TotalPortRevenue?: number;
    AvgPortRevenue?: number;
    AveragePortRevenue?: number;
    NumPorts?: number;
    PortRevenues?: {[portName: string]: number} | { [port: string]: { step: number; revenue: number }[] };
    PortDocking?: {[portName: string]: number};
    
    // Visualization data fields
    ShipTypesToDestinations?: { source: string; target: string; value: number }[];
    ScrubberShipTypesToDestinations?: { source: string; target: string; value: number }[];
    NonScrubberShipTypesToDestinations?: { source: string; target: string; value: number }[];
    CountryRevenues?: { [country: string]: { step: number; revenue: number }[] };
    AmsterdamRevenue?: number;
    step_count?: number;
    // Add scrubber pollution timeseries data
    ScrubberPollutionTimeseries?: { step: number; pollution: number }[];
    [key: string]: any;
  };
  // Add stepCount prop that comes directly from the ABM context
  stepCount?: number;
}

// All types moved to react-plotly.d.ts file

const SimulationDashboard: React.FC<SimulationDashboardProps> = ({ modelData, stepCount = 0 }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<string>('sankey');
  
  // Ship type filter for Sankey diagram
  const [shipTypeFilter, setShipTypeFilter] = useState<'all' | 'scrubber' | 'non-scrubber'>('all');
  
  // Get the appropriate ship types data based on filter
  const getShipTypeData = () => {
    if (shipTypeFilter === 'scrubber' && modelData.ScrubberShipTypesToDestinations) {
      return modelData.ScrubberShipTypesToDestinations;
    } else if (shipTypeFilter === 'non-scrubber' && modelData.NonScrubberShipTypesToDestinations) {
      return modelData.NonScrubberShipTypesToDestinations;
    } else {
      return modelData.ShipTypesToDestinations || [];
    }
  };
  
  // Selected port for revenue chart
  const [selectedPort, setSelectedPort] = useState<string>('Amsterdam');
  

  
  // Helper function to format numbers
  const formatNumber = (value: any): string => {
    if (value === undefined || value === null) return 'N/A';
    
    // If value is an object (like PortRevenues or PortDocking)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    // If value is already a string
    if (typeof value === 'string') {
      return value;
    }
    
    // For numeric values
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value.toString();
      }
      // Format float to 2 decimal places
      return value.toFixed(2);
    }
    
    // For any other type, convert to string
    return String(value);
  };
  
  // Prepare data for Sankey diagram
  const prepareSankeyData = () => {
    // Get ship type data based on current filter
    const shipTypeData = getShipTypeData();
    
    if (!shipTypeData || shipTypeData.length === 0) {
      return null;
    }
    
    // Use the appropriate filtered data from the backend
    const sankeyData = [...shipTypeData];
    
    // Get unique sources and targets
    const allNodes = Array.from(new Set([
      ...sankeyData.map(item => item.source),
      ...sankeyData.map(item => item.target)
    ]));
    
    // Create node labels
    const nodeLabels = allNodes;
    
    // Create node colors - ship types in blues, destinations in greens
    const shipTypes = Array.from(new Set(sankeyData.map(item => item.source)));
    
    const nodeColors = allNodes.map(node => {
      if (shipTypes.includes(node)) {
        return '#2196f3';  // Blue for ship types
      } else {
        return '#388e3c';  // Green for destinations
      }
    });
    
    // Map sources and targets to indices
    const sourceIndices = sankeyData.map(item => allNodes.indexOf(item.source));
    const targetIndices = sankeyData.map(item => allNodes.indexOf(item.target));
    
    // Get values
    const values = sankeyData.map(item => item.value);
    
    // Create link colors based on source
    const linkColors = sankeyData.map(item => {
      const sourceIndex = allNodes.indexOf(item.source);
      return `rgba(25, 118, 210, ${0.3 + (sourceIndex / allNodes.length) * 0.7})`;  // Gradient blues
    });
    
    return {
      type: 'sankey' as const,
      orientation: 'h',
      node: {
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5
        },
        label: nodeLabels,
        color: nodeColors
      },
      link: {
        source: sourceIndices,
        target: targetIndices,
        value: values,
        color: linkColors
      }
    };
  };
  
  // Prepare Sankey diagram data for revenue visualization
  const prepareRevenueSankeyData = () => {
    // Get the current port revenue data
    let portRevenue = 0;
    let scrubberRevenue = 0;
    let nonScrubberRevenue = 0;
    
    // Get actual revenue for the selected port if available
    if (modelData.PortRevenues && modelData.PortRevenues[selectedPort]) {
      if (Array.isArray(modelData.PortRevenues[selectedPort]) && modelData.PortRevenues[selectedPort].length > 0) {
        // Get the latest revenue entry
        const latestRevenue = modelData.PortRevenues[selectedPort][modelData.PortRevenues[selectedPort].length - 1];
        portRevenue = latestRevenue.revenue;
      } else if (typeof modelData.PortRevenues[selectedPort] === 'number') {
        // Direct value
        portRevenue = modelData.PortRevenues[selectedPort] as number;
      }
    }

    // Get scrubber and non-scrubber revenue if available
    if (modelData.PortScrubberRevenues && modelData.PortScrubberRevenues[selectedPort]) {
      if (Array.isArray(modelData.PortScrubberRevenues[selectedPort]) && modelData.PortScrubberRevenues[selectedPort].length > 0) {
        scrubberRevenue = modelData.PortScrubberRevenues[selectedPort][modelData.PortScrubberRevenues[selectedPort].length - 1].revenue;
      } else if (typeof modelData.PortScrubberRevenues[selectedPort] === 'number') {
        scrubberRevenue = modelData.PortScrubberRevenues[selectedPort] as number;
      }
    }

    // Calculate non-scrubber revenue as the difference
    nonScrubberRevenue = portRevenue - scrubberRevenue;

    // If we don't have any revenue data, use simulation step as a multiplier with base values
    if (portRevenue === 0) {
      const currentStep = modelData.step !== undefined ? modelData.step : modelData.step_count || 0;
      portRevenue = 2000 * Math.max(1, currentStep);
      scrubberRevenue = portRevenue * 0.4; // Default 40% for scrubber ships
      nonScrubberRevenue = portRevenue * 0.6; // Default 60% for non-scrubber ships
    }
    
    // Prepare data for Sankey diagram
    return {
      type: 'sankey' as const,
      orientation: 'h' as const,
      node: {
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5
        },
        label: ['Scrubber Ships', 'Non-Scrubber Ships', `${selectedPort} Port`],
        color: ['#2196f3', '#388e3c', '#f39c12']
      },
      link: {
        source: [0, 1],
        target: [2, 2],
        value: [scrubberRevenue, nonScrubberRevenue],
        color: ['rgba(25, 118, 210, 0.4)', 'rgba(56, 142, 60, 0.4)']
      }
    };
  };
  
  // Get available ports for selector with default values in case API doesn't return any
  const defaultPorts = ['Amsterdam', 'Rotterdam', 'Hamburg', 'Antwerp', 'London']; // Default North Sea ports
  const availablePorts = modelData.PortRevenues ? 
    Object.keys(modelData.PortRevenues).sort() : defaultPorts.sort();
  
  // Prepare data for scrubber pollution timeseries plot
  const preparePollutionTimeseriesData = (): Data[] => {
    if (!modelData.ScrubberPollutionTimeseries || modelData.ScrubberPollutionTimeseries.length === 0) {
      return [];
    }

    return [{
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Scrubber Pollution',
      x: modelData.ScrubberPollutionTimeseries.map(point => point.step),
      y: modelData.ScrubberPollutionTimeseries.map(point => point.pollution), // Use original pollution values
      line: {
        color: '#e74c3c',
        width: 2
      },
      marker: {
        size: 6,
        color: '#e74c3c'
      }
    }];
  };

  // Prepare layout for scrubber pollution timeseries plot
  const preparePollutionTimeseriesLayout = (): Partial<Layout> => ({
    autosize: true,
    font: {
      size: 12
    },
    margin: {
      l: 50,
      r: 20,
      b: 50,
      t: 20,
      pad: 4
    },
    xaxis: {
      title: {
        text: 'Simulation Step'
      },
      showgrid: true,
      gridcolor: '#f0f0f0'
    },
    yaxis: {
      title: {
        text: 'Total Discharge (Tonnes)'
      },
      showgrid: true,
      gridcolor: '#f0f0f0'
    },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white'
  });
  
  return (
    <div className="simulation-dashboard">
      <h3>Simulation Visualizations</h3>
      
      {/* Tab Navigation */}
      <div className="tabs-container">
        <div className="tabs">
          <button 
            onClick={() => setActiveTab('sankey')} 
            className={`tab ${activeTab === 'sankey' ? 'active' : ''}`}
          >
            Ship Types to Destinations
          </button>
          <button 
            onClick={() => setActiveTab('revenue')} 
            className={`tab ${activeTab === 'revenue' ? 'active' : ''}`}
          >
            Port Revenue
          </button>
          <button 
            onClick={() => setActiveTab('summary')} 
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          >
            Scrubber Pollution
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'sankey' && (
          <div className="sankey-container">
            <h4>Top Ship Types to Destinations</h4>
            
            {/* Ship type filter toggles */}
            <div className="ship-type-filter">
              <button 
                onClick={() => setShipTypeFilter('all')} 
                className={`filter-button ${shipTypeFilter === 'all' ? 'active' : ''}`}
              >
                All Ships
              </button>
              <button 
                onClick={() => setShipTypeFilter('scrubber')} 
                className={`filter-button ${shipTypeFilter === 'scrubber' ? 'active' : ''}`}
              >
                Scrubber Ships
              </button>
              <button 
                onClick={() => setShipTypeFilter('non-scrubber')} 
                className={`filter-button ${shipTypeFilter === 'non-scrubber' ? 'active' : ''}`}
              >
                Non-Scrubber Ships
              </button>
            </div>
            
            {getShipTypeData().length > 0 ? (
              <Plot
                data={[prepareSankeyData() as any]}
                layout={{
                  title: { text: 'Ship Routes Flow' },
                  autosize: true,
                  font: {
                    size: 13,
                    weight: 600
                  },
                  margin: {
                    l: 0,
                    r: 0,
                    b: 30,
                    t: 30,
                    pad: 4
                  }
                }}
                style={{ width: '100%', height: '500px' }}
                config={{ responsive: true }}
              />
            ) : (
              <div className="no-data-message">
                <p>No {shipTypeFilter === 'all' ? '' : shipTypeFilter + ' '}ship movement data available yet. Please run the simulation longer.</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'revenue' && (
          <div className="revenue-container">
            <div className="port-selector">
              <label htmlFor="port-select">Select Port: </label>
              <select 
                id="port-select"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                className="port-dropdown"
              >
                {availablePorts.map(port => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
            </div>
            
            <div>
              <Plot
                data={[prepareRevenueSankeyData()]}
                layout={{
                  autosize: true,
                  font: {
                    size: 10
                  },
                  margin: {
                    l: 0,
                    r: 0,
                    b: 30,
                    t: 30,
                    pad: 4
                  }
                }}
                style={{ width: '100%', height: '500px' }}
                config={{ responsive: true }}
              />
              
              <div style={{ 
                backgroundColor: 'white', 
                padding: '16px', 
                borderRadius: '8px', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
                textAlign: 'center',
                marginTop: '20px'
              }}>
                <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>Current Total Revenue</h4>
                <p style={{ fontSize: '26px', fontWeight: 'bold', color: '#2c3e50' }}>
                  {formatNumber(
                    // Get the actual port revenue from the same source as the Sankey diagram
                    (() => {
                      if (modelData.PortRevenues && modelData.PortRevenues[selectedPort]) {
                        if (Array.isArray(modelData.PortRevenues[selectedPort]) && modelData.PortRevenues[selectedPort].length > 0) {
                          return modelData.PortRevenues[selectedPort][modelData.PortRevenues[selectedPort].length - 1].revenue;
                        } else if (typeof modelData.PortRevenues[selectedPort] === 'number') {
                          return modelData.PortRevenues[selectedPort];
                        }
                      }
                      // Fallback to estimated value
                      return 2000 * Math.max(1, modelData.step_count || 0);
                    })()
                  )}
                </p>
                <p style={{ color: '#7f8c8d', fontSize: '14px' }}>Step: {stepCount}</p>
              </div>
            </div>
            

          </div>
        )}
        
        {activeTab === 'summary' && (
          <div className="summary-container">
            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="dashboard-card pollution-chart" style={{ gridColumn: '1 / -1', backgroundColor: 'white', borderRadius: '8px', padding: '16px', marginBottom: '16px', height: '60vh', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>Scrubber Pollution Over Time</h4>
                {modelData.ScrubberPollutionTimeseries && modelData.ScrubberPollutionTimeseries.length > 0 ? (
                  <Plot
                    data={preparePollutionTimeseriesData()}
                    layout={preparePollutionTimeseriesLayout()}
                    style={{ width: '100%', height: '100%' }}
                    config={{ responsive: true }}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ color: '#666', fontWeight: 'medium', fontSize: '18px' }}>No pollution data available yet. Please run the simulation longer.</p>
                  </div>
                )}
              </div>
              
              <div className="dashboard-card" style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center' }}>
                <div className="card-icon ship-icon" style={{ marginRight: '12px', fontSize: '24px' }}>🚢</div>
                <div className="card-content">
                  <h4 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>Total Ships</h4>
                  <div className="stat-value" style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatNumber(modelData.NumShips)}</div>
                </div>
              </div>
              
              <div className="dashboard-card" style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center' }}>
                <div className="card-icon scrubber-icon" style={{ marginRight: '12px', fontSize: '24px' }}>💧</div>
                <div className="card-content">
                  <h4 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>Scrubber Ships</h4>
                  <div className="stat-value" style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatNumber(modelData.NumScrubberShips)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationDashboard; 