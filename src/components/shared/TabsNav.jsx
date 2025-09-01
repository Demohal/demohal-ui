import React from "react";
import classNames from "classnames";

/**
 * Visual tabs (no routing yet).
 * Styled like real tabs and visually attached to the banner’s bottom.
 */
export default function TabsNav({ tabs = [], activeId }) {
  return (
    <div
      role="tablist"
      className="inline-flex items-end gap-1 bg-transparent"
      aria-label="Sections"
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            className={classNames(
              "px-3.5 py-2 text-sm font-medium rounded-t-md border",
              "transition-all",
              active
                ? "bg-white text-gray-900 border-gray-300 shadow-sm"
                : "bg-gray-100 text-gray-700 border-gray-300 hover:brightness-105"
            )}
            onClick={() => {
              // wire later
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
