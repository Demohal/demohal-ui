
/* src/components/DemoButton.jsx */
import React from "react";
import styles from "./DemoButton.module.css";
export default function DemoButton({ item, onClick, idx }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.description || item.title}
      className={styles.button}
      data-idx={idx}
    >
      <div className={styles.label}>{item.title}</div>
    </button>
  );
}
