import React, { useMemo, useState } from "react";
import AppShell from "./shared/AppShell";
import ContentArea from "./shared/ContentArea";

// NOTE: Logo is controlled by the bot's record only. Pass null to hide if absent.
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
      logoUrl={null}     // do not fallback; null hides the logo
      tabs={tabs}
      askValue=""
      askPlaceholder="Ask your question here"
      onAskChange={() => {}}
      onAskSend={() => {}}
      // themeVars are applied by the app; nothing needed here for the shell
    >
      <ContentArea activeTab={mode} />
    </AppShell>
  );
}
