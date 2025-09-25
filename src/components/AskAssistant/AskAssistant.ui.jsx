// src/components/AskAssistant/AskAssistant.ui.jsx
// UI tokens, helpers, and small presentational components extracted from SECTION 1
// All are **named exports**.

import React from "react";

/* =============================== *
 *  CLIENT-CONTROLLED CSS TOKENS   *
 * =============================== */
export const DEFAULT_THEME_VARS = {
  "--banner-bg": "#000000",
  "--banner-fg": "#ffffff",
  "--page-bg": "#e6e6e6",
  "--card-bg": "#ffffff",
  "--shadow-elevation":
    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",

  // Text roles
  "--message-fg": "#000000",
  "--helper-fg": "#4b5563",
  "--mirror-fg": "#4b5563",

  // Tabs (inactive)
  "--tab-bg": "#303030",
  "--tab-fg": "#ffffff",
  "--tab-active-fg": "#ffffff", // derived at runtime

  // Buttons (explicit types)
  "--demo-button-bg": "#3a4554",
  "--demo-button-fg": "#ffffff",
  "--doc.button.background": "#000000", // legacy mapping guard (no-op)
  "--doc-button-bg": "#000000",
  "--doc-button-fg": "#ffffff",
  "--price-button-bg": "#1a1a1a",
  "--price-button-fg": "#ffffff",

  // Send icon
  "--send-color": "#000000",

  // Default faint gray border (used only where allowed)
  "--border-default": "#9ca3af",
};

// Map DB token_key → CSS var used in this app (mirror of server mapping)
export const TOKEN_TO_CSS = {
  "banner.background": "--banner-bg",
  "banner.foreground": "--banner-fg",
  "page.background": "--page-bg",
  "content.area.background": "--card-bg",

  "message.text.foreground": "--message-fg",
  "helper.text.foreground": "--helper-fg",
  "mirror.text.foreground": "--mirror-fg",

  "tab.background": "--tab-bg",
  "tab.foreground": "--tab-fg",

  "demo.button.background": "--demo-button-bg",
  "demo.button.foreground": "--demo-button-fg",
  "doc.button.background": "--doc-button-bg",
  "doc.button.foreground": "--doc-button-fg",
  "price.button.background": "--price-button-bg",
  "price.button.foreground": "--price-button-fg",

  "send.button.background": "--send-color",

  "border.default": "--border-default",
};

// Hardcoded screen order/labels for grouping the 16 client-controlled tokens
export const SCREEN_ORDER = [
  { key: "welcome", label: "Welcome" },
  { key: "bot_response", label: "Bot Response" },
  { key: "browse_demos", label: "Browse Demos" },
  { key: "browse_docs", label: "Browse Documents" },
  { key: "price", label: "Price Estimate" },
];

export const classNames = (...xs) => xs.filter(Boolean).join(" ");
export function inverseBW(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
    String(hex || "").trim()
  );
  if (!m) return "#000000";
  const r = parseInt(m[1], 16),
    g = parseInt(m[2], 16),
    b = parseInt(m[3], 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.5 ? "#000000" : "#ffffff";
}

/* ========================== *
 *  UI PRIMITIVES             *
 * ========================== */
export const UI = {
  CARD: "rounded-[0.75rem] p-4 bg-[var(--card-bg)] [box-shadow:var(--shadow-elevation)]",
  BTN_DEMO:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition " +
    "text-[var(--demo-button-fg)] bg-[var(--demo-button-bg)] hover:brightness-110 active:brightness-95",
  BTN_DOC:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition " +
    "text-[var(--doc-button-fg)] bg-[var(--doc-button-bg)] hover:brightness-110 active:brightness-95",
  BTN_PRICE:
    "w-full text-center rounded-[0.75rem] px-4 py-3 transition " +
    "text-[var(--price-button-fg)] bg-[var(--price-button-bg)] hover:brightness-110 active:brightness-95",
  FIELD:
    "w-full rounded-[0.75rem] px-4 py-3 text-base bg-[var(--card-bg)] " +
    "border border-[var(--border-default)]",
  TAB_ACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] " +
    "[box-shadow:var(--shadow-elevation)]",
  TAB_INACTIVE:
    "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition rounded-t-[0.75rem] hover:brightness-110",
};

export function Row({ item, onPick, kind = "demo" }) {
  const btnClass =
    kind === "doc"
      ? UI.BTN_DOC
      : kind === "price"
      ? UI.BTN_PRICE
      : UI.BTN_DEMO;
  return (
    <button
      data-patch="row-button"
      onClick={() => onPick(item)}
      className={btnClass}
      title={item.description || ""}
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

export function OptionButton({ opt, selected, onClick }) {
  return (
    <button
      data-patch="option-button"
      onClick={() => onClick(opt)}
      className={classNames(UI.BTN_PRICE, selected && "ring-2 ring-black/20")}
      title={opt.tooltip || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">{opt.label}</div>
      {opt.tooltip ? (
        <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">
          {opt.tooltip}
        </div>
      ) : null}
    </button>
  );
}

export function PriceMirror({ lines }) {
  if (!lines?.length) return null;
  return (
    <div data-patch="price-mirror" className="mb-3">
      {lines.map((ln, i) => (
        <div
          key={i}
          className="text-base italic whitespace-pre-line text-[var(--mirror-fg)]"
        >
          {ln}
        </div>
      ))}
    </div>
  );
}

export function EstimateCard({ estimate, outroText }) {
  if (!estimate) return null;

  const items = Array.isArray(estimate.line_items) ? estimate.line_items : [];

  const fmtAmount = (ccy, v) => `${ccy} ${Number(v).toLocaleString()}`;
  const fmtRange = (ccy, min, max) =>
    Number(min) === Number(max) ? fmtAmount(ccy, max) : `${fmtAmount(ccy, min)} – ${fmtAmount(ccy, max)}`;

  const totalText = fmtRange(estimate.currency_code, estimate.total_min, estimate.total_max);

  return (
    <div data-patch="estimate-card">
      <div className={UI.CARD}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-lg">Your Estimate</div>
          <div className="font-bold text-lg text-right [font-variant-numeric:tabular-nums]">
            {totalText}
          </div>
        </div>

        <div className="space-y-3">
          {items.map((li, idx) => {
            const name = li?.product?.name ?? li?.label ?? "Item";
            const key = li?.product?.id ?? `${name}-${idx}`;
            const ccy = li?.currency_code || estimate.currency_code || "";
            const lineText = fmtRange(ccy, li?.price_min, li?.price_max);

            return (
              <div key={key} className="rounded-[0.75rem] p-3 bg-white">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="font-bold">{name}</div>
                  <div className="font-bold text-lg text-right [font-variant-numeric:tabular-nums]">
                    {lineText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {outroText ? (
        <div className="mt-3 text-base font-bold whitespace-pre-line">
          {outroText}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Options normalizer (accepts many backend shapes) ---------- */
export function normalizeOptions(q) {
  const raw = q?.options ?? q?.choices ?? q?.buttons ?? q?.values ?? [];

  return (Array.isArray(raw) ? raw : [])
    .map((o, idx) => {
      if (o == null) return null;
      if (typeof o === "string") {
        return { key: o, label: o, id: String(idx) };
      }
      const key = o.key ?? o.value ?? o.id ?? String(idx);
      const label = o.label ?? o.title ?? o.name ?? String(key);
      const tooltip = o.tooltip ?? o.description ?? o.help ?? undefined;
      return { key, label, tooltip, id: String(o.id ?? key ?? idx) };
    })
    .filter(Boolean);
}

export function QuestionBlock({ q, value, onPick }) {
  const opts = normalizeOptions(q);
  const type = String(q?.type || "").toLowerCase();
  const isMulti =
    type === "multi_choice" || type === "multichoice" || type === "multi";

  return (
    <div data-patch="question-block" className={UI.FIELD}>
      <div className="font-bold text-base">{q.prompt}</div>
      {q.help_text ? (
        <div className="text-xs italic mt-1 text-[var(--helper-fg)]">
          {q.help_text}
        </div>
      ) : null}

      {opts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {opts.map((opt) => (
            <OptionButton
              key={opt.id}
              opt={opt}
              selected={
                isMulti
                  ? Array.isArray(value) && value.includes(opt.key)
                  : value === opt.key
              }
              onClick={() => onPick(q, opt)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-[var(--helper-fg)]">
          No options available.
        </div>
      )}
    </div>
  );
}

export function TabsNav({ mode, tabs }) {
  return (
    <div
      className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-patch="tabs-nav"
    >
      <nav
        className="inline-flex min-w-max items-center gap-0.5 overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((t) => {
          const active =
            (mode === "browse" && t.key === "demos") ||
            (mode === "docs" && t.key === "docs") ||
            (mode === "price" && t.key === "price") ||
            (mode === "meeting" && t.key === "meeting");
          return (
            <button
              key={t.key}
              onClick={t.onClick}
              role="tab"
              aria-selected={active}
              className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
              style={
                active
                  ? { background: "var(--card-bg)", color: "var(--tab-active-fg)" }
                  : { background: "var(--tab-bg)", color: "var(--tab-fg)" }
              }
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
