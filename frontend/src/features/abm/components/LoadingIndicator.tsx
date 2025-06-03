import React, { useEffect, useRef } from 'react';
import { LoadingStage } from '../types';
import './LoadingIndicator.css';

// Loading stage descriptions and corresponding percentage ranges
const loadingStagesInfo = {
  [LoadingStage.IDLE]: {
    description: 'Ready to start simulation',
    icon: '⏳',
    color: '#888888',
    progressRange: [0, 0]
  },
  [LoadingStage.INITIALIZING]: {
    description: 'Initializing simulation...',
    icon: '🔄',
    color: '#3498db',
    progressRange: [0, 20]
  },
  [LoadingStage.LOADING_DATA]: {
    description: 'Loading geographical data...',
    icon: '🗺️',
    color: '#2ecc71',
    progressRange: [20, 40]
  },
  [LoadingStage.CREATING_AGENTS]: {
    description: 'Creating ships and ports...',
    icon: '🚢',
    color: '#e67e22',
    progressRange: [40, 70]
  },
  [LoadingStage.ESTABLISHING_ROUTES]: {
    description: 'Establishing shipping routes...',
    icon: '📍',
    color: '#9b59b6',
    progressRange: [70, 95]
  },
  [LoadingStage.COMPLETE]: {
    description: 'Simulation loaded successfully',
    icon: '✅',
    color: '#27ae60',
    progressRange: [100, 100]
  },
  [LoadingStage.FAILED]: {
    description: 'Failed to load simulation',
    icon: '❌',
    color: '#e74c3c',
    progressRange: [0, 0]
  }
};

interface LoadingIndicatorProps {
  currentStage: LoadingStage;
  progress: number; // 0-100
  error: string | null;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ currentStage, progress, error }) => {
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  
  // Calculate total progress based on current stage and progress within stage
  const calculateOverallProgress = () => {
    if (currentStage === LoadingStage.COMPLETE) return 100;
    if (currentStage === LoadingStage.FAILED) return 0;
    
    const stageInfo = loadingStagesInfo[currentStage];
    if (!stageInfo) return 0;
    
    const [min, max] = stageInfo.progressRange;
    // Scale the progress to the stage's range
    return min + ((max - min) * (progress / 100));
  };
  
  // Format the stage name by replacing underscores with spaces
  const formatStageName = (stageName: string): string => {
    return stageName.replace(/_/g, ' ');
  };
  
  const overallProgress = calculateOverallProgress();
  const currentStageInfo = loadingStagesInfo[currentStage];
  
  // Update the progress line width
  useEffect(() => {
    if (stepsContainerRef.current) {
      // Set progress width as percentage of total width
      stepsContainerRef.current.style.setProperty('--progress-width', `${overallProgress}%`);
    }
  }, [overallProgress]);
  
  // Generate steps for progress indicator
  const generateSteps = () => {
    const stages = [
      LoadingStage.INITIALIZING,
      LoadingStage.LOADING_DATA,
      LoadingStage.CREATING_AGENTS,
      LoadingStage.ESTABLISHING_ROUTES,
      LoadingStage.COMPLETE
    ];
    
    return stages.map((stage, index) => {
      const stageInfo = loadingStagesInfo[stage];
      const isActive = stages.indexOf(currentStage) >= index;
      const isCurrent = currentStage === stage;
      
      // Add position classes to help with CSS positioning
      const positionClass = index === 0 ? 'first-step' : 
                           index === stages.length - 1 ? 'last-step' : 
                           `middle-step step-${index}`;
      
      return (
        <div 
          key={stage} 
          className={`loading-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''} ${positionClass}`}
          title={stageInfo.description}
        >
          <div className="step-icon">{stageInfo.icon}</div>
        </div>
      );
    });
  };
  
  return (
    <div className="loading-indicator">
      <div className="loading-content">
        <div className="stage-details">
          <div className="stage-icon" style={{ color: currentStageInfo?.color }}>
            {currentStageInfo?.icon}
          </div>
          <div className="stage-info">
            <h3>{formatStageName(currentStage)}</h3>
            <p>{currentStageInfo?.description}</p>
            {error && <p className="error-message">{error}</p>}
          </div>
        </div>
        
        <div className="progress-section">
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          
          <div className="loading-steps" ref={stepsContainerRef}>
            {generateSteps()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingIndicator; 