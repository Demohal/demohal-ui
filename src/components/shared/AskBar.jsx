import React, { useRef, useState } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

/**
 * Unified hover: no separate hover color; we just “lighten” the token.
 */
export default function AskBar({ onSend }) {
  const [text, setText] = useState("");
  const taRef = useRef(null);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    if (taRef.current) {
      taRef.current.style.height = "auto";
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Ask your question here"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
      />
      <button
        aria-label="Send"
        onClick={send}
        className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95 transition-transform"
      >
        <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color,#cc2b2b)] hover:brightness-110" />
      </button>
    </div>
  );
}
