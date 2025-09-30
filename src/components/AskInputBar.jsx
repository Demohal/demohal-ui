import React, { useEffect, useRef } from "react";

/**
 * AskInputBar — FULL REPLACEMENT (Revision to match screenshot feedback)
 *
 * Addresses:
 *  1. Question box too narrow  -> Now stretches full width minus the page padding (parent supplies px-4).
 *  2. Missing dividing line    -> Always renders a top border line (border-t) spanning 100%.
 *  3. Send icon too big / not perfectly centered / too far left ->
 *        - Button size reduced to 26x26 (was 32 / 40).
 *        - Arrow icon reduced to 11x11 (was 16).
 *        - Button vertically centered via top-1/2 translate-y-1/2.
 *        - Button moved closer to the right: right-8 (leaves room for native resize handle).
 *
 * Design specifics implemented:
 *  - Native resize handle is visible (resize: vertical) and unobstructed (we reserve 34px at right).
 *  - Textarea large rounded corners (14px) like screenshot.
 *  - Consistent light gray border (#d1d5db Tailwind border-gray-300).
 *  - Background white, placeholder medium gray (#6b7280).
 *  - Send button always vivid green (uses --send-color if defined; fallback #059669).
 *  - Arrow always white, never dims; we simply disable pointer events when empty.
 *  - Subtle focus style: darken border slightly.
 *  - Auto-height up to 3 lines, then scroll (still user-resizable).
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

  const MAX_AUTO_LINES = 3;
  const LINE_HEIGHT = 20; // px

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Auto-grow (does not interfere with manual user vertical resize unless they drag)
    el.style.height = "auto";
    const maxAuto = LINE_HEIGHT * MAX_AUTO_LINES;
    const natural = el.scrollHeight;
    const finalH = Math.min(natural, maxAuto);
    el.style.height = finalH + "px";
    el.style.overflowY = natural > maxAuto ? "auto" : "hidden";
  }, [value, ref]);

  function triggerSend() {
    if (disabled) return;
    if (!(value || "").trim()) return;
    onSend && onSend();
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
  }

  const canSend = !disabled && !!(value || "").trim();

  return (
    <div
      className="w-full border-t border-[var(--border-default,#d1d5db)] bg-[var(--card-bg,#ffffff)] px-4 pb-3 pt-2"
      style={{ transition: "background .2s" }}
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
            pr-[90px]  /* space for send (26) + gap + native resize area */
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

        {/* Send button (smaller, precise positioning) */}
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
            w-[26px] h-[26px]
            rounded-full
            flex items-center justify-center
            shadow
            active:scale-95
            transition
          "
          style={{
            background: "var(--send-color,#059669)",
            color: "#ffffff",
            cursor: canSend ? "pointer" : "not-allowed",
            pointerEvents: canSend ? "auto" : "none",
          }}
        >
          <svg
            viewBox="0 0 20 20"
            width="11"
            height="11"
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
