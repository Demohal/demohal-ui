// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AskAssistant from "./components/AskAssistant";
import RecoMock from "./features/reco/RecoMock";  // ⬅️ new test page

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AskAssistant />} />
        <Route path="/reco-mock" element={<RecoMock />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
