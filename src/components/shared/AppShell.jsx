// src/components/shared/AppShell.jsx
import React from "react";
import Banner from "./Banner";
import TabsNav from "./TabsNav";
import AskBar from "./AskBar";

export default function AppShell({
  title = "Ask the Assistant",
  logoUrl,                 // <-- pass brand logo URL if available; undefined/empty hides the logo
  tabs = [],               // [{ id, label }]
  activeId,
  onTab,
  children,
}) {
  const active = typeof activeId === "string" ? activeId : (tabs[0]?.id || "ask");

  return (
    <div className="w-screen min-h-[100dvh] bg-[var(--page-bg)] p-3 md:p-6 flex items-center justify-center">
      {/* Card */}
      <div className="w-full max-w-[720px] md:h-[96dvh] bg-white border border-[var(--card-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] flex flex-col overflow-hidden">
        {/* Banner (fixed height) */}
        <div className="bg-[var(--banner-bg)] text-[var(--banner-fg)]">
          <Banner logoUrl={logoUrl} title={title} />
          <div className="px-2 md:px-5 pb-2">
            <TabsNav
              tabs={tabs}
              activeId={active}
              onTab={onTab}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Ask input bar */}
        <div className="border-t border-[var(--card-border)] bg-white">
          <AskBar />
        </div>
      </div>
    </div>
  );
}
