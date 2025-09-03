import React from "react";
import AskAssistant from "./components/DemoHal";

function useQuery() {
  return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
}
