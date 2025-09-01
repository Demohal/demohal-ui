// src/components/screens/BrowseDocs.jsx
import React from "react";

/**
 * BrowseDocs — list of documents to pick from.
 *
 * Props:
 *  items     array<{ id,title,url,description,functions_text }>
 *  loading   boolean
 *  error     string|""
 *  onPick    (item) => void
 */
export default function BrowseDocs({ items = [], loading = false, error = "", onPick = () => {} }) {
  return (
    <div className="w-full flex-1 flex flex-col">
      {loading ? <p className="text-sm text-gray-600">Loading documents…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-2 mb-3">
            <p className="italic text-gray-600">Select a document to view it</p>
            <span />
          </div>
          <div className="flex flex-col gap-3">
            {items.map((it) => (
              <button
                key={it.id || it.url || it.title}
                onClick={() => onPick(it)}
                className="w-full text-left rounded-xl px-4 py-3 shadow transition-colors text-white border border-gray-500
                           bg-gradient-to-b from-gray-400 to-gray-500 hover:from-gray-300 hover:to-gray-500"
                title={it.description || ""}
              >
                <div className="font-extrabold text-xs sm:text-sm">{it.title}</div>
                {it.description ? (
                  <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{it.description}</div>
                ) : it.functions_text ? (
                  <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{it.functions_text}</div>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
