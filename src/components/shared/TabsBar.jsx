import React from "react";

export default function TabsBar({ tabs = [], activeId, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange?.(t.id)}
            className={[
              "px-3 py-1.5 rounded-md text-sm border transition",
              active
                ? "bg-[var(--tab-active-bg,#2d3748)] text-[var(--tab-active-fg,#ffffff)] border-transparent"
                : "bg-[var(--tab-bg,#f3f4f6)] text-[var(--tab-fg,#111827)] border-[var(--card-border,#e5e7eb)] hover:bg-[#e9eaee]",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
