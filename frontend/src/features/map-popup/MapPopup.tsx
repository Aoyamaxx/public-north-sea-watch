// src/features/home/components/MapPopup.tsx
import './MapPopup.css';
import { useState, useEffect, useCallback } from 'react';

// Import .svg icons
import warningYellowScrubberIcon from '../../assets/images/warning_yellow_scrubber.svg';
import portsIconPartialBan from '../../assets/images/ports32_partial_ban_dash_outline.svg';
import portsIconTotalBan from '../../assets/images/ports32_total_ban_dash_outline.svg';
import buttonQuestionMark from '../../assets/images/question-circle-fill.svg'

// Placeholder component to handle image loading errors
const ImageWithFallback = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  
  // Fallback image as SVG data URL for map icon
  const fallbackSrc = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Cpath d='M25 25 L75 25 L75 75 L25 75 Z' stroke='%23007bff' stroke-width='2' fill='%23e6f2ff'/%3E%3Ccircle cx='40' cy='40' r='5' fill='%23007bff'/%3E%3Ccircle cx='60' cy='60' r='5' fill='%23007bff'/%3E%3Cpath d='M40 40 L60 60' stroke='%23007bff' stroke-width='2' stroke-dasharray='4'/%3E%3C/svg%3E`;

  return (
    <img 
      src={error ? fallbackSrc : src} 
      alt={alt} 
      className={className}
      onError={() => setError(true)}
    />
  );
};

export function MapPopup({ onClose }: { onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [device, setDevice] = useState({
    isMobile: window.innerWidth <= 768,
    isVerySmall: window.innerWidth <= 480
  });

  // Determine number of pages based on screen size
  const totalPages = device.isMobile ? 5 : 4;
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDevice({
        isMobile: window.innerWidth <= 768,
        isVerySmall: window.innerWidth <= 480
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Safe image loader function with try/catch
  const loadImage = useCallback((imagePath: string) => {
    try {
      return require(`../../assets/images/${imagePath}`);
    } catch (error) {
      console.error(`Failed to load image: ${imagePath}`, error);
      return null;
    }
  }, []);

  // Function to navigate to ABM page
  const goToAbmPage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Close the popup first
    onClose();
    // Navigate to ABM page
    window.location.href = '/abm';
  }, [onClose]);

  if (!isVisible) return null;

  // Render progress dots
  const renderProgressDots = () => {
    return (
      <div className="map-popup-progress">
        {Array.from({ length: totalPages }).map((_, index) => (
          <span
            key={index}
            className={`map-popup-progress-dot ${index < page ? 'visited' : ''} ${index === page ? 'active' : ''}`}
          >
            •
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="map-popup-overlay">
      <div className="map-popup">
        <div className="map-popup-close-button" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </div>
        
        {/* Progress indicators */}
        {renderProgressDots()}
        
        <div className="map-popup-content">
          {/* Welcome page - same for all devices */}
          {page === 0 && (
            <div className="map-popup-page">
              <h2>
                Welcome to North Sea Watch
              </h2>
              <p className={device.isMobile ? "map-popup-welcome-text-mobile" : ""}>
                This is a maritime information system, displaying real-time data on scrubber pollution.
              </p>
              {!device.isMobile && (
              <div className="map-popup-intro-blocks">
                <div className="map-popup-left">
                    <ImageWithFallback 
                      src={loadImage("tutorial-ship.png") || ""} 
                      alt="Ship Click"
                    />
                  <p>Click on ships to reveal their known path and learn about their specifications.</p>
                </div>
                <div className="map-popup-middle">
                    <ImageWithFallback 
                      src={loadImage("tutorial-port.png") || ""} 
                      alt="Port Click"
                    />
                  <p>Click on ports to learn more about their details and policy measures.</p>
                </div>
                <div className="map-popup-right">
                    <ImageWithFallback 
                      src={loadImage("tutorial-heatmap.png") || ""} 
                      alt="Heatmap Click"
                    />
                <p>Toggle the pollution heatmap through settings to view pollution distribution.</p>
                  </div>
                </div>
              )}
              <div className="map-popup-skip-notice">
                <h3>
                  Already familiar with the map?
                </h3>
                <p>You can also <span className="map-popup-skip-link" onClick={onClose}>skip</span> to start exploring directly.</p>
              </div>
              {device.isMobile && (<p><i>For a better experience, visit North Sea Watch via a computer.</i></p>)}
            </div>
          )}

          {/* For desktop: How it works page with 3 columns */}
          {page === 1 && !device.isMobile && (
            <div className="map-popup-page">
              <h2 id="map-popup-second-page-h2">How Does it Work?</h2>
              <div className="map-popup-intro-blocks">
                <div className="map-popup-left">
                  <svg fill="#3498db" version="1.1" id="Capa_1" viewBox="0 0 49.442 49.442"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><g><path d="M25.323,2.811c6.39,0,12.095,2.969,15.824,7.592l-2.448,1.73l7.704,2.63l-0.801-7.505l-2.157,1.523 C39.202,3.437,32.66,0,25.323,0c-3.613,0-7.035,0.834-10.085,2.316l0.898,2.696C18.898,3.608,22.018,2.811,25.323,2.811z"></path><path d="M45.499,28.365c-0.707,3.018-2.108,5.917-4.238,8.441c-4.121,4.886-10.067,7.332-16.007,7.203l0.258-2.988l-6.978,4.193 l6.252,4.228l0.228-2.632c6.818,0.201,13.666-2.584,18.396-8.19c2.33-2.763,3.897-5.915,4.731-9.203L45.499,28.365z"></path><path d="M5.632,31.42c-2.427-5.91-1.848-12.315,1.014-17.522l2.529,1.61L8.682,7.381l-6.638,3.59l2.229,1.418 c-3.331,5.953-4.027,13.313-1.24,20.099c1.371,3.345,3.442,6.191,5.972,8.451l2.153-1.856C8.809,37.062,6.886,34.477,5.632,31.42z "></path><path d="M25.325,38.596l0.363-0.031c0.018,0,0.033,0.002,0.05,0.002c4.957,0,9.357-2.415,12.091-6.129 c0.478-0.649,0.901-1.34,1.271-2.062c0.829-1.619,1.374-3.408,1.563-5.302c0.05-0.491,0.075-0.989,0.075-1.493 c0-0.076-0.005-0.152-0.006-0.229c-0.021-1.376-0.229-2.708-0.6-3.972c-0.137-0.467-0.295-0.923-0.475-1.37 c-0.365-0.906-0.815-1.77-1.344-2.579c-0.239-0.367-0.494-0.723-0.764-1.066c-0.739-0.943-1.588-1.795-2.527-2.538 c-0.322-0.254-0.653-0.497-0.995-0.725c-2.377-1.582-5.229-2.506-8.292-2.506c-2.712,0-5.255,0.727-7.453,1.989 c-0.361,0.208-0.713,0.429-1.055,0.664c-0.965,0.667-1.85,1.443-2.634,2.313c-0.303,0.335-0.591,0.684-0.862,1.045 c-0.752,1.001-1.379,2.099-1.863,3.27c-0.186,0.448-0.349,0.906-0.49,1.375c-0.382,1.257-0.598,2.583-0.632,3.954 c-0.003,0.126-0.01,0.25-0.01,0.376c0,0.458,0.024,0.91,0.064,1.356c0.151,1.672,0.578,3.262,1.233,4.729 c0.341,0.763,0.741,1.491,1.199,2.181c2.616,3.937,7.044,6.565,12.085,6.705C25.324,38.575,25.325,38.592,25.325,38.596z M26.088,30.008c1.619-0.018,3.183-0.181,4.681-0.459c-0.354,1.498-0.812,2.848-1.271,3.99c-1.059,0.126-2.146,0.199-3.255,0.204 C26.187,32.624,26.131,31.36,26.088,30.008z M27.729,37.176c-0.417,0.062-0.84,0.103-1.268,0.125 c-0.042-0.593-0.095-1.385-0.149-2.328c0.894-0.006,1.771-0.053,2.632-0.137C28.414,35.99,27.95,36.805,27.729,37.176z M29.922,36.678c-0.194,0.062-0.392,0.114-0.589,0.168c0.301-0.562,0.668-1.301,1.048-2.185c0.555-0.082,1.104-0.173,1.641-0.284 C31.083,35.545,30.267,36.352,29.922,36.678z M30.91,33.334c0.445-1.193,0.876-2.561,1.194-4.072 c1.218-0.295,2.373-0.672,3.463-1.123c-0.607,1.783-1.506,3.385-2.415,4.715C32.427,33.045,31.676,33.202,30.91,33.334z M32.849,35.336c0.354-0.431,0.728-0.912,1.103-1.439c0.451-0.129,0.897-0.266,1.333-0.414 C34.548,34.189,33.727,34.805,32.849,35.336z M36.993,31.492c-0.638,0.291-1.308,0.553-1.994,0.791 c0.84-1.413,1.599-3.045,2.067-4.836c0.773-0.395,1.517-0.816,2.194-1.286C38.889,28.117,38.101,29.924,36.993,31.492z M39.509,23.58c0,0.31-0.014,0.615-0.034,0.92c-0.636,0.51-1.335,0.982-2.088,1.415c0.118-0.767,0.182-1.552,0.168-2.359 c-0.01-0.589-0.063-1.166-0.148-1.733c0.63-0.431,1.213-0.893,1.735-1.387C39.379,21.447,39.509,22.498,39.509,23.58z M38.759,19.112c-0.474,0.502-1.015,0.973-1.607,1.411c-0.248-1.008-0.597-1.973-1.009-2.886c0.495-0.376,0.952-0.778,1.354-1.207 C38.01,17.269,38.434,18.168,38.759,19.112z M34.281,12.803c0.946,0.751,1.795,1.621,2.516,2.591 c-0.35,0.4-0.753,0.777-1.198,1.132c-0.603-1.139-1.286-2.178-1.973-3.093C33.86,13.232,34.08,13.023,34.281,12.803z M34.571,17.246c-0.792,0.492-1.682,0.915-2.648,1.254c-0.303-1.226-0.674-2.385-1.072-3.444c0.641-0.247,1.229-0.548,1.767-0.888 C33.297,15.078,33.979,16.116,34.571,17.246z M33.295,12.089c-0.128,0.136-0.275,0.261-0.42,0.388 c-0.374-0.455-0.737-0.869-1.079-1.238C32.313,11.493,32.817,11.774,33.295,12.089z M28.993,10.22 c0.328,0.284,1.531,1.365,2.871,2.993c-0.445,0.271-0.935,0.511-1.461,0.712c-0.668-1.604-1.353-2.915-1.856-3.805 C28.697,10.152,28.845,10.184,28.993,10.22z M26.515,9.854c0.155,0.009,0.311,0.019,0.463,0.032 c0.414,0.676,1.334,2.27,2.231,4.407c-0.911,0.229-1.896,0.359-2.93,0.359c-0.002,0-0.003,0-0.003,0 C26.37,12.417,26.464,10.715,26.515,9.854z M26.225,15.881c0.019,0,0.037,0.002,0.055,0.002c1.194,0,2.334-0.162,3.386-0.445 c0.397,1.053,0.771,2.207,1.07,3.424c-1.381,0.362-2.882,0.566-4.456,0.566c-0.058,0-0.115-0.004-0.174-0.005 C26.142,18.163,26.183,16.973,26.225,15.881z M25.909,20.582c4.751,0.012,8.312-1.703,9.188-2.236 c0.406,0.923,0.896,2.676,0.951,2.908c0.055,0.232,0.215,0.818,0.206,1.281s-0.041,3.123-0.266,4.107 c-1.011,0.473-5.35,2.131-9.936,2.139c-4.587,0.008-9.145-1.561-10.251-2.066c-0.235-1.006-0.367-4.123-0.094-5.375 c0.117-0.406,0.65-2.322,1.149-3.386C17.672,18.515,20.722,20.219,25.909,20.582z M25.011,33.715 c-0.961-0.035-1.903-0.117-2.822-0.246c-0.445-1.119-0.889-2.434-1.234-3.888c1.255,0.229,2.561,0.372,3.902,0.418 C24.9,31.342,24.954,32.6,25.011,33.715z M20.77,33.236c-0.772-0.148-1.524-0.328-2.254-0.538 c-0.858-1.276-1.695-2.792-2.276-4.474c1.064,0.431,2.193,0.789,3.378,1.072C19.927,30.754,20.339,32.075,20.77,33.236z M17.414,16.864c0.619-1.125,1.32-2.148,2.011-3.039c0.47,0.345,0.993,0.652,1.56,0.921c-0.409,1.06-0.798,2.223-1.117,3.46 C18.962,17.83,18.139,17.378,17.414,16.864z M21.037,18.636c0.313-1.222,0.696-2.374,1.102-3.424 c0.885,0.302,1.845,0.512,2.857,0.608c-0.043,1.095-0.084,2.286-0.12,3.548C23.516,19.264,22.223,19.014,21.037,18.636z M25.283,9.84c-0.052,0.882-0.144,2.563-0.236,4.751c-0.869-0.086-1.687-0.268-2.444-0.517c0.877-2.051,1.76-3.572,2.152-4.213 C24.929,9.849,25.106,9.846,25.283,9.84z M22.862,10.132c0.112-0.024,0.226-0.046,0.339-0.067 c-0.475,0.833-1.116,2.051-1.755,3.546c-0.453-0.217-0.882-0.454-1.26-0.726c1.44-1.694,2.656-2.716,2.686-2.74L22.862,10.132z M20.209,10.993c-0.301,0.317-0.622,0.673-0.955,1.063c-0.124-0.132-0.255-0.263-0.361-0.402 C19.317,11.409,19.758,11.193,20.209,10.993z M17.865,12.306c0.183,0.244,0.388,0.479,0.61,0.703 c-0.699,0.896-1.41,1.925-2.048,3.06c-0.461-0.426-0.866-0.879-1.197-1.361C16,13.798,16.886,12.991,17.865,12.306z M14.453,15.715c0.397,0.52,0.867,1.008,1.396,1.464c-0.521,1.075-0.958,2.228-1.247,3.441c-0.691-0.497-1.312-1.038-1.845-1.619 C13.175,17.824,13.748,16.721,14.453,15.715z M11.995,24.371c-0.016-0.262-0.025-0.525-0.025-0.791 c0-1.122,0.139-2.213,0.394-3.258c0.593,0.573,1.262,1.105,1.993,1.593c-0.076,0.538-0.125,1.085-0.135,1.641 c-0.014,0.84,0.056,1.657,0.184,2.45C13.527,25.514,12.716,24.967,11.995,24.371z M14.122,30.95 c-0.938-1.472-1.604-3.129-1.927-4.907c0.779,0.553,1.632,1.057,2.542,1.508c0.448,1.67,1.147,3.201,1.926,4.541 C15.771,31.754,14.919,31.373,14.122,30.95z M15.764,33.047c0.627,0.254,1.28,0.479,1.947,0.686 c0.519,0.742,1.038,1.4,1.511,1.957C17.934,34.992,16.766,34.1,15.764,33.047z M22.007,36.818 c-0.162-0.146-1.171-1.074-2.352-2.562c0.538,0.123,1.088,0.229,1.645,0.321c0.413,0.97,0.812,1.765,1.129,2.353 C22.288,36.895,22.147,36.858,22.007,36.818z M24.017,37.225c-0.213-0.353-0.708-1.211-1.27-2.444 c0.765,0.088,1.541,0.146,2.331,0.174c0.055,0.954,0.108,1.761,0.151,2.369C24.821,37.309,24.416,37.273,24.017,37.225z"></path><path d="M23.17,25.646h-2.504v-0.008c0.261-0.158,0.534-0.313,0.819-0.461c0.286-0.147,0.549-0.314,0.788-0.498 c0.238-0.182,0.434-0.396,0.587-0.64c0.154-0.243,0.231-0.544,0.231-0.898c0-0.291-0.055-0.548-0.164-0.768 c-0.106-0.22-0.262-0.401-0.46-0.544c-0.199-0.143-0.438-0.251-0.717-0.322c-0.277-0.071-0.584-0.108-0.917-0.108 c-0.372,0-0.707,0.055-1.007,0.159c-0.298,0.106-0.553,0.262-0.759,0.466c-0.206,0.205-0.36,0.454-0.462,0.751 c-0.101,0.298-0.14,0.638-0.117,1.019h1.494c-0.011-0.34,0.046-0.614,0.171-0.823c0.123-0.21,0.345-0.314,0.664-0.314 c0.186,0,0.343,0.048,0.472,0.148c0.131,0.097,0.195,0.273,0.195,0.527c0,0.101-0.025,0.191-0.075,0.271s-0.114,0.151-0.191,0.214 c-0.076,0.064-0.158,0.123-0.246,0.176s-0.166,0.102-0.235,0.145c-0.173,0.104-0.354,0.211-0.539,0.322 c-0.187,0.106-0.365,0.221-0.537,0.342c-0.173,0.117-0.334,0.246-0.486,0.385c-0.149,0.138-0.284,0.285-0.4,0.445 c-0.138,0.186-0.242,0.393-0.313,0.621c-0.071,0.227-0.1,0.477-0.083,0.746h4.792L23.17,25.646L23.17,25.646z"></path><path d="M26.105,26.998h1.654v-1.097h0.747v-1.353h-0.747v-3.085h-1.583l-2.528,2.942V25.9h2.457V26.998z M24.753,24.549 l1.352-1.551v1.551H24.753z"></path><path d="M30.724,24.819c0-0.164,0.021-0.298,0.062-0.399c0.04-0.104,0.089-0.187,0.149-0.242c0.062-0.061,0.129-0.1,0.203-0.121 c0.073-0.021,0.146-0.031,0.215-0.031c0.117,0,0.207,0.021,0.274,0.061c0.065,0.039,0.117,0.096,0.154,0.168 c0.038,0.07,0.062,0.156,0.07,0.258c0.012,0.101,0.018,0.209,0.018,0.326V27h1.574v-2.83c0-0.239-0.039-0.445-0.115-0.621 c-0.077-0.175-0.183-0.319-0.313-0.433c-0.133-0.114-0.284-0.2-0.454-0.259c-0.17-0.059-0.349-0.088-0.531-0.088 c-0.334,0-0.602,0.053-0.795,0.155c-0.196,0.104-0.361,0.234-0.493,0.394h-0.018v-1.995h-1.572V27h1.572V24.819z"></path></g></g></g></svg>
                  <h3>Real-time Tracking</h3>
                  <p>This site uses open-source AIS (Automatic Identification System) data to track global ship movements. Thousands of data points are processed hourly to monitor vessel traffic and estimate scrubber pollution in the North Sea.</p>
                </div>
                <div className="map-popup-middle">
                  <svg fill="#3498db" version="1.1" id="Capa_1" viewBox="0 0 101.38 101.379" stroke="#007bff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><g><path d="M100.622,70.318L80.839,50.535c6.242-8.051,5.687-19.706-1.703-27.095c-8.01-8.01-21.044-8.01-29.054,0 c-8.01,8.011-8.01,21.044,0,29.055c7.389,7.389,19.043,7.944,27.095,1.703L96.96,73.98c1.013,1.012,2.651,1.012,3.662,0.001 C101.633,72.969,101.633,71.331,100.622,70.318z M75.473,48.832c-5.99,5.991-15.738,5.992-21.729,0 c-5.991-5.99-5.991-15.738,0-21.729c5.99-5.99,15.738-5.992,21.729,0C81.464,33.093,81.464,42.841,75.473,48.832z"></path><path d="M5,66.071V12.403h89v48.086l5,5V11.903c0-2.48-2.02-4.5-4.5-4.5h-90c-2.481,0-4.5,2.02-4.5,4.5v54.668 c0,2.48,2.019,4.5,4.5,4.5h36.012v14.254c0,1.721,1.398,3.119,3.117,3.119h9.741c1.719,0,3.116-1.398,3.116-3.119V71.071H91.6 l-5-5H5z M43.629,85.325V71.071h9.741l0.002,14.256L43.629,85.325z"></path><path d="M64.49,82.077v3c-0.213,0-0.387-0.174-0.387-0.387v6.287H32.896V84.69c0,0.213-0.174,0.387-0.387,0.387v-3 c-1.441,0-2.613,1.172-2.613,2.613v6.674c0,1.441,1.172,2.613,2.613,2.613H64.49c1.441,0,2.613-1.172,2.613-2.613V84.69 C67.104,83.249,65.932,82.077,64.49,82.077z"></path><path d="M38.279,60.799h7.656c0.312,0,0.564-0.252,0.564-0.563v-9.399c-1.578-2.267-2.687-4.754-3.337-7.341l-5.448,5.67v11.071 C37.714,60.547,37.967,60.799,38.279,60.799z"></path><path d="M59.613,60.799c0.312,0,0.565-0.252,0.565-0.563v-0.264c-3.19-0.687-6.173-2.064-8.785-4.048v4.312 c0,0.312,0.253,0.563,0.564,0.563H59.613z"></path><path d="M59.613,47.749h-3.711c1.26,1.172,2.707,2.076,4.276,2.68v-2.114C60.179,48.002,59.926,47.749,59.613,47.749z"></path><path d="M72.541,60.799c0.312,0,0.564-0.252,0.564-0.563v-1.269c-2.582,0.996-5.349,1.524-8.142,1.524 c-0.2,0-0.396-0.022-0.593-0.028c0.088,0.197,0.283,0.336,0.514,0.336H72.541z"></path><path d="M72.061,36.082c-0.48,0-0.949-0.17-1.317-0.478l-1.392-1.163L64.32,39.93v11.363c0.222,0.011,0.441,0.031,0.666,0.031 c2.98,0,5.801-0.978,8.119-2.758V35.791c-0.031,0.019-0.06,0.04-0.092,0.058C72.721,36.001,72.391,36.082,72.061,36.082z"></path><path d="M57.697,44.815l11.611-12.667l2.717,2.271c0.133,0.11,0.319,0.131,0.473,0.051c0.152-0.08,0.242-0.244,0.229-0.417 l-0.59-6.585c-0.021-0.235-0.229-0.409-0.463-0.388l-6.585,0.589c-0.172,0.016-0.317,0.133-0.37,0.298 c-0.017,0.055-0.021,0.11-0.018,0.166c0.01,0.11,0.062,0.216,0.152,0.289l2.721,2.275L56.544,42.73L52,41.058 c0.227,0.96,0.557,1.888,0.986,2.77l3.488,1.283C56.906,45.269,57.389,45.153,57.697,44.815z"></path><path d="M42.486,38.646l-7.456,7.76c-0.433,0.45-0.418,1.165,0.032,1.597c0.219,0.211,0.501,0.315,0.782,0.315 c0.297,0,0.593-0.116,0.814-0.347l6.112-6.36C42.61,40.628,42.516,39.638,42.486,38.646z"></path></g></g></g></svg>
                  <h3>Data Analysis</h3>  
                  <p>Incoming AIS data is analysed continuously. By identifying ships equipped with exhaust gas cleaning systems (scrubbers), we estimate pollution levels in specific areas and display this information on the map in near real-time.</p>
                </div>
                <div className="map-popup-right">
                  <svg 
                    fill="#3498db" 
                    viewBox="-2 0 19 19" 
                    xmlns="http://www.w3.org/2000/svg" 
                    stroke="#007bff" 
                    strokeWidth="0.00019"
                  >
                    <g id="SVGRepo_iconCarrier">
                      <path 
                        d="M14.443 4.445a1.615 1.615 0 0 1-1.613 1.614h-.506v8.396a1.615 1.615 0 0 1-1.613 1.613H2.17a1.613 1.613 0 1 1 0-3.227h.505V4.445A1.615 1.615 0 0 1 4.289 2.83h8.54a1.615 1.615 0 0 1 1.614 1.614zM2.17 14.96h7.007a1.612 1.612 0 0 1 0-1.01H2.172a.505.505 0 0 0 0 1.01zm9.045-10.515a1.62 1.62 0 0 1 .08-.505H4.29a.5.5 0 0 0-.31.107l-.002.001a.5.5 0 0 0-.193.397v8.396h6.337a.61.61 0 0 1 .6.467.632.632 0 0 1-.251.702.505.505 0 1 0 .746.445zm-.86 1.438h-5.76V6.99h5.76zm0 2.26h-5.76V9.25h5.76zm0 2.26h-5.76v1.108h5.76zm2.979-5.958a.506.506 0 0 0-.505-.505.496.496 0 0 0-.31.107h-.002a.501.501 0 0 0-.194.398v.505h.506a.506.506 0 0 0 .505-.505z">
                      </path>
                    </g>
                  </svg>
                  <h3>Policy Relevance</h3>
                  <p>The North Sea Watch map highlights pollution hotspots and port regulation zones, helping users and policymakers visualise where scrubber emissions are concentrated and what rules are in effect.</p>
                </div>
                  </div>
                </div>
          )}

          {/* For desktop: Data explanation page with 3 columns */}

          {page === 2 && !device.isMobile && (
            <div className="map-popup-page">
              <h2 id="understanding-header">Understanding the Data</h2>
              <div className="explanation-block-container">
                <div className="explanation-block">
                  <h3>Sources & Limitations</h3>
                  <ul>
                    <li><p><b>AIS Data:</b> Live ship tracking data is obtained via <a href="https://aisstream.io">AIS Stream</a>, which collects AIS signals from land-based stations. Coverage may be limited in offshore areas, leading to occasional gaps.</p></li>
                    <li><p><b>Scrubber Data:</b> Scrubber-equipped vessels are identified using datasets from the International Council on Clean Transportation (ICCT).</p></li>
                    <li><p><b>Estimations:</b> Pollution calculations are based on ship type, size, and estimated power usage. Because detailed engine and fuel consumption data is scarce, we provide indicative estimates, not precise measurements.</p></li>
                   </ul>
                </div>
                <div className="explanation-block">
                   <h3>Tips</h3>
                   <ul>
                    <li><p><b>Ship Types:</b> Different ship types are marked with distinct colors. You can view the full legend via the Ship Types legend on the map.</p></li>
                    <li><p><b>Scrubbers:</b> Scrubber-equipped vessels are highlighted with <img src={warningYellowScrubberIcon} alt="Scrubber vessel icon" style={{ width: '20px', height: '20px', marginTop: '-3px', marginLeft: '3px', verticalAlign: 'middle'}}/></p></li>
                    <li><p><b>Port Regulations:</b> Ports that are labelled green <img src={portsIconTotalBan} alt="Total ban icon" style={{ width: '35px', height: '35px',verticalAlign: 'middle'}}/> represent stricter bans, whereas orange labelled ports <img src={portsIconPartialBan} alt="Partial ban icon" style={{ width: '35px', height: '35px',verticalAlign: 'middle'}}/> represent conditional restrictions. Click on ports to learn more about the specific regulations that apply.</p></li>
                   </ul>
                </div>

              </div>
            </div>
          )}

          {/* For desktop: Final page */}
          {page === 3 && !device.isMobile && (
            <div className="map-popup-page map-popup-final-page">
              <h2>
                Start Exploring!
              </h2>
              <p>Use the dashboard to begin monitoring real-time maritime data and track pollution trends.</p>
              <div className="map-popup-policy-explore">
                <h3>Looking to explore how policy changes can impact scrubber pollution?</h3>
                <p>Head over to our <a href="/abm" onClick={goToAbmPage} className="map-popup-abm-link">ABM page</a> to simulate real-world scenarios and test the impact of regulations on scrubber pollution.</p>
              </div>
              <p className="map-popup-tutorial-note">You can always access this tutorial again from the settings menu or by clicking the <img src={buttonQuestionMark} alt="Question mark icon" style={{ width: '35px', height: '35px',verticalAlign: 'middle'}}/> button.</p>
            </div>
          )}

          {/* For mobile: Ship interaction feature page */}
          {page === 1 && device.isMobile && (
            <div className="map-popup-page">
              <h2>Ship Tracking</h2>
              <div className="map-popup-feature-showcase">
                <ImageWithFallback 
                  src={loadImage("tutorial-ship.png") || ""} 
                  alt="Ship Click"
                />
                <div className="map-popup-feature-description">
                  <p>Click on ships to reveal their known path and learn about their specifications.</p>
                </div>
              </div>
                  </div>
          )}

          {/* For mobile: Port information feature page */}
          {page === 2 && device.isMobile && (
            <div className="map-popup-page">
              <h2>Port Information</h2>
              <div className="map-popup-feature-showcase">
                <ImageWithFallback 
                  src={loadImage("tutorial-port.png") || ""} 
                  alt="Port Click"
                />
                <div className="map-popup-feature-description">
                  <p>Click on ports to learn more about their details and policy measures.</p>
                </div>
              </div>
            </div>
          )}

          {/* For mobile: Pollution heatmap feature page */}
          {page === 3 && device.isMobile && (
            <div className="map-popup-page">
              <h2>Pollution Heatmap</h2>
              <div className="map-popup-feature-showcase">
                <ImageWithFallback 
                  src={loadImage("tutorial-heatmap.png") || ""} 
                  alt="Heatmap"
                />
                <div className="map-popup-feature-description">
                  <p>Toggle the pollution heatmap through settings to view pollution distribution.</p>
                </div>
              </div>
            </div>
          )}

          {/* For mobile: Final summary page */}
          {page === 4 && device.isMobile && (
            <div className="map-popup-page map-popup-final-page-mobile">
              <h2>
                Start Exploring!
              </h2>
              <p>Use the dashboard to begin monitoring real-time maritime data and track pollution trends.</p>
              <div className="map-popup-policy-explore-mobile">
                <h3>Agent Based Modelling</h3>
                <p>Head over to our <a href="/abm" onClick={goToAbmPage} className="map-popup-abm-link">ABM page</a> to simulate policy impact.</p>
              </div>
              <p className="map-popup-tutorial-note">You can always access this tutorial again from the settings menu or via the <img src={buttonQuestionMark} alt="Question mark icon" style={{ width: '25px', height: '25px',verticalAlign: 'middle'}}/> button.</p>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="map-popup-buttons">
          <div className="map-popup-left-space">
            {page > 0 ? (
              <button className="map-popup-button-next-back" onClick={handleBack}>
                Back
              </button>
            ) : (
              <button className="map-popup-button-next-back" style={{ visibility: 'hidden' }}>
                Back
              </button>
            )}
          </div>
          <div className="map-popup-middle-buttons">
            {page === totalPages - 1 ? (
              <button className="map-popup-button-skip-start" onClick={onClose}>
                Start
              </button>
            ) : (
              <button className="map-popup-button-skip-start" onClick={handleNext}>
                Next
              </button>
            )}
          </div>
          <div className="map-popup-right-button">
            {page < totalPages - 1 && (
              <button className="map-popup-button-next-back" onClick={onClose}>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}