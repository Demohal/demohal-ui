import React from "react";

export default function TabsNav({ tabs = [], activeId, onChange }) {
  const list = Array.isArray(tabs) ? tabs : [];

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl flex gap-2 px-4 py-2">
        {list.length === 0 ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          list.map((t) => {
            const isActive = t.id === activeId;
            return (
              <button
                key={t.id || t.label}
                type="button"
                onClick={() => onChange?.(t.id)}
                className={
                  "px-3 py-1 rounded-md text-sm " +
                  (isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200")
                }
              >
                {t.label ?? t.id}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
