import React from "react";
import Banner from "../shared/Banner";
import AskBar from "../shared/AskBar";

/**
 * Fixed card-size shell matching the legacy container:
 * - Card max width 720px
 * - Height: 100dvh on mobile, 90vh on md+
 * - Banner extends to bottom of tabs
 * - Centered in viewport
 */
export default function AppShell({
  title = "Ask the Assistant",
  logoUrl = null,          // pass ONLY the bot's logo URL; null/'' hides logo
  tabs = [],               // [{ key, label, onClick, active? }]
  children,
  askValue = "",
  askPlaceholder = "Ask your question here",
  onAskChange,
  onAskSend,
  askDisabled = false,
  themeVars = undefined,   // CSS variables map applied to outer wrapper
}) {
  return (
    <div
      className="w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center"
      style={themeVars}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] flex flex-col overflow-hidden">
        <Banner title={title} logoUrl={logoUrl} tabs={tabs} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6">
          {children}
        </div>

        {/* Ask box */}
        <div className="border-t bg-[var(--card-bg)]">
          <AskBar
            value={askValue}
            placeholder={askPlaceholder}
            onChange={onAskChange}
            onSend={onAskSend}
            disabled={askDisabled}
          />
        </div>
      </div>
    </div>
  );
}
