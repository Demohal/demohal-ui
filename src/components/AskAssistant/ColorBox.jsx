import React, { useEffect, useMemo, useState } from "react";
import { TOKEN_TO_CSS, SCREEN_ORDER } from "../AskAssistant.ui";

export default function ColorBox({ apiBase, botId, frameRef, onVars }) {
  const [rows, setRows] = useState([]);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [authState, setAuthState] = useState("checking");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [pos, setPos] = useState({ left: 16, top: 16, width: 460 });
  useEffect(() => {
    function updatePos() {
      const rect = frameRef.current?.getBoundingClientRect();
      const width = 460, gap = 12;
      if (!rect) return setPos({ left: 16, top: 16, width });
      setPos({ left: Math.max(8, rect.left - width - gap), top: Math.max(8, rect.top + 8), width });
    }
    updatePos();
    const h = () => updatePos();
    window.addEventListener("resize", h);
    window.addEventListener("scroll", h, { passive: true });
    return () => {
      window.removeEventListener("resize", h);
      window.removeEventListener("scroll", h);
    };
  }, [frameRef]);

  async function checkStatusAndMaybeLoad() {
    try {
      setAuthError(""); setAuthState("checking");
      const res = await fetch(`${apiBase}/themelab/status?bot_id=${encodeURIComponent(botId)}`);
      if (res.status === 200) { setAuthState("ok"); await load(); }
      else if (res.status === 401) setAuthState("need_password");
      else if (res.status === 403) setAuthState("disabled");
      else setAuthState("error");
    } catch { setAuthState("error"); }
  }
  useEffect(() => { checkStatusAndMaybeLoad(); /* eslint-disable-next-line */ }, [apiBase, botId]);

  async function load() {
    const res = await fetch(`${apiBase}/brand/client-tokens?bot_id=${encodeURIComponent(botId)}`, { credentials: "include" });
    const data = await res.json();
    const toks = (data?.ok ? data.tokens : []) || [];
    setRows(toks);
    const v = {}; toks.forEach(t => { v[t.token_key] = t.value || "#000000"; }); setValues(v);
    const css = {}; toks.forEach(t => { const cssVar = TOKEN_TO_CSS[t.token_key]; if (cssVar) css[cssVar] = v[t.token_key]; }); onVars(css);
  }
  function updateToken(tk, value) {
    const v = value || "";
    setValues(prev => ({ ...prev, [tk]: v }));
    const cssVar = TOKEN_TO_CSS[tk];
    if (cssVar) onVars(prev => ({ ...prev, [cssVar]: v }));
  }
  async function doSave() {
    try {
      setBusy(true);
      const updates = Object.entries(values).map(([token_key, value]) => ({ token_key, value }));
      const res = await fetch(`${apiBase}/brand/client-tokens/save`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ bot_id: botId, updates }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error();
      setMsg(`Saved ${data.updated} token(s).`); setTimeout(() => setMsg(""), 1800);
    } catch { setMsg("Save failed."); setTimeout(() => setMsg(""), 2000); }
    finally { setBusy(false); }
  }
  async function doReset() { await load(); setMsg("Colors restored from database."); setTimeout(() => setMsg(""), 1800); }
  async function doLogin(e) {
    e?.preventDefault();
    try {
      setAuthError("");
      const res = await fetch(`${apiBase}/themelab/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ bot_id: botId, password }),
      });
      const data = await res.json();
      if (res.status === 200 && data?.ok) { setAuthState("ok"); setPassword(""); await load(); }
      else if (res.status === 403) setAuthState("disabled");
      else setAuthError("Invalid password.");
    } catch { setAuthError("Login failed."); }
  }

  const groups = useMemo(() => {
    const by = new Map();
    for (const r of rows) { const key = r.screen_key || "welcome"; if (!by.has(key)) by.set(key, []); by.get(key).push(r); }
    SCREEN_ORDER.forEach(({ key }) => { if (by.has(key)) by.get(key).sort((a,b)=>String(a.label||"").localeCompare(String(b.label||""))); });
    return by;
  }, [rows]);

  return (
    <div style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, background: "#fff", border: "1px solid rgba(0,0,0,0.2)", borderRadius: "0.75rem", padding: 12, zIndex: 50 }}>
      <div className="text-2xl font-extrabold mb-2">Colors</div>
      {authState === "checking" && <div className="text-sm text-gray-600">Checking access…</div>}
      {authState === "disabled" && <div className="text-sm text-gray-600">ThemeLab is disabled for this bot.</div>}
      {authState === "need_password" && (
        <form onSubmit={doLogin} className="flex items-center gap-2">
          <input type="password" placeholder="Enter ThemeLab password" className="flex-1 rounded-[0.75rem] border border-black/20 px-3 py-2" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button type="submit" className="px-3 py-2 rounded-[0.75rem] bg-black text-white hover:brightness-110">Unlock</button>
          {authError ? <div className="text-xs text-red-600 ml-2">{authError}</div> : null}
        </form>
      )}
      {authState === "ok" && (
        <>
          {SCREEN_ORDER.map(({ key, label }) => (
            <div key={key} className="mb-2">
              <div className="text-sm font-bold mb-1">{label}</div>
              <div className="space-y-1 pl-1">
                {(groups.get(key) || []).map((t) => (
                  <div key={t.token_key} className="flex items-center justify-between gap-3">
                    <div className="text-xs">{t.label}</div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={values[t.token_key] || "#000000"} onChange={(e)=>updateToken(t.token_key, e.target.value)} style={{ width: 32, height: 24, borderRadius: 6, border: "1px solid rgba(0,0,0,0.2)" }} title={t.token_key}/>
                      <code className="text-[11px] opacity-70">{values[t.token_key] || ""}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">{msg}</div>
            <div className="flex items-center gap-2">
              <button onClick={doReset} disabled={busy} className="px-3 py-1 rounded-[0.75rem] border border-black/20 bg-white hover:brightness-105">Reset</button>
              <button onClick={doSave} disabled={busy} className="px-3 py-1 rounded-[0.75rem] bg-black text-white hover:brightness-110">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </>
      )}
      {authState === "error" && <div className="text-sm text-red-600">Unable to verify access.</div>}
    </div>
  );
}
