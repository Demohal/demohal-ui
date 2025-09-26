// Full-width choice row — presentational
// Props: { item: { id, title, description }, onPick: (item)=>void, kind?: 'demo'|'doc' }

import React from "react";

const UI = {
  BTN_DEMO:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition text-[var(--demo-button-fg)] bg-[var(--demo-button-bg)] hover:brightness-110 active:brightness-95",
  BTN_DOC:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition text-[var(--doc-button-fg)] bg-[var(--doc-button-bg)] hover:brightness-110 active:brightness-95",
};

export default function Row({ item, onPick, kind = "demo" }) {
  const btnClass = kind === "doc" ? UI.BTN_DOC : UI.BTN_DEMO;
  return (
    <button onClick={() => onPick(item)} className={btnClass} title={item.description || ""}>
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{item.description}</div>
      ) : null}
    </button>
  );
}
