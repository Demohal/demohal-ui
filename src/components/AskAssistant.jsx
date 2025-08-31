// [SECTION 1 BEGIN]

/* src/components/AskAssistant.jsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
/* =============================== *
 *  PATCH-READY CONSTANTS & UTILS  *
 * =============================== */

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
    "--btn-grad-from-hover": "#6B7280",
    "--btn-grad-to-hover": "#4B5563",
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
    "--send-color-hover": "#C03327",

    // Docs buttons (lighter gradient than demos)
    "--btn-docs-grad-from": "#b1b3b4",
    "--btn-docs-grad-to": "#858789",
    "--btn-docs-grad-from-hover": "#c2c4c5",
    "--btn-docs-grad-to-hover": "#9a9c9e",
};

const UI = {
    CARD: "border rounded-xl p-4 bg-white shadow",
    BTN:
        "w-full text-center rounded-xl px-4 py-3 shadow transition-colors " +
        "text-[var(--btn-fg)] border " +
        "border-[var(--btn-border)] " +
        "bg-gradient-to-b from-[var(--btn-grad-from)] to-[var(--btn-grad-to)] " +
        "hover:from-[var(--btn-grad-from-hover)] hover:to-[var(--btn-grad-to-hover)]",
    BTN_DOCS:
        "w-full text-center rounded-xl px-4 py-3 shadow transition-colors " +
        "text-[var(--btn-fg)] border " +
        "border-[var(--btn-border)] " +
        "bg-gradient-to-b from-[var(--btn-docs-grad-from)] to-[var(--btn-docs-grad-to)] " +
        "hover:from-[var(--btn-docs-grad-from-hover)] hover:to-[var(--btn-docs-grad-to-hover)]",
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

/* ========================== *
 *  SMALL PATCHABLE COMPONENTS *
 * ========================== */

function Row({ item, onPick, variant }) {
    const btnClass = variant === "docs" ? UI.BTN_DOCS : UI.BTN;
    return (
        <button data-patch="row-button" onClick={() => onPick(item)} className={btnClass} title={item.description || ""}>
            <div className="font-extrabold text-base">{item.title}</div>
            {item.description ? (
                <div className="mt-1 text-sm opacity-90">{item.description}</div>
            ) : item.functions_text ? (
                <div className="mt-1 text-sm opacity-90">{item.functions_text}</div>
            ) : null}
        </button>
    );
}

function OptionButton({ opt, selected, onClick }) {
    return (
        <button
            data-patch="option-button"
            onClick={() => onClick(opt)}
            className={classNames(UI.BTN, selected && "ring-2 ring-white/60")}
            title={opt.tooltip || ""}
        >
            <div className="font-extrabold text-base">{opt.label}</div>
            {opt.tooltip ? <div className="mt-1 text-sm opacity-90">{opt.tooltip}</div> : null}
        </button>
    );
}

function PriceMirror({ lines }) {
    if (!lines?.length) return null;
    return (
        <div data-patch="price-mirror" className="mb-3">
            {lines.map((ln, i) => (
                <div key={i} className="text-base italic text-gray-700 whitespace-pre-line">
                    {ln}
                </div>
            ))}
        </div>
    );
}

function EstimateCard({ estimate, outroText }) {
    if (!estimate) return null;
    return (
        <div data-patch="estimate-card">
            <div className={UI.CARD}>
                <div className="flex items-center justify-between mb-3">
                    <div className="text-black font-bold text-lg">Your Estimate</div>
                    <div className="text-black font-bold text-lg">
                        {estimate.currency_code} {Number(estimate.total_min).toLocaleString()} – {estimate.currency_code}{" "}
                        {Number(estimate.total_max).toLocaleString()}
                    </div>
                </div>
                <div className="space-y-3">
                    {(estimate.line_items || []).map((li) => (
                        <div key={li.product.id} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div className="text-black font-bold">{li.product.name}</div>
                                <div className="text-black font-bold text-lg">
                                    {li.currency_code} {Number(li.price_min).toLocaleString()} – {li.currency_code}{" "}
                                    {Number(li.price_max).toLocaleString()}
                                </div>
                            </div>
                            {Array.isArray(li.features) && li.features.length > 0 && (
                                <div className="mt-2">
                                    {li.features
                                        .filter((f) => f.is_standard)
                                        .map((f, idx) => (
                                            <span
                                                key={`${li.product.id}-${idx}`}
                                                className="inline-block text-xs border border-gray-300 rounded-full px-2 py-0.5 mr-1 mb-1"
                                            >
                                                {f.name}
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {outroText ? <div className="mt-3 text-black text-base font-bold whitespace-pre-line">{outroText}</div> : null}
        </div>
    );
}

// [SECTION 1 END]

// [SECTION 2 BEGIN]

function QuestionBlock({ q, value, onPick }) {
    return (
        <div data-patch="question-block" className={UI.FIELD}>
            <div className="text-black font-bold text-base">{q.prompt}</div>
            {q.help_text ? <div className="text-xs text-black italic mt-1">{q.help_text}</div> : null}

            {Array.isArray(q.options) && q.options.length > 0 ? (
                <div className="mt-3 flex flex-col gap-3">
                    {q.options.map((opt) => (
                        <OptionButton
                            key={opt.key || opt.id}
                            opt={opt}
                            selected={q.type === "multi" ? Array.isArray(value) && value.includes(opt.key) : value === opt.key}
                            onClick={() => onPick(q, opt)}
                        />
                    ))}
                </div>
            ) : (
                <div className="mt-3 text-xs text-gray-600">No options available.</div>
            )}
        </div>
    );
}

function TabsNav({ mode, tabs }) {
    return (
        <div
            className="w-full flex justify-start md:justify-center overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                        <button key={t.key} onClick={t.onClick} role="tab" aria-selected={active} className={active ? UI.TAB_ACTIVE : UI.TAB_INACTIVE}>
                            {t.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

/* =================== *
 *  MAIN APP COMPONENT *
 * =================== */

export default function AskAssistant() {
    const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

    // Pull both alias and bot_id from URL; give precedence to bot_id.
    const { alias, botIdFromUrl } = useMemo(() => {
        const qs = new URLSearchParams(window.location.search);
        const a = (qs.get("alias") || qs.get("alais") || "").trim();
        const b = (qs.get("bot_id") || "").trim();
        return { alias: a, botIdFromUrl: b };
    }, []);

    // DEV ONLY: hardwired branding on for prototype
    const brandingMode = true;
    // Optional: allow a default alias via env, e.g., VITE_DEFAULT_ALIAS=demo
    const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

    const [botId, setBotId] = useState(botIdFromUrl || "");
    const [fatal, setFatal] = useState("");

    // Modes: ask | browse | docs | price | meeting
    const [mode, setMode] = useState("ask");
    const [input, setInput] = useState("");
    const [lastQuestion, setLastQuestion] = useState("");
    const [responseText, setResponseText] = useState("");
    const [introVideoUrl, setIntroVideoUrl] = useState("");
    const [showIntroVideo, setShowIntroVideo] = useState(false);

    const [loading, setLoading] = useState(false);

    const [items, setItems] = useState([]); // Ask suggestions
    const [browseItems, setBrowseItems] = useState([]); // Demos
    const [browseDocs, setBrowseDocs] = useState([]); // Docs
    const [selected, setSelected] = useState(null);

    const [helperPhase, setHelperPhase] = useState("hidden");
    const [isAnchored, setIsAnchored] = useState(false);

    const contentRef = useRef(null);
    const inputRef = useRef(null);

    // Theme (DB-driven CSS variables)
    const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
    // BRANDING DRAFT (live preview; publish later)
    const [brandDraft, setBrandDraft] = useState({
        css_vars: {},
        text: {
            welcome_message: "",
            ui_copy: { intro: { heading: "", body: "" }, outro: { heading: "", body: "" } },
            schedule_header: "",
        },
        dirty: false,
    });
    const [editing, setEditing] = useState({
        welcome: false,
        priceIntro: false,
        priceOutro: false,
        scheduleHeader: false,
    });


    // Brand assets (logo variants)
    const [brandAssets, setBrandAssets] = useState({
        logo_url: null,
        logo_light_url: null,
        logo_dark_url: null,
    });

    // Prevent brand FOUC: gate UI until brand is loaded at least once
    // If no alias and no bot_id in the URL, there’s no brand fetch to wait for.
    // In that case, start visible; otherwise gate until /brand finishes.
    const initialBrandReady = useMemo(() => !(botIdFromUrl || alias), [botIdFromUrl, alias]);
    const [brandReady, setBrandReady] = useState(initialBrandReady);

    // NEW: Tab visibility flags
    const [tabsEnabled, setTabsEnabled] = useState({
        demos: false,
        docs: false,
        meeting: false,
        price: false,
    });

    // Pricing state
    const [priceUiCopy, setPriceUiCopy] = useState({});
    const [priceQuestions, setPriceQuestions] = useState([]);
    const [priceAnswers, setPriceAnswers] = useState({});
    const [priceEstimate, setPriceEstimate] = useState(null);
    const [priceBusy, setPriceBusy] = useState(false);
    const [priceErr, setPriceErr] = useState("");

    // Agent for meeting tab
    const [agent, setAgent] = useState(null);

    // Resolve bot settings first when alias is present and botId not already known
    useEffect(() => {
        if (botId) return; // already have a bot id from URL
        if (!alias) return; // nothing to resolve
        let cancel = false;
        (async () => {
            try {
                const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
                const data = await res.json();
                if (cancel) return;
                const id = data?.ok ? data?.bot?.id : null;

                // NEW: tab flags from bot row when resolving by alias
                const b = data?.ok ? data?.bot : null;
                if (b) {
                    setTabsEnabled({
                        demos: !!b.show_browse_demos,
                        docs: !!b.show_browse_docs,
                        meeting: !!b.show_schedule_meeting,
                        price: !!b.show_price_estimate,
                    });
                    setResponseText(b.welcome_message || "");
                    setIntroVideoUrl(b.intro_video_url || "");
                    setShowIntroVideo(!!b.show_intro_video);
                }
                if (id) {
                    setBotId(id);
                    setFatal("");
                } else if (!res.ok || data?.ok === false) {
                    setFatal("Invalid or inactive alias.");
                }
            } catch {
                if (!cancel) setFatal("Invalid or inactive alias.");
            }
        })();
        return () => { cancel = true; };
    }, [alias, apiBase, botId]);

    // If neither bot_id nor alias present, try resolving defaultAlias once.
    useEffect(() => {
        if (botId || alias || !defaultAlias) return;
        let cancel = false;
        (async () => {
            try {
                const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(defaultAlias)}`);
                const data = await res.json();
                if (cancel) return;
                const id = data?.ok ? data?.bot?.id : null;

                // NEW: tab flags from bot row when using default alias
                const b = data?.ok ? data?.bot : null;
                if (b) {
                    setTabsEnabled({
                        demos: !!b.show_browse_demos,
                        docs: !!b.show_browse_docs,
                        meeting: !!b.show_schedule_meeting,
                        price: !!b.show_price_estimate,
                    });
                    setResponseText(b.welcome_message || "");
                    setIntroVideoUrl(b.intro_video_url || "");
                    setShowIntroVideo(!!b.show_intro_video);
                }
                if (id) setBotId(id);
            } catch {
                // ignore; UI will show a friendly prompt instead of a spinner
            }
        })();
        return () => { cancel = true; };
    }, [botId, alias, defaultAlias, apiBase]);

    // [SECTION 2 END]

    // [SECTION 3 BEGIN]

    useEffect(() => {
        // If there’s nothing to resolve (no alias, no botId) and we somehow stayed gated, un-gate.
        if (!botId && !alias && !brandReady) setBrandReady(true);
    }, [botId, alias, brandReady]);


    // Fetch brand once we know botId (DB-driven CSS + logo)
    useEffect(() => {
        if (!botId) return;
        let cancel = false;
        (async () => {
            try {
                const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
                const data = await res.json();
                if (cancel) return;

                if (data?.ok && data?.css_vars && typeof data.css_vars === "object") {
                    setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
                }
                if (data?.ok && data?.assets) {
                    const logos = {
                        url: data.assets.logo_url || null
                    };
                    setBrandAssets({
                        logo_url: logos.url
                    });
                    if (!logos.url) {
                        setFatal("Brand logo missing for this bot.");
                    }
                }
            } catch {
                setFatal("Failed to load brand assets.");
            } finally {
                if (!cancel) setBrandReady(true);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [botId, apiBase]);
    // Initialize BRANDING DRAFT once brand + bot copy are available (branding mode only)
    useEffect(() => {
        if (!brandingMode || !botId) return;
        let cancel = false;
        (async () => {
            try {
                const [botRes, priceRes, agentRes] = await Promise.all([
                    fetch(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botId)}`),
                    fetch(`${apiBase}/pricing/questions?bot_id=${encodeURIComponent(botId)}`),
                    fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`),
                ]);
                const botJ = await botRes.json().catch(() => ({}));
                const priceJ = await priceRes.json().catch(() => ({}));
                const agentJ = await agentRes.json().catch(() => ({}));
                if (cancel) return;
                const welcome_message = botJ?.ok ? (botJ.bot?.welcome_message || "") : "";
                const ui_copy = (priceJ?.ok ? (priceJ.ui_copy || {}) : {});
                const schedule_header = agentJ?.ok ? (agentJ.agent?.schedule_header || "") : "";
                const editable = [
                    "--banner-bg", "--banner-fg",
                    "--page-bg", "--card-bg", "--card-border",
                    "--tab-active-bg", "--tab-active-fg",
                    "--field-bg", "--field-border",
                    "--send-color", "--send-color-hover"
                ];
                const css_vars = {};
                for (const k of editable) css_vars[k] = themeVars[k];
                setBrandDraft({
                    css_vars,
                    text: {
                        welcome_message,
                        ui_copy: {
                            intro: { heading: ui_copy?.intro?.heading || "", body: ui_copy?.intro?.body || "" },
                            outro: { heading: ui_copy?.outro?.heading || "", body: ui_copy?.outro?.body || "" }
                        },
                        schedule_header
                    },
                    dirty: false
                });
            } catch { }
        })();
        return () => { cancel = true; };
    }, [brandingMode, botId, apiBase, themeVars]);
    // Helpers to update draft + live preview
    const updateCssVar = (name, value) => {
        setThemeVars((prev) => ({ ...prev, [name]: value }));
        setBrandDraft((prev) => ({ ...prev, css_vars: { ...prev.css_vars, [name]: value }, dirty: true }));
    };
    const updateDraftText = (path, value) => {
        setBrandDraft((prev) => {
            const next = JSON.parse(JSON.stringify(prev.text));
            const parts = path.split(".");
            let p = next;
            while (parts.length > 1) p = p[parts.shift()];
            p[parts[0]] = value;
            return { ...prev, text: next, dirty: true };
        });
    };
    const discardDraft = () => {
        setBrandDraft((prev) => ({ ...prev, dirty: false }));
    };
    const publishDraft = async () => {
        try {
            const payload = {
                bot_id: botId,
                css_vars: brandDraft.css_vars,
                welcome_message: brandDraft.text.welcome_message,
                ui_copy: brandDraft.text.ui_copy,
                schedule_header: brandDraft.text.schedule_header,
            };
            const res = await fetch(`${apiBase}/brand/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const j = await res.json().catch(() => ({}));
            if (!j?.ok) throw new Error(j?.error || "save_failed");
            setBrandDraft((prev) => ({ ...prev, dirty: false }));
        } catch (e) {
            alert("Failed to publish branding changes.");
        }
    };


    // NEW: when botId is known (e.g., bot_id in URL), fetch bot-settings to get show_* flags
    useEffect(() => {
        if (!botId) return;
        let cancel = false;
        (async () => {
            try {
                const res = await fetch(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(botId)}`);
                const data = await res.json();
                if (cancel) return;
                const b = data?.ok ? data?.bot : null;
                if (b) {
                    setTabsEnabled({
                        demos: !!b.show_browse_demos,
                        docs: !!b.show_browse_docs,
                        meeting: !!b.show_schedule_meeting,
                        price: !!b.show_price_estimate,
                    });
                    setResponseText(b.welcome_message || "");
                    setIntroVideoUrl(b.intro_video_url || "");
                    setShowIntroVideo(!!b.show_intro_video);
                }
            } catch {
                // silent; tabs remain default false if call fails
            }
        })();
        return () => { cancel = true; };
    }, [botId, apiBase]);

    // Autosize ask box
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [input]);

    // Release video/doc sticky when scrolling
    useEffect(() => {
        const el = contentRef.current;
        if (!el || !selected) return;
        const onScroll = () => {
            if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [selected, isAnchored]);

    // Helpers
    async function normalizeAndSelectDemo(item) {
        // Normalize demo URL to an embeddable form via backend
        try {
            const r = await fetch(`${apiBase}/render-video-iframe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ video_url: item.url }),
            });
            const j = await r.json();
            const embed = j?.video_url || item.url;
            setSelected({ ...item, url: embed });
            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
        } catch {
            setSelected(item);
            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
        }
    }

    // [SECTION 3 END]

    // [SECTION 4 BEGIN]

    async function openMeeting() {
        if (!botId) return;
        setSelected(null);
        setMode("meeting");
        try {
            const res = await fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            const ag = data?.ok ? data.agent : null;
            setAgent(ag);

            // NEW: if external, open in a new tab immediately (with in-pane fallback link)
            if (ag && ag.calendar_link_type && String(ag.calendar_link_type).toLowerCase() === "external" && ag.calendar_link) {
                try { window.open(ag.calendar_link, "_blank", "noopener,noreferrer"); } catch (_) { }
            }

            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
        } catch {
            setAgent(null);
        }
    }

    async function openBrowse() {
        if (!botId) return;
        setMode("browse");
        setSelected(null);
        try {
            const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            const src = Array.isArray(data?.items) ? data.items : [];
            setBrowseItems(
                src.map((it) => ({
                    id: it.id ?? it.value ?? it.url ?? it.title,
                    title: it.title ?? it.button_title ?? it.label ?? "",
                    url: it.url ?? it.value ?? it.button_value ?? "",
                    description: it.description ?? it.summary ?? it.functions_text ?? "",
                    functions_text: it.functions_text ?? it.description ?? "",
                }))
            );
            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
        } catch {
            setBrowseItems([]);
        }
    }

    async function openBrowseDocs() {
        if (!botId) return;
        setMode("docs");
        setSelected(null);
        try {
            const res = await fetch(`${apiBase}/browse-docs?bot_id=${encodeURIComponent(botId)}`);
            const data = await res.json();
            const src = Array.isArray(data?.items) ? data.items : [];
            setBrowseDocs(
                src.map((it) => ({
                    id: it.id ?? it.value ?? it.url ?? it.title,
                    title: it.title ?? it.button_title ?? it.label ?? "",
                    url: it.url ?? it.value ?? it.button_value ?? "",
                    description: it.description ?? it.summary ?? it.functions_text ?? "",
                    functions_text: it.functions_text ?? it.description ?? "",
                }))
            );
            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
        } catch {
            setBrowseDocs([]);
        }
    }

    // Pricing loader
    const priceScrollRef = useRef(null);
    useEffect(() => {
        if (mode !== "price" || !botId) return;
        let cancel = false;
        (async () => {
            try {
                setPriceErr("");
                setPriceEstimate(null);
                setPriceAnswers({});
                const res = await fetch(`${apiBase}/pricing/questions?bot_id=${encodeURIComponent(botId)}`);
                const data = await res.json();
                if (cancel) return;
                if (!data?.ok) throw new Error(data?.error || "Failed to load pricing questions");
                setPriceUiCopy(data.ui_copy || {});
                setPriceQuestions(Array.isArray(data.questions) ? data.questions : []);
                requestAnimationFrame(() => priceScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
            } catch {
                if (!cancel) setPriceErr("Unable to load price estimator.");
            }
        })();
        return () => {
            cancel = true;
        };
    }, [mode, botId, apiBase]);

    // Pricing: compute estimate when inputs ready
    useEffect(() => {
        const haveAll = (() => {
            if (!priceQuestions?.length) return false;
            const req = priceQuestions.filter((q) => q.group === "estimation" && q.required !== false);
            if (!req.length) return false;
            return req.every((q) => {
                const v = priceAnswers[q.q_key];
                return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
            });
        })();

        if (mode !== "price" || !botId || !haveAll) {
            setPriceEstimate(null);
            return;
        }
        let cancel = false;
        (async () => {
            try {
                setPriceBusy(true);
                const res = await fetch(`${apiBase}/pricing/estimate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bot_id: botId, answers: priceAnswers }),
                });
                const data = await res.json();
                if (cancel) return;
                if (!data?.ok) throw new Error(data?.error || "Failed to compute estimate");
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
    }, [mode, botId, apiBase, priceQuestions, priceAnswers]);

    // Next unanswered (required) question
    const nextPriceQuestion = useMemo(() => {
        if (!priceQuestions?.length) return null;
        for (const q of priceQuestions) {
            const v = priceAnswers[q.q_key];
            const empty =
                (q.type === "multi" && Array.isArray(v) && v.length === 0) || v === undefined || v === null || v === "";
            if (empty && q.group === "estimation" && q.required !== false) return q;
        }
        return null;
    }, [priceQuestions, priceAnswers]);

    // Mirror lines (for PriceTop)
    const mirrorLines = useMemo(() => {
        if (!priceQuestions?.length) return [];
        const lines = [];
        for (const q of priceQuestions) {
            const ans = priceAnswers[q.q_key];
            if (ans === undefined || ans === null || ans === "" || (Array.isArray(ans) && ans.length === 0)) continue;
            const opts = q.options || [];
            let label = "";
            if (q.type === "single") {
                const o = opts.find((o) => o.key === ans);
                const keyNorm = normKey(q.q_key);
                label = o?.label ?? String(ans);
            } else if (q.type === "multi") {
                const picked = Array.isArray(ans) ? ans : [];
                label = opts
                    .filter((o) => picked.includes(o.key))
                    .map((o) => o.name ?? o.label)
                    .join(", ");
            } else {
                label = String(ans);
            }
            if (!label) continue;

            let line = null;
            if (q.mirror_template) {
                line = renderMirror(q.mirror_template, label);
            }
            if (line) lines.push(line);
        }
        return lines;
    }, [priceQuestions, priceAnswers]);

    // Actions used in multiple panes
    function handlePickOption(q, opt) {
        setPriceAnswers((prev) => {
            if (q.type === "multi") {
                const curr = Array.isArray(prev[q.q_key]) ? prev[q.q_key] : [];
                const exists = curr.includes(opt.key);
                const next = exists ? curr.filter((k) => k !== opt.key) : [...curr, opt.key];
                return { ...prev, [q.q_key]: next };
            }
            return { ...prev, [q.q_key]: opt.key };
        });
    }

    // [SECTION 4 END]

   // [SECTION 5 BEGIN]

    async function sendMessage() {
        if (!input.trim() || !botId) return;
        const outgoing = input.trim();
        setMode("ask");
        setLastQuestion(outgoing);
        setInput("");
        setSelected(null);
        setResponseText("");
        setHelperPhase("hidden");
        setItems([]);
        setLoading(true);
        try {
            const res = await axios.post(
                `${apiBase}/demo-hal`,
                { bot_id: botId, user_question: outgoing },
                { timeout: 30000 }
            );
            const data = res?.data || {};

            const text = data?.response_text || "";
            const recSource = Array.isArray(data?.items) ? data.items : Array.isArray(data?.buttons) ? data.buttons : [];

            const recs = (Array.isArray(recSource) ? recSource : [])
                .map((it) => {
                    const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
                    const title =
                        it.title ??
                        it.button_title ??
                        (typeof it.label === "string" ? it.label.replace(/^Watch the \"|\" demo$/g, "") : it.label) ??
                        "";
                    const url = it.url ?? it.value ?? it.button_value ?? "";
                    const description = it.description ?? it.summary ?? it.functions_text ?? "";
                    const action = it.action ?? it.button_action ?? "demo";
                    return { id, title, url, description, functions_text: it.functions_text ?? description, action };
                })
                .filter((b) => {
                    const act = (b.action || "").toLowerCase();
                    const lbl = (b.title || "").toLowerCase();
                    return act !== "continue" && act !== "options" && lbl !== "continue" && lbl !== "show me options";
                });

            setResponseText(text);
            setLoading(false);

            if (recs.length > 0) {
                setHelperPhase("header");
                setTimeout(() => {
                    setItems(recs);
                    setHelperPhase("buttons");
                }, 60);
            } else {
                setHelperPhase("hidden");
                setItems([]);
            }

            requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: "auto" }));
        } catch {
            setLoading(false);
            setResponseText("Sorry—something went wrong.");
            setHelperPhase("hidden");
            setItems([]);
        }
    }

    const listSource = mode === "browse" ? browseItems : items;
    const askUnderVideo = useMemo(() => {
        if (!selected) return items;
        const selKey = selected.id ?? selected.url ?? selected.title;
        return (items || []).filter((it) => (it.id ?? it.url ?? it.title) !== selKey);
    }, [selected, items]);
    const visibleUnderVideo = selected ? (mode === "ask" ? askUnderVideo : []) : listSource;

    // NEW: dynamically build tabs from bot flags
    const tabs = useMemo(() => {
        const out = [];
        if (tabsEnabled.demos) out.push({ key: "demos", label: "Browse Demos", onClick: openBrowse });
        if (tabsEnabled.docs) out.push({ key: "docs", label: "Browse Documents", onClick: openBrowseDocs });
        if (tabsEnabled.price) out.push({ key: "price", label: "Price Estimate", onClick: () => { setSelected(null); setMode("price"); } });
        if (tabsEnabled.meeting) out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
        return out;
    }, [tabsEnabled]);

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
                style={themeVars}
            >
                {brandingMode ? (
                    <>
                        {/* Left control rail — anchored relative to the 720px app container */}
                        <div
                            className="fixed top-20 z-[9999] bg-white/90 backdrop-blur-sm border rounded-xl shadow p-4 w-72 space-y-3 max-h-[75vh] overflow-auto text-black"
                            style={{ left: "calc(50% - 360px - 18rem - 8px)" }} /* 18rem = w-72 */
                        >
                            <div className="font-semibold text-sm tracking-wide uppercase text-black">Controls</div>

                            {/* Upload/Logo URL */}
                            <div className="space-y-1">
                                <div className="text-[11px] font-medium">Logo URL</div>
                                <input
                                    className="w-full border rounded px-2 py-1 text-xs"
                                    placeholder="https://..."
                                    value={brandAssets.logo_url || ""}
                                    onChange={(e) => setBrandAssets((a) => ({ ...a, logo_url: e.target.value }))}
                                />
                            </div>

                            {/* Show toggles */}
                            <div className="space-y-1">
                                <div className="text-[11px] font-medium">Show Sections</div>
                                <label className="flex items-center gap-2 text-xs text-black">
                                    <input
                                        type="checkbox"
                                        checked={tabsEnabled.demos}
                                        onChange={(e) => setTabsEnabled((t) => ({ ...t, demos: e.target.checked }))}
                                    />{" "}
                                    Browse Demos
                                </label>
                                <label className="flex items-center gap-2 text-xs text-black">
                                    <input
                                        type="checkbox"
                                        checked={tabsEnabled.docs}
                                        onChange={(e) => setTabsEnabled((t) => ({ ...t, docs: e.target.checked }))}
                                    />{" "}
                                    Browse Documents
                                </label>
                                <label className="flex items-center gap-2 text-xs text-black">
                                    <input
                                        type="checkbox"
                                        checked={tabsEnabled.price}
                                        onChange={(e) => setTabsEnabled((t) => ({ ...t, price: e.target.checked }))}
                                    />{" "}
                                    Price Estimate
                                </label>
                                <label className="flex items-center gap-2 text-xs text-black">
                                    <input
                                        type="checkbox"
                                        checked={tabsEnabled.meeting}
                                        onChange={(e) => setTabsEnabled((t) => ({ ...t, meeting: e.target.checked }))}
                                    />{" "}
                                    Schedule Meeting
                                </label>
                            </div>

                            {/* Text editors toggles */}
                            <div className="space-y-1">
                                <div className="text-[11px] font-medium">Text Editors</div>
                                <button
                                    className="w-full text-left text-xs border rounded px-2 py-1"
                                    onClick={() => setEditing((e) => ({ ...e, welcome: !e.welcome }))}
                                >
                                    Edit Welcome Message
                                </button>
                                <button
                                    className="w-full text-left text-xs border rounded px-2 py-1"
                                    onClick={() => (setMode("price"), setEditing((e) => ({ ...e, priceIntro: true })))}
                                >
                                    Edit Price Introduction
                                </button>
                                <button
                                    className="w-full text-left text-xs border rounded px-2 py-1"
                                    onClick={() => (setMode("price"), setEditing((e) => ({ ...e, priceOutro: true })))}
                                >
                                    Edit Price CTA
                                </button>

                                <div className="text-[11px] font-medium mt-2">Intro Video Link</div>
                                <input
                                    className="w-full border rounded px-2 py-1 text-xs"
                                    placeholder="https://..."
                                    value={introVideoUrl || ""}
                                    onChange={(e) => setIntroVideoUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Right color picker rail — anchored relative to the 720px app container */}
                        <div
                            className="fixed top-20 z-[9999] bg-white/90 backdrop-blur-sm border rounded-xl shadow p-4 w-72 space-y-2 max-h-[75vh] overflow-auto text-black"
                            style={{ left: "calc(50% + 360px + 8px)" }}
                        >
                            <div className="font-semibold text-xs tracking-wide uppercase text-black">Colors</div>

                            <label className="flex items-center justify-between text-xs text-black">
                                Banner Title
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--banner-fg"] || themeVars["--banner-fg"]}
                                    onChange={(e) => updateCssVar("--banner-fg", e.target.value)}
                                />
                            </label>
                            <label className="flex items-center justify-between text-xs text-black">
                                Banner Background
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--banner-bg"] || themeVars["--banner-bg"]}
                                    onChange={(e) => updateCssVar("--banner-bg", e.target.value)}
                                />
                            </label>

                            <div className="border-t border-black/10 my-1" />

                            <label className="flex items-center justify-between text-xs text-black">
                                Tab Titles
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--tab-active-fg"] || themeVars["--tab-active-fg"]}
                                    onChange={(e) => updateCssVar("--tab-active-fg", e.target.value)}
                                />
                            </label>
                            <label className="flex items-center justify-between text-xs text-black">
                                Tab Background
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--tab-active-bg"] || themeVars["--tab-active-bg"]}
                                    onChange={(e) => updateCssVar("--tab-active-bg", e.target.value)}
                                />
                            </label>

                            <div className="border-t border-black/10 my-1" />

                            <label className="flex items-center justify-between text-xs text-black">
                                Card Background
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--card-bg"] || themeVars["--card-bg"]}
                                    onChange={(e) => updateCssVar("--card-bg", e.target.value)}
                                />
                            </label>
                            <label className="flex items-center justify-between text-xs text-black">
                                Message Field BG
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--field-bg"] || themeVars["--field-bg"]}
                                    onChange={(e) => updateCssVar("--field-bg", e.target.value)}
                                />
                            </label>

                            <div className="border-t border-black/10 my-1" />

                            <label className="flex items-center justify-between text-xs text-black">
                                Send Button
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--send-color"] || themeVars["--send-color"]}
                                    onChange={(e) => updateCssVar("--send-color", e.target.value)}
                                />
                            </label>
                            <label className="flex items-center justify-between text-xs text-black">
                                Send Hover
                                <input
                                    type="color"
                                    value={brandDraft.css_vars["--send-color-hover"] || themeVars["--send-color-hover"]}
                                    onChange={(e) => updateCssVar("--send-color-hover", e.target.value)}
                                />
                            </label>
                        </div>
                    </>
                ) : null}

                <div className="text-gray-800 text-center space-y-2">
                    <div className="text-lg font-semibold">No bot selected</div>
                    {alias ? (
                        <div className="text-sm text-gray-600">Resolving alias “{alias}”...</div>
                    ) : (
                        <div className="text-sm text-gray-600">
                            Provide a <code>?bot_id=…</code> or <code>?alias=…</code> in the URL
                            {defaultAlias ? <> (trying default alias “{defaultAlias}”)</> : null}.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // [SECTION 5 END]

// [SECTION 6 BEGIN]

  const showAskBottom = mode !== "price" || !!priceEstimate;
  const embedDomain = typeof window !== "undefined" ? window.location.hostname : "";

  const logoSrc =
    brandAssets.logo_url ||
    brandAssets.logo_light_url ||
    brandAssets.logo_dark_url ||
    "";

  return (
    <div
      className={classNames(
        "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
        brandReady ? "opacity-100" : "opacity-0"
      )}
      style={themeVars}
    >
      {/* BRANDING RAILS (anchored to the 720px app container) */}
      {brandingMode ? (
        <>
          {/* Left control rail — left of the 720px card, 8px gap */}
          <div
            className="fixed top-20 z-[9999] bg-white/90 backdrop-blur-sm border rounded-xl shadow p-4 w-72 space-y-3 max-h-[75vh] overflow-auto text-black"
            style={{ left: "calc(50% - 360px - 18rem - 8px)" }}
          >
            <div className="font-semibold text-xs tracking-wide uppercase text-black">Controls</div>

            {/* Show toggles */}
            <div className="space-y-1">
              <div className="text-[11px] font-medium">Show Sections</div>
              <label className="flex items-center justify-between text-[12px]">
                <span>Browse Demos</span>
                <input
                  type="checkbox"
                  checked={!!tabsEnabled.demos}
                  onChange={(e) => setTabsEnabled((t) => ({ ...t, demos: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between text-[12px]">
                <span>Browse Documents</span>
                <input
                  type="checkbox"
                  checked={!!tabsEnabled.docs}
                  onChange={(e) => setTabsEnabled((t) => ({ ...t, docs: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between text-[12px]">
                <span>Price Estimate</span>
                <input
                  type="checkbox"
                  checked={!!tabsEnabled.price}
                  onChange={(e) => setTabsEnabled((t) => ({ ...t, price: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between text-[12px]">
                <span>Schedule Meeting</span>
                <input
                  type="checkbox"
                  checked={!!tabsEnabled.meeting}
                  onChange={(e) => setTabsEnabled((t) => ({ ...t, meeting: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between text-[12px]">
                <span>Intro Video</span>
                <input
                  type="checkbox"
                  checked={!!showIntroVideo}
                  onChange={(e) => setShowIntroVideo(e.target.checked)}
                />
              </label>
            </div>

            {/* Text Editors */}
            <div className="space-y-1">
              <div className="text-[11px] font-medium">Text Editors</div>
              <button
                className="w-full text-left border rounded-md px-2 py-1 text-[12px]"
                onClick={() => setEditing((e) => ({ ...e, welcome: !e.welcome }))}
              >
                Edit Welcome Message
              </button>
              <button
                className="w-full text-left border rounded-md px-2 py-1 text-[12px]"
                onClick={() => setEditing((e) => ({ ...e, priceIntro: true }))}
              >
                Edit Price Introduction
              </button>
              <button
                className="w-full text-left border rounded-md px-2 py-1 text-[12px]"
                onClick={() => setEditing((e) => ({ ...e, priceOutro: true }))}
              >
                Edit Price CTA
              </button>
            </div>
          </div>

          {/* Right color rail — right of the 720px card, 8px gap */}
          <div
            className="fixed top-20 z-[9999] bg-white/90 backdrop-blur-sm border rounded-xl shadow p-4 w-72 space-y-2 max-h-[75vh] overflow-auto text-black"
            style={{ left: "calc(50% + 360px + 8px)" }}
          >
            <div className="font-semibold text-xs tracking-wide uppercase text-black">Colors</div>

            <label className="flex items-center justify-between text-xs">
              Banner Title
              <input
                type="color"
                value={brandDraft.css_vars["--banner-fg"] || themeVars["--banner-fg"]}
                onChange={(e) => updateCssVar("--banner-fg", e.target.value)}
              />
            </label>
            <label className="flex items-center justify-between text-xs">
              Banner Background
              <input
                type="color"
                value={brandDraft.css_vars["--banner-bg"] || themeVars["--banner-bg"]}
                onChange={(e) => updateCssVar("--banner-bg", e.target.value)}
              />
            </label>

            <div className="border-t border-black/10 my-1" />

            <label className="flex items-center justify-between text-xs">
              Tab Titles
              <input
                type="color"
                value={brandDraft.css_vars["--tab-active-fg"] || themeVars["--tab-active-fg"]}
                onChange={(e) => updateCssVar("--tab-active-fg", e.target.value)}
              />
            </label>
            <label className="flex items-center justify-between text-xs">
              Tab Background
              <input
                type="color"
                value={brandDraft.css_vars["--tab-active-bg"] || themeVars["--tab-active-bg"]}
                onChange={(e) => updateCssVar("--tab-active-bg", e.target.value)}
              />
            </label>

            <div className="border-t border-black/10 my-1" />

            <label className="flex items-center justify-between text-xs">
              Card Background
              <input
                type="color"
                value={brandDraft.css_vars["--card-bg"] || themeVars["--card-bg"]}
                onChange={(e) => updateCssVar("--card-bg", e.target.value)}
              />
            </label>
            <label className="flex items-center justify-between text-xs">
              Message Field BG
              <input
                type="color"
                value={brandDraft.css_vars["--field-bg"] || themeVars["--field-bg"]}
                onChange={(e) => updateCssVar("--field-bg", e.target.value)}
              />
            </label>

            <div className="border-t border-black/10 my-1" />

            <label className="flex items-center justify-between text-xs">
              Send Button
              <input
                type="color"
                value={brandDraft.css_vars["--send-color"] || themeVars["--send-color"]}
                onChange={(e) => updateCssVar("--send-color", e.target.value)}
              />
            </label>
            <label className="flex items-center justify-between text-xs">
              Send Hover
              <input
                type="color"
                value={brandDraft.css_vars["--send-color-hover"] || themeVars["--send-color-hover"]}
                onChange={(e) => updateCssVar("--send-color-hover", e.target.value)}
              />
            </label>
          </div>
        </>
      ) : null}

      {/* Main card */}
      <div className="w-full max-w-[720px] h-[100dvh] md:h-[96dvh] bg-white border border-[var(--card-border)] md:rounded-[var(--radius-card)] [box-shadow:var(--shadow-card)] flex flex-col transition-all duration-300">
        {/* Header */}
        <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)]">
          <div className="flex items-center justify-between w-full py-3">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Brand logo" className="h-10 object-contain" />
            </div>
            <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">
              {selected
                ? selected.title
                : mode === "browse"
                ? "Browse Demos"
                : mode === "docs"
                ? "Browse Documents"
                : mode === "price"
                ? "Price Estimate"
                : mode === "meeting"
                ? "Schedule Meeting"
                : "Ask the Assistant"}
            </div>
          </div>
          <TabsNav mode={mode} tabs={tabs} />
        </div>

        {/* PRICE MODE */}
        {mode === "price" ? (
          <>
            <div className="px-6 pt-3 pb-2" data-patch="price-intro">
              <PriceMirror lines={mirrorLines.length ? mirrorLines : null} />
              {!mirrorLines.length ? (
                <div className="text-black text-base font-bold whitespace-pre-line">
                  {((priceUiCopy?.intro?.heading || "").trim()
                    ? `${priceUiCopy.intro.heading.trim()}\n\n`
                    : "") +
                    (priceUiCopy?.intro?.body ||
                      "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation.")}
                </div>
              ) : null}
            </div>
            <div ref={priceScrollRef} className="px-6 pt-0 pb-6 flex-1 overflow-y-auto">
              {!priceQuestions?.length ? null : nextPriceQuestion ? (
                <QuestionBlock
                  q={nextPriceQuestion}
                  value={priceAnswers[nextPriceQuestion.q_key]}
                  onPick={handlePickOption}
                />
              ) : (
                <EstimateCard
                  estimate={priceEstimate}
                  outroText={
                    ((priceUiCopy?.outro?.heading || "").trim()
                      ? `${priceUiCopy.outro.heading.trim()}\n\n`
                      : "") + (priceUiCopy?.outro?.body || "")
                  }
                />
              )}
              {priceBusy ? <div className="mt-2 text-sm text-gray-500">Calculating…</div> : null}
              {priceErr ? <div className="mt-2 text-sm text-red-600">{priceErr}</div> : null}
            </div>
          </>
        ) : (
          /* OTHER MODES */
          <div ref={contentRef} className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
            {mode === "meeting" ? (
              <div className="w-full flex-1 flex flex-col" data-patch="meeting-pane">
                <div className="bg-white pt-2 pb-2">
                  {agent?.schedule_header ? (
                    <div className="mb-2 text-sm italic text-gray-600 whitespace-pre-line">
                      {agent.schedule_header}
                    </div>
                  ) : null}
                  
                    {/* END OF SECTION 6 */}

                    {/* BEGIN SECTION 7 */}
                    
                    {/* calendar_link_type handling */}
                  {!agent ? (
                    <div className="text-sm text-gray-600">Loading scheduling…</div>
                  ) : agent.calendar_link_type &&
                    String(agent.calendar_link_type).toLowerCase() === "embed" &&
                    agent.calendar_link ? (
                    <iframe
                      title="Schedule a Meeting"
                      src={`${agent.calendar_link}?embed_domain=${embedDomain}&embed_type=Inline`}
                      style={{ width: "100%", height: "60vh", maxHeight: "640px" }}
                      className="rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                    />
                  ) : agent.calendar_link_type &&
                    String(agent.calendar_link_type).toLowerCase() === "external" &&
                    agent.calendar_link ? (
                    <div className="text-sm text-gray-700">
                      We opened the scheduling page in a new tab. If it didn’t open,&nbsp;
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
                    <div className="text-sm text-gray-600">No scheduling link is configured.</div>
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="w-full flex-1 flex flex-col">
                {mode === "docs" ? (
                  <div className="bg-white pt-2 pb-2">
                    <iframe
                      className="w-full h-[65vh] md:h-[78vh] rounded-xl border border-gray-200 shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                      src={selected.url}
                      title={selected.title}
                    />
                  </div>
                ) : (
                  <div className="bg-white pt-2 pb-2">
                    <div style={{ position: "relative", paddingTop: "56.25%" }}>
                      <iframe
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        src={selected.url}
                        title={selected.title}
                        className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    {mode === "ask" && (visibleUnderVideo || []).length > 0 && (
                      <>
                        <div className="flex items-center justify-between mt-1 mb-3">
                          <p className="italic text-gray-600">Recommended demos</p>
                          <span />
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
                )}
              </div>
            ) : mode === "browse" ? (
              <div className="w-full flex-1 flex flex-col">
                {(browseItems || []).length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-2 mb-3">
                      <p className="italic text-gray-600">Select a demo to view it</p>
                      <span />
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
                      <p className="italic text-gray-600">Select a document to view it</p>
                      <span />
                    </div>
                    <div className="flex flex-col gap-3">
                      {browseDocs.map((it) => (
                        <Row
                          key={it.id || it.url || it.title}
                          item={it}
                          variant="docs"
                          onPick={(val) => {
                            setSelected(val);
                            requestAnimationFrame(() =>
                              contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
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
                    <div className="text-black text-base font-bold whitespace-pre-line">{responseText}</div>
                    {showIntroVideo && introVideoUrl ? (
                      <div style={{ position: "relative", paddingTop: "56.25%" }}>
                        <iframe
                          src={introVideoUrl}
                          title="Intro Video"
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="bg-white rounded-lg px-4 py-3 min-h-[90px] flex items-center">
                  {loading ? (
                    <p className="text-gray-500 font-semibold animate-pulse">Thinking…</p>
                  ) : lastQuestion ? (
                    <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                  ) : null}
                </div>
                {helperPhase !== "hidden" && (
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-gray-600">Recommended demos</p>
                    <span />
                  </div>
                )}
                {helperPhase === "buttons" && (items || []).length > 0 && (
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row key={it.id || it.url || it.title} item={it} onPick={(val) => normalizeAndSelectDemo(val)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Ask Bar */}
        <div className="px-4 py-3 border-t border-gray-200" data-patch="ask-bottom-bar">
          {showAskBottom ? (
            <div className="relative w-full">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full border border-[var(--field-border)] rounded-lg px-4 py-2 pr-14 text-base text-black placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--field-bg)]"
                placeholder="Ask your question here"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={(e) => {
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                aria-label="Send"
                onClick={sendMessage}
                className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-95"
              >
                <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:text-[var(--send-color-hover)]" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
// [SECTION 7 END]
