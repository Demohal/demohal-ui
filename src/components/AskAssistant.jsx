// [DH-SECTION-BEGIN] BRAND_CONSTANTS
/* =============================== *
 *  PATCH-READY CONSTANTS & UTILS  *
 * =============================== */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";

/** Default CSS variable values (used until /brand loads). */
const DEFAULT_THEME_VARS = {
    // Page + card
    "--banner-bg": "#000000",
    "--banner-fg": "#FFFFFF",
    "--page-bg": "#F3F4F6",
    "--card-bg": "#FFFFFF",
    "--card-border": "#E5E7EB",
    "--radius-card": "1rem",
    "--shadow-card": "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",

    // Primary (demo) buttons
    "--btn-grad-from": "#485563",
    "--btn-grad-to": "#374151",
    "--btn-grad-from-hover": "#6B7280", // legacy, hover colors disabled
    "--btn-grad-to-hover": "#4B5563",   // legacy, hover colors disabled
    "--btn-fg": "#FFFFFF",
    "--btn-border": "#374151",

    // Tabs
    "--tab-active-bg": "#FFFFFF",
    "--tab-active-fg": "#000000",
    "--tab-active-border": "#FFFFFF",
    "--tab-active-shadow": "0 2px 0 rgba(0,0,0,.15)",
    "--tab-inactive-grad-from": "#4B5563",
    "--tab-inactive-grad-to": "#374151",
    "--tab-inactive-hover-from": "#6B7280",
    "--tab-inactive-hover-to": "#4B5563",
    "--tab-inactive-fg": "#FFFFFF",
    "--tab-inactive-border": "#374151",

    // Fields
    "--field-bg": "#FFFFFF",
    "--field-border": "#9CA3AF",
    "--radius-field": "0.5rem",

    // Send icon
    "--send-color": "#EA4335",
    "--send-color-hover": "#C03327", // legacy, not used

    // Docs buttons
    "--btn-docs-grad-from": "#b1b3b4",
    "--btn-docs-grad-to": "#858789",
    "--btn-docs-grad-from-hover": "#c2c4c5", // legacy
    "--btn-docs-grad-to-hover": "#9a9c9e",   // legacy
};

const UI = {
    CARD: "border rounded-xl p-4 bg-white shadow",
    // Hover is an effect (translate), not a color change
    BTN:
        "w-full text-center rounded-xl px-4 py-3 shadow " +
        "text-[var(--btn-fg)] border border-[var(--btn-border)] " +
        "bg-gradient-to-b from-[var(--btn-grad-from)] to-[var(--btn-grad-to)] " +
        "transition-transform hover:translate-y-[1px] active:scale-95",
    BTN_DOCS:
        "w-full text-center rounded-xl px-4 py-3 shadow " +
        "text-[var(--btn-fg)] border border-[var(--btn-border)] " +
        "bg-gradient-to-b from-[var(--btn-docs-grad-from)] to-[var(--btn-docs-grad-to)] " +
        "transition-transform hover:translate-y-[1px] active:scale-95",
    FIELD:
        "w-full rounded-lg px-4 py-3 text-base " +
        "bg-[var(--field-bg)] border border-[var(--field-border)]",
    TAB_ACTIVE:
        "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 " +
        "bg-[var(--tab-active-bg)] text-[var(--tab-active-fg)] border-[var(--tab-active-border)] -mb-px " +
        "shadow-[var(--tab-active-shadow)]",
    TAB_INACTIVE:
        "px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-none transition-colors rounded-t-md border border-b-0 " +
        "text-[var(--tab-inactive-fg)] border-[var(--tab-inactive-border)] " +
        "bg-gradient-to-b from-[var(--tab-inactive-grad-from)] to-[var(--tab-inactive-grad-to)] " +
        "hover:from-[var(--tab-inactive-hover-from)] hover:to-[var(--tab-inactive-hover-to)] " +
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_rgba(0,0,0,0.12)]",
};

const CFG = {
    qKeys: {
        product: ["edition", "editions", "product", "products", "industry_edition", "industry"],
        tier: ["transactions", "transaction_volume", "volume", "tier", "tiers"],
    },
};

const normKey = (s) => (s || "").toLowerCase().replace(/[\s-]+/g, "_");
const classNames = (...xs) => xs.filter(Boolean).join(" ");

function renderMirror(template, label) {
    if (!template) return null;
    return template
        .split("{{answer_label_lower}}")
        .join(label.toLowerCase())
        .split("{{answer_label}}")
        .join(label);
}
// [DH-SECTION-END] BRAND_CONSTANTS
// [DH-SECTION-BEGIN] BRAND_STATE_AND_EFFECTS

// Theme variables (DB-driven CSS variables merged into defaults)
const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);

// Brand assets (logo, etc.)
const [brandAssets, setBrandAssets] = useState({
    logo_url: null,
});

// Branding mode toggle + working draft (edited via rails)
const [brandingMode, setBrandingMode] = useState(false);
const [brandDraft, setBrandDraft] = useState({ css_vars: {} });

// Update a single CSS var in both the draft and the live theme
function updateCssVar(key, value) {
    setBrandDraft((prev) => ({ css_vars: { ...(prev.css_vars || {}), [key]: value } }));
    setThemeVars((prev) => ({ ...prev, [key]: value }));
}

// One-time brand fetch (safe if botId/apiBase are not defined in this file)
useEffect(() => {
    let active = true;
    (async () => {
        try {
            if (typeof botId === "undefined" || !botId) return;
            const base = (typeof apiBase !== "undefined" && apiBase) || "";
            const res = await fetch(`${base}/brand?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            if (!active) return;
            if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
                setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
            }
            if (data?.ok && data?.assets) {
                setBrandAssets({ logo_url: data.assets.logo_url || null });
            }
        } catch {/* keep defaults on failure */ }
    })();
    return () => { active = false; };
}, []);

// [DH-SECTION-END] BRAND_STATE_AND_EFFECTS
// [DH-SECTION-BEGIN] THEME_SCOPE_WRAPPER
function ThemeScope({ vars, children }) {
    const cssVars = useMemo(() => {
        const out = {};
        const v = vars || {};
        for (const k in v) {
            if (Object.prototype.hasOwnProperty.call(v, k) && k.startsWith("--")) {
                out[k] = v[k];
            }
        }
        return out;
    }, [vars]);

    return <div style={cssVars}>{children}</div>;
}
// [DH-SECTION-END] THEME_SCOPE_WRAPPER
// [DH-SECTION-BEGIN] HEADER_BANNER
<div
    className="w-full"
    style={{ background: "var(--banner-bg)", color: "var(--banner-fg)" }}
    data-section="HEADER_BANNER"
>
    <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            {brandAssets?.logo_url ? (
                <img
                    src={brandAssets.logo_url}
                    alt="Logo"
                    className="h-8 w-auto rounded-sm border border-white/20"
                />
            ) : null}
            <div className="text-lg font-semibold tracking-wide">Your Brand</div>
        </div>

        <button
            type="button"
            onClick={() => setBrandingMode((v) => !v)}
            className="rounded-lg px-3 py-1.5 border border-white/40 text-[var(--banner-fg)] transition-transform hover:translate-y-[1px] active:scale-95"
            title={brandingMode ? "Exit Branding" : "Enter Branding"}
        >
            {brandingMode ? "Exit Branding" : "Enter Branding"}
        </button>
    </div>
</div>
// [DH-SECTION-END] HEADER_BANNER
// [DH-SECTION-BEGIN] BRAND_CONTROL_RAIL
{
    brandingMode ? (
        <div
            className="fixed top-20 z-[9999] bg-white/90 backdrop-blur-sm border rounded-xl shadow p-4 w-72 space-y-3 max-h-[75vh] overflow-auto"
            style={{ left: "calc(50% - 360px - 18rem - 8px)" }}
            data-section="BRAND_CONTROL_RAIL"
        >
            <div className="font-semibold text-sm tracking-wide uppercase text-black">Controls</div>
            <div className="border-t border-black/20" />

            <div className="space-y-3 text-sm text-black">
                {/* Branding mode note (no card-area editing) */}
                <div>
                    <div className="font-bold">Branding Mode</div>
                    <p className="mt-1">
                        Make all changes from these rails. Direct edits on the card are disabled while branding is on.
                    </p>
                    <button
                        type="button"
                        onClick={() => setBrandingMode(false)}
                        className="mt-2 w-full rounded-lg border border-black px-3 py-2 text-center transition-transform hover:translate-y-[1px] active:scale-95"
                    >
                        Exit Branding
                    </button>
                </div>

                {/* Policy reminders */}
                <div className="border-t border-black/20 pt-3">
                    <div className="font-bold">Notes</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>Controls text and separator lines are black.</li>
                        <li>Button hovers use a subtle movement (no color change).</li>
                        <li>Borders, lines, and button shapes are not changeable.</li>
                    </ul>
                </div>
            </div>
        </div>
    ) : null
}
// [DH-SECTION-END] BRAND_CONTROL_RAIL
// [DH-SECTION-BEGIN] BRAND_COLOR_RAIL
{
    brandingMode ? (
        <div
            className="fixed top-20 z-[9999] bg-white/90 backdrop-blur-sm border rounded-xl shadow p-4 w-72 space-y-2 max-h-[75vh] overflow-auto"
            style={{ left: "calc(50% + 360px + 8px)" }}
            data-section="BRAND_COLOR_RAIL"
        >
            <div className="font-semibold text-sm tracking-wide uppercase text-black">Colors</div>
            <div className="border-t border-black/20" />

            <div className="space-y-2 text-sm text-black">
                {/* Banner */}
                <label className="flex items-center justify-between text-sm text-black">
                    Banner Title
                    <input
                        type="color"
                        value={brandDraft.css_vars["--banner-fg"] || themeVars["--banner-fg"]}
                        onChange={(e) => updateCssVar("--banner-fg", e.target.value)}
                    />
                </label>
                <label className="flex items-center justify-between text-sm text-black">
                    Banner Background
                    <input
                        type="color"
                        value={brandDraft.css_vars["--banner-bg"] || themeVars["--banner-bg"]}
                        onChange={(e) => updateCssVar("--banner-bg", e.target.value)}
                    />
                </label>

                <div className="border-t border-black/20 my-2" />

                {/* Tabs (active state) */}
                <label className="flex items-center justify-between text-sm text-black">
                    Tab Titles
                    <input
                        type="color"
                        value={brandDraft.css_vars["--tab-active-fg"] || themeVars["--tab-active-fg"]}
                        onChange={(e) => updateCssVar("--tab-active-fg", e.target.value)}
                    />
                </label>
                <label className="flex items-center justify-between text-sm text-black">
                    Tab Background
                    <input
                        type="color"
                        value={brandDraft.css_vars["--tab-active-bg"] || themeVars["--tab-active-bg"]}
                        onChange={(e) => updateCssVar("--tab-active-bg", e.target.value)}
                    />
                </label>

                <div className="border-t border-black/20 my-2" />

                {/* Card + Fields */}
                <label className="flex items-center justify-between text-sm text-black">
                    Card Background
                    <input
                        type="color"
                        value={brandDraft.css_vars["--card-bg"] || themeVars["--card-bg"]}
                        onChange={(e) => updateCssVar("--card-bg", e.target.value)}
                    />
                </label>
                <label className="flex items-center justify-between text-sm text-black">
                    Message Field BG
                    <input
                        type="color"
                        value={brandDraft.css_vars["--field-bg"] || themeVars["--field-bg"]}
                        onChange={(e) => updateCssVar("--field-bg", e.target.value)}
                    />
                </label>

                <div className="border-t border-black/20 my-2" />

                {/* Send icon (no hover color control) */}
                <label className="flex items-center justify-between text-sm text-black">
                    Send Button
                    <input
                        type="color"
                        value={brandDraft.css_vars["--send-color"] || themeVars["--send-color"]}
                        onChange={(e) => updateCssVar("--send-color", e.target.value)}
                    />
                </label>
            </div>
        </div>
    ) : null
}
// [DH-SECTION-END] BRAND_COLOR_RAIL
// [DH-SECTION-BEGIN] BRAND_NAV
{
    brandingMode ? (
        <div className="px-0 py-2 flex flex-wrap gap-2" data-section="BRAND_NAV">
            <button
                type="button"
                className={UI.BTN}
                onClick={() => {
                    setSelected?.(null);
                    setMode?.("ask");
                    requestAnimationFrame(() => contentRef?.current?.scrollTo?.({ top: 0, behavior: "auto" }));
                }}
            >
                <div className="font-extrabold text-base">Ask</div>
            </button>

            <button
                type="button"
                className={UI.BTN}
                onClick={() => {
                    setSelected?.(null);
                    setMode?.("browse");
                    openBrowse?.();
                }}
            >
                <div className="font-extrabold text-base">Browse Demos</div>
            </button>

            <button
                type="button"
                className={UI.BTN_DOCS}
                onClick={() => {
                    setSelected?.(null);
                    setMode?.("docs");
                    openBrowseDocs?.();
                }}
            >
                <div className="font-extrabold text-base">Browse Documents</div>
            </button>

            <button
                type="button"
                className={UI.BTN}
                onClick={() => {
                    setSelected?.(null);
                    setMode?.("price");
                }}
            >
                <div className="font-extrabold text-base">Price Estimate</div>
            </button>

            <button
                type="button"
                className={UI.BTN}
                onClick={() => {
                    setSelected?.(null);
                    setMode?.("meeting");
                    openMeeting?.();
                }}
            >
                <div className="font-extrabold text-base">Schedule Meeting</div>
            </button>
        </div>
    ) : null
}
// [DH-SECTION-END] BRAND_NAV
// [DH-SECTION-BEGIN] BOTTOM_ASK_BAR
{/* Bottom Ask Bar */ }
<div className="w-full border-t border-gray-200 bg-white">
    <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
        <input
            type="text"
            value={askText}
            onChange={(e) => setAskText?.(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend?.(askText);
                }
            }}
            placeholder="Ask a question…"
            className={UI.FIELD}
        />
        <button
            type="button"
            aria-label="Send"
            onClick={() => onSend?.(askText)}
            className="shrink-0 rounded-full p-1 transition-transform hover:translate-y-[1px] active:scale-95"
        >
            <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] active:scale-95" />
        </button>
    </div>
</div>
// [DH-SECTION-END] BOTTOM_ASK_BAR
// [DH-SECTION-BEGIN] PRICE_MODE
// Pricing state
const [priceQs, setPriceQs] = useState([]);
const [priceLoading, setPriceLoading] = useState(false);
const [priceAnswers, setPriceAnswers] = useState({});
const [estimate, setEstimate] = useState(null);
const [estimating, setEstimating] = useState(false);

// Load pricing questions (bot_id/alias/apiBase are optional; safe-guarded)
useEffect(() => {
    let on = true;
    (async () => {
        try {
            if (typeof apiBase === "undefined") return;
            const qs = [];
            const params = new URLSearchParams();
            if (typeof botId !== "undefined" && botId) params.set("bot_id", botId);
            if (!params.toString()) return; // need at least bot_id to resolve
            setPriceLoading(true);
            const res = await fetch(`${apiBase}/pricing/questions?${params.toString()}`);
            const data = await res.json();
            if (!on) return;
            if (data?.ok && Array.isArray(data.questions)) {
                setPriceQs(data.questions);
            }
        } catch {/* silent */ }
        finally { if (on) setPriceLoading(false); }
    })();
    return () => { on = false; };
}, []);

// Answer helpers
function setAnswer(qKey, val) {
    setPriceAnswers((prev) => ({ ...prev, [qKey]: val }));
    setEstimate(null);
}

async function runEstimate() {
    try {
        if (typeof apiBase === "undefined") return;
        const payload = {
            bot_id: (typeof botId !== "undefined" && botId) || undefined,
            answers: priceAnswers,
        };
        setEstimating(true);
        const res = await fetch(`${apiBase}/pricing/estimate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        setEstimate(data?.ok ? data : null);
    } catch {
        setEstimate(null);
    } finally {
        setEstimating(false);
    }
}

{
    mode === "price" ? (
        <div className="px-4 sm:px-6 py-4" data-section="PRICE_MODE">
            <div className="text-xl font-bold mb-2">Price Estimate</div>
            {priceLoading ? (
                <div className="text-sm text-gray-600">Loading questions…</div>
            ) : (
                <div className="space-y-4">
                    {priceQs.map((q) => (
                        <div key={q.id} className="border rounded-lg p-3 bg-white">
                            <div className="font-extrabold text-base">{q.prompt || q.q_key}</div>
                            {q.help_text ? (
                                <div className="mt-1 text-sm opacity-90">{q.help_text}</div>
                            ) : null}
                            {Array.isArray(q.options) && q.options.length > 0 ? (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {q.options.map((opt) => {
                                        const active =
                                            priceAnswers[q.q_key] === (opt.key || opt.id || opt.label);
                                        return (
                                            <button
                                                key={opt.id || opt.key || opt.label}
                                                type="button"
                                                onClick={() => setAnswer(q.q_key, opt.key || opt.id || opt.label)}
                                                className={classNames(
                                                    "w-full text-left rounded-xl px-4 py-3 border transition-transform hover:translate-y-[1px] active:scale-95",
                                                    active ? "border-black" : "border-gray-300"
                                                )}
                                            >
                                                <div className="font-extrabold text-base">{opt.label}</div>
                                                {opt.tooltip ? (
                                                    <div className="mt-1 text-sm opacity-90">{opt.tooltip}</div>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    ))}

                    <div className="pt-2 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={runEstimate}
                            disabled={estimating || priceQs.length === 0}
                            className={UI.BTN}
                        >
                            <div className="font-extrabold text-base">
                                {estimating ? "Estimating…" : "Get Estimate"}
                            </div>
                        </button>
                        {estimate && (
                            <div className="ml-2 text-sm">
                                <div className="font-semibold">
                                    Total: {estimate.currency_code || "USD"} {estimate.total_min} – {estimate.total_max}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    ) : null
}
// [DH-SECTION-END] PRICE_MODE
// [DH-SECTION-BEGIN] MEETING_PANE
// Meeting state
const [meetingAgent, setMeetingAgent] = useState(null);
const [meetingLoading, setMeetingLoading] = useState(false);

// Load agent (safe if apiBase/botId are not wired in this file)
useEffect(() => {
    let on = true;
    (async () => {
        try {
            if (typeof apiBase === "undefined") return;
            if (typeof botId === "undefined" || !botId) return;
            setMeetingLoading(true);
            const res = await fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            if (!on) return;
            if (data?.ok && data.agent) setMeetingAgent(data.agent);
        } catch {/* silent */ }
        finally { if (on) setMeetingLoading(false); }
    })();
    return () => { on = false; };
}, []);

{
    mode === "meeting" ? (
        <div className="px-4 sm:px-6 py-4" data-section="MEETING_PANE">
            <div className="text-xl font-bold mb-2">Schedule a Meeting</div>

            {meetingLoading ? (
                <div className="text-sm text-gray-600">Loading…</div>
            ) : (
                <div className="space-y-3">
                    {meetingAgent?.schedule_header ? (
                        <div className="text-sm">{meetingAgent.schedule_header}</div>
                    ) : (
                        <div className="text-sm">Pick a time that works for you.</div>
                    )}

                    <div className="border rounded-lg p-3 bg-white">
                        <div className="font-extrabold text-base">
                            {meetingAgent?.name || "Sales Team"}
                        </div>
                        {meetingAgent?.email ? (
                            <div className="mt-1 text-sm opacity-90">{meetingAgent.email}</div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                            {meetingAgent?.calendar_link ? (
                                <a
                                    href={meetingAgent.calendar_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={UI.BTN}
                                >
                                    <div className="font-extrabold text-base">
                                        {meetingAgent?.calendar_link_type === "cal" ? "Open Calendar" : "Book a Meeting"}
                                    </div>
                                </a>
                            ) : (
                                <button type="button" className={UI.BTN} disabled>
                                    <div className="font-extrabold text-base">Calendar Unavailable</div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    ) : null
}
// [DH-SECTION-END] MEETING_PANE
// [DH-SECTION-BEGIN] ASK_PANE
// Ask/chat state
const [askText, setAskText] = useState("");
const [messages, setMessages] = useState([]);
const [responseText, setResponseText] = useState("");
const [sending, setSending] = useState(false);

// Send handler (stubbed: replace with your API call if needed)
async function onSend(text) {
    const t = ((text ?? askText) || "").trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setAskText("");
    setSending(true);
    try {
        // TODO: wire to your assistant endpoint; placeholder response for now
        const fakeReply = "Thanks — branding mode is active. Use the rails on the sides to adjust your theme.";
        setResponseText(fakeReply);
        setMessages((m) => [...m, { role: "assistant", text: fakeReply }]);
    } finally {
        setSending(false);
    }
}

{
    mode === "ask" ? (
        <div className="px-4 sm:px-6 py-4" data-section="ASK_PANE">
            <div className="text-xl font-bold mb-2">Ask the Assistant</div>

            <div className="space-y-3">
                {/* Conversation */}
                <div className="border rounded-lg p-3 bg-white">
                    {messages.length === 0 ? (
                        <div className="text-sm text-gray-600">
                            Ask a question to get started.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {messages.map((m, i) => (
                                <div key={i} className={m.role === "user" ? "text-black" : "text-gray-800"}>
                                    <div className="text-xs uppercase opacity-60">{m.role}</div>
                                    <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Latest answer preview (optional) */}
                {responseText ? (
                    <div className="border rounded-lg p-3 bg-white">
                        <div className="font-extrabold text-base">Answer</div>
                        <div className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{responseText}</div>
                    </div>
                ) : null}

                {/* Quick actions (optional) */}
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className={UI.BTN}
                        onClick={() => onSend("Show me how to adjust the banner colors.")}
                        disabled={sending}
                    >
                        <div className="font-extrabold text-base">Banner Colors</div>
                    </button>
                    <button
                        type="button"
                        className={UI.BTN}
                        onClick={() => onSend("How do I change tab styles?")}
                        disabled={sending}
                    >
                        <div className="font-extrabold text-base">Tab Styles</div>
                    </button>
                </div>
            </div>
        </div>
    ) : null
}
// [DH-SECTION-END] ASK_PANE
// [DH-SECTION-BEGIN] BROWSE_PANE
// Demos browse state
const [browseItems, setBrowseItems] = useState([]);
const [browseLoading, setBrowseLoading] = useState(false);

// Open demos browser and load items
function openBrowse() {
    setMode?.("browse");
    setSelected?.(null);
    (async () => {
        try {
            if (typeof apiBase === "undefined") return;
            const params = new URLSearchParams();
            if (typeof alias !== "undefined" && alias) params.set("alias", alias);
            if (typeof botId !== "undefined" && botId) params.set("bot_id", botId);
            setBrowseLoading(true);
            const res = await fetch(`${apiBase}/browse-demos?${params.toString()}`);
            const data = await res.json();
            setBrowseItems(Array.isArray(data?.items) ? data.items : []);
        } catch {
            setBrowseItems([]);
        } finally {
            setBrowseLoading(false);
        }
    })();
}

{
    mode === "browse" ? (
        <div className="px-4 sm:px-6 py-4" data-section="BROWSE_PANE">
            <div className="text-xl font-bold mb-2">Browse Demos</div>

            {browseLoading ? (
                <div className="text-sm text-gray-600">Loading…</div>
            ) : browseItems.length === 0 ? (
                <div className="text-sm text-gray-600">No demos found.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {browseItems.map((it) => (
                        <a
                            key={it.id}
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className={UI.BTN}
                        >
                            <div className="font-extrabold text-base">Watch “{it.title}”</div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    ) : null
}
// [DH-SECTION-END] BROWSE_PANE
// [DH-SECTION-BEGIN] DOCS_PANE
// Documents browse state
const [docsItems, setDocsItems] = useState([]);
const [docsLoading, setDocsLoading] = useState(false);

// Open documents browser and load items
function openBrowseDocs() {
    setMode?.("docs");
    setSelected?.(null);
    (async () => {
        try {
            if (typeof apiBase === "undefined") return;
            const params = new URLSearchParams();
            if (typeof alias !== "undefined" && alias) params.set("alias", alias);
            if (typeof botId !== "undefined" && botId) params.set("bot_id", botId);
            setDocsLoading(true);
            const res = await fetch(`${apiBase}/browse-docs?${params.toString()}`);
            const data = await res.json();
            setDocsItems(Array.isArray(data?.items) ? data.items : []);
        } catch {
            setDocsItems([]);
        } finally {
            setDocsLoading(false);
        }
    })();
}

{
    mode === "docs" ? (
        <div className="px-4 sm:px-6 py-4" data-section="DOCS_PANE">
            <div className="text-xl font-bold mb-2">Browse Documents</div>

            {docsLoading ? (
                <div className="text-sm text-gray-600">Loading…</div>
            ) : docsItems.length === 0 ? (
                <div className="text-sm text-gray-600">No documents found.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {docsItems.map((it) => (
                        <a
                            key={it.id}
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className={UI.BTN_DOCS}
                        >
                            <div className="font-extrabold text-base">Read “{it.title}”</div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    ) : null
}
// [DH-SECTION-END] DOCS_PANE
// [DH-SECTION-BEGIN] TABS_NAV
function TabsNav({ mode, tabs }) {
    return (
        <div
            className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-section="TABS_NAV"
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
                        (mode === "meeting" && t.key === "meeting") ||
                        (mode === "ask" && t.key === "ask");
                    return (
                        <button
                            key={t.key}
                            onClick={t.onClick}
                            role="tab"
                            aria-selected={active}
                            className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
// [DH-SECTION-END] TABS_NAV
// [DH-SECTION-BEGIN] TABS_CONFIG
// Tabs enabled flags (override if your app gates tabs)
const tabsEnabled = { ask: true, demos: true, docs: true, price: true, meeting: true };

// Build tabs array; tabs are inert while brandingMode is on.
const tabs = useMemo(() => {
    const inert = brandingMode;

    const toTop = () =>
        requestAnimationFrame(() =>
            contentRef?.current?.scrollTo?.({ top: 0, behavior: "auto" })
        );

    const make = (key, label, handler) => ({
        key,
        label,
        onClick: inert
            ? () => { } // tabs disabled during branding
            : handler,
    });

    const list = [
        make("ask", "Ask", () => {
            setSelected?.(null);
            setMode?.("ask");
            toTop();
        }),
    ];

    if (tabsEnabled.demos) {
        list.push(
            make("demos", "Browse Demos", () => {
                setSelected?.(null);
                setMode?.("browse");
                openBrowse?.();
            })
        );
    }

    if (tabsEnabled.docs) {
        list.push(
            make("docs", "Browse Documents", () => {
                setSelected?.(null);
                setMode?.("docs");
                openBrowseDocs?.();
            })
        );
    }

    if (tabsEnabled.price) {
        list.push(
            make("price", "Price Estimate", () => {
                setSelected?.(null);
                setMode?.("price");
            })
        );
    }

    if (tabsEnabled.meeting) {
        list.push(
            make("meeting", "Schedule Meeting", () => {
                setSelected?.(null);
                setMode?.("meeting");
                openMeeting?.();
            })
        );
    }

    return list;
}, [brandingMode, setSelected, setMode, openBrowse, openBrowseDocs, openMeeting, contentRef]);
// [DH-SECTION-END] TABS_CONFIG
// [DH-SECTION-BEGIN] COMPONENT_OPEN
export default function AskAssistant() {
    // Core UI state
    const [mode, setMode] = useState("ask");     // "ask" | "browse" | "docs" | "price" | "meeting"
    const [selected, setSelected] = useState(null);
    const contentRef = useRef(null);

    // === THEME SCOPE + PAGE SHELL ===
    return (
        <ThemeScope vars={themeVars}>
            {/* Header / Banner */}
            {/* (Section 12 — HEADER_BANNER should appear just above or here) */}

            {/* Tabs + Branding Nav */}
            {/* (Section 14 — TABS_NAV and Section 15 — TABS_CONFIG build + render tabs) */}
            <div className="w-full">
                <TabsNav mode={mode} tabs={tabs} />
                {/* (Section 5 — BRAND_NAV can be placed right below to render branding buttons) */}
            </div>

            {/* Main content container (centered card layout) */}
            <div className="relative mx-auto max-w-3xl">
                {/* Side rails and content panes paste below (Sections 3, 4, 9–11, 7, 8, etc.) */}

                {/* Scrollable content area */}
                <div ref={contentRef} className="min-h-[50vh]">
                    {/* [DH-SECTION-BEGIN] COMPONENT_CLOSE */}
                </div> {/* close scrollable content area */}
            </div>   {/* close main content container */}

            {/* === Bottom Ask Bar === */}
            {/* Paste Section 6 — BOTTOM_ASK_BAR right here */}
            {/* [Section 6 goes here] */}

        </ThemeScope>
    );
}
{/* [DH-SECTION-END] COMPONENT_CLOSE */ }
// [DH-SECTION-BEGIN] SMALL_COMPONENTS
function Row({ item, onClick, active }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={classNames(
                "w-full text-left rounded-xl px-4 py-3 border bg-white transition-transform hover:translate-y-[1px] active:scale-95",
                active ? "border-black" : "border-gray-300"
            )}
        >
            <div className="font-extrabold text-base">{item.title}</div>
            {item.description ? (
                <div className="mt-1 text-sm opacity-90">{item.description}</div>
            ) : null}
            {item.functions_text ? (
                <div className="mt-1 text-sm opacity-90">{item.functions_text}</div>
            ) : null}
        </button>
    );
}

function OptionButton({ opt, onClick, active }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={classNames(
                "w-full text-left rounded-xl px-4 py-3 border bg-white transition-transform hover:translate-y-[1px] active:scale-95",
                active ? "border-black" : "border-gray-300"
            )}
        >
            <div className="font-extrabold text-base">{opt.label}</div>
            {opt.tooltip ? (
                <div className="mt-1 text-sm opacity-90">{opt.tooltip}</div>
            ) : null}
        </button>
    );
}
// [DH-SECTION-END] SMALL_COMPONENTS
// [DH-SECTION-BEGIN] REVISION_FOOTER
// REVISION: AskAssistant.jsx | Sectioned branding refactor + rails placement + hover effects
// NOTES: Controls/Colors rails flush to card edges; black labels/separators; no hover color; tabs inert in branding.
// DATE: 2025-08-30
// [DH-SECTION-END] REVISION_FOOTER
