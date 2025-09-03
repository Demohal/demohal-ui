import React from "react";

const tabs = [
  { key: "ask",     label: "Ask" },
  { key: "browse",  label: "Browse Demos" },
  { key: "docs",    label: "Browse Documents" },
  { key: "price",   label: "Price Estimate" },
  { key: "meeting", label: "Schedule Meeting" },
];

export default function TabsNav({ mode, onModeChange }) {
  return (
    <div className="flex gap-2 pb-3">
      {tabs.map((t) => {
        const active = mode === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onModeChange(t.key)}
            className={
              "px-3 py-1 rounded text-xs sm:text-[13px] border transition " +
              (active
                ? "bg-[var(--tab-active-bg)] text-[var(--tab-active-fg)] border-transparent"
                : "bg-transparent text-[var(--banner-fg)] border-white/30 hover:bg-white/10")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
