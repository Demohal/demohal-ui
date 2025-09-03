import React, { useMemo, useState } from "react";
import AppShell from "./shared/AppShell";
import ContentArea from "./shared/ContentArea";

export default function ShellEntry() {
  const [mode, setMode] = useState("ask");

  const tabs = useMemo(
    () => [
      { key: "demos",   label: "Browse Demos",     active: mode === "demos",   onClick: () => setMode("demos") },
      { key: "docs",    label: "Browse Documents", active: mode === "docs",    onClick: () => setMode("docs") },
      { key: "price",   label: "Price Estimate",    active: mode === "price",   onClick: () => setMode("price") },
      { key: "meeting", label: "Schedule Meeting",  active: mode === "meeting", onClick: () => setMode("meeting") },
    ],
    [mode]
  );

  return (
    <AppShell
      title="Ask the Assistant"
      logoUrl={null}
      tabs={tabs}
      askValue=""
      askPlaceholder="Ask your question here"
      onAskChange={() => {}}
      onAskSend={() => {}}
    >
      <ContentArea activeTab={mode} />
    </AppShell>
  );
}
