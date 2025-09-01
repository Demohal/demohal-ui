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
