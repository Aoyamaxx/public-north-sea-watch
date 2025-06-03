import React, { useState, useEffect, useCallback } from 'react';
import './ABMTutorial.css';

// Tutorial popup component for ABM simulation page
export function ABMTutorial({ onClose }: { onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [page, setPage] = useState(0);

  // Total number of tutorial pages
  const totalPages = 5;
  
  // Animate popup entry
  useEffect(() => {
    setTimeout(() => {
      setIsVisible(true);
    }, 100);
  }, []);

  // Handle navigation
  const handleNext = useCallback(() => {
    if (page < totalPages - 1) {
      setPage(page + 1);
    }
  }, [page, totalPages]);

  const handleBack = useCallback(() => {
    if (page > 0) {
      setPage(page - 1);
    }
  }, [page]);

  if (!isVisible) return null;

  // Render progress dots
  const renderProgressDots = () => {
    return (
      <div className="abm-tutorial-progress">
        {Array.from({ length: totalPages }).map((_, index) => (
          <span
            key={index}
            className={`abm-tutorial-progress-dot ${index < page ? 'visited' : ''} ${index === page ? 'active' : ''}`}
          >
            •
          </span>
        ))}
      </div>
    );
  };

  // Render navigation buttons
  const renderNavigationButtons = () => {
    return (
      <div className="abm-tutorial-buttons">
        <div className="abm-tutorial-left-space">
          {page > 0 && (
            <button 
              className="abm-tutorial-button-back"
              onClick={handleBack}
            >
              Back
            </button>
          )}
        </div>
        <div className="abm-tutorial-middle-buttons">
          {page === 0 && (
            <button 
              className="abm-tutorial-button-skip"
              onClick={onClose}
            >
              Skip Tutorial
            </button>
          )}
        </div>
        <div className="abm-tutorial-right-button">
          {page < totalPages - 1 ? (
            <button 
              className="abm-tutorial-button-next"
              onClick={handleNext}
            >
              Next
            </button>
          ) : (
            <button 
              className="abm-tutorial-button-start"
              onClick={onClose}
            >
              Start Exploring
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="abm-tutorial-overlay">
      <div className="abm-tutorial">
        <div className="abm-tutorial-close-button" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </div>
        
        {/* Progress indicators */}
        {renderProgressDots()}
        
        <div className="abm-tutorial-content">
          {/* Page 1: Welcome to the Simulation */}
          {page === 0 && (
            <div className="abm-tutorial-page">
              <h2>Welcome to the Simulation</h2>
              <h3>Explore maritime policy impacts in the North Sea</h3>
              <p>
                This simulation models how ships travel between ports and discharge scrubber washwater. 
                It allows you to test how different port and national policies affect both revenue and 
                pollution levels across the region.
              </p>
              <div className="abm-tutorial-visual">
                <div className="abm-tutorial-simulation-preview">
                  <div className="abm-tutorial-grid">
                    <div className="abm-tutorial-port port-allow"></div>
                    <div className="abm-tutorial-port port-ban"></div>
                    <div className="abm-tutorial-port port-subsidy"></div>
                    <div className="abm-tutorial-port port-tax"></div>
                    <div className="abm-tutorial-ship"></div>
                    <div className="abm-tutorial-discharge discharge-1"></div>
                    <div className="abm-tutorial-discharge discharge-2"></div>
                    <div className="abm-tutorial-discharge discharge-3"></div>
                    <div className="abm-tutorial-discharge discharge-4"></div>
                    <div className="abm-tutorial-discharge discharge-5"></div>
                  </div>
                  <p className="abm-tutorial-caption">
                    Ships move between ports, creating pollution trails
                  </p>
                </div>
              </div>
              <p className="abm-tutorial-start-text">
                Click "Next" to begin learning how the simulation works.
              </p>
            </div>
          )}

          {/* Page 2: How the Simulation Works */}
          {page === 1 && (
            <div className="abm-tutorial-page">
              <h2>How the Simulation Works</h2>
              <div className="abm-tutorial-explanation-blocks">
                <div className="abm-tutorial-block">
                  <div className="abm-tutorial-icon ship-types">
                    <div className="abm-tutorial-ship-cargo"></div>
                    <div className="abm-tutorial-ship-tanker"></div>
                    <div className="abm-tutorial-ship-other"></div>
                  </div>
                  <h4>Ship Types & Equipment</h4>
                  <p>
                    Ships are assigned types (cargo, tanker, etc.) based on real-world proportions. 
                    A percentage of cargo (18%) and tanker (13%) vessels are equipped with scrubbers.
                  </p>
                </div>
                <div className="abm-tutorial-block">
                  <div className="abm-tutorial-icon movement">
                    <div className="abm-tutorial-grid-small">
                      <div className="abm-tutorial-path"></div>
                    </div>
                  </div>
                  <h4>Ship Movement</h4>
                  <p>
                    Ships travel step by step across a simplified grid, choosing destinations 
                    based on real port popularity and traffic patterns.
                  </p>
                </div>
                <div className="abm-tutorial-block">
                  <div className="abm-tutorial-icon pollution">
                    <div className="abm-tutorial-discharge-trail"></div>
                  </div>
                  <h4>Pollution Discharge</h4>
                  <p>
                    Scrubber-equipped ships discharge washwater at every step of their journey, 
                    creating pollution trails across the simulation area.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Page 3: Port Policies and Economic Logic */}
          {page === 2 && (
            <div className="abm-tutorial-page">
              <h2>Port Policies and Economic Logic</h2>
              <p>Each port can implement different scrubber-related policies:</p>
              <div className="abm-tutorial-policy-grid">
                <div className="abm-tutorial-policy-item">
                  <div className="abm-tutorial-policy-icon allow">
                    <span className="abm-tutorial-port-allow">■</span>
                  </div>
                  <div className="abm-tutorial-policy-text">
                    <h4>Allow</h4>
                    <p>Permits scrubber-equipped ships to dock with standard fees.</p>
                  </div>
                </div>
                <div className="abm-tutorial-policy-item">
                  <div className="abm-tutorial-policy-icon ban">
                    <span className="abm-tutorial-port-ban">■</span>
                  </div>
                  <div className="abm-tutorial-policy-text">
                    <h4>Ban</h4>
                    <p>Prohibits scrubber-equipped ships from docking.</p>
                  </div>
                </div>
                <div className="abm-tutorial-policy-item">
                  <div className="abm-tutorial-policy-icon subsidy">
                    <span className="abm-tutorial-port-subsidy">■</span>
                  </div>
                  <div className="abm-tutorial-policy-text">
                    <h4>Subsidy</h4>
                    <p>Reduces docking fees for non-scrubber ships, encouraging cleaner traffic.</p>
                  </div>
                </div>
                <div className="abm-tutorial-policy-item">
                  <div className="abm-tutorial-policy-icon tax">
                    <span className="abm-tutorial-port-tax">■</span>
                  </div>
                  <div className="abm-tutorial-policy-text">
                    <h4>Tax</h4>
                    <p>Increases fees for scrubber ships, discouraging their visits.</p>
                  </div>
                </div>
              </div>
              <p className="abm-tutorial-economic-note">
                Ports earn revenue from docking fees, with different policy settings affecting 
                traffic composition and total income.
              </p>
            </div>
          )}

          {/* Page 4: Visual Insights */}
          {page === 3 && (
            <div className="abm-tutorial-page">
              <h2>Visual Insights</h2>
              <p>The simulation includes dynamic visualizations to make results easier to interpret:</p>
              <div className="abm-tutorial-insights-grid">
                <div className="abm-tutorial-insight-item">
                  <div className="abm-tutorial-chart sankey">
                    <div className="abm-tutorial-sankey-flow"></div>
                  </div>
                  <h4>Sankey Diagrams</h4>
                  <p>Show traffic flows between ship types and major ports.</p>
                </div>
                <div className="abm-tutorial-insight-item">
                  <div className="abm-tutorial-chart revenue">
                    <div className="abm-tutorial-revenue-chart"></div>
                  </div>
                  <h4>Revenue Attribution Charts</h4>
                  <p>Display the share of income from scrubber vs non-scrubber ships per port.</p>
                </div>
              </div>
              <p className="abm-tutorial-insights-note">
                These visuals help assess the trade-off between environmental impact and economic activity.
              </p>
            </div>
          )}

          {/* Page 5: Adjusting the Parameters */}
          {page === 4 && (
            <div className="abm-tutorial-page">
              <h2>Adjusting the Parameters</h2>
              <p>You can customize the simulation to explore different policy scenarios:</p>
              <div className="abm-tutorial-controls-demo">
                <div className="abm-tutorial-control-item">
                  <div className="abm-tutorial-control-icon speed">
                    <div className="abm-tutorial-speed-control"></div>
                  </div>
                  <div className="abm-tutorial-control-text">
                    <h4>Speed Control</h4>
                    <p>Adjust how fast the simulation runs using the play/pause and step controls.</p>
                  </div>
                </div>
                <div className="abm-tutorial-control-item">
                  <div className="abm-tutorial-control-icon policy">
                    <div className="abm-tutorial-policy-selector"></div>
                  </div>
                  <div className="abm-tutorial-control-text">
                    <h4>Policy Settings</h4>
                    <p>Select country-wide bans or apply custom policies by typing specific port names and choosing ban, subsidy, or tax settings.</p>
                  </div>
                </div>
              </div>
              <div className="abm-tutorial-final-message">
                <h3>Now you're ready to begin!</h3>
                <p>
                  Click "Start Simulation" to explore your first scenario and see how different 
                  policies affect maritime traffic and pollution in the North Sea.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Navigation buttons */}
        {renderNavigationButtons()}
      </div>
    </div>
  );
} 