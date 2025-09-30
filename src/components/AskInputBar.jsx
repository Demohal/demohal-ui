import React, { useEffect, useRef } from "react";

/*
  PATCH NOTES (Formatting Restore):
  - Restores padding + rounded container styling (lost after previous refactor).
  - Adds a subtle background + border tied to theme vars so it matches the rest of the UI.
  - Reintroduces consistent font + line-height + preserved whitespace look.
  - Auto‑grows the textarea (was handled in parent but safer to keep here for resilience).
  - Ensures multi-line entry keeps internal newlines (whitespace:pre-wrap).
  - Keeps Send button aligned bottom-right and disables when empty.
*/

export default function AskInputBar({
  value,
  onChange,
  onSend,
  inputRef,
  placeholder,
  disabled,
}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  // Auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend && onSend();
    }
  }

  const canSend = !!value.trim() && !disabled;

  return (
    <div className="px-4 pb-3 pt-2 bg-[var(--card-bg)] border-t border-[var(--border-default)]">
      <div className="flex items-end gap-3">
        <div
          className="flex-1 rounded-[0.85rem] border border-[var(--border-default)] bg-white/80
                     backdrop-blur-sm px-3 py-2 flex"
        >
          <textarea
            ref={ref}
            className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed
                       whitespace-pre-wrap placeholder:italic placeholder:text-gray-400
                       scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
            value={value}
            placeholder={placeholder || "Type your question..."}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            spellCheck="true"
          />
        </div>
        <button
          onClick={() => canSend && onSend && onSend()}
          disabled={!canSend}
          className={`px-4 py-2 rounded-[0.9rem] text-sm font-semibold transition
            ${
              canSend
                ? "text-white bg-[var(--send-color)] hover:brightness-110 active:brightness-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          style={{ minWidth: 78 }}
        >
          Send
        </button>
      </div>
      {/* Optional helper row (hidden unless needed) */}
      <div className="mt-1 flex justify-between select-none">
        <div className="text-[10px] uppercase tracking-wide text-gray-400">
          Shift+Enter for newline
        </div>
      </div>
    </div>
  );
}
