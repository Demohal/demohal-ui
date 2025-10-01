import React, { useEffect, useRef } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

/**
 * AskInputBar — FULL REPLACEMENT
 *
 * Matches the Ask Bar implementation used directly inside AskAssistant.jsx.
 * Structure, class names, spacing, sizing, and behavior are aligned to the
 * "gold standard" snippet:
 *
 *  <div class="px-4 py-3 border-t ...">
 *    <div class="relative w-full">
 *      <textarea ... />
 *      <button ...><ArrowUpCircleIcon ... /></button>
 *    </div>
 *  </div>
 *
 * Props:
 *  - value (string)
 *  - onChange(nextValue)
 *  - onSend()  (triggered on Enter (no Shift) or button click)
 *  - inputRef (optional external ref for the textarea)
 *  - placeholder (optional)
 *  - disabled (optional)
 *  - show (optional boolean) if false, renders null (convenience)
 *
 * Auto-resize logic matches original: adjusts height on each input.
 */

export default function AskInputBar({
  value,
  onChange,
  onSend,
  inputRef,
  placeholder = "Ask your question here",
  disabled = false,
  show = true,
}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  // Auto-resize (same behavior as gold standard)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend && onSend();
      }
    }
  }

  function handleInput(e) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  if (!show) return null;

  return (
    <div
      className="px-4 py-3 border-t border-[var(--border-default)]"
      data-patch="ask-bottom-bar"
    >
      <div className="relative w-full">
        <textarea
          ref={ref}
            rows={1}
          className="
            w-full
            rounded-[0.75rem]
            px-4
            py-2
            pr-14
            text-base
            placeholder-gray-400
            resize-y
            min-h-[3rem]
            max-h-[160px]
            bg-[var(--card-bg)]
            border
            border-[var(--border-default)]
            focus:border-[var(--border-default)]
            focus:ring-1
            focus:ring-[var(--border-default)]
            outline-none
          "
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => !disabled && onChange && onChange(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          spellCheck="true"
        />
        <button
          aria-label="Send"
          onClick={() => {
            if (!disabled && value.trim()) onSend && onSend();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95 transition"
          disabled={disabled || !value.trim()}
          style={{
            opacity: disabled ? 0.6 : 1,
            cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          }}
        >
          <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:brightness-110" />
        </button>
      </div>
    </div>
  );
}
