import React, { useState } from "react";
import Banner from "./Banner";
import ContentArea from "./ContentArea";
import AskBar from "./AskBar";

export default function AppShell() {
  const [mode, setMode] = useState("ask"); // "ask" | "browse" | "docs" | "price" | "meeting"

  // Minimal theme tokens via CSS variables; can be wired to branding later.
  const themeVars = {
    "--page-bg": "#eef0f3",
    "--banner-bg": "#0b0b0b",
    "--banner-fg": "#ffffff",
    "--tab-active-bg": "#2a3441",
    "--tab-active-fg": "#ffffff",
    "--card-bg": "#ffffff",
    "--field-bg": "#ffffff",
    "--send-color": "#d13232",
  };

  return (
    <div
      className="w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center"
      style={themeVars}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[96dvh] bg-white border border-gray-200 md:rounded-xl shadow flex flex-col">
        <Banner mode={mode} onModeChange={setMode} />
        <ContentArea mode={mode} />
        <AskBar onSend={(txt) => console.log("SEND:", txt)} />
      </div>
    </div>
  );
}
