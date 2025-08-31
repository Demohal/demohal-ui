// src/components/shared/TabsNav.jsx
import React from "react";

// Pure-presentational Tabs strip:
// - props: mode (string), tabs (array of {key,label,onClick})
// - optional: className
// - Accessibility: role=tablist / aria-selected on active
export default function TabsNav({ mode, tabs, className = "" }) {
  return (
    <div
      className={
        "w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden " +
        className
      }
      data-patch="tabs-nav"
    >
      <nav
        className="inline-flex min-w-max items-center gap-0.5 overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((t) => {
          const active =
            (mode === "browse" && t.key === "demos") ||
            (mode === "docs" && t.key === "docs") ||
            (mode === "price" && t.key === "price") ||
            (mode === "meeting" && t.key === "meeting") ||
            (mode === "ask" && t.key === "ask");

          return (
            <button
              key={t.key}
              onClick={t.onClick}
              role="tab"
              aria-selected={active}
              className={active ? (globalThis?.UI?.TAB_ACTIVE ?? "") : (globalThis?.UI?.TAB_INACTIVE ?? "")}
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
