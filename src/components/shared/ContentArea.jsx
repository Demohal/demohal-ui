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
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="h-4 rounded bg-gray-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ContentArea
 * - Renders a card that mirrors the old white “center panel”
 * - Switches content by activeTab
 * - Shell only; no API/data
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
import React from "react";

export default function ContentArea({ tabs = [], activeId }) {
  const id = typeof activeId === "string" ? activeId : (tabs[0]?.id || "ask");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {id === "ask" && (
        <div className="bg-white rounded-md border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Ask the Assistant</h2>
          <p className="text-sm text-gray-600">
            Type a question below and press send. (Placeholder UI)
          </p>
        </div>
      )}

      {id === "demos" && (
        <div className="bg-white rounded-md border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Browse Demos</h2>
          <p className="text-sm text-gray-600">Demo list goes here…</p>
        </div>
      )}

      {id === "docs" && (
        <div className="bg-white rounded-md border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Browse Documents</h2>
          <p className="text-sm text-gray-600">Document list goes here…</p>
        </div>
      )}

      {id === "price" && (
        <div className="bg-white rounded-md border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Price Estimate</h2>
          <p className="text-sm text-gray-600">
            Pricing flow placeholder (question blocks / estimate card)…
          </p>
        </div>
      )}

      {id === "meeting" && (
        <div className="bg-white rounded-md border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Schedule Meeting</h2>
          <p className="text-sm text-gray-600">
            Embed / external calendar placeholder…
          </p>
        </div>
      )}
    </div>
  );
}
