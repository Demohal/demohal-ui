// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AskAssistant from "./components/AskAssistant";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AskAssistant />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
