import React, { useEffect, useRef } from "react";

/**
 * AskInputBar (Redesigned)
 *
 * - Pill shaped container with embedded Send button (green circle, up arrow).
 * - Auto-resizes textarea up to 3 lines; scrolls after that.
 * - Enter sends (unless Shift held).
 * - No helper/footer text.
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
  const LINE_HEIGHT = 20; // px (tailwind text-sm ~20px line-height)
  const H_PADDING = 14;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // Natural height
    const natural = el.scrollHeight;
    const maxH = LINE_HEIGHT * MAX_LINES;
    const finalH = Math.min(natural, maxH);
    el.style.height = finalH + "px";
    el.style.overflowY = natural > maxH ? "auto" : "hidden";
  }, [value, ref]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend()) onSend && onSend();
    }
  }

  function canSend() {
    return !disabled && !!value.trim();
  }

  return (
    <div
      className="w-full border-t border-[var(--border-default)] bg-[var(--card-bg)] px-4 pb-3 pt-2"
      style={{
        // Make sure background matches main card for seamless look
        transition: "background 0.2s",
      }}
    >
      <div
        className="relative w-full"
        style={{
          background: "#fff",
          border: "1px solid var(--border-default)",
          borderRadius: "14px",
          paddingRight: 44, // space for button
          paddingLeft: H_PADDING,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        <textarea
          ref={ref}
          className="w-full resize-none outline-none text-sm leading-5 bg-transparent placeholder:text-gray-400"
          style={{
            maxHeight: LINE_HEIGHT * MAX_LINES,
            lineHeight: LINE_HEIGHT + "px",
          }}
          rows={1}
          value={value}
            placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck="true"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={() => canSend() && onSend && onSend()}
          disabled={!canSend()}
          aria-label="Send"
          title="Send"
          className={`absolute top-1/2 -translate-y-1/2 right-2 w-8 h-8 flex items-center justify-center rounded-full transition
            ${
              canSend()
                ? "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          style={{ fontSize: 0 }}
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
            {/* Up arrow (chevron style) */}
            <path d="M5 9.5 10 4.5l5 5" />
            <path d="M10 5v10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
