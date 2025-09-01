import React from "react";
import Banner from "./Banner";
import TabsNav from "./TabsNav";
import AskBar from "./AskBar";

/**
 * Card shell: dark banner (with tabs anchored to its bottom),
 * scrollable middle content constrained to 720px,
 * ask bar docked at the bottom with a border-top.
 */
export default function AppShell({
  title = "Ask the Assistant",
  logoUrl = "/logo.svg",      // replace with your brand logo when wired
  activeTab = "ask",          // UI-only for now
  onSend = () => {},
  children,
}) {
  // No "Ask" tab per spec
  const tabs = [
    { id: "browse",  label: "Browse Demos" },
    { id: "docs",    label: "Browse Documents" },
    { id: "price",   label: "Price Estimate" },
    { id: "meeting", label: "Schedule Meeting" },
  ];

  return (
    <div className="w-screen min-h-[100dvh] bg-[var(--page-bg,#f5f7fa)] p-4 md:p-6 flex items-start justify-center">
      <div className="w-full max-w-[1000px] bg-white rounded-2xl shadow border border-gray-200 flex flex-col overflow-hidden">
        {/* Banner */}
        <div className="relative bg-[var(--banner-bg,#0f141a)] text-[var(--banner-fg,#fff)] rounded-t-2xl">
          <Banner title={title} logoUrl={logoUrl} />

          {/* Tabs bar - anchored to bottom of banner */}
          <div className="absolute -bottom-5 inset-x-0 px-4">
            <div className="mx-auto w-full max-w-[720px]">
              <TabsNav tabs={tabs} activeId={activeTab} />
            </div>
          </div>
        </div>

        {/* Middle content (scrolls), constrained like the old app */}
        <div className="pt-8 px-4 md:px-6 pb-6 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px]">
            {children}
          </div>
        </div>

        {/* Ask bar docked at bottom */}
        <div className="border-t bg-white px-3 md:px-4 py-3">
          <div className="mx-auto w-full max-w-[720px]">
            <AskBar onSend={onSend} />
          </div>
        </div>
      </div>
    </div>
  );
}
