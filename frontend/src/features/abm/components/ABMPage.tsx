import React, { useEffect, useRef, useState } from 'react';
import Layout from '../../../components/layout/Layout';
import { ABMProvider, useABMContext } from '../hooks/useABMContext';
import SEO from '../../../components/ui/SEO';
import SimulationRenderer from './SimulationRenderer';
import SimulationControls from './SimulationControls';
import SimulationDashboard from './SimulationDashboard';
import LoadingIndicator from './LoadingIndicator';
import SimulationStatusIndicator from './SimulationStatusIndicator';
import BackToTop from '../../../components/ui/BackToTop';
import { ABMTutorial } from './ABMTutorial';
import { DEFAULT_SIMULATION_PARAMS, LoadingStage } from '../types';
import './ABMPage.css';

// Tutorial button component
const ABMTutorialButton = ({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) => {
  return (
    <button 
      className="abm-tutorial-button" 
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

// Main ABM content component that uses the ABM context
const ABMContent = () => {
  const {
    state,
    createSimulation,
    startSimulation,
    stopSimulation,
    stepSimulation,
    resetSimulation,
    cleanupSimulation
  } = useABMContext();
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Use a ref to track if initialization has been completed
  const hasInitializedRef = useRef(false);
  // Track whether this is a legitimate unmount or just a React re-render
  const mountCountRef = useRef(0);

  // Log when component mounts to track remounting
  useEffect(() => {
    mountCountRef.current += 1;
    console.log(`ABMPage mounting (count: ${mountCountRef.current})`);
    
    return () => {
      console.log(`ABMPage unmounting instance ${mountCountRef.current}`);
    };
  }, []);

  // Create a simulation when the component mounts
  useEffect(() => {
    // Only create a simulation once on the first mount
    if (!hasInitializedRef.current) {
      // Generate a new client ID every time to avoid rate limiting issues
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const clientId = `client_${timestamp}_${randomString}`;
      localStorage.setItem('abm_client_id', clientId);
      
      // Use default parameters and client ID to create a simulation immediately
      const params = {
        ...DEFAULT_SIMULATION_PARAMS,
        client_id: clientId
      };
      
      console.log('Creating simulation on initial mount with client ID:', clientId);
      createSimulation(params);
      hasInitializedRef.current = true;
    }

    // Clean up function - only clean up on unmount, not on every render
    // Return an empty function to avoid cleanup during renders
    return () => {};
  }, [createSimulation]); // Only depend on createSimulation

  // Add a debug log whenever loading stage changes
  useEffect(() => {
    console.log(`ABMPage: Loading stage changed to ${state.loadingStage}, progress: ${state.loadingProgress}, loading: ${state.loading}`);
  }, [state.loadingStage, state.loadingProgress, state.loading]);

  // Use a ref to track if we're in a real unmount or just a re-render
  const isRealUnmountRef = useRef(false);

  // Add separate effect for component unmount to handle cleanup
  useEffect(() => {
    return () => {
      // Only perform cleanup if it's the final unmount, not a re-render
      if (isRealUnmountRef.current) {
        console.log('ABMPage unmounting, cleaning up resources');
        
        // Make sure we don't create any new simulations during unmount
        window._unmountingPage = true;
        
        // Set protection flag to prevent errors during cleanup
        window._simulationActiveFlag = true;
        
        // Clear any pending protection flag timeouts
        if (window._protectionFlagTimeoutId) {
          clearTimeout(window._protectionFlagTimeoutId);
          window._protectionFlagTimeoutId = undefined;
          console.log('Cleared pending protection flag timeout');
        }
        
        // Set a small delay before cleanup to allow any in-progress operations to complete
        setTimeout(() => {
          cleanupSimulation();
          
          // Reset the unmount flag after cleanup is complete
          setTimeout(() => {
            window._unmountingPage = false;
            // Keep protection flag active for a bit longer after unmount
            setTimeout(() => {
              window._simulationActiveFlag = false;
            }, 3000);
          }, 500);
        }, 100);
      } else {
        console.log('ABMPage effect teardown detected, but not a real unmount - skipping cleanup');
      }
    };
  }, [cleanupSimulation]);

  // Set the real unmount flag just before the component will unmount
  // This useEffect runs when the component is about to be unmounted from the DOM
  // not just when effect dependencies change
  useEffect(() => {
    return () => {
      // This will only run when the component is fully unmounted from the DOM
      isRealUnmountRef.current = true;
      console.log('ABMPage will fully unmount');
    };
  }, []);

  // Handle tutorial button click
  const handleShowTutorial = () => {
    setShowTutorial(true);
  };

  // Handle tutorial close
  const handleCloseTutorial = () => {
    setShowTutorial(false);
  };

  // Helper to render appropriate status indicator
  const renderStatusIndicator = () => {
    return (
      <SimulationStatusIndicator
        loadingStage={state.loadingStage}
        isRunning={state.isRunning}
        error={state.error}
      />
    );
  };
  
  return (
    <div className="abm-container">
      {/* Tutorial button - fixed position on the left side */}
      <ABMTutorialButton onClick={handleShowTutorial} />
      
      {/* Tutorial popup */}
      {showTutorial && <ABMTutorial onClose={handleCloseTutorial} />}
      
      <section className="content-section">
        <div className="container">
          <div className="abm-content">
            <div className="abm-sidebar">
              <div className="simulation-dashboard">
                <SimulationDashboard 
                  modelData={state.modelData} 
                  stepCount={state.stepCount} 
                />
              </div>
              
              <div className="simulation-info-panel">
                <h3>About This Simulation</h3>
                <p>
                  <strong>Legend:</strong>
                </p>
                <ul className="legend-list">
                  <li><span className="legend-icon port-allow">■</span> Ports (Black) - Scrubbers allowed</li>
                  <li><span className="legend-icon port-ban">■</span> Ports (Green) - Scrubbers banned</li>
                  <li><span className="legend-icon port-tax">■</span> Ports (Yellow) - Scrubbers taxed</li>
                  <li><span className="legend-icon port-subsidy">■</span> Ports (Blue) - Scrubbers subsidized</li>
                  <li><span className="legend-icon ship-red">●</span> Ships (Red) - Ships with scrubbers</li>
                  <li><span className="legend-icon ship-cargo">●</span> Ships (Blue) - Cargo vessels</li>
                  <li><span className="legend-icon ship-tanker">●</span> Ships (Navy) - Tankers</li>
                  <li><span className="legend-icon ship-fishing">●</span> Ships (Yellow) - Fishing vessels</li>
                  <li><span className="legend-icon ship-passenger">●</span> Ships (Pink) - Passenger vessels</li>
                  <li><span className="legend-icon ship-tug">●</span> Ships (Orange) - Tug boats</li>
                  <li><span className="legend-icon ship-hsc">●</span> Ships (Purple) - High-speed craft</li>
                  <li><span className="legend-icon ship-dredging">●</span> Ships (Brown) - Dredging vessels</li>
                  <li><span className="legend-icon ship-search">●</span> Ships (Green) - Search and rescue vessels</li>
                  <li><span className="legend-icon ship-other">●</span> Ships (Gray) - Other vessel types</li>
                  <li><span className="legend-icon trail">◆</span> Discharge (Orange) - Points of wastewater discharge</li>
                </ul>
                <p></p>
                <p>
                  <strong>Agent-Based Model:</strong> This simulation models shipping traffic in the North Sea region and the impact of pollution policies. 
                  Ships in the model move between ports based on empirical data, with different types of vessels having unique behaviors and preferences.
                  Ports can implement various scrubber policies: allow, ban, tax, or subsidize.
                </p>
                <p>
                  The main objective of the simulation is to study how different pollution policies affect port popularity, 
                  ship behavior, port revenue, and overall pollution levels in maritime environments.
                </p>
                <p>
                  <strong>Port Popularity:</strong> Large ports like Rotterdam and Antwerp are more attractive to ships,
                  especially cargo and passenger vessels. Ship routing is determined by weighted probability based on 
                  port size and ship type preferences.
                </p>
                <p>
                  <strong>Ship Types:</strong> The simulation includes various vessel types with realistic proportions: cargo (53.2%), tankers (21.3%), 
                  fishing vessels (10.6%), and others including passenger ships, tugs, and specialized vessels.
                </p>
              </div>
            </div>

            {/* 
              For all devices: Always render loading-indicator-container to maintain layout
              regardless of whether the indicator is visible
            */}
            <div className="loading-indicator-container">
              {/* Conditionally show loading indicator */}
              {state.loading && state.loadingStage !== LoadingStage.COMPLETE && state.loadingStage !== LoadingStage.FAILED && (
                <LoadingIndicator
                  currentStage={state.loadingStage}
                  progress={state.loadingProgress}
                  error={state.error}
                />
              )}
              
              {/* Conditionally show error card */}
              {state.loadingStage === LoadingStage.FAILED && (
                <div className="error-card">
                  <h3>Loading Failed</h3>
                  <p>{state.error || 'Failed to load simulation, please try again'}</p>
                  <button 
                    className="retry-button"
                    onClick={() => {
                      // Clear all stored IDs, completely reset
                      localStorage.removeItem('abm_client_id');
                      
                      // Clear previous state, ensure retry logic is clean
                      cleanupSimulation();
                      
                      // Set a delay to ensure cleanup is complete
                      setTimeout(() => {
                        // Generate a new client ID
                        const newClientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                        localStorage.setItem('abm_client_id', newClientId);
                        
                        // Use default parameters and new client ID to create a new simulation
                        const params = {
                          ...DEFAULT_SIMULATION_PARAMS,
                          client_id: newClientId
                        };
                        
                        console.log('Completely reset and created a new simulation, new client ID:', newClientId);
                        createSimulation(params);
                      }, 1500); // Increase timeout to ensure proper cleanup
                    }}
                  >
                    Reset and Retry
                  </button>
                </div>
              )}
              
              {/* Always show placeholder with status text when neither indicator nor error is shown */}
              {!state.loading && state.loadingStage !== LoadingStage.FAILED && (
                <div className="indicator-placeholder">
                  <div className="placeholder-content">
                    {state.loadingStage === LoadingStage.COMPLETE ? (
                      <p className="status-text complete">
                        <span className="status-icon">✓</span> Loading complete
                      </p>
                    ) : (
                      <p className="status-text waiting">Waiting to load...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Always show status indicator - moved below loading indicator */}
            <div className="simulation-status-container">
              {renderStatusIndicator()}
            </div>
            
            <div className="abm-main">
              <div className="visualization-container">
                {state.gridState.length > 0 ? (
                  <SimulationRenderer 
                    gridState={state.gridState} 
                    width={100}
                    height={100}
                  />
                ) : (
                  <div className="loading-placeholder">
                    {state.loading ? (
                      <div className="loading-message">
                        <div className="loading-spinner"></div>
                        <p>{state.loadingStage === LoadingStage.FAILED ? 'Loading failed' : `Loading simulation...`}</p>
                      </div>
                    ) : (
                      <div className="no-data-message">
                        {state.error && state.loadingStage !== LoadingStage.FAILED ? (
                          <div className="error-message">
                            <h3>Error</h3>
                            <p>{state.error}</p>
                          </div>
                        ) : (
                          state.loadingStage !== LoadingStage.FAILED && 'No simulation data available. Please check console for details.'
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="controls-container">
                <SimulationControls
                  stepCount={state.stepCount}
                  isRunning={state.isRunning}
                  loading={state.loading}
                  onStart={startSimulation}
                  onStop={stopSimulation}
                  onStep={stepSimulation}
                  onReset={resetSimulation}
                  onCreateNew={createSimulation}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// Wrapper component that provides the ABM context
const ABMPage = () => {
  return (
    <Layout>
      <SEO 
        title="Agent-Based Simulation - North Sea Watch" 
        description="Explore our agent-based model simulating ship behavior and pollution policies in the North Sea. Observe how different regulations affect maritime traffic and environmental impact."
        canonicalUrl="/abm"
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
            "url": "https://northseawatch.org/abm",
            "name": "Agent-Based Simulation - North Sea Watch",
            "description": "Explore our agent-based model simulating ship behavior and pollution policies in the North Sea. Observe how different regulations affect maritime traffic and environmental impact.",
            "isPartOf": {
              "@type": "WebSite",
              "name": "North Sea Watch",
              "url": "https://northseawatch.org"
            }
          },
          softwareApplication: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "North Sea Ship Simulation Model",
            "applicationCategory": "Simulation",
            "operatingSystem": "Web Browser",
            "description": "An agent-based model simulating ship behavior, port policies, and environmental impact in the North Sea region."
          }
        }}
      />
      <ABMProvider>
        <ABMContent />
      </ABMProvider>
      <BackToTop />
    </Layout>
  );
};

export default ABMPage; 