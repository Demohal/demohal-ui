import React from "react";
import AppShell from "./shell/AppShell";
import AskAssistant from "./AskAssistant"; // legacy screen

export default function ShellEntry() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const v = params ? params.get("version") : null;

  // version=2 → new shell, else legacy
  if (v === "2") return <AppShell />;
  return <AskAssistant />;
}
