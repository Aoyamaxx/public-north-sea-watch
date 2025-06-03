import React from 'react';
import './Footer.css';
import radarLogo from '../../assets/images/radar.svg';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="section-header">
              <img src={radarLogo} alt="Radar Logo" className="radar-logo" />
              <span className="footer-title">North Sea Watch</span>
            </h3>
            <p>Monitoring and analyzing maritime scrubber pollutions in the North Sea.</p>
          </div>
          
          <div className="footer-section">
            <h3 className="section-header">Contact</h3>
            <p>Email: info@northseawatch.org</p>
            <p>Phone: +31 (0)6 48 01 20 49</p>
          </div>
          
          <div className="footer-section">
            <h3 className="section-header">Links</h3>
            <ul>
              <li><a href="https://github.com/NorthSeaWatch/north-sea-watch" target="_blank" rel="noopener noreferrer">GitHub (Internal Access Only)</a></li>
              <li><a href="https://www.noordzee.nl/" target="_blank" rel="noopener noreferrer">Stichting De Noordzee</a></li>
              <li><a href="/privacy-policy">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} North Sea Watch. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 