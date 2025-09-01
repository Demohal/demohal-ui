import React from "react";
import Banner from "./Banner";

/**
 * AppShell
 * - Fixed 720px max width card centered on page
 * - Fixed card height (full height on mobile, 96dvh on md+)
 * - Accepts: title, logoUrl, tabs (array), children (main content), bottomSlot (ask bar)
 * - NO fallbacks for logo: pass undefined to hide logo
 */
export default function AppShell({ title = "Ask the Assistant", logoUrl, tabs = [], children, bottomSlot, theme = {} }) {
  const vars = {
    // safe defaults; can be overridden by `theme` prop
    "--page-bg": theme["--page-bg"] || "#f3f4f6",
    "--banner-bg": theme["--banner-bg"] || "#0b0f14",
    "--banner-fg": theme["--banner-fg"] || "#e8edf4",
    "--card-bg": theme["--card-bg"] || "#ffffff",
    "--card-border": theme["--card-border"] || "rgba(0,0,0,0.15)",
    "--radius-card": theme["--radius-card"] || "14px",
    "--shadow-card": theme["--shadow-card"] || "0 10px 30px rgba(0,0,0,0.25)",
  };

  return (
    <div
      className="w-screen h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center"
      style={vars}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[96dvh] bg-[var(--card-bg)] border border-[var(--card-border)] md:rounded-[var(--radius-card)] [box-shadow:var(--shadow-card)] flex flex-col overflow-hidden">
        <Banner title={title} logoUrl={logoUrl} tabs={tabs} />
        <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6">
          {children}
        </div>
        <div className="border-t border-gray-200">
          {bottomSlot}
        </div>
      </div>
    </div>
  );
}
