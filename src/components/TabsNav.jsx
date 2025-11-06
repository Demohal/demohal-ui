// TabsNav.jsx — supports personalize (formfill), browse demos, docs, price, meeting
import React from "react";

const UI = {
  TAB_ACTIVE:
    "px-2 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] [box-shadow:var(--shadow-elevation)]",
  TAB_INACTIVE:
    "px-2 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] hover:brightness-110",
};

export default function TabsNav({ mode, tabs }) {
  const normMode = (mode || "").toLowerCase();
  return (
    <div className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden px-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        className="inline-flex min-w-max items-center gap-0.5 sm:gap-1 overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Primary navigation"
      >
        {tabs.map((t) => {
          const k = t.key;
          const active =
            (k === "personalize" &&
              (normMode === "personalize" ||
                normMode === "formfill")) ||
            (k === "demos" && normMode === "browse") ||
            k === normMode;
          return (
            <button
              key={k}
              onClick={t.onClick}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${k}`}
              className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
              style={
                active
                  ? {
                      background: "var(--card-bg)",
                      color: "var(--tab-active-fg)",
                    }
                  : {
                      background: "var(--tab-bg)",
                      color: "var(--tab-fg)",
                    }
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
