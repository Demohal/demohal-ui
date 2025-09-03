import React from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

export default function AskBar({
  value = "",
  onChange = () => {},
  onSend = () => {},
  placeholder = "Ask your question here",
}) {
  return (
    <div className="px-4 py-3">
      <div className="relative w-full">
        <textarea
          rows={1}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-white"
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
          <ArrowUpCircleIcon className="w-8 h-8 text-red-600 hover:opacity-80" />
        </button>
      </div>
    </div>
  );
}
