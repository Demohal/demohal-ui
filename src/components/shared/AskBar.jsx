import React, { useRef, useEffect } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

export default function AskBar({
  value = "",
  placeholder = "Ask your question here",
  onChange,
  onSend,
  disabled = false,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  const send = () => {
    if (disabled) return;
    const text = (value || "").trim();
    if (!text) return;
    onSend && onSend(text);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="px-4 sm:px-6 py-3">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="w-full rounded-[var(--radius-field)] px-4 py-3 text-base bg-[var(--field-bg)] border border-[var(--field-border)] resize-none focus:outline-none"
        />
        <button
          type="button"
          aria-label="Send"
          onClick={send}
          disabled={disabled}
          className="absolute right-3 bottom-3 active:scale-95 disabled:opacity-50"
        >
          <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)] transition-colors" />
        </button>
      </div>
    </div>
  );
}
