import React from "react";
import AskAssistant from "./components/Demohal";

function useQuery() {
  return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
}
