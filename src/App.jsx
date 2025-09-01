// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ShellEntry from "./components/ShellEntry";
import RecoMock from "./features/reco/RecoMock";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ShellEntry />} />
        <Route path="/reco-mock" element={<RecoMock />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
