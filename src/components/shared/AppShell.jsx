import React, { useState } from "react";
import TabsBar from "./TabsBar";
import ContentArea from "./ContentArea";
import AskBar from "./AskBar";

/**
 * AppShell
 * A single centered 720px card that contains:
 *  - Top banner row (brand + page title)
 *  - Tabs
 *  - Scrollable content area
 *  - Bottom Ask bar (inside the card)
 */
export default function AppShell() {
  const [active, setActive] = useState("ask");

  const tabs = [
    { id: "ask", label: "Ask" },
    { id: "demos", label: "Browse Demos" },
    { id: "docs", label: "Browse Documents" },
    { id: "price", label: "Price Estimate" },
    { id: "meeting", label: "Schedule Meeting" },
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--page-bg,#f5f6f8)] flex items-start justify-center p-3 md:p-6">
      <div className="w-full max-w-[720px] min-h-[92dvh] bg-white border border-[var(--card-border,#e5e7eb)] rounded-[12px] shadow-sm flex flex-col">
        {/* Banner inside the card */}
        <div className="px-4 sm:px-6 py-3 bg-[var(--banner-bg,#111111)] text-[var(--banner-fg,#ffffff)] rounded-t-[12px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/10 border border-white/30" />
              <div className="font-semibold">DemoHAL</div>
            </div>
            <div className="text-base sm:text-lg font-semibold">Ask the Assistant</div>
          </div>

          {/* Tabs live under the banner row */}
          <div className="mt-3">
            <TabsBar tabs={tabs} activeId={active} onChange={setActive} />
          </div>
        </div>

        {/* Scrollable middle content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <ContentArea activeTab={active} />
        </div>

        {/* Ask bar anchored at the bottom INSIDE the card */}
        <div className="px-4 sm:px-6 py-3 border-t border-[var(--card-border,#e5e7eb)] rounded-b-[12px]">
          <AskBar onSend={(text) => console.log("send:", text)} />
        </div>
      </div>
    </div>
  );
}
