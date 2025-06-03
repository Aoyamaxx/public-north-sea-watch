import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  className?: string; 
  videoSectionRef?: React.RefObject<HTMLElement>; 
}

const Layout: React.FC<LayoutProps> = ({ children, className, videoSectionRef }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isMapPage = location.pathname === '/map';
  const [headerHeight, setHeaderHeight] = useState(60); // Default height
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Check if footer should be hidden
  const hideFooter = className?.includes('no-footer') || false;
  
  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  // Monitor header height changes and update CSS variables
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const headerElement = headerRef.current.querySelector('.header');
        const isCollapsed = headerElement?.classList.contains('collapsed');
        const height = isCollapsed ? 0 : (headerElement ? headerElement.getBoundingClientRect().height : 0);
        
        // Set global CSS variable for other components positioning
        document.documentElement.style.setProperty('--header-height', `${height}px`);
        setHeaderHeight(height);
        
        // Add special class to body if header is collapsed in map page
        if (isMapPage) {
          if (isCollapsed) {
            document.body.classList.add('map-header-collapsed');
          } else {
            document.body.classList.remove('map-header-collapsed');
          }
        }
      }
    };
    
    // Initial update
    updateHeaderHeight();
    
    // Listen for window resize events
    window.addEventListener('resize', updateHeaderHeight);
    
    // Create a MutationObserver to monitor header element changes (expand/collapse)
    const observer = new MutationObserver(updateHeaderHeight);
    
    if (headerRef.current) {
      observer.observe(headerRef.current, { 
        attributes: true, 
        childList: true, 
        subtree: true 
      });
    }
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      observer.disconnect();
      document.body.classList.remove('map-header-collapsed');
    };
  }, [isHomePage, isMapPage]);
  
  return (
    <div 
      className={`layout ${className || ''} ${isMapPage ? 'map-layout-container' : ''}`} 
      style={{ '--header-height': `${headerHeight}px` } as React.CSSProperties}
    >
      <div ref={headerRef}>
        <Header videoSectionRef={videoSectionRef} />
      </div>
      <main className="main-content">
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
};

export default Layout; 