import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';
import radarLogo from '../../assets/images/radar.svg';
import radarTransparentLogo from '../../assets/images/radar_transparent.svg';
import sdnLogo from '../../assets/images/sdn_logo4.png';
import sdnTransparentLogo from '../../assets/images/sdn_logo3.png';

interface HeaderProps {
  videoSectionRef?: React.RefObject<HTMLElement>;
}

const Header: React.FC<HeaderProps> = ({ videoSectionRef }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isPrivacyPage = location.pathname === '/privacy-policy';
  // State for header expansion status
  const [isExpanded, setIsExpanded] = useState(() => {
    // Initial state logic: collapse header if screen width <= 350px and not on homepage or privacy page
    const isSmallScreen = window.innerWidth <= 350;
    const isSpecialPage = location.pathname === '/' || location.pathname === '/privacy-policy';
    return !(isSmallScreen && !isSpecialPage);
  });
  
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isOverVideo, setIsOverVideo] = useState(isHomePage);
  const scrollTimeoutRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  
  const logoSrc = (isHomePage && isOverVideo) ? radarTransparentLogo : radarLogo;
  const sdnLogoSrc = (isHomePage && isOverVideo) ? sdnTransparentLogo : sdnLogo;
  
  useEffect(() => {
    const checkIfMobile = () => {
      const newIsMobile = window.innerWidth <= 1024;
      setIsMobile(newIsMobile);
      
      // Check small screen condition for header state
      const isSmallScreen = window.innerWidth <= 350;
      const isSpecialPage = location.pathname === '/' || location.pathname === '/privacy-policy';
      
      // Only automatically collapse on page load, not on every resize
      if (isSmallScreen && !isSpecialPage && headerRef.current) {
        setIsExpanded(false);
      }
    };
    
    checkIfMobile();
    
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (isHomePage) {
      setIsOverVideo(true);
    } else {
      setIsOverVideo(false);
    }
  }, [isHomePage]);

  // Effect to handle initial header state based on page and screen size
  useEffect(() => {
    const isSmallScreen = window.innerWidth <= 350;
    const isSpecialPage = isHomePage || isPrivacyPage;
    
    // Only collapse header on small screens for non-special pages
    if (isSmallScreen && !isSpecialPage) {
      setIsExpanded(false);
    } else if (isHomePage) {
      // On home page, always expand header
      setIsExpanded(true);
    }
  }, [isHomePage, isPrivacyPage, location.pathname]);

  const checkHeaderPosition = useCallback(() => {
    if (!isHomePage || !videoSectionRef?.current) {
      setIsOverVideo(false);
      return;
    }
    
    const videoRect = videoSectionRef.current.getBoundingClientRect();
    
    const thresholdTop = isMobile ? -1 : -1;
    
    const videoVisible = videoRect.top > thresholdTop;
    
    if (isOverVideo !== videoVisible) {
      setIsOverVideo(videoVisible);
    }
  }, [isHomePage, videoSectionRef, isOverVideo, isMobile]);
  
  useEffect(() => {
    if (isHomePage && videoSectionRef?.current) {
      const initialCheckTimeout = setTimeout(() => {
        checkHeaderPosition();
      }, 300);
      
      let scrollTimeout: number | null = null;
      const scrollThrottleTime = isMobile ? 50 : 100;
      
      const handleScrollThrottled = () => {
        if (scrollTimeout === null) {
          scrollTimeout = window.setTimeout(() => {
            checkHeaderPosition();
            scrollTimeout = null;
          }, scrollThrottleTime);
        }
      };
      
      checkHeaderPosition();
      
      window.addEventListener('scroll', handleScrollThrottled, { passive: true });
      
      window.addEventListener('resize', checkHeaderPosition, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScrollThrottled);
        window.removeEventListener('resize', checkHeaderPosition);
        clearTimeout(initialCheckTimeout);
        if (scrollTimeout) {
          window.clearTimeout(scrollTimeout);
        }
      };
    }
  }, [isHomePage, videoSectionRef, checkHeaderPosition, isMobile]);
  
  const handleScroll = useCallback(() => {
    if (!isMobile) return;
    
    const currentScrollY = window.scrollY;
    const scrollDelta = Math.abs(currentScrollY - lastScrollY);
    
    if (scrollDelta < 5) return;
    
    if (isHomePage) {
      const isInInitialViewport = currentScrollY < window.innerHeight * 0.3;
      
      if (isInInitialViewport && isOverVideo) {
        setIsExpanded(true);
        setLastScrollY(currentScrollY);
        return;
      }
      
    }
    
    const direction = currentScrollY > lastScrollY ? 'down' : 'up';
    
    if (direction !== scrollDirectionRef.current || scrollDelta > 20) {
      scrollDirectionRef.current = direction;
      
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = window.setTimeout(() => {
        if (direction === 'down' && currentScrollY > 50) {
          setIsExpanded(false);
        } else if (direction === 'up') {
          setIsExpanded(true);
        }
        scrollTimeoutRef.current = null;
      }, 100);
    }
    
    setLastScrollY(currentScrollY);
  }, [isMobile, lastScrollY, isHomePage, isOverVideo]);
  
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    const scrollTimeoutRefValue = scrollTimeoutRef;
    const transitionTimeoutRefValue = transitionTimeoutRef;
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRefValue.current) {
        window.clearTimeout(scrollTimeoutRefValue.current);
      }
      if (transitionTimeoutRefValue.current) {
        window.clearTimeout(transitionTimeoutRefValue.current);
      }
    };
  }, [handleScroll]);
  
  const toggleHeader = () => {
    setIsExpanded(!isExpanded);
  };
  
  const headerClass = `header ${!isExpanded ? 'collapsed' : ''} ${isHomePage && isOverVideo ? 'transparent' : ''}`;
  
  const showToggleButton = isMobile && !isHomePage;
  
  return (
    <div className="header-wrapper" ref={headerRef}>
      <header className={headerClass}>
        <div className={`container ${!isExpanded ? 'hidden' : ''}`}>
          <div className="logo">
            <Link to="/">
              <img src={logoSrc} alt="Radar Logo" className="radar-logo" />
              <span className="logo-text">North Sea Watch</span>
            </Link>
          </div>
          <nav className="navigation">
            <ul>
              <li className={location.pathname === '/' ? 'active' : ''}>
                <Link to="/">Home</Link>
              </li>
              <li className={location.pathname === '/map' ? 'active' : ''}>
                <Link to="/map">Map</Link>
              </li>
              <li className={location.pathname === '/abm' ? 'active' : ''}>
                <Link to="/abm">Simulation</Link>
              </li>
              <li className="noordzee-link">
                <a href="https://www.noordzee.nl/" target="_blank" rel="noopener noreferrer">
                  <img src={sdnLogoSrc} alt="Stichting De Noordzee" className="noordzee-logo" />
                </a>
              </li>
            </ul>
          </nav>
        </div>
        
        {showToggleButton && (
          <div className={`header-toggle ${!isExpanded ? 'collapsed' : ''}`} onClick={toggleHeader}>
            <span className={`toggle-icon ${isExpanded ? 'up' : 'down'}`}>
              {isExpanded ? '▲' : '▼'}
            </span>
          </div>
        )}
      </header>
    </div>
  );
};

export default Header; 