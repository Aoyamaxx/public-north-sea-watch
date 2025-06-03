import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '../features/home/components/HomePage';
import MapPage from '../features/map/components/MapPage';
import ABMPage from '../features/abm/components/ABMPage';
import PrivacyPolicyPage from '../features/privacy/components/PrivacyPolicyPage';
import { usePageTracking } from '../hooks';

function AppRouter() {
  // Initialize page tracking
  usePageTracking();
  
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/abm" element={<ABMPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
    </Routes>
  );
}

export default AppRouter;
