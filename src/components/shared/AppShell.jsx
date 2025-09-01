// src/components/shared/AppShell.jsx
import React from "react";

/**
 * AppShell: Banner + Folder-style Tabs + Content + Ask Bar
 * Tweaks in this version:
 *  - Tabs are nudged down by 1px so their lower edges intersect the banner bottom line.
 *  - Active tab is white and visually attached to the content (folder-tab look).
 */
export default function AppShell({
  title = "",
  logoUrl = "",
  tabs = [],

  // Ask bar
  askValue = "",
  askPlaceholder = "Ask your question here",
  onAskChange = () => {},
  onAskSend = () => {},
  askInputRef = null,
  askSendIcon = null,

  // Theming (CSS variables from /brand)
  themeVars = {},
  children,
}) {
  return (
    <div
      className="w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200"
      style={themeVars}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] bg-[var(--card-bg)] border border-[var(--card-border)] md:rounded-[var(--radius-card)] [box-shadow:var(--shadow-card)] flex flex-col overflow-hidden">
        {/* Banner */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] relative pb-10">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              {logoUrl ? <img src={logoUrl} alt="Brand logo" className="h-10 object-contain" /> : null}
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">{title}</div>
          </div>

          {/* Tabs pinned to banner bottom */}
          {Array.isArray(tabs) && tabs.length > 0 ? (
            <div className="absolute left-0 right-0 bottom-0">
              {/* Nudge the whole tab bar down by 1px so it touches the banner bottom */}
              <div className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden border-b border-gray-300 translate-y-[1px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <nav
                  className="inline-flex min-w-max items-end gap-1 overflow-y-hidden px-3 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="tablist"
                >
                  {tabs.map((t) => {
                    const base =
                      // Shared folder-tab frame
                      "px-4 py-1.5 text-sm font-semibold whitespace-nowrap flex-none rounded-t-md border border-b-0 transition-colors";
                    const active =
                      // Looks attached to the white content area
                      "bg-white text-black shadow-[0_2px_0_rgba(0,0,0,.15)]";
                    const inactive =
                      // Dark beveled, like closed tabs
                      "text-white border-gray-600 bg-gradient-to-b from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]";
                    return (
                      <button
                        key={t.key || t.label}
                        onClick={t.onClick}
                        aria-selected={!!t.active}
                        role="tab"
                        className={`${base} ${t.active ? active : inactive}`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          ) : null}
        </div>

        {/* Content area */}
        <div className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
          {children}
        </div>

        {/* Ask bar (always visible) */}
        <div className="px-4 py-3 border-t border-gray-200 relative z-10 bg-[var(--card-bg)]">
          <div className="relative w-full">
            <textarea
              ref={askInputRef}
              rows={1}
              className="w-full border border-[var(--field-border)] rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--field-bg)]"
              placeholder={askPlaceholder}
              value={askValue}
              onChange={(e) => onAskChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onAskSend(askValue);
                }
              }}
            />
            <button
              aria-label="Send"
              onClick={() => onAskSend(askValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
            >
              {askSendIcon || <span className="px-3 py-1 rounded-md border">Send</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
