import React from "react";
import Banner from "./Banner";
import TabsNav from "./TabsNav";
import ContentArea from "./ContentArea";
import AskBar from "./AskBar";

const DEFAULT_TABS = [
  { id: "ask", label: "Ask" },
  { id: "demos", label: "Browse Demos" },
  { id: "docs", label: "Browse Documents" },
  { id: "price", label: "Price Estimate" },
  { id: "meeting", label: "Schedule Meeting" },
];

export default function AppShell() {
  // In the future we can hydrate from API; for now guard everything.
  const [config] = React.useState(() => ({ tabs: DEFAULT_TABS }));
  const safeTabs = Array.isArray(config?.tabs) ? config.tabs : DEFAULT_TABS;

  const [activeId, setActiveId] = React.useState(() => {
    const first = safeTabs[0]?.id || "ask";
    return first;
  });

  // If an invalid id sneaks in, snap back to a known tab.
  React.useEffect(() => {
    if (!safeTabs.some((t) => t.id === activeId)) {
      setActiveId(safeTabs[0]?.id || "ask");
    }
  }, [activeId, safeTabs]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--page-bg,#f5f6f7)]">
      <Banner />
      <TabsNav tabs={safeTabs} activeId={activeId} onChange={setActiveId} />
      <div className="flex-1">
        <ContentArea tabs={safeTabs} activeId={activeId} />
      </div>
      <AskBar />
    </div>
  );
}
