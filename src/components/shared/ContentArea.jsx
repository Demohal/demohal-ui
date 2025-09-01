import React from "react";

export default function ContentArea({ mode }) {
  return (
    <div className="px-6 pt-3 pb-6 flex-1 overflow-y-auto">
      {mode === "ask" && (
        <div className="space-y-3">
          <div className="text-black text-base font-bold">Ask the Assistant</div>
          <div className="rounded-lg border border-gray-200 p-3 bg-white">
            <div className="text-sm text-gray-600">
              Placeholder for the assistant’s reply and recommended demos.
            </div>
          </div>
        </div>
      )}
      {mode === "browse" && <div className="text-sm text-gray-700">Browse Demos (placeholder)</div>}
      {mode === "docs" && <div className="text-sm text-gray-700">Browse Documents (placeholder)</div>}
      {mode === "price" && <div className="text-sm text-gray-700">Price Estimator (placeholder)</div>}
      {mode === "meeting" && <div className="text-sm text-gray-700">Schedule Meeting (placeholder)</div>}
    </div>
  );
}
