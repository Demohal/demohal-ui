import React from "react";
import TabsNav from "./TabsNav";

/**
 * Banner
 * - Fixed header row with logo + title
 * - Tabs centered and anchored to banner bottom
 * - Logo renders ONLY when a valid URL is provided (no fallbacks)
 */
export default function Banner({ title = "Ask the Assistant", logoUrl = null, tabs = [] }) {
  return (
    <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)]">
      {/* Header row */}
      <div className="flex items-center justify-between h-[60px] select-none">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-9 w-auto object-contain drop-shadow"
              draggable={false}
            />
          ) : null}
        </div>
        <div className="text-right text-lg sm:text-xl font-semibold opacity-90">{title}</div>
      </div>

      {/* Tabs strip (bottom of banner) */}
      <TabsNav tabs={tabs} />
    </div>
  );
}
