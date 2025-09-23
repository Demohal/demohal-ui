
import React from "react";
import ShellEntry from "./components/ShellEntry";
import AskAssistant from "./components/AskAssistant";

function useQuery() {
  return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
}

export default function App() {
  const q = useQuery();
  const v = (q.get("version") || "").trim();
  return v === "2" ? <ShellEntry /> : <AskAssistant />;
}
