// src/tools/ThemeLab.jsx
// Standalone Theme editor. Open via: /?themelab=1&alias=... (or &bot_id=...)
// Sends preview messages to the app when the iframe URL includes ?preview=1.

import React, { useEffect, useMemo, useRef, useState } from "react";

const snakeToKebab = (s) => String(s || "").trim().replace(/_/g, "-");
const tokenKeyToCssVar = (k) => `--${snakeToKebab(k)}`;

export default function ThemeLab({ apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com" }) {
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || "").trim();
  const botIdFromUrl = (qs.get("bot_id") || "").trim();

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);        // [{ token_key, value, input_type, label, screen_key, client_controlled, group_key, description }]
  const [draft, setDraft] = useState({});          // { token_key: newValue }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);

  // Resolve bot id by alias if needed
  useEffect(() => {
    if (botId || !alias) return;
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (!stop && data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch (_) {}
    })();
    return () => { stop = true; };
  }, [alias, botId, apiBase]);

  // Load editable tokens (and push current values into preview on load)
  useEffect(() => {
    if (!botId) return;
    let stop = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        // Prefer a dedicated tokens endpoint if available; fall back to /brand with tokens/items/rows
        const tryUrls = [
          `${apiBase}/brand/tokens?bot_id=${encodeURIComponent(botId)}`,
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        ];
        let rows = [];
        for (const url of tryUrls) {
          try {
            const res = await fetch(url);
            const data = await res.json();
            // Normalize: look for arrays under common keys
            const items = data?.items || data?.tokens || data?.rows || [];
            if (Array.isArray(items) && items.length) {
              rows = items;
              break;
            }
          } catch {}
        }
        if (stop) return;

        // Filter to client-controlled if present; otherwise include all
        const filtered = rows.filter((r) => r.client_controlled !== false);
        setTokens(filtered);
        setDraft({});

        // Push current server values into preview so it starts synced
        const vars = {};
        for (const t of filtered) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
        try {
          iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
        } catch {}
      } catch (e) {
        if (!stop) setError("Unable to load tokens.");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [botId, apiBase]);

  const grouped = useMemo(() => {
    const g = new Map();
    for (const t of tokens) {
      const grp = t.group_key || t.group_label || t.screen_key || "General";
      if (!g.has(grp)) g.set(grp, []);
      g.get(grp).push(t);
    }
    return Array.from(g.entries());
  }, [tokens]);

  // Post a preview CSS var delta + optional screen jump
  function pushPreview(token_key, value, screen_key) {
    const cssVar = tokenKeyToCssVar(token_key);
    const msg = { type: "preview:theme", payload: { vars: { [cssVar]: value } } };
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
      if (screen_key) {
        iframeRef.current?.contentWindow?.postMessage({ type: "preview:go", payload: { screen: screen_key } }, window.location.origin);
      }
    } catch {}
  }

  function onChangeToken(t, value) {
    setDraft((prev) => ({ ...prev, [t.token_key || t.key]: value }));
    pushPreview(t.token_key || t.key, value, t.screen_key || t.screen || null);
  }

  async function onSave() {
    if (!botId || !Object.keys(draft).length) return;
    setSaving(true);
    setError("");
    try {
      const body = { bot_id: botId, tokens: draft, commit_key: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) };
      const res = await fetch(`${apiBase}/brand/update-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Save failed");
      setDraft({});
      // Ask the app to re-read brand vars
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: "preview:reload" }, window.location.origin);
      } catch {}
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onDiscard() {
    setDraft({});
    // Re-apply server values from current token list
    const vars = {};
    for (const t of tokens) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
    } catch {}
  }

  const previewSrc = useMemo(() => {
    // Always same-origin; add ?preview=1 so the app turns on the bridge
    const base = `${window.location.origin}/`;
    const q = new URLSearchParams();
    if (alias) q.set("alias", alias);
    if (botId) q.set("bot_id", botId);
    q.set("preview", "1");
    return `${base}?${q.toString()}`;
  }, [alias, botId]);

  return (
    <div className="w-screen h-[100dvh] grid grid-cols-1 md:grid-cols-[300px_1fr]">
      {/* Left control box */}
      <div className="border-r border-gray-200 p-4 overflow-y-auto bg-white text-black">
        <div className="text-sm font-semibold mb-2">Theme Editor</div>
        <div className="text-xs text-black mb-4">
          {botId ? <>bot_id <code>{botId}</code></> : alias ? <>alias <code>{alias}</code> (resolving…)</> : "Provide alias or bot_id in the URL."}
        </div>

        {loading ? <div className="text-xs text-black mb-4">Loading tokens…</div> : null}
        {error ? <div className="text-xs text-red-600 mb-4">{error}</div> : null}

        {grouped.map(([grp, rows]) => (
          <div key={grp} className="mb-6">
            <div className="text-[0.8rem] font-bold mb-2">{grp}</div>
            <div className="space-y-2">
              {rows.map((t) => {
                const key = t.token_key || t.key;
                const type = (t.input_type || t.token_type || "color").toLowerCase();
                const val = draft[key] ?? t.value ?? "";
                const label = t.label || key;
                const screenKey = t.screen_key || t.screen || null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                    onClick={() => {
                      if (screenKey) {
                        try {
                          iframeRef.current?.contentWindow?.postMessage(
                            { type: "preview:go", payload: { screen: screenKey } },
                            window.location.origin
                          );
                        } catch {}
                      }
                    }}
                  >
                    <div className="text-[0.8rem]">
                      <div className="font-medium">{label}</div>
                      {t.description ? <div className="text-[0.7rem] text-black/70">{t.description}</div> : null}
                    </div>
                    {type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={String(val) === "1" || String(val).toLowerCase() === "true"}
                        onChange={(e) => onChangeToken(t, e.target.checked ? "1" : "0")}
                      />
                    ) : type === "length" || type === "number" ? (
                      <input
                        type="text"
                        className="w-28 border rounded px-2 py-1 text-sm text-black"
                        value={val}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        placeholder={type === "length" ? "e.g. 0.75rem" : "number"}
                      />
                    ) : (
                      <input
                        type="color"
                        className="w-12 h-8 border rounded cursor-pointer"
                        value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) ? val : "#ffffff"}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        title={val}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer actions */}
        <div className="sticky bottom-0 pt-3 bg-white border-t border-gray-200 mt-6">
          <button
            className="w-full mb-2 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm text-black"
            onClick={onDiscard}
            disabled={saving || !Object.keys(draft).length}
            title="Discard unsaved changes"
          >
            Discard
          </button>
          <button
            className="w-full py-2 rounded bg-black text-white hover:opacity-90 text-sm disabled:opacity-50"
            onClick={onSave}
            disabled={saving || !Object.keys(draft).length}
            title="Save changes"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Right live preview */}
      <div className="bg-gray-50">
        <iframe
          ref={iframeRef}
          title="Preview"
          src={previewSrc}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
// src/tools/ThemeLab.jsx
// Standalone Theme editor. Open via: /?themelab=1&alias=... (or &bot_id=...)
// Sends preview messages to the app when the iframe URL includes ?preview=1.

import React, { useEffect, useMemo, useRef, useState } from "react";

const snakeToKebab = (s) => String(s || "").trim().replace(/_/g, "-");
const tokenKeyToCssVar = (k) => `--${snakeToKebab(k)}`;

export default function ThemeLab({ apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com" }) {
  const qs = new URLSearchParams(window.location.search);
  const alias = (qs.get("alias") || "").trim();
  const botIdFromUrl = (qs.get("bot_id") || "").trim();

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);        // [{ token_key, value, input_type, label, screen_key, client_controlled, group_key, description }]
  const [draft, setDraft] = useState({});          // { token_key: newValue }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);

  // Resolve bot id by alias if needed
  useEffect(() => {
    if (botId || !alias) return;
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
        const data = await res.json();
        if (!stop && data?.ok && data?.bot?.id) setBotId(data.bot.id);
      } catch (_) {}
    })();
    return () => { stop = true; };
  }, [alias, botId, apiBase]);

  // Load editable tokens (and push current values into preview on load)
  useEffect(() => {
    if (!botId) return;
    let stop = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        // Prefer a dedicated tokens endpoint if available; fall back to /brand with tokens/items/rows
        const tryUrls = [
          `${apiBase}/brand/tokens?bot_id=${encodeURIComponent(botId)}`,
          `${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`
        ];
        let rows = [];
        for (const url of tryUrls) {
          try {
            const res = await fetch(url);
            const data = await res.json();
            // Normalize: look for arrays under common keys
            const items = data?.items || data?.tokens || data?.rows || [];
            if (Array.isArray(items) && items.length) {
              rows = items;
              break;
            }
          } catch {}
        }
        if (stop) return;

        // Filter to client-controlled if present; otherwise include all
        const filtered = rows.filter((r) => r.client_controlled !== false);
        setTokens(filtered);
        setDraft({});

        // Push current server values into preview so it starts synced
        const vars = {};
        for (const t of filtered) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
        try {
          iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
        } catch {}
      } catch (e) {
        if (!stop) setError("Unable to load tokens.");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [botId, apiBase]);

  const grouped = useMemo(() => {
    const g = new Map();
    for (const t of tokens) {
      const grp = t.group_key || t.group_label || t.screen_key || "General";
      if (!g.has(grp)) g.set(grp, []);
      g.get(grp).push(t);
    }
    return Array.from(g.entries());
  }, [tokens]);

  // Post a preview CSS var delta + optional screen jump
  function pushPreview(token_key, value, screen_key) {
    const cssVar = tokenKeyToCssVar(token_key);
    const msg = { type: "preview:theme", payload: { vars: { [cssVar]: value } } };
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
      if (screen_key) {
        iframeRef.current?.contentWindow?.postMessage({ type: "preview:go", payload: { screen: screen_key } }, window.location.origin);
      }
    } catch {}
  }

  function onChangeToken(t, value) {
    setDraft((prev) => ({ ...prev, [t.token_key || t.key]: value }));
    pushPreview(t.token_key || t.key, value, t.screen_key || t.screen || null);
  }

  async function onSave() {
    if (!botId || !Object.keys(draft).length) return;
    setSaving(true);
    setError("");
    try {
      const body = { bot_id: botId, tokens: draft, commit_key: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) };
      const res = await fetch(`${apiBase}/brand/update-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Save failed");
      setDraft({});
      // Ask the app to re-read brand vars
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: "preview:reload" }, window.location.origin);
      } catch {}
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onDiscard() {
    setDraft({});
    // Re-apply server values from current token list
    const vars = {};
    for (const t of tokens) vars[tokenKeyToCssVar(t.token_key || t.key)] = t.value;
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: "preview:theme", payload: { vars } }, window.location.origin);
    } catch {}
  }

  const previewSrc = useMemo(() => {
    // Always same-origin; add ?preview=1 so the app turns on the bridge
    const base = `${window.location.origin}/`;
    const q = new URLSearchParams();
    if (alias) q.set("alias", alias);
    if (botId) q.set("bot_id", botId);
    q.set("preview", "1");
    return `${base}?${q.toString()}`;
  }, [alias, botId]);

  return (
    <div className="w-screen h-[100dvh] grid grid-cols-1 md:grid-cols-[300px_1fr]">
      {/* Left control box */}
      <div className="border-r border-gray-200 p-4 overflow-y-auto bg-white text-black">
        <div className="text-sm font-semibold mb-2">Theme Editor</div>
        <div className="text-xs text-black mb-4">
          {botId ? <>bot_id <code>{botId}</code></> : alias ? <>alias <code>{alias}</code> (resolving…)</> : "Provide alias or bot_id in the URL."}
        </div>

        {loading ? <div className="text-xs text-black mb-4">Loading tokens…</div> : null}
        {error ? <div className="text-xs text-red-600 mb-4">{error}</div> : null}

        {grouped.map(([grp, rows]) => (
          <div key={grp} className="mb-6">
            <div className="text-[0.8rem] font-bold mb-2">{grp}</div>
            <div className="space-y-2">
              {rows.map((t) => {
                const key = t.token_key || t.key;
                const type = (t.input_type || t.token_type || "color").toLowerCase();
                const val = draft[key] ?? t.value ?? "";
                const label = t.label || key;
                const screenKey = t.screen_key || t.screen || null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                    onClick={() => {
                      if (screenKey) {
                        try {
                          iframeRef.current?.contentWindow?.postMessage(
                            { type: "preview:go", payload: { screen: screenKey } },
                            window.location.origin
                          );
                        } catch {}
                      }
                    }}
                  >
                    <div className="text-[0.8rem]">
                      <div className="font-medium">{label}</div>
                      {t.description ? <div className="text-[0.7rem] text-black/70">{t.description}</div> : null}
                    </div>
                    {type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={String(val) === "1" || String(val).toLowerCase() === "true"}
                        onChange={(e) => onChangeToken(t, e.target.checked ? "1" : "0")}
                      />
                    ) : type === "length" || type === "number" ? (
                      <input
                        type="text"
                        className="w-28 border rounded px-2 py-1 text-sm text-black"
                        value={val}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        placeholder={type === "length" ? "e.g. 0.75rem" : "number"}
                      />
                    ) : (
                      <input
                        type="color"
                        className="w-12 h-8 border rounded cursor-pointer"
                        value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) ? val : "#ffffff"}
                        onChange={(e) => onChangeToken(t, e.target.value)}
                        title={val}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer actions */}
        <div className="sticky bottom-0 pt-3 bg-white border-t border-gray-200 mt-6">
          <button
            className="w-full mb-2 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm text-black"
            onClick={onDiscard}
            disabled={saving || !Object.keys(draft).length}
            title="Discard unsaved changes"
          >
            Discard
          </button>
          <button
            className="w-full py-2 rounded bg-black text-white hover:opacity-90 text-sm disabled:opacity-50"
            onClick={onSave}
            disabled={saving || !Object.keys(draft).length}
            title="Save changes"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Right live preview */}
      <div className="bg-gray-50">
        <iframe
          ref={iframeRef}
          title="Preview"
          src={previewSrc}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
