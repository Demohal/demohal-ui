// src/components/shared/ContentArea.jsx
import React from "react";
import AskScreen from "../ask/AskScreen";

function Placeholder({ title, lines = 4 }) {
  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-4 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ContentArea
 * - Renders the white “center card” like the old UI.
 * - Switches content by activeTab (shell-only).
 */
export default function ContentArea({ activeTab }) {
  return (
    <div className="w-full flex-1 bg-white border border-gray-200 rounded-[12px] shadow-sm flex flex-col">
      {activeTab === "ask" && <AskScreen />}
      {activeTab === "demos" && <Placeholder title="Browse Demos (shell)" />}
      {activeTab === "docs" && <Placeholder title="Browse Documents (shell)" />}
      {activeTab === "price" && <Placeholder title="Price Estimate (shell)" lines={6} />}
      {activeTab === "meeting" && <Placeholder title="Schedule Meeting (shell)" lines={6} />}
    </div>
  );
}
