import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import fallbackLogo from "../assets/logo.png";

import TabsNav from "./TabsNav";
import Row from "./Row";
import DocIframe from "./DocIframe";
import AskInputBar from "./AskInputBar";
import FormFillCard from "./FormFillCard";

/* --------------------------------------------------------------------------------
   Constants & Helpers
-------------------------------------------------------------------------------- */
const DEFAULT_THEME_VARS = {
  "--banner-bg": "#000000",
  "--banner-fg": "#ffffff",
  "--page-bg": "#e6e6e6",
  "--card-bg": "#ffffff",
  "--shadow-elevation":
    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
  "--message-fg": "#000000",
  "--helper-fg": "#4b5563",
  "--mirror-fg": "#4b5563",
  "--tab-bg": "#303030",
  "--tab-fg": "#ffffff",
  "--tab-active-fg": "#ffffff",
  "--demo-button-bg": "#3a4554",
  "--demo-button-fg": "#ffffff",
  "--doc-button-bg": "#000000",
  "--doc-button-fg": "#ffffff",
  "--price-button-bg": "#1a1a1a",
  "--price-button-fg": "#ffffff",
  "--send-color": "#000000",
  "--border-default": "#9ca3af",
};

const PERSPECTIVE_OPTIONS = [
  { key: "general", label: "General" },
  { key: "financial", label: "Financial" },
  { key: "operational", label: "Operational" },
  { key: "executive", label: "Owner / Executive" },
  { key: "technical", label: "Technical / IT" },
  { key: "user", label: "User / Functional" },
  { key: "customer", label: "Customer / Market" },
  { key: "compliance", label: "Governance / Compliance" },
];

const ALWAYS_FORM_FIELDS = [
  { field_key: "first_name", label: "First Name" },
  { field_key: "last_name", label: "Last Name" },
  { field_key: "email", label: "Email" },
];

const DEMO_PRUNE_MAX = 6;
const DEMO_STRONG_THRESHOLD = 2;
const DEMO_STRONG_RATIO = 2.2;
const DEMO_SECONDARY_KEEP = 2;

const classNames = (...xs) => xs.filter(Boolean).join(" ");
function inverseBW(hex) {
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

function scoreDemo(question, demo) {
  const qTokens = new Set(
    (question || "")
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) || []
  );
  const textTokens =
    (
      (demo.title || "") +
      " " +
      (demo.description || "")
    )
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) || [];
  const dTokens = new Set(textTokens);
  let overlap = 0;
  qTokens.forEach((t) => {
    if (dTokens.has(t)) overlap++;
  });
  return overlap;
}

function pruneDemoButtons(q, buttons) {
  if (!Array.isArray(buttons) || buttons.length <= 2) return buttons;
  const scored = buttons.map((b) => ({ b, s: scoreDemo(q, b) }));
  scored.sort((a, b) => b.s - a.s);
  const top = scored[0].s;
  const second = scored[1]?.s ?? 0;
  if (top < DEMO_STRONG_THRESHOLD) {
    return scored.slice(0, Math.min(DEMO_PRUNE_MAX, buttons.length)).map((x) => x.b);
  }
  if (second === 0 || top >= second * DEMO_STRONG_RATIO) {
    return [scored[0].b];
  }
  const cap = Math.min(
    Math.max(DEMO_SECONDARY_KEEP, 2),
    DEMO_PRUNE_MAX,
    scored.length
  );
  return scored.slice(0, cap).map((x) => x.b);
}

/* Floating panel positioning */
function useFloatingPos(frameRef, side = "left", width = 460, gap = 12) {
  const [pos, setPos] = useState({ left: 16, top: 16, width });
  useEffect(() => {
    function update() {
      const r = frameRef?.current?.getBoundingClientRect?.();
      if (!r) return setPos({ left: 16, top: 16, width });
      if (side === "left") {
        setPos({
          left: Math.max(8, r.left - width - gap),
          top: Math.max(8, r.top + 8),
          width,
        });
      } else {
        setPos({
          left: Math.min(window.innerWidth - width - 8, r.right + gap),
          top: Math.max(8, r.top + 8),
          width,
        });
      }
    }
    update();
    const h = () => update();
    window.addEventListener("resize", h);
    window.addEventListener("scroll", h, { passive: true });
    return () => {
      window.removeEventListener("resize", h);
      window.removeEventListener("scroll", h);
    };
  }, [frameRef, side, width, gap]);
  return pos;
}

/* -----------------------------------------------------------------------------
   ThemeLab Color Panel
----------------------------------------------------------------------------- */
function ThemeLabColorBox({ apiBase, botId, frameRef, onVars, sharedAuth }) {
  const TOKEN_TO_CSS = {
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

  const SCREEN_ORDER = [
    { key: "welcome", label: "Welcome" },
    { key: "bot_response", label: "Bot Response" },
    { key: "browse_demos", label: "Browse Demos" },
    { key: "browse_docs", label: "Browse Documents" },
    { key: "price", label: "Price Estimate" },
  ];

  const [rows, setRows] = useState([]);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function fetchWithToken(url, init = {}) {
    const headers = { ...(init.headers || {}) };
    if (sharedAuth.token) headers["X-ThemeLab-Token"] = sharedAuth.token;
    return fetch(url, { ...init, headers, credentials: "include" });
  }

  const pos = useFloatingPos(frameRef, "left", 460);

  async function load() {
    try {
      const res = await fetchWithToken(
        `${apiBase}/brand/client-tokens?bot_id=${encodeURIComponent(botId)}`
      );
      const data = await res.json();
      const toks = (data?.ok ? data.tokens : []) || [];
      setRows(toks);

      const v = {};
      toks.forEach((t) => {
        v[t.token_key] = t.value || "#000000";
      });
      setValues(v);

      const cssPatch = {};
      toks.forEach((t) => {
        const cssVar = TOKEN_TO_CSS[t.token_key];
        if (cssVar) cssPatch[cssVar] = v[t.token_key];
      });
      onVars && onVars(cssPatch);
    } catch {}
  }

  useEffect(() => {
    if (sharedAuth.state === "ok") load();
  }, [sharedAuth.state]);

  function updateToken(tokenKey, value) {
    const v = value || "";
    setValues((prev) => ({ ...prev, [tokenKey]: v }));
    const cssVar = TOKEN_TO_CSS[tokenKey];
    if (cssVar && onVars) onVars({ [cssVar]: v });
  }

  async function doSave() {
    try {
      setBusy(true);
      const updates = Object.entries(values).map(([token_key, value]) => ({
        token_key,
        value,
      }));
      const res = await fetchWithToken(
        `${apiBase}/brand/client-tokens/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, updates }),
        }
      );
      const data = await res.json();
      if (!data?.ok) throw new Error();
      setMsg(`Saved ${data.updated} token(s).`);
      setTimeout(() => setMsg(""), 1600);
    } catch {
      setMsg("Save failed.");
      setTimeout(() => setMsg(""), 1800);
    } finally {
      setBusy(false);
    }
  }
  async function doReset() {
    await load();
    setMsg("Restored.");
    setTimeout(() => setMsg(""), 1400);
  }

  const groups = useMemo(() => {
    const by = new Map();
    rows.forEach((r) => {
      const k = r.screen_key || "welcome";
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    });
    SCREEN_ORDER.forEach(({ key }) => {
      if (by.has(key)) {
        by
          .get(key)
          .sort((a, b) =>
            String(a.label || "").localeCompare(String(b.label || ""))
          );
      }
    });
    return by;
  }, [rows]);

  return (
    <div
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: pos.width,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.2)",
        borderRadius: "12px",
        padding: 12,
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <div className="text-base font-bold mb-2">ThemeLab Colors</div>
      {sharedAuth.state === "ok" ? (
        <>
          {SCREEN_ORDER.map(({ key, label }) => (
            <div key={key} className="mb-2">
              <div className="text-sm font-semibold mb-1">{label}</div>
              <div className="space-y-1 pl-1">
                {(groups.get(key) || []).map((t) => (
                  <div
                    key={t.token_key}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="text-xs">{t.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={values[t.token_key] || "#000000"}
                        onChange={(e) =>
                          updateToken(t.token_key, e.target.value)
                        }
                        style={{
                          width: 32,
                          height: 24,
                          borderRadius: 6,
                          border: "1px solid rgba(0,0,0,0.2)",
                        }}
                        title={t.token_key}
                      />
                      <code className="text-[11px] opacity-70">
                        {values[t.token_key] || ""}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">{msg}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={doReset}
                disabled={busy}
                className="px-3 py-1 rounded-[12px] border border-black/20 bg-white"
              >
                Reset
              </button>
              <button
                onClick={doSave}
                disabled={busy}
                className="px-3 py-1 rounded-[12px] bg-black text-white"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      ) : sharedAuth.state === "checking" ? (
        <div className="text-sm text-gray-600">Checking access…</div>
      ) : sharedAuth.state === "need_password" ? (
        <div className="text-xs text-gray-600">
          Enter password in Wording panel.
        </div>
      ) : sharedAuth.state === "disabled" ? (
        <div className="text-xs text-gray-600">ThemeLab disabled.</div>
      ) : (
        <div className="text-xs text-red-600">Auth error.</div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   ThemeLab Wording Panel (with live Apply)
----------------------------------------------------------------------------- */
function ThemeLabWordingBox({
  apiBase,
  botId,
  frameRef,
  sharedAuth,
  onFormfillChange,
  onLiveMessages,
}) {
  const pos = useFloatingPos(frameRef, "right", 460);

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [options, setOptions] = useState({
    show_browse_demos: false,
    show_browse_docs: false,
    show_price_estimate: false,
    show_schedule_meeting: false,
    show_intro_video: false,
    show_formfill: false,
    intro_video_url: "",
  });

  const [messages, setMessages] = useState({
    welcome_message: "",
    pricing_intro: "",
    pricing_outro: "",
    pricing_custom_notice: "",
  });

  const [standardFields, setStandardFields] = useState([]);
  const [editingKey, setEditingKey] = useState("");
  const [draft, setDraft] = useState("");
  const stashRef = useRef(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const messageLabels = {
    welcome_message: "Welcome",
    pricing_intro: "Pricing Intro",
    pricing_outro: "Pricing Outro",
    pricing_custom_notice: "Custom Pricing",
  };

  const ALWAYS_FIELD_KEYS = new Set(
    ALWAYS_FORM_FIELDS.map((f) => f.field_key.toLowerCase())
  );

  function fetchWithToken(url, init = {}) {
    const headers = { ...(init.headers || {}) };
    if (sharedAuth.token) headers["X-ThemeLab-Token"] = sharedAuth.token;
    return fetch(url, { ...init, headers, credentials: "include" });
  }

  function markDirty() {
    setDirty(true);
  }

  function propagateFormfill(
    show = options.show_formfill,
    fields = standardFields
  ) {
    onFormfillChange &&
      onFormfillChange({
        show_formfill: show,
        standard_fields: fields.map((f) => ({
          field_key: f.field_key,
            is_collected: !!f.is_collected,
          is_required: !!f.is_required,
        })),
      });
  }

  function getInitialMessageKey(ms) {
    if (ms?.welcome_message !== undefined) return "welcome_message";
    return Object.keys(ms || {})[0] || "";
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetchWithToken(
        `${apiBase}/themelab/wording-options?bot_id=${encodeURIComponent(
          botId
        )}`
      );
      const data = await res.json();
      if (!data?.ok) throw new Error();
      setOptions(data.options || {});
      setMessages(data.messages || {});
      const sf = (data.standard_fields || []).map((f) => ({
        ...f,
        is_collected: !!f.is_collected,
        is_required: !!f.is_required,
      }));
      setStandardFields(sf);
      stashRef.current = {
        options: data.options || {},
        messages: data.messages || {},
        standard_fields: sf,
      };
      const fk = getInitialMessageKey(data.messages);
      setEditingKey(fk);
      setDraft(fk ? data.messages[fk] || "" : "");
      setDirty(false);
      propagateFormfill(data.options?.show_formfill, sf);
      if (typeof onLiveMessages === "function") {
        onLiveMessages(data.messages || {});
      }
    } catch {
      setMsg("Load failed.");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sharedAuth.state === "ok") load();
  }, [sharedAuth.state]);

  async function doLogin(e) {
    e?.preventDefault();
    try {
      setAuthError("");
      const res = await fetch(`${apiBase}/themelab/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bot_id: botId, password }),
      });
      const data = await res.json();
      if (res.status === 200 && data?.ok) {
        sharedAuth.set({ state: "ok" });
        if (data.token) sharedAuth.setToken(data.token);
        setPassword("");
        await load();
      } else if (res.status === 403) {
        sharedAuth.set({ state: "disabled" });
      } else {
        setAuthError("Invalid password.");
        sharedAuth.set({ state: "need_password" });
      }
    } catch {
      setAuthError("Login failed.");
      sharedAuth.set({ state: "error" });
    }
  }

  function toggleOption(k) {
    setOptions((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      markDirty();
      if (k === "show_formfill") propagateFormfill(!prev[k], standardFields);
      return next;
    });
  }
  function toggleCollected(fk) {
    if (ALWAYS_FIELD_KEYS.has(String(fk).toLowerCase())) return;
    setStandardFields((prev) => {
      const next = prev.map((f) =>
        f.field_key === fk ? { ...f, is_collected: !f.is_collected } : f
      );
      markDirty();
      propagateFormfill(options.show_formfill, next);
      return next;
    });
  }
  function toggleRequired(fk) {
    if (ALWAYS_FIELD_KEYS.has(String(fk).toLowerCase())) return;
    setStandardFields((prev) => {
      const next = prev.map((f) =>
        f.field_key === fk ? { ...f, is_required: !f.is_required } : f
      );
      markDirty();
      propagateFormfill(options.show_formfill, next);
      return next;
    });
  }

  function beginEdit(k) {
    setEditingKey(k);
    setDraft(messages[k] || "");
  }

  function applyDraft() {
    if (!editingKey) return;
    setMessages((prev) => {
      const updated = { ...prev, [editingKey]: draft };
      if (typeof onLiveMessages === "function") onLiveMessages(updated);
      return updated;
    });
    markDirty();
  }

  function cancelEdit() {
    if (editingKey) setDraft(messages[editingKey] || "");
  }

  async function doSave() {
    try {
      setSaving(true);
      const payload = {
        bot_id: botId,
        options,
        messages,
        standard_fields: standardFields.map((f) => ({
          field_key: f.field_key,
          is_collected: !!f.is_collected,
          is_required: !!f.is_required,
        })),
      };
      const res = await fetchWithToken(
        `${apiBase}/themelab/wording-options/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!data?.ok) throw new Error();
      setMsg("Saved.");
      setDirty(false);
      stashRef.current = payload;
      setTimeout(() => setMsg(""), 1500);
    } catch {
      setMsg("Save failed.");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setSaving(false);
    }
  }

  function doReset() {
    if (!stashRef.current) {
      load();
      return;
    }
    const snap = stashRef.current;
    setOptions(snap.options);
    setMessages(snap.messages);
    setStandardFields(snap.standard_fields);
    const fk = getInitialMessageKey(snap.messages);
    setEditingKey(fk);
    setDraft(fk ? snap.messages[fk] || "" : "");
    setDirty(false);
    propagateFormfill(snap.options.show_formfill, snap.standard_fields);
    setMsg("Restored.");
    setTimeout(() => setMsg(""), 1400);
    if (typeof onLiveMessages === "function") {
      onLiveMessages(snap.messages || {});
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: pos.width,
        maxHeight: "90vh",
        overflowY: "auto",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.2)",
        borderRadius: "12px",
        padding: 14,
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <div className="text-base font-bold mb-2">
        ThemeLab Wording &amp; Options
      </div>

      {sharedAuth.state === "checking" && (
        <div className="text-sm text-gray-600">Checking access…</div>
      )}
      {sharedAuth.state === "disabled" && (
        <div className="text-sm text-gray-600">
          ThemeLab is disabled for this bot.
        </div>
      )}
      {sharedAuth.state === "need_password" && (
        <form onSubmit={doLogin} className="flex items-center gap-2 mb-3">
          <input
            type="password"
            placeholder="ThemeLab password"
            className="flex-1 rounded-[12px] border border-black/30 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-[12px] bg-black text-white text-sm"
          >
            Unlock
          </button>
          {authError && (
            <div className="text-xs text-red-600 ml-2">{authError}</div>
          )}
        </form>
      )}
      {sharedAuth.state === "error" && (
        <div className="text-sm text-red-600">Unable to verify access.</div>
      )}

      {sharedAuth.state === "ok" && (
        <>
          {loading && (
            <div className="text-xs text-gray-500 mb-2">Loading…</div>
          )}
          <div className="grid grid-cols-2 gap-6 mb-3">
            {/* Options */}
            <div>
              <div className="font-semibold text-sm mb-1">Things to Show</div>
              <div className="space-y-1">
                {[
                  ["show_browse_demos", "Browse Demos Tab"],
                  ["show_browse_docs", "Browse Docs Tab"],
                  ["show_price_estimate", "Price Estimate Tab"],
                  ["show_schedule_meeting", "Schedule Meeting Tab"],
                  ["show_intro_video", "Introduction Video"],
                  ["show_formfill", "Show Form Fill"],
                ].map(([k, label]) => (
                  <label
                    key={k}
                    className="flex items-center justify-between text-xs gap-2 cursor-pointer"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={!!options[k]}
                      onChange={() => toggleOption(k)}
                    />
                  </label>
                ))}
              </div>
            </div>
            {/* Form Fill Fields (excluding always-required) */}
            <div>
              <div className="font-semibold text-sm mb-1">
                Form Fill Fields
              </div>
              <div className="space-y-1">
                {standardFields
                  .filter(
                    (f) =>
                      f?.field_key &&
                      !ALWAYS_FIELD_KEYS.has(f.field_key.toLowerCase())
                  )
                  .map((f) => (
                    <div
                      key={f.field_key}
                      className="flex items-center justify-between text-xs gap-2"
                    >
                      <span className="flex-1">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          title="Collect"
                          checked={!!f.is_collected}
                          onChange={() => toggleCollected(f.field_key)}
                        />
                        <span className="text-[10px] uppercase tracking-wide opacity-70">
                          reqd
                        </span>
                        <input
                          type="checkbox"
                          title="Required"
                          checked={!!f.is_required}
                          onChange={() => toggleRequired(f.field_key)}
                        />
                      </div>
                    </div>
                  ))}
                <div className="text-[10px] italic text-gray-500 pt-1">
                  First Name, Last Name, and Email are always collected & required.
                </div>
              </div>
            </div>
          </div>
          {/* Messages */}
            <div className="mb-2 font-semibold text-sm">Messages</div>
          <div className="space-y-1 mb-3">
            {Object.entries(messageLabels).map(([k, label]) => {
              const active = editingKey === k;
              return (
                <div
                  key={k}
                  className={classNames(
                    "flex items-center justify-between text-xs px-2 py-1 rounded cursor-pointer group",
                    active
                      ? "bg-black text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  )}
                  onClick={() => beginEdit(k)}
                >
                  <span className="flex-1">{label}</span>
                  <span className="opacity-70 mr-2 truncate max-w-[140px]">
                    {messages[k]
                      ? messages[k].slice(0, 24) +
                        (messages[k].length > 24 ? "…" : "")
                      : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      beginEdit(k);
                    }}
                    className={classNames(
                      "p-1 rounded transition",
                      active
                        ? "bg-white text-black"
                        : "bg-gray-200 text-gray-700 group-hover:bg-gray-300"
                    )}
                    title="Edit"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 14.5V17h2.5l9.1-9.1-2.5-2.5L3 14.5z" />
                      <path d="M12.3 5.4l2.6 2.6 1.3-1.3a1.8 1.8 0 0 0 0-2.6l-.7-.7a1.8 1.8 0 0 0-2.6 0l-1.3 1.3z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          {editingKey && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold">
                  Editing: {messageLabels[editingKey]}
                </div>
                {dirty && (
                  <div className="text-[10px] text-orange-600">
                    Unsaved changes
                  </div>
                )}
              </div>
              <textarea
                rows={5}
                className="w-full border border-black/30 rounded p-2 text-xs"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Edit message text..."
              />
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  onClick={cancelEdit}
                  className="px-2 py-1 rounded bg-gray-200 text-xs"
                >
                  Revert
                </button>
                <button
                  onClick={applyDraft}
                  className="px-2 py-1 rounded bg-black text-white text-xs"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
          <div className="mb-3">
            <label className="text-xs font-semibold block mb-1">
              Intro Video URL
            </label>
            <input
              type="text"
              value={options.intro_video_url || ""}
              onChange={(e) => {
                setOptions((prev) => ({
                  ...prev,
                  intro_video_url: e.target.value,
                }));
                markDirty();
              }}
              className="w-full text-xs border border-black/30 rounded px-2 py-1"
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {msg || (dirty ? "Unsaved changes" : saving ? "Saving…" : "")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={doReset}
                disabled={saving}
                className="px-3 py-1 rounded-[12px] border border-black/20 bg-white text-xs"
              >
                Reset
              </button>
              <button
                onClick={doSave}
                disabled={saving || !dirty}
                className={classNames(
                  "px-3 py-1 rounded-[12px] text-xs",
                  dirty
                    ? "bg-black text-white"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                )}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------------
   ThemeLab Panels Wrapper
----------------------------------------------------------------------------- */
function ThemeLabPanels({
  apiBase,
  botId,
  frameRef,
  onVars,
  onFormfillChange,
  onLiveMessages,
}) {
  const [authState, setAuthState] = useState("checking");
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setAuthState("checking");
        const res = await fetch(
          `${apiBase}/themelab/status?bot_id=${encodeURIComponent(botId)}`,
          { credentials: "include" }
        );
        if (cancel) return;
        if (res.status === 200) setAuthState("ok");
        else if (res.status === 401) setAuthState("need_password");
        else if (res.status === 403) setAuthState("disabled");
        else setAuthState("error");
      } catch {
        if (!cancel) setAuthState("error");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [apiBase, botId]);

  const sharedAuth = {
    state: authState,
    set: (s) => setAuthState(s.state),
    token,
    setToken,
  };

  return (
    <>
      <ThemeLabColorBox
        apiBase={apiBase}
        botId={botId}
        frameRef={frameRef}
        onVars={onVars}
        sharedAuth={sharedAuth}
      />
      <ThemeLabWordingBox
        apiBase={apiBase}
        botId={botId}
        frameRef={frameRef}
        sharedAuth={sharedAuth}
        onFormfillChange={onFormfillChange}
        onLiveMessages={onLiveMessages}
      />
    </>
  );
}

/* -----------------------------------------------------------------------------
   Pricing Helpers
----------------------------------------------------------------------------- */
function normalizeOptions(q) {
  const raw = q?.options ?? q?.choices ?? q?.buttons ?? q?.values ?? [];
  return (Array.isArray(raw) ? raw : [])
    .map((o, idx) => {
      if (o == null) return null;
      if (typeof o === "string") return { key: o, label: o, id: String(idx) };
      const key = o.key ?? o.value ?? o.id ?? String(idx);
      const label = o.label ?? o.title ?? o.name ?? String(key);
      const tooltip = o.tooltip ?? o.description ?? o.help ?? undefined;
      return { key, label, tooltip, id: String(o.id ?? key ?? idx) };
    })
    .filter(Boolean);
}

function OptionButton({ opt, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(opt)}
      className={classNames(
        "w-full text-center rounded-[0.75rem] px-4 py-3 transition",
        "text-[var(--price-button-fg)] bg-[var(--price-button-bg)] hover:brightness-110 active:brightness-95",
        selected && "ring-2 ring-black/20"
      )}
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

function QuestionBlock({ q, value, onPick }) {
  const opts = normalizeOptions(q);
  const type = String(q?.type || "").toLowerCase();
  const isMulti =
    type === "multi_choice" || type === "multichoice" || type === "multi";
  return (
    <div className="w-full rounded-[0.75rem] px-4 py-3 text-base bg-[var(--card-bg)] border border-[var(--border-default)]">
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
              onClick={(o) => onPick(q, o)}
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

function PriceMirror({ lines }) {
  if (!lines?.length) return null;
  return (
    <div className="mb-3">
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

function EstimateCard({ estimate, outroText }) {
  if (!estimate) return null;
  const items = Array.isArray(estimate.line_items) ? estimate.line_items : [];
  const fmtAmount = (c, v) => `${c} ${Number(v).toLocaleString()}`;
  const fmtRange = (c, min, max) =>
    Number(min) === Number(max)
      ? fmtAmount(c, max)
      : `${fmtAmount(c, min)} – ${fmtAmount(c, max)}`;
  const totalText = fmtRange(
    estimate.currency_code,
    estimate.total_min,
    estimate.total_max
  );
  return (
    <div>
      <div className="rounded-[0.75rem] p-4 bg-white [box-shadow:var(--shadow-elevation)]">
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

/* -----------------------------------------------------------------------------
   Main Component
----------------------------------------------------------------------------- */
export default function Welcome() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  // ORIGINAL SIMPLE THEMELAB ACTIVATION (restored)
  const themeLabOn = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const th = (qs.get("themelab") || "").trim().toLowerCase();
    return th === "1" || th === "true";
  }, []);

  /* --- State declarations (unchanged content) --- */
  const urlParams = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const o = {};
    q.forEach((v, k) => (o[k] = v));
    return o;
  }, []);

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [agent, setAgent] = useState(null);
  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);
  const [pickerVars, setPickerVars] = useState({});
  const liveTheme = useMemo(
    () => ({ ...derivedTheme, ...pickerVars }),
    [derivedTheme, pickerVars]
  );
  const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const initialBrandReady = useMemo(
    () => !(botIdFromUrl || alias),
    [botIdFromUrl, alias]
  );
  const [brandReady, setBrandReady] = useState(initialBrandReady);
  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });
  const [showFormfill, setShowFormfill] = useState(true);
  const [formFields, setFormFields] = useState([]);
  const [visitorDefaults, setVisitorDefaults] = useState({});
  const [formShown, setFormShown] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [pending, setPending] = useState(null);
  const FORM_KEY = useMemo(
    () => `formfill_completed:${botId || alias || "_"}`,
    [botId, alias]
  );
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FORM_KEY) === "1") setFormCompleted(true);
    } catch {}
  }, [FORM_KEY]);
  const [pricingCopy, setPricingCopy] = useState({
    intro: "",
    outro: "",
    custom_notice: "",
  });
  const [priceQuestions, setPriceQuestions] = useState([]);
  const [priceAnswers, setPriceAnswers] = useState({});
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceErr, setPriceErr] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [lastError, setLastError] = useState(null);
  const firstPrefillDone = useRef(false);

  function maybePrefillFirstQuestion(firstQ) {
    if (!firstQ || firstPrefillDone.current) return;
    setInput((curr) => {
      if (curr.trim().length === 0) {
        firstPrefillDone.current = true;
        return firstQ;
      }
      return curr;
    });
  }

  function ensurePerspectiveField(incomingFields, incomingDefaults) {
    let hasPerspective = false;
    const updated = (incomingFields || []).map((f) => {
      if (f.field_key === "perspective") {
        hasPerspective = true;
        return {
          ...f,
          field_type: f.field_type || "single_select",
          is_standard: true,
          is_collected: true,
          is_required: true,
          options: PERSPECTIVE_OPTIONS,
        };
      }
      return f;
    });
    if (!hasPerspective) {
      updated.push({
        field_key: "perspective",
        label: "Perspective",
        field_type: "single_select",
        is_standard: true,
        is_collected: true,
        is_required: true,
        options: PERSPECTIVE_OPTIONS,
      });
    }
    const d = { ...(incomingDefaults || {}) };
    d.perspective = d.perspective
      ? String(d.perspective).toLowerCase()
      : "general";
    return { fields: updated, defaults: d };
  }

  const withIdsBody = (obj) => ({
    ...obj,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
  });
  const withIdsHeaders = () => ({
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
  });
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    return u.toString();
  };

  function updateLocalVisitorValues(newVals) {
    if (!newVals || typeof newVals !== "object") return;
    setVisitorDefaults((prev) => {
      const merged = { ...(prev || {}) };
      Object.entries(newVals).forEach(([k, v]) => {
        if (typeof v === "string") merged[k] = v;
      });
      if (merged.perspective)
        merged.perspective = merged.perspective.toLowerCase();
      return merged;
    });
  }

  async function refetchVisitorValues() {
    if (!visitorId) return;
    try {
      const res = await fetch(
        `${apiBase}/visitor-formfill?visitor_id=${encodeURIComponent(
          visitorId
        )}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && data.values) updateLocalVisitorValues(data.values);
    } catch {}
  }

  /* --- Bot / alias resolution & brand/theme loading (same logic as before) --- */
  useEffect(() => {
    if (botId || !alias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`
        );
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;
        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setResponseText(b.welcome_message || "");
          maybePrefillFirstQuestion(b.first_question || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
            price: !!b.show_price_estimate,
          });
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
        if (id) setBotId(id);
        else if (!res.ok || data?.ok === false)
          setFatal("Invalid or inactive alias.");
      } catch {
        if (!cancel) setFatal("Invalid or inactive alias.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alias, apiBase, botId]);

  useEffect(() => {
    if (botId || alias || !defaultAlias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(defaultAlias)}`
        );
        const data = await res.json();
        if (cancel) return;
        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }
        const b = data?.ok ? data?.bot : null;
        if (b) {
          setResponseText(b.welcome_message || "");
          maybePrefillFirstQuestion(b.first_question || "");
          setIntroVideoUrl(b.intro_video_url || "");
          setShowIntroVideo(!!b.show_intro_video);
          setTabsEnabled({
            demos: !!b.show_browse_demos,
            docs: !!b.show_browse_docs,
            meeting: !!b.show_schedule_meeting,
            price: !!b.show_price_estimate,
          });
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
        if (data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [botId, alias, defaultAlias, apiBase]);

  useEffect(() => {
    if (!botId && !alias && !brandReady) setBrandReady(true);
  }, [botId, alias, brandReady]);

  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        );
        const data = await res.json();
        if (cancel) return;
        if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
          setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
        }
        if (data?.ok && data?.assets) {
          setBrandAssets({
            logo_url: data.assets.logo_url || null,
            logo_light_url: data.assets.logo_light_url || null,
            logo_dark_url: data.assets.logo_dark_url || null,
          });
        }
      } catch {
      } finally {
        if (!cancel) setBrandReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [botId, apiBase]);

  async function fetchFormfillConfigBy(botIdArg, aliasArg) {
    try {
      const params = new URLSearchParams();
      if (botIdArg) params.set("bot_id", botIdArg);
      else if (aliasArg) params.set("alias", aliasArg);
      if (visitorId) params.set("visitor_id", visitorId);
      if ([...params.keys()].length === 0) return;
      const res = await fetch(
        `${apiBase}/formfill-config?${params.toString()}`
      );
      const data = await res.json();
      if (data?.ok) {
        const rawFields = Array.isArray(data.fields) ? data.fields : [];
        const visitorVals =
          (data.visitor_values && typeof data.visitor_values === "object"
            ? data.visitor_values
            : {}) || {};
        const { fields: patched, defaults: patchedDefaults } =
          ensurePerspectiveField(rawFields, visitorVals);
        setShowFormfill(!!data.show_formfill);
        setFormFields(patched);
        setVisitorDefaults(patchedDefaults);
      }
    } catch {}
  }
  useEffect(() => {
    if (botId) fetchFormfillConfigBy(botId, null);
  }, [botId]);
  useEffect(() => {
    if (!botId && alias) fetchFormfillConfigBy(null, alias);
  }, [alias, botId]);
  useEffect(() => {
    if (botId && visitorId) fetchFormfillConfigBy(botId, null);
  }, [visitorId, botId]);
  useEffect(() => {
    if (
      (mode === "formfill" || mode === "personalize") &&
      visitorId &&
      botId
    ) {
      refetchVisitorValues();
    }
  }, [mode, visitorId, botId]);

  const activeFormFields = useMemo(() => {
    const byKey = new Map();
    (Array.isArray(formFields) ? formFields : []).forEach((f) => {
      if (f?.field_key) byKey.set(f.field_key.toLowerCase(), { ...f });
    });
    // Always inject required core fields
    ALWAYS_FORM_FIELDS.forEach((core) => {
      const k = core.field_key.toLowerCase();
      const existing = byKey.get(k) || {};
      byKey.set(k, {
        ...existing,
        field_key: core.field_key,
        label: core.label,
        is_standard: true,
        is_collected: true,
        is_required: true,
        field_type:
          existing.field_type || (core.field_key === "email" ? "email" : "text"),
      });
    });
    // Ensure perspective
    if (!byKey.has("perspective")) {
      byKey.set("perspective", {
        field_key: "perspective",
        label: "Perspective",
        field_type: "single_select",
        is_standard: true,
        is_collected: true,
        is_required: true,
        options: PERSPECTIVE_OPTIONS,
      });
    } else {
      const pv = byKey.get("perspective");
      byKey.set("perspective", {
        ...pv,
        field_type: "single_select",
        is_collected: true,
        is_required: true,
        options: pv.options || PERSPECTIVE_OPTIONS,
      });
    }
    return Array.from(byKey.values());
  }, [formFields]);

  const formDefaults = useMemo(() => {
    const o = { ...(visitorDefaults || {}) };
    activeFormFields.forEach((f) => {
      const k = f.field_key;
      const urlV = urlParams[k];
      if (typeof urlV === "string" && urlV.length) o[k] = urlV;
    });
    if (!o.perspective) o.perspective = "general";
    o.perspective = String(o.perspective).toLowerCase();
    return o;
  }, [activeFormFields, visitorDefaults, urlParams]);

  async function doSend(outgoing) {
    if (!outgoing || !botId) return;
    setMode("ask");
    setLastQuestion(outgoing);
    setInput("");
    setSelected(null);
    setResponseText("");
    setItems([]);
    setLoading(true);
    setLastError(null);

    const payload = withIdsBody({
      bot_id: botId,
      user_question: outgoing,
      scope: "standard",
      debug: true,
    });

    const axiosConfig = {
      timeout: 30000,
      headers: { "Content-Type": "application/json", ...withIdsHeaders() },
      validateStatus: () => true,
    };

    try {
      const res = await axios.post(`${apiBase}/demo-hal`, payload, axiosConfig);
      const status = res.status;
      const data = res.data || {};
      const ok =
        data.ok !== false &&
        status >= 200 &&
        status < 300 &&
        typeof data.response_text === "string";
      if (!ok) {
        const msg =
          data.response_text ||
          data.message ||
          (status === 500
            ? "Internal server error"
            : `Request failed (${status})`);
        setResponseText(msg || "Sorry—something went wrong.");
        setLoading(false);
        setLastError({ status, data, payloadSent: payload });
        return;
      }
      const text = data.response_text || "";
      const src = Array.isArray(data.demo_buttons) ? data.demo_buttons : [];
      let mapped = src.map((it, idx) => ({
        id: it.id ?? it.value ?? it.url ?? it.title ?? String(idx),
        title: it.title ?? it.button_title ?? it.label ?? "",
        url: it.url ?? it.value ?? it.button_value ?? "",
        description: it.description ?? it.summary ?? it.functions_text ?? "",
      }));
      mapped = pruneDemoButtons(outgoing, mapped);
      if (typeof data.perspective === "string" && data.perspective.trim()) {
        updateLocalVisitorValues({
          perspective: data.perspective.toLowerCase(),
        });
      }
      setItems(mapped.filter(Boolean));
      setResponseText(text);
      setLoading(false);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const fallback =
        data?.response_text ||
        data?.message ||
        (status ? `Request failed (HTTP ${status})` : "Network error");
      setResponseText(
        fallback.startsWith("Request failed")
          ? "Sorry—something went wrong."
          : fallback
      );
      setLastError({
        status,
        data,
        message: err.message,
        stack: err.stack,
        payloadSent: payload,
      });
      setItems([]);
      setLoading(false);
    }
  }

  function maybeOpenForm(next) {
    if (!showFormfill || activeFormFields.length === 0) return false;
    try {
      if (sessionStorage.getItem(FORM_KEY) === "1") {
        if (!formCompleted) setFormCompleted(true);
        return false;
      }
    } catch {}
    if (!formCompleted && !formShown) {
      setFormShown(true);
      setPending(next);
      setMode("formfill");
      return true;
    }
    return false;
  }

  async function onSendClick() {
    const outgoing = input.trim();
    if (!outgoing || !botId) return;
    if (maybeOpenForm({ type: "ask", payload: { text: outgoing } })) return;
    await doSend(outgoing);
  }

  function openPersonalize() {
    refetchVisitorValues();
    setPending(null);
    setMode("formfill");
    setFormShown(true);
  }

  async function normalizeAndSelectDemo(item) {
    try {
      const r = await fetch(`${apiBase}/render-video-iframe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...withIdsHeaders() },
        body: JSON.stringify(
          withIdsBody({
            bot_id: botId,
            demo_id: item.id || "",
            title: item.title || "",
            video_url: item.url || "",
          })
        ),
      });
      const j = await r.json();
      const embed = j?.video_url || item.url;
      setSelected({ ...item, url: embed });
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setSelected(item);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    }
  }

  async function _openBrowse() {
    if (!botId) return;
    setMode("browse");
    setSelected(null);
    try {
      const url = withIdsQS(
        `${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`
      );
      const res = await fetch(url, { headers: withIdsHeaders() });
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseItems(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseItems([]);
    }
  }
  async function openBrowse() {
    if (maybeOpenForm({ type: "demos" })) return;
    await _openBrowse();
  }

  async function _openBrowseDocs() {
    if (!botId) return;
    setMode("docs");
    setSelected(null);
    try {
      const url = withIdsQS(
        `${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`
      );
      const res = await fetch(url, { headers: withIdsHeaders() });
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setBrowseDocs(
        src.map((it) => ({
          id: it.id ?? it.value ?? it.url ?? it.title,
          title: it.title ?? it.button_title ?? it.label ?? "",
          url: it.url ?? it.value ?? it.button_value ?? "",
          description: it.description ?? it.summary ?? it.functions_text ?? "",
        }))
      );
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setBrowseDocs([]);
    }
  }
  async function openBrowseDocs() {
    if (maybeOpenForm({ type: "docs" })) return;
    await _openBrowseDocs();
  }

  const embedDomain =
    typeof window !== "undefined" ? window.location.hostname : "";

  async function _openMeeting() {
    if (!botId) return;
    setMode("meeting");
    try {
      const res = await fetch(
        `${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`
      );
      const data = await res.json();
      const ag = data?.ok ? data.agent : null;
      setAgent(ag);
      if (
        ag &&
        ag.calendar_link_type &&
        String(ag.calendar_link_type).toLowerCase() === "external" &&
        ag.calendar_link
      ) {
        try {
          const base = ag.calendar_link || "";
          const withQS = `${base}${
            base.includes("?") ? "&" : "?"
          }session_id=${encodeURIComponent(
            sessionId || ""
          )}&visitor_id=${encodeURIComponent(
            visitorId || ""
          )}&bot_id=${encodeURIComponent(botId || "")}`;
          window.open(withQS, "_blank", "noopener,noreferrer");
        } catch {}
      }
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch {
      setAgent(null);
    }
  }
  async function openMeeting() {
    if (maybeOpenForm({ type: "meeting" })) return;
    await _openMeeting();
  }

  function _openPrice() {
    if (!botId) return;
    setMode("price");
    setSelected(null);
  }
  function openPrice() {
    if (maybeOpenForm({ type: "price" })) return;
    _openPrice();
  }

  useEffect(() => {
    if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;
    function onCalendlyMessage(e) {
      try {
        const m = e?.data;
        if (!m || typeof m !== "object") return;
        if (
          m.event !== "calendly.event_scheduled" &&
          m.event !== "calendly.event_canceled"
        )
          return;
        const p = m.payload || {};
        const payloadOut = {
          event: m.event,
          scheduled_event: p.event || p.scheduled_event || null,
          invitee: {
            uri: p.invitee?.uri ?? null,
            email: p.invitee?.email ?? null,
            name: p.invitee?.full_name ?? p.invitee?.name ?? null,
          },
          questions_and_answers:
            p.questions_and_answers ??
            p.invitee?.questions_and_answers ??
            [],
          tracking: p.tracking || {},
        };
        fetch(`${apiBase}/calendly/js-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bot_id: botId,
            session_id: sessionId,
            visitor_id: visitorId,
            payload: payloadOut,
          }),
        }).catch(() => {});
      } catch {}
    }
    window.addEventListener("message", onCalendlyMessage);
    return () => window.removeEventListener("message", onCalendlyMessage);
  }, [mode, botId, sessionId, visitorId, apiBase]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    if (mode !== "price" || !botId) return;
    let cancel = false;
    (async () => {
      try {
        setPriceErr("");
        setPriceEstimate(null);
        setPriceAnswers({});
        const res = await fetch(
          `${apiBase}/pricing/questions?bot_id=${encodeURIComponent(botId)}`
        );
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok)
          throw new Error(
            data?.error || "Failed to load pricing questions"
          );
        setPriceQuestions(
          Array.isArray(data.questions) ? data.questions : []
        );
        requestAnimationFrame(() =>
          contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
        );
        setPricingCopy((prev) => ({
          ...prev,
          intro: data.pricing_intro || prev.intro,
          outro: data.pricing_outro || prev.outro,
          custom_notice: data.pricing_custom_notice || prev.custom_notice,
        }));
      } catch {
        if (!cancel) setPriceErr("Unable to load price estimator.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, botId, apiBase]);

  const nextPriceQuestion = useMemo(() => {
    if (!priceQuestions.length) return null;
    for (const q of priceQuestions) {
      if ((q.group ?? "estimation") !== "estimation" || q.required === false)
        continue;
      const v = priceAnswers[q.q_key];
      const isMulti = String(q.type).toLowerCase().includes("multi");
      const empty = isMulti
        ? !(Array.isArray(v) && v.length > 0)
        : v === undefined || v === null || v === "";
      if (empty) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);

  useEffect(() => {
    if (mode !== "price" || !botId || nextPriceQuestion) {
      setPriceEstimate((prev) => (nextPriceQuestion ? null : prev));
      return;
    }
    let cancel = false;
    (async () => {
      try {
        setPriceBusy(true);
        setPriceErr("");
        const body = {
          bot_id: botId,
          answers: {
            product_id:
              priceAnswers?.product ||
              priceAnswers?.edition ||
              priceAnswers?.product_id ||
              "",
            tier_id:
              priceAnswers?.tier ||
              priceAnswers?.transactions ||
              priceAnswers?.tier_id ||
              "",
          },
          session_id: sessionId || undefined,
          visitor_id: visitorId || undefined,
        };
        const res = await fetch(`${apiBase}/pricing/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (cancel) return;
        if (!data?.ok) throw new Error();
        setPriceEstimate(data);
      } catch {
        if (!cancel) setPriceErr("Unable to compute estimate.");
      } finally {
        if (!cancel) setPriceBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [
    mode,
    botId,
    apiBase,
    priceQuestions,
    priceAnswers,
    nextPriceQuestion,
    sessionId,
    visitorId,
  ]);

  function handlePickPriceOption(q, opt) {
    const isMulti = String(q?.type || "").toLowerCase().includes("multi");
    setPriceAnswers((prev) => {
      if (isMulti) {
        const curr = Array.isArray(prev[q.q_key]) ? prev[q.q_key] : [];
        const exists = curr.includes(opt.key);
        const next = exists
          ? curr.filter((k) => k !== opt.key)
          : [...curr, opt.key];
        return { ...prev, [q.q_key]: next };
      }
      return { ...prev, [q.q_key]: opt.key };
    });
  }

  const mirrorLines = useMemo(() => {
    const labelFor = (q_key) => {
      const q = priceQuestions.find((qq) => qq.q_key === q_key);
      if (!q) return "";
      const ans = priceAnswers[q.q_key];
      if (
        ans == null ||
        ans === "" ||
        (Array.isArray(ans) && ans.length === 0)
      )
        return "";
      const opts = normalizeOptions(q);
      if (String(q.type).toLowerCase().includes("multi")) {
        const picked = Array.isArray(ans) ? ans : [];
        return opts
          .filter((o) => picked.includes(o.key))
          .map((o) => o.label)
          .join(", ");
      }
      const o = opts.find((o) => o.key === ans);
      return o?.label || String(ans);
    };

    if (typeof priceEstimate?.mirror_text === "string") {
      const t = priceEstimate.mirror_text.trim();
      if (t) return [t];
    }

    if (Array.isArray(priceEstimate?.mirror_text)) {
      const out = [];
      for (const m of priceEstimate.mirror_text) {
        const raw = String(m?.text || "").trim();
        if (!raw) continue;
        const lbl = labelFor(m?.q_key);
        const replaced = raw
          .replace(/\{\{\s*answer_label_lower\s*\}\}/gi, lbl.toLowerCase())
          .replace(/\{\{\s*answer_label\s*\}\}/gi, lbl);
        out.push(replaced);
      }
      return out.filter(Boolean);
    }

    if (!priceQuestions.length) return [];
    const lines = [];
    for (const q of priceQuestions) {
      const ans = priceAnswers[q.q_key];
      if (
        ans === undefined ||
        ans === null ||
        ans === "" ||
        (Array.isArray(ans) && ans.length === 0)
      )
        continue;
      const opts = normalizeOptions(q);
      let label = "";
      if (String(q.type).toLowerCase().includes("multi")) {
        const picked = Array.isArray(ans) ? ans : [];
        label = opts
          .filter((o) => picked.includes(o.key))
          .map((o) => o.label)
          .join(", ");
      } else {
        const o = opts.find((o) => o.key === ans);
        label = o?.label || String(ans);
      }
      if (!label) continue;
      const tmpl = q.mirror_template;
      if (tmpl && typeof tmpl === "string") {
        const replaced = tmpl
          .replace(/\{\{\s*answer_label_lower\s*\}\}/gi, label.toLowerCase())
          .replace(/\{\{\s*answer_label\s*\}\}/gi, label);
        lines.push(replaced);
      } else {
        lines.push(label);
      }
    }
    return lines;
  }, [priceEstimate, priceQuestions, priceAnswers]);

  /* Tabs */
  const tabs = useMemo(() => {
    const out = [];
    out.push({
      key: "personalize",
      label: "Personalize",
      onClick: openPersonalize,
    });
    if (tabsEnabled.demos)
      out.push({ key: "demos", label: "Browse Demos", onClick: openBrowse });
    if (tabsEnabled.docs)
      out.push({
        key: "docs",
        label: "Browse Documents",
        onClick: openBrowseDocs,
      });
    if (tabsEnabled.price)
      out.push({
        key: "price",
        label: "Price Estimate",
        onClick: openPrice,
      });
    if (tabsEnabled.meeting)
      out.push({
        key: "meeting",
        label: "Schedule Meeting",
        onClick: openMeeting,
      });
    return out;
  }, [tabsEnabled]);

  /* Live wording updates */
  function handleLiveMessages(updated) {
    if (!updated || typeof updated !== "object") return;
    if ("welcome_message" in updated) {
      setResponseText(updated.welcome_message || "");
    }
    setPricingCopy((prev) => ({
      intro:
        "pricing_intro" in updated ? updated.pricing_intro || "" : prev.intro,
      outro:
        "pricing_outro" in updated ? updated.pricing_outro || "" : prev.outro,
      custom_notice:
        "pricing_custom_notice" in updated
          ? updated.pricing_custom_notice || ""
          : prev.custom_notice,
    }));
  }

  /* Failure or missing bot conditions */
  if (fatal) {
    return (
      <div className="w-screen min-h-[100dvh] flex items-center justify-center bg-gray-100 p-4">
        <div className="text-red-600 font-semibold">{fatal}</div>
      </div>
    );
  }
  if (!botId) {
    return (
      <div
        className={classNames(
          "w-screen min-h-[100dvh] flex items-center justify-center bg-[var(--page-bg)] p-4 transition-opacity duration-200",
          brandReady ? "opacity-100" : "opacity-0"
        )}
        style={liveTheme}
      >
        <div className="text-gray-800 text-center space-y-2">
          <div className="text-lg font-semibold">No bot selected</div>
          {alias ? (
            <div className="text-sm text-gray-600">
              Resolving alias “{alias}”…
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the
              URL
              {defaultAlias ? (
                <> (trying default alias “{defaultAlias}”)</>
              ) : null}
              .
            </div>
          )}
        </div>
      </div>
    );
  }

  const logoSrc =
    brandAssets.logo_url ||
    brandAssets.logo_light_url ||
    brandAssets.logo_dark_url ||
    fallbackLogo;

  const listSource = mode === "browse" ? browseItems : items;
  const visibleUnderVideo = selected
    ? mode === "ask"
      ? items
      : []
    : listSource;

  const showAskBottom = mode !== "formfill";

  function handleThemeLabFormfillChange({ show_formfill, standard_fields }) {
    setShowFormfill(!!show_formfill);
    if (Array.isArray(standard_fields)) {
      setFormFields((prev) => {
        const byKey = {};
        prev.forEach((f) => {
          if (f?.field_key) byKey[f.field_key] = { ...f };
        });
        standard_fields.forEach((sf) => {
          if (sf.field_key && byKey[sf.field_key]) {
            byKey[sf.field_key] = {
              ...byKey[sf.field_key],
              is_collected: sf.is_collected,
              is_required: sf.is_required,
            };
          }
        });
        return Object.values(byKey);
      });
    }
  }

  return (
    <div
      className={classNames(
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
        brandReady ? "opacity-100" : "opacity-0"
      )}
      style={liveTheme}
    >
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all">
        {/* Header */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img
                src={logoSrc}
                alt="Brand logo"
                className="h-10 object-contain"
              />
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
              {selected
                ? selected.title
                : mode === "personalize" || mode === "formfill"
                ? "Personalize"
                : mode === "browse"
                ? "Browse Demos"
                : mode === "docs"
                ? "Browse Documents"
                : mode === "meeting"
                ? "Schedule Meeting"
                : mode === "price"
                ? "Price Estimate"
                : "Ask the Assistant"}
            </div>
          </div>
          <TabsNav
            mode={mode === "formfill" ? "personalize" : mode}
            tabs={tabs}
          />
        </div>

        {/* Body */}
        <div
          ref={contentRef}
          className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
        >
          {(mode === "formfill" || mode === "personalize") ? (
            <div className="space-y-4">
              <div className="text-base font-semibold">
                Update your information below (adjust Perspective or any other
                details).
              </div>
              <FormFillCard
                fields={activeFormFields}
                defaults={formDefaults}
                onSubmit={async (vals) => {
                  if (!visitorId) return;
                  if (typeof vals.perspective === "string")
                    vals.perspective = vals.perspective.toLowerCase();
                  updateLocalVisitorValues(vals);
                  let postOk = false;
                  try {
                    const resp = await fetch(`${apiBase}/visitor-formfill`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        visitor_id: visitorId,
                        values: vals,
                        bot_id: botId || undefined,
                      }),
                    });
                    postOk = resp.ok;
                  } catch {}
                  try {
                    sessionStorage.setItem(FORM_KEY, "1");
                  } catch {}
                  setFormCompleted(true);
                  const p = pending;
                  setPending(null);
                  if (p?.type === "ask" && p.payload?.text) {
                    await doSend(p.payload.text);
                  } else if (p?.type === "demos") {
                    await _openBrowse();
                  } else if (p?.type === "docs") {
                    await _openBrowseDocs();
                  } else if (p?.type === "meeting") {
                    await _openMeeting();
                  } else if (p?.type === "price") {
                    _openPrice();
                  } else {
                    setMode("ask");
                  }
                  if (!postOk) refetchVisitorValues();
                }}
              />
            </div>
          ) : mode === "price" ? (
            <div className="flex-1 flex flex-col">
              <div className="pt-0 pb-0">
                <PriceMirror lines={mirrorLines.length ? mirrorLines : [""]} />
                {!mirrorLines.length && (
                  <div className="text-base font-bold whitespace-pre-line">
                    {pricingCopy.intro ||
                      "This tool provides a quick estimate based on your selections. Final pricing may vary."}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-4">
                {!priceQuestions.length ? (
                  <div className="text-sm text-[var(--helper-fg)]">
                    Loading questions…
                  </div>
                ) : nextPriceQuestion ? (
                  <QuestionBlock
                    q={nextPriceQuestion}
                    value={priceAnswers[nextPriceQuestion.q_key]}
                    onPick={handlePickPriceOption}
                  />
                ) : priceEstimate && priceEstimate.custom ? (
                  <div className="text-base font-bold whitespace-pre-line">
                    {pricingCopy.custom_notice ||
                      "We’ll follow up with a custom quote tailored to your selection."}
                  </div>
                ) : (
                  <EstimateCard
                    estimate={priceEstimate}
                    outroText={pricingCopy.outro || ""}
                  />
                )}
                {!nextPriceQuestion && priceBusy && (
                  <div className="text-sm text-[var(--helper-fg)]">
                    Calculating…
                  </div>
                )}
                {priceErr && (
                  <div className="text-sm text-red-600">{priceErr}</div>
                )}
              </div>
            </div>
          ) : mode === "meeting" ? (
            <div className="w-full flex-1 flex flex-col">
              {agent?.schedule_header ? (
                <div className="text-sm italic text-[var(--helper-fg)] mb-3 whitespace-pre-line">
                  {agent.schedule_header}
                </div>
              ) : null}
              {!agent ? (
                <div className="text-sm text-[var(--helper-fg)]">
                  Loading scheduling…
                </div>
              ) : agent.calendar_link_type &&
                String(agent.calendar_link_type).toLowerCase() === "embed" &&
                agent.calendar_link ? (
                <iframe
                  title="Schedule a Meeting"
                  src={`${agent.calendar_link}${
                    agent.calendar_link.includes("?") ? "&" : "?"
                  }embed_domain=${embedDomain}&embed_type=Inline&session_id=${encodeURIComponent(
                    sessionId || ""
                  )}&visitor_id=${encodeURIComponent(
                    visitorId || ""
                  )}&bot_id=${encodeURIComponent(botId || "")}`}
                  style={{
                    width: "100%",
                    height: "60vh",
                    maxHeight: "640px",
                    background: "var(--card-bg)",
                  }}
                  className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                />
              ) : agent.calendar_link_type &&
                String(agent.calendar_link_type).toLowerCase() ===
                  "external" &&
                agent.calendar_link ? (
                <div className="text-sm text-gray-700">
                  We opened the scheduling page in a new tab. If it didn’t
                  open,&nbsp;
                  <a
                    href={agent.calendar_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    click here to open it
                  </a>
                  .
                </div>
              ) : (
                <div className="text-sm text-[var(--helper-fg)]">
                  No scheduling link is configured.
                </div>
              )}
            </div>
          ) : selected ? (
            <div className="w-full flex-1 flex flex-col">
              {mode === "docs" ? (
                <DocIframe doc={selected} />
              ) : (
                <div className="bg-[var(--card-bg)] pt-2 pb-2">
                  <iframe
                    style={{ width: "100%", aspectRatio: "471 / 272" }}
                    src={selected.url}
                    title={selected.title}
                    className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              {mode === "ask" && (visibleUnderVideo || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-1 mb-3">
                    <p className="italic text-[var(--helper-fg)]">
                      Recommended demos
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {visibleUnderVideo.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => normalizeAndSelectDemo(val)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : mode === "browse" ? (
            <div className="w-full flex-1 flex flex-col">
              {(browseItems || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-3">
                    <p className="italic text-[var(--helper-fg)]">
                      Select a demo to view it
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {browseItems.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => normalizeAndSelectDemo(val)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : mode === "docs" ? (
            <div className="w-full flex-1 flex flex-col">
              {(browseDocs || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-2 mb-3">
                    <p className="italic text-[var(--helper-fg)]">
                      Select a document to view it
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {browseDocs.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        kind="doc"
                        onPick={async (val) => {
                          try {
                            const r = await fetch(
                              `${apiBase}/render-doc-iframe`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(
                                  withIdsBody({
                                    bot_id: botId,
                                    doc_id: val.id || "",
                                    title: val.title || "",
                                    url: val.url || "",
                                  })
                                ),
                              }
                            );
                            const j = await r.json();
                            setSelected({
                              ...val,
                              _iframe_html: j?.iframe_html || null,
                            });
                          } catch {
                            setSelected(val);
                          }
                          requestAnimationFrame(() =>
                            contentRef.current?.scrollTo({
                              top: 0,
                              behavior: "auto",
                            })
                          );
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              {!lastQuestion && !loading && (
                <div className="space-y-3">
                  <div className="text-base font-bold whitespace-pre-line">
                    {responseText}
                  </div>
                  {showIntroVideo && introVideoUrl ? (
                    <div style={{ position: "relative", paddingTop: "56.25%" }}>
                      <iframe
                        src={introVideoUrl}
                        title="Intro Video"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                        }}
                        className="rounded-[0.75rem] [box-shadow:var(--shadow-elevation)]"
                      />
                    </div>
                  ) : null}
                </div>
              )}
              {lastQuestion ? (
                <p className="text-base italic text-center mb-2 text-[var(--helper-fg)]">
                  "{lastQuestion}"
                </p>
              ) : null}
              <div className="text-left mt-2">
                {loading ? (
                  <p className="font-semibold animate-pulse text-[var(--helper-fg)]">
                    Thinking…
                  </p>
                ) : lastQuestion ? (
                  <p className="text-base font-bold whitespace-pre-line">
                    {responseText}
                  </p>
                ) : null}
              </div>
              {(items || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-[var(--helper-fg)]">
                      Recommended demos
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => normalizeAndSelectDemo(val)}
                      />
                    ))}
                  </div>
                </>
              )}
              {lastError && (
                <details className="mt-4 text-[11px] p-2 border border-red-300 rounded bg-red-50">
                  <summary className="cursor-pointer text-red-700 font-semibold">
                    Technical details
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-all">
{JSON.stringify(lastError, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {showAskBottom && (
          <AskInputBar
            value={input}
            onChange={setInput}
            onSend={onSendClick}
            inputRef={inputRef}
            placeholder="Ask your question here"
          />
        )}
      </div>

      {themeLabOn && botId ? (
        <ThemeLabPanels
          apiBase={apiBase}
          botId={botId}
          frameRef={contentRef}
          onVars={(varsUpdate) => {
            if (typeof varsUpdate === "function") {
              setPickerVars((prev) => {
                const produced = varsUpdate(prev) || {};
                return { ...prev, ...produced };
              });
            } else {
              setPickerVars((prev) => ({ ...prev, ...(varsUpdate || {}) }));
            }
          }}
          onFormfillChange={handleThemeLabFormfillChange}
          onLiveMessages={handleLiveMessages}
        />
      ) : null}
    </div>
  );
}
