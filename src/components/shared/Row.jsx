// src/components/shared/Row.jsx
import React from "react";

// Keep visual + API identical to your inline Row:
// - props: item, onPick, variant ("docs" uses the docs button style)
// - Uses the same UI classnames you already have on window scope
//   (UI.BTN / UI.BTN_DOCS). If UI is local, pass an override via props.
export default function Row({ item, onPick, variant, UI: UIOverride }) {
  const UI = UIOverride || (globalThis?.UI ?? {});
  const btnClass = variant === "docs" ? UI.BTN_DOCS : UI.BTN;

  return (
    <button
      data-patch="row-button"
      onClick={() => onPick?.(item)}
      className={btnClass}
      title={item.description || ""}
      type="button"
    >
      <div className="font-extrabold text-xs sm:text-sm">{item.title}</div>
      {item.description ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.description}
        </div>
      ) : item.functions_text ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {item.functions_text}
        </div>
      ) : null}
    </button>
  );
}
