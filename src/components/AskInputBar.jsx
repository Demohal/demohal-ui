import React, { useEffect, useRef } from "react";

/**
 * AskInputBar — FULL REPLACEMENT (Micro‑adjusted)
 *
 * Changes in this revision (per requested visual adjustments):
 *  - Added a lighter hairline divider (#d1d5db) via explicit border color reference.
 *  - Increased top padding (pt-4) and bottom padding (pb-4) for balanced vertical breathing room.
 *  - Textarea right padding increased to pr-[100px] to give more space between text and send button + native resize grip.
 *  - Send button: precise 26x26px, arrow icon 11x11px, moved slightly further right (right-8) while preserving resize handle clearance.
 *  - Ensured symmetric padding around the bar and consistent field height.
 *  - Kept visually consistent (button never “dulls” when disabled; only pointer events blocked).
 */

export default function AskInputBar({
  value,
  onChange,
  onSend,
  inputRef,
  placeholder = "Ask your question here",
  disabled = false,
}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  // Layout constants
  const MAX_AUTO_LINES = 3;
  const LINE_HEIGHT = 20; // px
  const BUTTON_SIZE = 26;
  const ICON_SIZE = 11;

  // Auto-grow (up to MAX_AUTO_LINES). After that user scrolls / can resize manually.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const maxAuto = LINE_HEIGHT * MAX_AUTO_LINES;
    const natural = el.scrollHeight;
    const finalH = Math.min(natural, maxAuto);
    el.style.height = finalH + "px";
    el.style.overflowY = natural > maxAuto ? "auto" : "hidden";
  }, [value, ref]);

  const canSend = !disabled && !!(value || "").trim();

  function triggerSend() {
    if (!canSend) return;
    onSend && onSend();
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  }

  return (
    <div
      className="w-full px-4 pt-4 pb-4 bg-[var(--card-bg,#ffffff)] border-t"
      style={{
        borderTopColor: "var(--border-default,#d1d5db)",
        transition: "background .2s",
      }}
    >
      <div className="relative w-full">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck="true"
          className="
            w-full
            text-sm
            bg-white
            border border-gray-300
            rounded-[14px]
            px-4
            pr-[100px]
            py-2
            leading-5
            placeholder:text-gray-500
            focus:outline-none focus:border-gray-400
            resize-y
            min-h-[40px]
            max-h-[260px]
          "
          style={{ lineHeight: LINE_HEIGHT + "px" }}
        />

        {/* Send button */}
        <button
          type="button"
          aria-label="Send"
          title="Send"
          onClick={triggerSend}
          disabled={!canSend}
          className="
            absolute
            top-1/2
            -translate-y-1/2
            right-8
            flex items-center justify-center
            rounded-full
            shadow
            active:scale-95
            transition
          "
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            background: "var(--send-color,#059669)",
            color: "#ffffff",
            cursor: canSend ? "pointer" : "not-allowed",
            pointerEvents: canSend ? "auto" : "none",
          }}
        >
          <svg
            viewBox="0 0 20 20"
            width={ICON_SIZE}
            height={ICON_SIZE}
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
