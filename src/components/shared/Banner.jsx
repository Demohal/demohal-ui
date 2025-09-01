import React from "react";

export default function Banner({ logoUrl, title }) {
  return (
    <div className="px-4 md:px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Brand logo"
            className="h-9 w-auto object-contain select-none"
            draggable={false}
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-white/20" />
        )}
      </div>
      <div className="text-base md:text-lg font-semibold">{title}</div>
    </div>
  );
}
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
