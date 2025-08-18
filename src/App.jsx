// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Adjust the import path if needed
import AskAssistant from "./components/AskAssistant";
import RecoTest from "./features/reco/RecoTest";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AskAssistant />} />
        <Route path="/reco-test" element={<RecoTest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
