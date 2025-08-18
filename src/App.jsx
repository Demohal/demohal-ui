// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AskAssistant from "./components/AskAssistant";      // ⬅️ your path
import RecoTest from "./features/reco/RecoTest";           // ⬅️ test screen path

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
