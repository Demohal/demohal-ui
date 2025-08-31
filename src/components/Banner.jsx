import React from "react";
import TabsNav from "./TabsNav";

export default function Banner({ mode, onModeChange }) {
  return (
    <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)]">
      <div className="flex items-center justify-between w-full py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10 grid place-items-center font-bold">DH</div>
          <div className="text-base sm:text-lg font-semibold">Your Brand</div>
        </div>
      </div>
      <TabsNav mode={mode} onModeChange={onModeChange} />
    </div>
  );
}
