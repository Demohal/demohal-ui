import React from "react";

export default function AskInputBar({
  value,
  onChange,
  onSend,
  inputRef,
  placeholder,
}) {
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend && onSend();
    }
  }
  return (
    <div className="border-t border-[var(--border-default)] px-4 py-3 bg-[var(--card-bg)]">
      <div className="flex items-end gap-3">
        <textarea
          ref={inputRef}
          className="flex-1 resize-none outline-none bg-transparent text-sm leading-relaxed max-h-40"
          value={value}
          placeholder={placeholder || ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <button
          onClick={onSend}
          className="px-4 py-2 rounded-[0.75rem] text-sm font-semibold text-white"
          style={{ background: "var(--send-color)" }}
          disabled={!value.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
