import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CampaignPreview from "./CampaignPreview";
import Dashboard from "./agents/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CampaignPreview />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}