
/* src/components/DemoGrid.jsx */
import React from "react";
import css from "./DemoGrid.module.css";
import DemoButton from "./DemoButton";
export default function DemoGrid({ items = [], onPick }) {
  return (
    <div className={css.grid}>
      {items.map((b, i) => (
        <DemoButton key={`${b.id || b.title}-${i}`} item={b} idx={i} onClick={() => onPick(b)} />
      ))}
    </div>
  );
}
