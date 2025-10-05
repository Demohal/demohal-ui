import React, { useEffect, useRef } from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

/**
 * AskInputBar — MVP version with optional "Powered by" logo anchored.
 */
export default function AskInputBar({
  value,
  onChange,
  onSend,
  inputRef,
  placeholder = "Ask your question here",
  disabled = false,
  show = true,
  poweredBy = "https://demohal.com/",
  poweredByImg = "https://rvwcyysphhaawvzzyjxq.supabase.co/storage/v1/object/public/demohal-logos/f3ab3e92-9855-4c9b-8038-0a9e483218b7/Powered%20By%20Logo.png",
  showLogo = true,
}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend && onSend();
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
      className="relative px-4 pt-4 border-t border-[var(--border-default)]"
      style={{
        // Logo h-6 is 24px, plus 16px (1rem) for symmetrical padding: 24 + 16 = 40px
        paddingBottom: showLogo ? "40px" : "1rem",
      }}
      data-patch="ask-bottom-bar"
    >
      <div className="relative">
        <textarea
          ref={ref}
          rows={1}
          className="w-full rounded-[0.75rem] px-4 py-3 pr-14 text-base placeholder-gray-400 resize-y min-h-[3.25rem] max-h-[200px] bg-[var(--card-bg)] border border-[var(--border-default)] focus:border-[var(--border-default)] focus:ring-1 focus:ring-[var(--border-default)] outline-none mb-[5px]"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) =>
            !disabled && onChange && onChange(e.target.value)
          }
          onInput={handleInput}
          onKeyDown={handleKey}
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
            cursor:
              disabled || !value.trim() ? "not-allowed" : "pointer",
          }}
        >
          <ArrowUpCircleIcon className="w-9 h-9 text-[var(--send-color)] hover:brightness-110" />
        </button>
      </div>
      {showLogo && (
        <a
          href={poweredBy}
          target="_blank"
          rel="noopener noreferrer"
          title="Powered by DemoHAL"
          className="absolute left-4 bottom-4 inline-flex"
        >
          <img
            src={poweredByImg}
            alt="Powered by DemoHAL"
            className="h-6 w-auto object-contain select-none"
            loading="lazy"
            draggable="false"
          />
        </a>
      )}
    </div>
  );
}
