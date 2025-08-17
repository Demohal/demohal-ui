// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ⬇️ CHANGE THIS PATH to match your repo
// e.g. "./features/ask/AskAssistant" or "./AskAssistant"
import AskAssistant from "./components/AskAssistant";

// New themed MVP screen (kept for later testing)
import DemoHalUI from "./features/ask/DemoHalUI";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default to your baseline app */}
        <Route path="/" element={<AskAssistant />} />

        {/* Keep the new UI available for testing */}
        <Route path="/new-ui" element={<DemoHalUI />} />

        {/* Anything unknown goes back to baseline */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
