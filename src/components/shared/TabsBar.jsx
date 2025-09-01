import React from "react";
import TabsNav from "./TabsNav";

/**
 * Shim wrapper so AppShell can keep importing "./TabsBar".
 * Maps the props AppShell uses to what TabsNav expects.
 */
export default function TabsBar({ tabs = [], activeId, onChange }) {
  // If your TabsNav uses a different change prop (e.g. onTabChange),
  // just swap the name below.
  return <TabsNav tabs={tabs} mode={activeId} onChange={onChange} />;
}
