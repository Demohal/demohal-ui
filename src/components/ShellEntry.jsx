// src/components/ShellEntry.jsx
import React from "react";
import AppShell from "./shared/AppShell";
import AskAssistant from "./AskAssistant";

export default function ShellEntry() {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const version = params ? params.get("version") : null;

  return version === "2" ? <AppShell /> : <AskAssistant />;
}
