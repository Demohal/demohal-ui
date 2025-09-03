import React from "react";

/**
 * TabsNav
 * tabs: [{ key, label, active, onClick }]
 * Centered across the banner bottom; looks like tabs (not buttons).
 */
export default function TabsNav({ tabs = [] }) {
  return (
    <div className="w-full max-w-[650px]">
      <nav
        className="w-full flex justify-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((t) => {
          const active = !!t.active;
          const onClick = t.onClick || (() => {});
          const cls = active
            ? "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none rounded-t-md border border-b-0 bg-white text-gray-900 -mb-px shadow"
            : "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none rounded-t-md border border-b-0 text-white/85 bg-gradient-to-b from-white/10 to-black/20 hover:from-white/15 hover:to-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]";
          return (
            <button
              key={t.key || t.label}
              onClick={onClick}
              role="tab"
              aria-selected={active}
              className={cls}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
