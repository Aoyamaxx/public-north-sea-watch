import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../../components/layout/Layout';
import BackToTop from '../../../components/ui/BackToTop';
import SEO from '../../../components/ui/SEO';
import './HomePage.css';

const HomePage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pagestartRef = useRef<HTMLDivElement>(null);
  const cardsMiddleRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isVerySmallDevice, setIsVerySmallDevice] = useState(false);
  
  // Check for mobile devices
  useEffect(() => {
    const checkIfMobile = () => {
      setIsTablet(window.innerWidth <= 1024);
      setIsMobile(window.innerWidth <= 768);
      setIsVerySmallDevice(window.innerWidth <= 320);
    };
    
    // Check on initial load
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  // Ensure video fills the screen properly
  useEffect(() => {
    if (videoRef.current) {
      // Store ref in local variable to avoid stale references in cleanup
      const videoElement = videoRef.current;
      
      // Force video to reload and apply new styles
      videoElement.load();
      
      // On mobile or very small screens, try to set playback quality to avoid performance issues
      if ((isMobile || isVerySmallDevice) && 'mediaSource' in videoElement) {
        // If available in the browser, set video quality lower on mobile
        try {
          const videoWithMedia = videoElement as any;
          if (videoWithMedia.mediaSource && videoWithMedia.mediaSource.setQualityLevel) {
            videoWithMedia.mediaSource.setQualityLevel('low');
          }
        } catch (e) {
          // Silently fail if this API isn't available
          console.log('Video quality adjustment not supported');
        }
      }
      
      // Add play event handler to ensure video starts properly
      const handleCanPlay = () => {
        if (videoElement && videoElement.paused) {
          videoElement.play().catch(err => {
            console.log('Auto-play prevented:', err);
          });
        }
      };
      
      videoElement.addEventListener('canplay', handleCanPlay);
      
      return () => {
        // Use the stored reference instead of potentially stale videoRef.current
        videoElement.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [isMobile, isVerySmallDevice]);
  
  const scrollExploreRef = () => {
    if (exploreRef.current) {
      // Get the element
      const element = exploreRef.current;
      
      // Calculate the position to scroll to
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + window.pageYOffset;
      const elementCenter = elementTop - (window.innerHeight / 1.6) + (rect.height / 2);
      
      // Scroll to the center position
      window.scrollTo({
        top: elementCenter,
        behavior: 'smooth'
      });
    }
  };

  const scrollToPageStart = () => {
    if (pagestartRef.current) {
      // Get the element
      const element = pagestartRef.current;
      
      // Calculate the position to scroll to
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + window.pageYOffset;
      const elementCenter = elementTop - (rect.height / 3.5);
      
      // Scroll to the center position
      window.scrollTo({
        top: elementCenter,
        behavior: 'smooth'
      });
    }
  };

  const [hiddenOne, setHiddenOne] = useState(true);
  const [hiddenTwo, setHiddenTwo] = useState(true);

  return (
    <Layout className="transparent-header" videoSectionRef={heroSectionRef}>
      <SEO 
        title="North Sea Watch - Unveiling the Hidden Impact of Shipping" 
        description="Scrubbers promise cleaner air, but at what cost? While they reduce air pollution, they dump acidic waste into the ocean, harming marine life and coastal ecosystems."
        canonicalUrl="/"
        jsonLd={{
          organization: {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "North Sea Watch",
            "url": "https://northseawatch.org",
            "logo": "https://northseawatch.org/logo512.png",
            "description": "North Sea Watch is dedicated to monitoring and researching the environmental impact of shipping in the North Sea region.",
            "sameAs": [
              "https://twitter.com/northseawatch",
              "https://facebook.com/northseawatch"
            ]
          },
          website: {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "North Sea Watch",
            "url": "https://northseawatch.org",
            "description": "Scrubbers promise cleaner air, but at what cost? While they reduce air pollution, they dump acidic waste into the ocean, harming marine life and coastal ecosystems."
          },
          webpage: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "url": "https://northseawatch.org/",
            "name": "North Sea Watch - Unveiling the Hidden Impact of Shipping",
            "description": "Scrubbers promise cleaner air, but at what cost? While they reduce air pollution, they dump acidic waste into the ocean, harming marine life and coastal ecosystems.",
            "isPartOf": {
              "@type": "WebSite",
              "name": "North Sea Watch",
              "url": "https://northseawatch.org"
            },
            "about": {
              "@type": "Thing",
              "name": "Maritime Pollution",
              "description": "The environmental impact of shipping and marine scrubber systems"
            }
          }
        }}
      />
      <div className="home-page">
        {/* Hero Video Section */}
        <section className="hero-section" ref={heroSectionRef}>
          <video 
            ref={videoRef}
            className="hero-video" 
            autoPlay 
            muted 
            loop
            playsInline
            preload="auto"
          >
            <source src={require('../../../assets/videos/homepage_video.mp4')} type="video/mp4" />
          </video>
          <div className="video-overlay" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
            <div className="hero-text-container" style={{ textAlign: 'left' }}>
              <h1 className="hero-title" style={{ textAlign: 'left' }}>Unveiling the Hidden Impact of Shipping{''}{!isVerySmallDevice && ': How Scrubbers Shift Pollution'}</h1>
              <h2 className="hero-subtitle" style={{ textAlign: 'left' }}>Scrubbers promise cleaner air, but at what cost? While they reduce air pollution, they dump acidic waste into the ocean, harming marine life and coastal ecosystems. Explore how these 'solutions' shift pollution rather than solving it.</h2>
              <button className="hero-button" onClick={scrollExploreRef}>Start Exploring</button>
              {isTablet && <p className="hero-subtitle" style={{ textAlign: 'left' }}>Powered By <a href="https://www.noordzee.nl">The North Sea Foundation</a></p>}
            </div>
          </div>
          <div className="scroll-arrow" onClick={scrollToPageStart} style={{ zIndex: 200, pointerEvents: 'auto' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 10L12 15L17 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </section>

        {/* Transition Module - Gradient Blur Transition */}
        <div className="video-transition">
          <div className="transition-content" ref={pagestartRef}>
            <h2>The Problem With Scrubbers</h2>
            <p>Scrubber technology has been widely adopted in the shipping industry to circumvent air pollution regulations. However, their environmental impact remains largely hidden from public view, creating a significant ecological concern as these systems transfer pollution from air to water.</p>
          </div>
        </div>
        
        {/* Info Blocks - Moved below the transition */}
        <div className="intro-blocks-container">
          <div className="intro-blocks" ref={cardsMiddleRef}>
            <div className="intro-block" id="block-1" onMouseEnter={() => setHiddenOne(false)} onMouseLeave={() => setHiddenOne(true)}>
              <h1 className="intro-heading">What are scrubbers?</h1>
              {!isTablet && <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10L12 15L17 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              <p className={`intro-text ${hiddenOne && !isTablet ? "hidden-text" : "visible-text"}`}>
                Exhaust gas cleaning systems, or scrubbers, are installed on ships to remove sulphur from air emissions. They do this by treating the exhaust gases with seawater. In the case of 'open-loop' scrubbers, which is approximately 80% of all scrubbers, this contaminated water is directly dumped back into sea.
              </p>
            </div>
            <div className="intro-block" id="block-2" onMouseEnter={() => setHiddenTwo(false)} onMouseLeave={() => setHiddenTwo(true)}>
              <h1 className="intro-heading">Why are they a problem?</h1>
              {!isTablet && <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10L12 15L17 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              <p className={`intro-text ${hiddenTwo && !isTablet ? "hidden-text" : "visible-text"}`}>
                The discharge of scrubber water leads to ocean acidification, harm to marine life, and bioaccumulation of carcinogenic toxins in the food chain. Instead of solving the issue, scrubbers create a pollution trade-off: air quality marginally improves, but water quality worsens, as it gets riddled with sulphates, harmful heavy metals, and PAHs.
              </p>
            </div>
          </div>
        </div>

        {/* Diagram */}
        {!isTablet && (
        <div className="diagram-container">
          <h2>How Do Scrubbers Work?</h2>
          <div className="diagram-steps">
            <h3>1.</h3><p>Seawater is pumped into the ship</p>
            <h3>2.</h3><p>The engine's exhaust gas is sprayed with seawater</p>
            <h3>3.</h3><p>The remaining exhaust gas is released in the air</p>
            <h3>4.</h3><p>The contaminated scrubber water is dumped into the ocean</p>
          </div>
          <div className="diagram-image"></div>
        </div>
        )}
        
        <div className="section-divider">
          <div className="divider-line"></div>
        </div>

        {/* Section Containing Summary Statistics */}
        <div className="stats-container">
          <h2>How Big Is This Problem?</h2>
          <div className="stats-boxes">
            <div className="stats-box">
              <svg 
                viewBox="0 0 16 16" 
                fill="none" 
                stroke="#3498db"
              >
                <g 
                  id="SVGRepo_bgCarrier" 
                  strokeWidth="0"
                >
                </g>
                <g 
                  id="SVGRepo_tracerCarrier" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                </g>
                <g 
                  id="SVGRepo_iconCarrier"
                >
                  <path 
                    d="M11 1H5V3.89181L7.99999 2.89182L11 3.89182V1Z" 
                    fill="#3498db"
                  >
                  </path>
                  <path 
                    d="M8 5L2 7L3 13H1V15H3.19258L5.5 14.077L8 15.077L10.5 14.077L12.8074 15H15V13H13L14 7L8 5Z" 
                    fill="#3498db"
                  >
                  </path>
                </g>
              </svg>
              <h3>Over 4.000 Ships Currently Have Scrubber Systems Installed</h3>
            </div>
            <div className="stats-box">
              <svg 
                fill="#3498db" 
                version="1.1" 
                id="Capa_1" 
                viewBox="0 0 468.562 468.562" 
                >
                  <g 
                    id="SVGRepo_bgCarrier" 
                    strokeWidth="0">
                  </g>
                  <g 
                    id="SVGRepo_tracerCarrier" 
                    strokeLinecap="round" 
                    strokeLinejoin="round">
                  </g>
                  <g 
                    id="SVGRepo_iconCarrier"
                  > 
                    <g> 
                      <path 
                        d="M71.719,439.875c-5.279,0-9.562,7.306-9.562,14.344s4.284,14.344,9.562,14.344h9.562h306h9.562 c5.278,0,9.562-7.306,9.562-14.344s-4.284-14.344-9.562-14.344h-9.562V76.5h9.562c5.278,0,9.562-7.411,9.562-14.344 c0-6.933-4.284-14.344-9.562-14.344h-9.562h-306h-9.562c-5.279,0-9.562,7.411-9.562,14.344c0,6.933,4.284,14.344,9.562,14.344 h9.562v363.375H71.719z M229.5,299.488c10.348,0,19.861-3.356,27.693-8.932l28.295,49.123 c-16.189,10.309-35.362,16.371-55.988,16.371c-22.128,0-42.62-6.923-59.517-18.666l28.668-49.429 C207.009,295.051,217.682,299.488,229.5,299.488z M207.315,255.27c0-11.801,9.562-21.363,21.363-21.363 c11.8,0,21.362,9.562,21.362,21.363c0,11.799-9.562,21.362-21.362,21.362C216.877,276.632,207.315,267.068,207.315,255.27z M258.054,222.51l28.42-52.297c27.808,8.163,52.058,42.913,47.21,87.975h-56.85C275.247,239.062,268.295,230.169,258.054,222.51z M182.165,258.188h-56.849c-7.285-44.062,22.715-76.562,48.146-85.47l28.344,46.024 C191.078,226.383,183.801,239.062,182.165,258.188z">
                      </path> 
                      <rect 
                        x="109.969" 
                        width="47.812" 
                        height="28.688">
                      </rect> 
                    </g> 
                  </g>
              </svg>
              <h3>Almost 10 Billion Tonnes of Scrubber Wastewater Is Discharged Into Seas Each Year</h3>
            </div>
            <div className="stats-box">
              <svg 
                width="200px" 
                version="1.1" 
                id="Capa_1" 
                viewBox="0 0 450.492 450.492" 
                fill="#3498db"
              >
                <g 
                  id="SVGRepo_bgCarrier" 
                  strokeWidth="0"
                >
                </g>
                <g 
                  id="SVGRepo_tracerCarrier" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                </g>
                <g 
                  id="SVGRepo_iconCarrier"
                > 
                  <g>
                    <g>
                      <g>
                        <path 
                          d="M246.233,94.096c0-11.402-9.536-20.644-21.309-20.644c-11.734,0-21.231,9.252-21.231,20.644 s9.506,20.644,21.231,20.644C236.716,114.731,246.233,105.488,246.233,94.096z M50.605,0v349.293H160.49l64.757,101.199 l64.766-101.199h109.875V0H50.605z M328.585,256.33l-21.016-20.4c-14.577,11.988-27.65,42.549-84.483,43.985 c-45.119,0-63.955-27.767-80.565-41.181l-19.189,18.612l-10.962-70.042l72.172,10.63l-19.882,19.296 c0,0,17.068,28.373,46.516,30.336l-0.068-115.317c-15.906-5.53-27.376-20.185-27.376-37.547c0-22.1,18.446-40.028,41.23-40.028 c22.804,0,41.269,17.918,41.269,40.028c0,17.645-11.812,32.437-28.138,37.752c0.117,22.51,0.459,115.542-0.02,115.542 c24.425-0.674,47.249-33.678,47.249-33.678l-18.622-18.055L339,185.643L328.585,256.33z"
                        >
                        </path>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
              <h3>Many North Sea Countries And Ports Still Allow Discharge Of Scrubber Water</h3>
            </div>
          </div>
          <p>
            See where in the North Sea scrubbers have the biggest impact, and see what ports and harbours are doing to combat this issue.
          </p>
          <button className="map-button"><Link to="/map">Explore The Map</Link></button>
        </div>

        <div className="section-divider">
          <div className="divider-line"></div>
        </div>

        {/* Section Containing Actionable Solutions */}
        <div className="action-section">
          <h2>What Can We Do?</h2>
          <p>Scrubbers are a short-term fix for a long-term problem. Instead of shifting pollution from air to water, we need real solutions:</p>
          <div className="solutions-containers">
            <div className="solution-container" id="sc-left">
            </div>
            <div className="solution-container" id="sc-right">
              <div className="sc-right-blocks">
                <h3>Alternative Fuels</h3>
                <p>Ships can adopt cleaner fuel options to adhere to sulphur emission restrictions. In addition to lowering risks of sulphur pollution, this also reduces other types of emissions, reducing environmental impact even further.</p>
              </div>
              <div className="sc-right-blocks">
                <h3>Regulatory Bans</h3>
                <p>Ports, countries, and international authorities such as the International Maritime Organisation (IMO), can implement bans and regulations on the usage of scrubbers or the discharge of their wastewater.</p>
              </div>
              <div className="sc-right-blocks">
                <h3>Economic Incentives</h3>
                <p>To make the usage of scrubbers less appealing, governments and ports could implement financial penalties for ships that use scrubbers, or reward ships that don't.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="section-divider">
          <div className="divider-line"></div>
        </div>

        {/* Section showing our tools */}
        <div className="tools-section" ref={exploreRef}>
          <h2>How Does This Website Help?</h2>
          <p>North Sea Watch offers interactive and data driven tools to shine light on a seemingly invisible threat to the North Sea. By leveraging digital innovation, we aim to inspire policymakers and regulatory organisations to bring an end to this crisis.</p>
          <div className="tools-containers">
            <div className="tools-container" id="tc-left">
              <h3>Explore The Map</h3>
              <p>The North Sea Watch map displays real-time ship movements and scrubber related pollution levels. By highlighting problematic pollution zones, the map can inspire relevant stakeholders to take action.</p>
              <div className="tools-image" id="map-image">
                <button><Link to="/map">Take Me To The Map</Link></button>
              </div>
            </div>
            <div className="tools-container" id="tc-right">
              <h3>Test Policy Solutions</h3>
              <p>North Sea Watch offers a simulation tools which allows users to test the impact of potential scrubber regulations. This tool aims to support policymakers who are seeking to tackle scrubber pollution.</p>
              <div className="tools-image" id="simulation-image">
                <button><Link to="/abm">Start Simulating</Link></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BackToTop showOffset={300} />
    </Layout>
  );
};

export default HomePage;