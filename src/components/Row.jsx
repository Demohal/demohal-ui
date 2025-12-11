import React from "react";

const KIND_CLASS = {
  demo: "text-[var(--demo-button-fg)] bg-[var(--demo-button-bg)]",
  doc: "text-[var(--doc-button-fg)] bg-[var(--doc-button-bg)]",
  price: "text-[var(--price-button-fg)] bg-[var(--price-button-bg)]",
};

export default function Row({ item, onPick, kind = "demo" }) {
  const cls =
    KIND_CLASS[kind] ||
    "text-[var(--demo-button-fg)] bg-[var(--demo-button-bg)]";

  return (
    <button
      onClick={() => onPick(item)}
      className={
        [
          "w-full rounded-[0.75rem] px-4 py-3 transition",
          "hover:brightness-110 active:brightness-95",
          "flex flex-col items-center justify-center text-center",
          cls,
        ].join(" ")
      }
      style={{ boxShadow: "var(--shadow-elevation)" }}
      title={item.description || item.functions_text || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">
        {item.title}
      </div>
      {(item.description || item.functions_text) && (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.description || item.functions_text}
        </div>
      )}
    </button>
  );
}
