import React from "react";
import TabsNav from "./TabsNav";

/**
 * Banner
 * - Fixed banner area; tabs are visually attached to bottom of banner
 * - If logoUrl is falsy, nothing is rendered on the left (no fallbacks here)
 */
export default function Banner({ title = "Ask the Assistant", logoUrl, tabs = [] }) {
  return (
    <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)]">
      {/* Top row: logo (optional) + title */}
      <div className="flex items-center justify-between w-full py-3">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Brand logo" className="h-10 object-contain" />
          ) : null}
        </div>
        <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
          {title}
        </div>
      </div>

      {/* Tabs bar anchored to the bottom of banner */}
      <div className="flex justify-center pb-2">
        <TabsNav tabs={tabs} />
      </div>
    </div>
  );
}
