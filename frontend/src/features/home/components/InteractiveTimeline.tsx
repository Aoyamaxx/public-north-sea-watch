import React, { useState, useEffect, useRef } from 'react';

// tree nodes
enum TreeNode {
  CLEAN_MARINE = 'CLEAN_MARINE',
  SULFUR_EMISSIONS = 'SULFUR_EMISSIONS',
  OTHER_EMISSIONS = 'OTHER_EMISSIONS',
  OPEN_LOOP = 'OPEN_LOOP',
  CLOSED_LOOP = 'CLOSED_LOOP',
  MIX_LOOP = 'MIX_LOOP',
  LOW_SULFUR_FUEL = 'LOW_SULFUR_FUEL',
  CHEAP_FUEL = 'CHEAP_FUEL'
}

// Base tree node structure
const baseTreeNodesInfo = {
  [TreeNode.CLEAN_MARINE]: {
    id: 1,
    title: "North Sea",
    content: "The initiative for cleaner marine operations in the North Sea.",
    icon: <img src={require("../../../assets/images/sea.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 1,
    position: 50
  },
  [TreeNode.SULFUR_EMISSIONS]: {
    id: 2,
    title: "Sulfur Pollutions",
    content: "Addressing sulfur oxide emissions from maritime vessels.",
    icon: <img src={require("../../../assets/images/ship.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 2,
    position: 33
  },
  [TreeNode.OTHER_EMISSIONS]: {
    id: 3,
    title: "Other Pollutions",
    content: "Addressing other types of emissions including nitrogen oxides and particulate matter.",
    icon: <img src={require("../../../assets/images/ship.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 2,
    position: 67
  },
  [TreeNode.OPEN_LOOP]: {
    id: 4,
    title: "Open Loop",
    content: "Open loop scrubbers discharge wash water directly back to the sea after treatment.",
    icon: <img src={require("../../../assets/images/open.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 3,
    position: 23
  },
  [TreeNode.MIX_LOOP]: {
    id: 5,
    title: "Mix Loop",
    content: "Hybrid systems that can operate in both open and closed loop modes.",
    icon: <img src={require("../../../assets/images/mix.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 3,
    position: 33
  },
  [TreeNode.CLOSED_LOOP]: {
    id: 6,
    title: "Closed Loop",
    content: "Closed loop scrubbers retain wash water for proper disposal at port facilities.",
    icon: <img src={require("../../../assets/images/closed.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 3,
    position: 43
  },
  [TreeNode.LOW_SULFUR_FUEL]: {
    id: 7,
    title: "Low Sulfur Fuel",
    content: "Using fuels with reduced sulfur content to meet emission regulations.",
    icon: <img src={require("../../../assets/images/clean.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 4,
    position: 67
  },
  [TreeNode.CHEAP_FUEL]: {
    id: 8,
    title: "Cheap Fuel",
    content: "Cheaper high-sulfur fuel used with scrubbers to achieve regulatory compliance.",
    icon: <img src={require("../../../assets/images/toxic.png")} alt= "Sea Icon" style={{ width: "30px", height: "30px" }}/>,
    color: "#3498db",
    level: 4,
    position: 33
  }
};

// Screen size breakpoints
enum ScreenSize {
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  MOBILE = 'mobile',
  SMALL_MOBILE = 'smallMobile'
}

// Position adjustments for different screen sizes
const positionAdjustments = {
  [ScreenSize.DESKTOP]: {
    // Default positions, no adjustments needed
  },
  [ScreenSize.TABLET]: {
    // Adjust positions for tablets
    [TreeNode.OPEN_LOOP]: { position: 20 },
    [TreeNode.MIX_LOOP]: { position: 35 },
    [TreeNode.CLOSED_LOOP]: { position: 50 },
  },
  [ScreenSize.MOBILE]: {
    // Adjust positions for mobile
    [TreeNode.SULFUR_EMISSIONS]: { position: 30 },
    [TreeNode.OTHER_EMISSIONS]: { position: 70 },
    [TreeNode.OPEN_LOOP]: { position: 15 },
    [TreeNode.MIX_LOOP]: { position: 30 },
    [TreeNode.CLOSED_LOOP]: { position: 45 },
    [TreeNode.LOW_SULFUR_FUEL]: { position: 70 },
    [TreeNode.CHEAP_FUEL]: { position: 30 },
  },
  [ScreenSize.SMALL_MOBILE]: {
    // Adjust positions for small mobile
    [TreeNode.SULFUR_EMISSIONS]: { position: 25 },
    [TreeNode.OTHER_EMISSIONS]: { position: 75 },
    [TreeNode.OPEN_LOOP]: { position: 10 },
    [TreeNode.MIX_LOOP]: { position: 25 },
    [TreeNode.CLOSED_LOOP]: { position: 40 },
    [TreeNode.LOW_SULFUR_FUEL]: { position: 75 },
    [TreeNode.CHEAP_FUEL]: { position: 25 },
  }
};

// Connection between nodes
const connections = [
  { from: TreeNode.CLEAN_MARINE, to: TreeNode.SULFUR_EMISSIONS },
  { from: TreeNode.CLEAN_MARINE, to: TreeNode.OTHER_EMISSIONS },
  { from: TreeNode.SULFUR_EMISSIONS, to: TreeNode.OPEN_LOOP },
  { from: TreeNode.SULFUR_EMISSIONS, to: TreeNode.MIX_LOOP },
  { from: TreeNode.SULFUR_EMISSIONS, to: TreeNode.CLOSED_LOOP },
  { from: TreeNode.OTHER_EMISSIONS, to: TreeNode.LOW_SULFUR_FUEL },
  { from: TreeNode.OPEN_LOOP, to: TreeNode.CHEAP_FUEL },
  { from: TreeNode.MIX_LOOP, to: TreeNode.CHEAP_FUEL },
  { from: TreeNode.CLOSED_LOOP, to: TreeNode.CHEAP_FUEL }
];

const InteractiveTimeline: React.FC = () => {
  const [activeNode, setActiveNode] = useState<TreeNode | null>(null);
  const [screenSize, setScreenSize] = useState<ScreenSize>(ScreenSize.DESKTOP);
  const [treeNodesInfo, setTreeNodesInfo] = useState(baseTreeNodesInfo);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Update screen size and adjust node positions based on window width
  useEffect(() => {
    const handleResize = () => {
      let newSize: ScreenSize;
      const width = window.innerWidth;
      
      if (width <= 380) {
        newSize = ScreenSize.SMALL_MOBILE;
      } else if (width <= 480) {
        newSize = ScreenSize.MOBILE;
      } else if (width <= 1024) {
        newSize = ScreenSize.TABLET;
      } else {
        newSize = ScreenSize.DESKTOP;
      }
      
      if (newSize !== screenSize) {
        setScreenSize(newSize);
      }
    };
    
    // Initial check
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, [screenSize]);
  
  // Apply position adjustments based on screen size
  useEffect(() => {
    const adjustments = positionAdjustments[screenSize];
    
    // Create a new tree nodes info object with adjusted positions
    const adjustedNodesInfo = { ...baseTreeNodesInfo };
    
    // Apply adjustments if they exist
    if (adjustments) {
      Object.entries(adjustments).forEach(([node, change]) => {
        if (adjustedNodesInfo[node as TreeNode]) {
          adjustedNodesInfo[node as TreeNode] = {
            ...adjustedNodesInfo[node as TreeNode],
            ...change
          };
        }
      });
    }
    
    setTreeNodesInfo(adjustedNodesInfo);
  }, [screenSize]);
  
  const handleNodeClick = (node: TreeNode) => {
    // Toggle the active node
    const newActiveNode = activeNode === node ? null : node;
    setActiveNode(newActiveNode);
    
    // If on mobile and we just set an active node, scroll to the content after it renders
    if (newActiveNode !== null && 
        (screenSize === ScreenSize.MOBILE || screenSize === ScreenSize.SMALL_MOBILE)) {
      // Use setTimeout to ensure the DOM has updated with the new content
      setTimeout(() => {
        if (contentRef.current) {
          // Calculate position to scroll to (smooth scroll to content)
          contentRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest'
          });
        }
      }, 100);
    }
  };
  
  // Convert the object to an array for mapping
  const nodesArray = Object.values(treeNodesInfo);
  
  // Set tree height based on screen size
  const maxLevel = Math.max(...nodesArray.map(node => node.level));
  let levelHeight = 100; // Default height for desktop
  let verticalOffset = 52;
  
  // Adjust level height based on screen size
  if (screenSize === ScreenSize.TABLET) {
    levelHeight = 90;
    verticalOffset = 50;
  } else if (screenSize === ScreenSize.MOBILE) {
    levelHeight = 80;
    verticalOffset = 45;
  } else if (screenSize === ScreenSize.SMALL_MOBILE) {
    levelHeight = 70;
    verticalOffset = 40;
  }
  
  const treeHeight = maxLevel * levelHeight + verticalOffset;
  
  return (
    <div className="tree-timeline-container">
      <h2 className="timeline-heading">Exploring Fuel Pollution Factors in the North Sea</h2>
      
      <div 
        className={`tree-container ${activeNode !== null ? 'has-active-node' : ''}`} 
        style={{ height: `${treeHeight}px` }}
      >
        {/* Render the nodes */}
        {nodesArray.map((node) => (
          <div
            key={node.id}
            className={`tree-node ${activeNode === Object.keys(baseTreeNodesInfo)[node.id - 1] ? 'active' : ''}`}
            onClick={() => handleNodeClick(Object.keys(baseTreeNodesInfo)[node.id - 1] as TreeNode)}
            style={{
              top: `${(node.level - 1) * levelHeight + verticalOffset}px`,
              left: `${node.position}%`,
              transform: 'translate(-50%, 0)',
              borderColor: node.color
            }}
          >
            <div 
              className="node-circle"
              style={{ backgroundColor: node.color }}
            >
              <span className="node-icon">{node.icon}</span>
            </div>
            <div className="node-label">
              {node.title}
            </div>
          </div>
        ))}
        
        {/* Render the connections */}
        <svg className="tree-connections">
          {connections.map((connection, index) => {
            const fromNode = treeNodesInfo[connection.from];
            const toNode = treeNodesInfo[connection.to];
            
            // Coordinates calculation
            const x1 = `${fromNode.position}%`;
            const y1 = (fromNode.level - 1) * levelHeight + verticalOffset/2;
            const x2 = `${toNode.position}%`;
            const y2 = (toNode.level - 1) * levelHeight + verticalOffset/2;
            
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={fromNode.color}
                strokeWidth={screenSize === ScreenSize.SMALL_MOBILE ? "2" : "3"}
              />
            );
          })}
        </svg>
      </div>
      
      {/* Display information about the selected node */}
      {activeNode !== null && treeNodesInfo[activeNode] && (
        <div 
          ref={contentRef}
          className="tree-node-content" 
          style={{ borderTop: `3px solid ${treeNodesInfo[activeNode].color}` }}
        >
          <div className="content-header">
            <div className="node-circle" style={{ backgroundColor: treeNodesInfo[activeNode].color }}>
              <span className="node-icon">{treeNodesInfo[activeNode].icon}</span>
            </div>
            <h3 style={{ color: treeNodesInfo[activeNode].color }}>{treeNodesInfo[activeNode].title}</h3>
          </div>
          <p>{treeNodesInfo[activeNode].content}</p>
        </div>
      )}
    </div>
  );
};

export default InteractiveTimeline;