import React, { useState } from "react";

/**
 * AskScreen (shell)
 * - Upper scrollable area (placeholder for now)
 * - Bottom Ask bar inside the card
 */
export default function AskScreen() {
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-sm text-gray-700">
          <p className="font-semibold mb-2">Ask the Assistant</p>
          <p>
            This is a shell placeholder. We’ll wire in the real message list,
            mirrors, and recommended demos here as we progress.
          </p>
        </div>
      </div>

      {/* Bottom ask bar (inside the card) */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="relative">
          <textarea
            rows={1}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-12 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-white outline-none"
            placeholder="Ask your question here"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={(e) => {
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                // no-op send in shell
              }
            }}
          />
          <button
            aria-label="Send"
            onClick={() => {/* no-op in shell */}}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--send-color,#dc2626)] text-white hover:opacity-90 active:scale-95"
            title="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
