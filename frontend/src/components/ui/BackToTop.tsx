import React, { useState, useEffect } from 'react';
import './BackToTop.css';

interface BackToTopProps {
  showOffset?: number; // Number of pixels to scroll before showing the button
}

const BackToTop: React.FC<BackToTopProps> = ({ showOffset = 300 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle scroll event
  useEffect(() => {
    const checkScrollPosition = () => {
      if (window.scrollY > showOffset) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', checkScrollPosition);
    return () => window.removeEventListener('scroll', checkScrollPosition);
  }, [showOffset]);

  // Check for mobile devices
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button 
      className={`back-to-top ${isVisible ? 'visible' : ''} ${isMobile ? 'mobile' : ''}`}
      onClick={scrollToTop}
      aria-label="Back to top"
    >
      <svg 
        width="35" 
        height="35" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <path 
          d="M8 14L12 10L16 14" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
};

export default BackToTop; 