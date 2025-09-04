import React from "react";

const TAB_ACTIVE =
  "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 \
   bg-[var(--tab-active-bg)] text-[var(--tab-active-fg)] border-[var(--tab-active-border)] -mb-px \
   shadow-[var(--tab-active-shadow)]";

const TAB_INACTIVE =
  "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 \
   text-[var(--tab-inactive-fg)] border-[var(--tab-inactive-border)] \
   bg-gradient-to-b from-[var(--tab-inactive-grad-from)] to-[var(--tab-inactive-grad-to)] \
   hover:from-[var(--tab-inactive-hover-from)] hover:to-[var(--tab-inactive-hover-to)] \
   shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]";

export default function TabsNav({ tabs = [] }) {
  return (
    <div className="pb-0">
      <nav
        className="w-full flex justify-center gap-2 md:gap-3 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((t) => {
          const active = !!t.active;
          const cls = active ? TAB_ACTIVE : TAB_INACTIVE;
          const onClick = t.onClick || (() => {});
          return (
            <button key={t.key || t.label} onClick={onClick} role="tab" aria-selected={active} className={cls}>
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
