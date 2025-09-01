// src/components/shared/Banner.jsx
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
