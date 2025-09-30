import React, { useEffect, useRef } from "react";

/**
 * AskInputBar — FULL REPLACEMENT
 *
 * Goal: Match the provided design EXACTLY:
 *  - Flat white bar area with a top border (handled by parent container).
 *  - Inner single textarea with light gray border, large rounded corners.
 *  - Native resize handle in the bottom-right corner (so keep resize: vertical).
 *  - Green circular send button with a white upward arrow INSIDE the input on the right.
 *  - Button appearance NEVER dulls / changes (even when empty); sending is just prevented when blank.
 *  - Placeholder text left-aligned, subtle gray.
 *  - Auto-grow up to a small limit (3 lines) before scroll; still allow manual vertical resize beyond that.
 *
 * Notes:
 *  - We keep the button always green; logic blocks blank sends.
 *  - Right padding leaves space for both the button AND the native resize handle.
 *  - Tailwind utility classes assumed; adjust colors if you theme via CSS vars.
 *  - Uses CSS variable --send-color if provided; fallback to bright green (#059669).
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

  const MAX_LINES = 3;
  const LINE_HEIGHT_PX = 20; // keep consistent with design line-height

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Auto-height up to MAX_LINES (after manual user resize we still allow user control)
    el.style.height = "auto";
    const maxH = LINE_HEIGHT_PX * MAX_LINES;
    const natural = el.scrollHeight;
    const finalH = Math.min(natural, maxH);
    el.style.height = finalH + "px";
    el.style.overflowY = natural > maxH ? "auto" : "hidden";
  }, [value, ref]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  }

  function triggerSend() {
    if (disabled) return;
    const text = (value || "").trim();
    if (!text) return;
    onSend && onSend();
  }

  return (
    <div
      // Outer bar area (parent usually has border-top; we keep spacing consistent)
      className="w-full bg-[var(--card-bg,#ffffff)] px-4 pt-2 pb-3"
      style={{
        transition: "background 0.2s",
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
          onKeyDown={handleKeyDown}
          spellCheck="true"
          className="
            w-full
            text-sm
            bg-white
            border border-gray-300
            rounded-[14px]
            px-4
            pr-[92px]     /* space for send button + resize handle */
            py-2
            leading-5
            placeholder:text-gray-500
            focus:outline-none focus:border-gray-400
            resize-y
            min-h-[40px]
            max-h-[240px]
          "
          style={{
            lineHeight: LINE_HEIGHT_PX + "px",
          }}
        />

        {/* Send Button (always green visually) */}
        <button
          type="button"
          onClick={triggerSend}
          aria-label="Send"
          title="Send"
          className="
            absolute
            top-1/2
            -translate-y-1/2
            right-[44px]   /* leave room for native resize handle */
            w-8 h-8
            rounded-full
            flex items-center justify-center
            shadow
            transition
            active:scale-95
          "
          style={{
            background: "var(--send-color,#059669)",
            color: "#ffffff",
            cursor:
              disabled || !(value || "").trim().length
                ? "not-allowed"
                : "pointer",
            opacity:
              disabled || !(value || "").trim().length
                ? 1 // visually unchanged per requirements
                : 1,
            pointerEvents:
              disabled || !(value || "").trim().length ? "none" : "auto",
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
