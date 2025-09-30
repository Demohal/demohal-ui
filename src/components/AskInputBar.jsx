import React, { useEffect, useRef } from "react";

/**
 * AskInputBar
 * - Auto-expands up to 3 lines
 * - Shows native resize grab (bottom-right) via resize: vertical
 * - Send button uses theme token: var(--send-color)
 * - Enter sends (Shift+Enter inserts newline)
 */

export default function AskInputBar({
  value,
  onChange,
  onSend,
  inputRef,
  placeholder = "Ask your question here",
  disabled,
}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  const MAX_LINES = 3;
  const LINE_HEIGHT = 20; // px

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Auto-size logic
    el.style.height = "auto";
    const natural = el.scrollHeight;
    const maxH = LINE_HEIGHT * MAX_LINES;
    const finalH = Math.min(natural, maxH);
    el.style.height = finalH + "px";
    el.style.overflowY = natural > maxH ? "auto" : "hidden";
  }, [value, ref]);

  function canSend() {
    return !disabled && !!value.trim();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend()) onSend && onSend();
    }
  }

  return (
    <div
      className="w-full border-t border-[var(--border-default)] bg-[var(--card-bg)] px-4 pb-3 pt-2"
      style={{ transition: "background 0.2s" }}
    >
      <div
        className="relative w-full"
        style={{
          background: "#fff",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          paddingRight: 46,
          paddingLeft: 14,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <textarea
          ref={ref}
          className="w-full outline-none text-sm leading-5 bg-transparent placeholder:text-gray-400"
          style={{
            lineHeight: LINE_HEIGHT + "px",
            resize: "vertical",              // <- enables grab bar
            maxHeight: LINE_HEIGHT * MAX_LINES,
            minHeight: LINE_HEIGHT,          // 1 line default
          }}
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck="true"
        />

        <button
          type="button"
          onClick={() => canSend() && onSend && onSend()}
            disabled={!canSend()}
          aria-label="Send"
          title="Send"
          className={`absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 flex items-center justify-center rounded-full transition
            ${
              canSend()
                ? "text-white hover:brightness-110 active:brightness-95"
                : "opacity-60 cursor-not-allowed"
            }`}
          style={{
            background: "var(--send-color)",
          }}
        >
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 9.5 10 4.5l5 5" />
            <path d="M10 5v10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
