// Ask input bar — presentational
// Props: { value, onChange, onSend, inputRef, placeholder? }

import React from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

export default function AskInputBar({ value, onChange, onSend, inputRef, placeholder = "Ask your question here" }) {
  return (
    <div className="px-4 py-3 border-t border-[var(--border-default)]">
      <div className="relative w-full">
        <textarea
          ref={inputRef}
          rows={1}
          className="w-full rounded-[0.75rem] px-4 py-2 pr-14 text-base placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--card-bg)] border border-[var(--border-default)] focus:border-[var(--border-default)] focus:ring-1 focus:ring-[var(--border-default)] outline-none"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => {
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          aria-label="Send"
          onClick={onSend}
          className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
        >
          <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:brightness-110" />
        </button>
      </div>
    </div>
  );
}
