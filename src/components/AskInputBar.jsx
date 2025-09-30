import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * AskInputBar (FULL REPLACEMENT)
 *
 * Changes vs prior version:
 * 1. Custom resize "grab handle" placed just to the LEFT of the send button at the lower right corner.
 *    - Native textarea resize disabled (resize: none).
 *    - Drag vertically to resize (within min/max height constraints).
 * 2. Send button visual style stays consistent (no dull / dark arrow when input is empty).
 *    - Arrow always white, background always var(--send-color).
 *    - Button still disabled logically (no send) but only shows reduced pointer events & subtle opacity.
 * 3. Maintains auto-grow up to MAX_AUTO_LINES; beyond that user can drag larger.
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

  // Auto-grow config
  const MAX_AUTO_LINES = 3;
  const LINE_HEIGHT = 20; // px

  // Manual resize config
  const MIN_HEIGHT = LINE_HEIGHT;          // minimum single line
  const MAX_DRAG_HEIGHT = 320;             // absolute cap when dragging
  const [manualHeight, setManualHeight] = useState(null); // null => auto mode

  const dragState = useRef({
    dragging: false,
    startY: 0,
    startH: 0,
  });

  // Auto-size effect (only when not manually resized)
  useEffect(() => {
    if (!ref.current) return;
    if (manualHeight != null) return; // manual override active
    const el = ref.current;
    el.style.height = "auto";
    const natural = el.scrollHeight;
    const maxAuto = LINE_HEIGHT * MAX_AUTO_LINES;
    const finalH = Math.min(natural, maxAuto);
    el.style.height = finalH + "px";
    el.style.overflowY = natural > maxAuto ? "auto" : "hidden";
  }, [value, manualHeight, ref]);

  // Apply manual height
  useEffect(() => {
    if (!ref.current) return;
    if (manualHeight != null) {
      ref.current.style.height = manualHeight + "px";
      ref.current.style.overflowY = "auto";
    }
  }, [manualHeight, ref]);

  function canSend() {
    return !disabled && !!value.trim();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend()) onSend && onSend();
    }
  }

  const beginDrag = useCallback((e) => {
    if (disabled) return;
    const target = ref.current;
    if (!target) return;
    dragState.current.dragging = true;
    dragState.current.startY = e.clientY;
    dragState.current.startH =
      manualHeight != null ? manualHeight : target.clientHeight;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("mouseleave", endDrag);
    e.preventDefault();
  }, [manualHeight, disabled]);

  const onDrag = (e) => {
    if (!dragState.current.dragging) return;
    const dy = e.clientY - dragState.current.startY;
    let nh = dragState.current.startH + dy;
    nh = Math.max(MIN_HEIGHT, Math.min(MAX_DRAG_HEIGHT, nh));
    setManualHeight(nh);
  };

  const endDrag = () => {
    if (dragState.current.dragging) {
      dragState.current.dragging = false;
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", endDrag);
      document.removeEventListener("mouseleave", endDrag);
    }
  };

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
          paddingRight: 74, // more space for grab + button
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
            resize: "none",               // disable native resize
            minHeight: LINE_HEIGHT,
            maxHeight: MAX_DRAG_HEIGHT,
          }}
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            onChange && onChange(e.target.value);
            if (manualHeight == null) {
              // let auto effect run; nothing else needed
            }
          }}
          onKeyDown={handleKeyDown}
          spellCheck="true"
        />

        {/* Custom grab handle (left of send button) */}
        <button
          type="button"
          aria-label="Resize input"
          title="Drag to resize"
          onMouseDown={beginDrag}
          className="absolute bottom-1 right-[52px] w-5 h-5 flex items-center justify-center cursor-ns-resize rounded hover:bg-black/5 active:bg-black/10 group"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--card-bg)",
          }}
        >
          <svg
            viewBox="0 0 20 20"
            width="14"
            height="14"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-500 group-active:text-gray-700"
          >
            <path d="M6 7h8M6 10h8M6 13h8" />
          </svg>
        </button>

        {/* Send button (consistent styling always) */}
        <button
          type="button"
          onClick={() => canSend() && onSend && onSend()}
          disabled={!canSend()}
          aria-label="Send"
          title={canSend() ? "Send" : "Enter text to enable send"}
          className={`absolute top-1/2 -translate-y-1/2 right-2 w-10 h-10 flex items-center justify-center rounded-full transition
            ${!canSend() ? "cursor-not-allowed" : "hover:brightness-110 active:brightness-95"}`}
          style={{
            background: "var(--send-color)",
            color: "#fff",
            opacity: !canSend() ? 0.85 : 1,
          }}
        >
          <svg
            viewBox="0 0 20 20"
            width="18"
            height="18"
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
