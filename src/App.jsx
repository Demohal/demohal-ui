// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import DemoHalUI from "./features/ask/DemoHalUI";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoHalUI />} />
        <Route path="/new-ui" element={<DemoHalUI />} />
        <Route path="*" element={<DemoHalUI />} />
      </Routes>
    </BrowserRouter>
  );
}
