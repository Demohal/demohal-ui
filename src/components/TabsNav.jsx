// Chrome-style tab bar — presentational only
// Props: { mode: 'ask'|'browse'|'docs'|'meeting', tabs: {key,label,onClick}[] }

import React from "react";

const UI = {
  TAB_ACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] [box-shadow:var(--shadow-elevation)]",
  TAB_INACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] hover:brightness-110",
};

export default function TabsNav({ mode, tabs }) {
  return (
    <div className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        className="inline-flex min-w-max items-center gap-0.5 overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((t) => {
          const active =
            (mode === "browse" && t.key === "demos") ||
            (mode === "docs" && t.key === "docs") ||
            (mode === "meeting" && t.key === "meeting");
          return (
            <button
              key={t.key}
              onClick={t.onClick}
              role="tab"
              aria-selected={active}
              className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
              style={
                active
                  ? { background: "var(--card-bg)", color: "var(--tab-active-fg)" }
                  : { background: "var(--tab-bg)", color: "var(--tab-fg)" }
              }
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
