import React, { useRef, useState } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

export default function AskBar({ onSend }) {
  const [input, setInput] = useState("");
  const ref = useRef(null);

  const submit = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput("");
  };

  return (
    <div className="px-4 py-3 border-t border-gray-200">
      <div className="relative w-full">
        <textarea
          ref={ref}
          rows={1}
          className="w-full border rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--field-bg)]"
          placeholder="Ask your question here"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={(e) => {
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          aria-label="Send"
          onClick={submit}
          className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
        >
          <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:brightness-110" />
        </button>
      </div>
    </div>
  );
}
