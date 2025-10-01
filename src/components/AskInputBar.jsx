import React, { useEffect, useRef } from "react";

/**
 * AskInputBar — FULL REPLACEMENT (Spec tweaks)
 *
 * User requests implemented:
 * 1. Larger white arrow inside green button (icon size increased from 11px → 14px).
 * 2. Increase starting width of the question box by exactly 3px (input bar widened by 3px using a wrapper width calc and negative horizontal offset).
 * 3. Send button vertically centered in the (now wider) question box and positioned 3px from the right inner boundary of the question box.
 *
 * Notes:
 * - Native vertical resize remains enabled.
 * - Button remains visually active (no dulling); blank submission still prevented logically.
 * - Right padding inside the textarea updated so typed text does not overlap the button.
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
  const ICON_SIZE = 14; // enlarged arrow
  const BUTTON_RIGHT_GAP = 3; // px from question box right edge
  const EXTRA_WIDTH = 3; // total width increase
  const HALF_EXTRA = EXTRA_WIDTH / 2; // symmetrical offset

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
      {/* Wrapper widened by +3px and centered by negative half-margins */}
      <div
        className="relative"
        style={{
            width: `calc(100% + ${EXTRA_WIDTH}px)`,
          marginLeft: `-${HALF_EXTRA}px`,
          marginRight: `-${HALF_EXTRA}px`,
        }}
      >
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
            pr-[72px]             /* space for button + gap + text clearance */
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

        {/* Send button (centered vertically, fixed gap from right edge) */}
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
            flex items-center justify-center
            rounded-full
            shadow
            active:scale-95
            transition
          "
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            right: BUTTON_RIGHT_GAP,
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
