// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Baseline screen (leave it as-is)
import AskAssistant from "./features/ask/AskAssistant";

// NEW themed MVP screen (browse + watch only; no recommendations yet)
import DemoHalUI from "./features/ask/DemoHalUI";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Keep your original entry route */}
        <Route path="/" element={<AskAssistant />} />

        {/* NEW: access at /new-ui?alias=demo */}
        <Route path="/new-ui" element={<DemoHalUI />} />

        {/* Fallback to baseline for any unknown path */}
        <Route path="*" element={<AskAssistant />} />
      </Routes>
    </BrowserRouter>
  );
}
