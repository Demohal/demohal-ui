import {
  DEFAULT_THEME_VARS,
  TOKEN_TO_CSS,
  SCREEN_ORDER,
  classNames,
  inverseBW,
  UI,
  Row,
  OptionButton,
  PriceMirror,
  EstimateCard,
  normalizeOptions,
  QuestionBlock,
  TabsNav
} from "./AskAssistant/AskAssistant.ui";

import DocIframe from "./AskAssistant/widgets/DocIframe";
import ColorBox from "./AskAssistant/widgets/ColorBox";
import DebugPanel from "./AskAssistant/widgets/DebugPanel";


/* =================== *
 *  MAIN APP COMPONENT *
 * =================== */

export default function AskAssistant() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // URL → alias / bot_id / themelab
  const { alias, botIdFromUrl, themeLabOn } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = (qs.get("alias") || qs.get("alais") || "").trim();
    const b = (qs.get("bot_id") || "").trim();
    const th = (qs.get("themelab") || "").trim();
    return {
      alias: a,
      botIdFromUrl: b,
      themeLabOn: th === "1" || th.toLowerCase() === "true",
    };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();

  const [botId, setBotId] = useState(botIdFromUrl || "");
  const [fatal, setFatal] = useState("");

  const [mode, setMode] = useState("ask");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [responseText, setResponseText] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [browseDocs, setBrowseDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  const [helperPhase, setHelperPhase] = useState("hidden");
  const [isAnchored, setIsAnchored] = useState(false);

  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const frameRef = useRef(null); // context card container (for ColorBox placement)
  const priceScrollRef = useRef(null);

  // NEW: visitor/session identity
  const [visitorId, setVisitorId] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Theme vars (DB → in-memory → derived → live with picker overrides)
  const [themeVars, setThemeVars] = useState(DEFAULT_THEME_VARS);
  const derivedTheme = useMemo(() => {
    const activeFg = inverseBW(themeVars["--tab-fg"] || "#000000");
    return { ...themeVars, "--tab-active-fg": activeFg };
  }, [themeVars]);

  // picker overrides (live preview)
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

  // Pricing state
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
  const [agent, setAgent] = useState(null);
  const mirrorLines = useMemo(() => {
  const qs = Array.isArray(priceQuestions) ? priceQuestions : [];
  const out = [];
  for (const q of qs) {
    const key = q?.q_key;
    if (!key) continue;
    const val = priceAnswers?.[key];
    const isMulti = String(q?.type || "").toLowerCase().includes("multi");
    const has = isMulti ? Array.isArray(val) && val.length > 0 : val != null && val !== "";
    if (!has) continue;
    const label = q?.prompt || q?.label || key;
    const display = isMulti ? val.join(", ") : String(val);
    out.push(`${label}: ${display}`);
    }
    return out;
  }, [priceQuestions, priceAnswers]);
  const nextPriceQuestion = useMemo(() => {
  const qs = Array.isArray(priceQuestions) ? priceQuestions : [];
  for (const q of qs) {
    const key = q?.q_key;
    if (!key) continue;
    const val = priceAnswers?.[key];
    const isMulti = String(q?.type || "").toLowerCase().includes("multi");
    const answered = isMulti ? Array.isArray(val) && val.length > 0 : val != null && val !== "";
    if (!answered) return q;
    }
    return null;
  }, [priceQuestions, priceAnswers]);


  // Screen-scoped chat context (reset after each answer)
  const [scopePayload, setScopePayload] = useState({ scope: "standard" });


  // Small helpers to always attach identity in requests
  const withIdsQS = (url) => {
    const u = new URL(url, window.location.origin);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (visitorId) u.searchParams.set("visitor_id", visitorId);
    return u.toString();
  };
  const withIdsBody = (obj) => ({
    ...obj,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
  });
  const withIdsHeaders = () => ({
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    ...(visitorId ? { "X-Visitor-Id": visitorId } : {}),
  });
  // Update scope when entering Demo/Doc views
  useEffect(() => {
    if (selected && selected.id && mode === "docs") {
      setScopePayload({ scope: "doc", doc_id: String(selected.id) });
    } else if (selected && selected.id && mode !== "docs") {
      setScopePayload({ scope: "demo", demo_id: String(selected.id) });
    } else {
      setScopePayload({ scope: "standard" });
    }
  }, [selected, mode]);


  // Resolve bot by alias
  useEffect(() => {
    if (botId) return;
    if (!alias) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`
        );
        const data = await res.json();
        if (cancel) return;
        const id = data?.ok ? data?.bot?.id : null;

        // NEW: capture visitor/session ids
        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
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
    return () => {
      cancel = true;
    };
  }, [alias, apiBase, botId]);

  // Try default alias if needed
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
        const id = data?.ok ? data?.bot?.id : null;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
        if (id) setBotId(id);
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [botId, alias, defaultAlias, apiBase]);

  // If we start with bot_id in URL, load settings that way (and init visitor/session)
  useEffect(() => {
    if (!botIdFromUrl) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`
        );
        const data = await res.json();
        if (cancel) return;

        if (data?.ok) {
          setVisitorId(data.visitor_id || "");
          setSessionId(data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
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
  }, [botIdFromUrl, apiBase]);

  useEffect(() => {
    if (!botId && !alias && !brandReady) setBrandReady(true);
  }, [botId, alias, brandReady]);

  // Brand: css vars + assets
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

  // Tab flags (by bot_id)
  useEffect(() => {
    if (!botId) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botId)}`
        );
        const data = await res.json();

        if (cancel) return;

        if (data?.ok) {
          setVisitorId((v) => v || data.visitor_id || "");
          setSessionId((s) => s || data.session_id || "");
        }

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
          // PRICING COPY from /bot-settings
          setPricingCopy({
            intro: b.pricing_intro || "",
            outro: b.pricing_outro || "",
            custom_notice: b.pricing_custom_notice || "",
          });
        }
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [botId, apiBase]);

  // Autosize ask box
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

/* ================================================================================= *
 *  BEGIN SECTION 3                                                                  *
 * ================================================================================= */
// release sticky when scrolling
useEffect(() => {
  const el = contentRef.current;
  if (!el || !selected) return;
  const onScroll = () => {
    if (el.scrollTop > 8 && isAnchored) setIsAnchored(false);
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => el.removeEventListener("scroll", onScroll);
}, [selected, isAnchored]);

// Calendly booking listener — send rich payload to backend (no Calendly fetch)
useEffect(() => {
  if (mode !== "meeting" || !botId || !sessionId || !visitorId) return;

  function onCalendlyMessage(e) {
    try {
      const m = e?.data;
      if (!m || typeof m !== "object") return;

      // We only care about these two events
      if (m.event !== "calendly.event_scheduled" && m.event !== "calendly.event_canceled") return;

      const p = m.payload || {};

      // Build a rich, self-contained payload from the postMessage
      const payloadOut = {
        event: m.event, // e.g., "calendly.event_scheduled"
        scheduled_event: p.event || p.scheduled_event || null, // mirrors what Calendly sends
        invitee: {
          uri: p.invitee?.uri ?? null,
          email: p.invitee?.email ?? null,
          name: p.invitee?.full_name ?? p.invitee?.name ?? null,
        },
        questions_and_answers:
          p.questions_and_answers ??
          p.invitee?.questions_and_answers ??
          [],
        tracking: p.tracking || {}, // utm_* fields if present
      };

      // Forward to backend (no Calendly API calls in the browser)
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
    } catch {
      // swallow — non-blocking telemetry
    }
  }

  window.addEventListener("message", onCalendlyMessage);
  return () => window.removeEventListener("message", onCalendlyMessage);
}, [mode, botId, sessionId, visitorId, apiBase]);

async function normalizeAndSelectDemo(item) {
  try {
    const r = await fetch(`${apiBase}/render-video-iframe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...withIdsHeaders(),
      },
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

  /* ================================================================================= *
   * END SECTION 3                                                                     *
   * ================================================================================= */
  
  /* ================================================================================= *
 *  BEGIN SECTION 4                                                                  *
 * ================================================================================= */

function handlePickOption(q, opt) {
  const isMulti = String(q?.type || "").toLowerCase().includes("multi");
  setPriceAnswers((prev) => {
    if (isMulti) {
      const curr = Array.isArray(prev[q.q_key]) ? prev[q.q_key] : [];
      const exists = curr.includes(opt.key);
      const next = exists ? curr.filter((k) => k !== opt.key) : [...curr, opt.key];
      return { ...prev, [q.q_key]: next };
    }
    return { ...prev, [q.q_key]: opt.key };
  });
}

// Ask flow
async function sendMessage() {
  if (!input.trim() || !botId) return;
  const outgoing = input.trim();
  
  // Capture screen-scoped context synchronously at submit time
  const commitScope = (() => {
    let scope = "standard";
    let demo_id, doc_id;
    if (selected && selected.id && mode === "docs") {
      scope = "doc";
      doc_id = String(selected.id);
    } else if (selected && selected.id && mode !== "docs") {
      scope = "demo";
      demo_id = String(selected.id);
    }
    return { scope, ...(demo_id ? { demo_id } : {}), ...(doc_id ? { doc_id } : {}) };
  })();
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
      withIdsBody({ bot_id: botId, user_question: outgoing, ...commitScope, debug: true }),
      { timeout: 30000, headers: withIdsHeaders() }
    );
    const data = res?.data || {};
    setDebugInfo(data?.debug || null);

    const text = data?.response_text || "";
    const recSource = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.buttons)
      ? data.buttons
      : [];

    const recs = (Array.isArray(recSource) ? recSource : [])
      .map((it) => {
        const id = it.id ?? it.button_id ?? it.value ?? it.url ?? it.title;
        const title =
          it.title ??
          it.button_title ??
          (typeof it.label === "string"
            ? it.label.replace(/^Watch the \"|\" demo$/g, "")
            : it.label) ??
          "";
        const url = it.url ?? it.value ?? it.button_value ?? "";
        const description =
          it.description ?? it.summary ?? it.functions_text ?? "";
        const action = it.action ?? it.button_action ?? "demo";
        return {
          id,
          title,
          url,
          description,
          functions_text: it.functions_text ?? description,
          action,
        };
      })
      .filter((b) => {
        const act = (b.action || "").toLowerCase();
        const lbl = (b.title || "").toLowerCase();
        return (
          act !== "continue" &&
          act !== "options" &&
          lbl !== "continue" &&
          lbl !== "show me options"
        );
      });

    setResponseText(text);
    setLoading(false);
    // Reset scope to standard after completing the response
    setScopePayload({ scope: "standard" });

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

    requestAnimationFrame(() =>
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  } catch {
    setLoading(false);
    setScopePayload({ scope: "standard" });
    setResponseText("Sorry—something went wrong.");
    setHelperPhase("hidden");
    setItems([]);
  }
}

const listSource = mode === "browse" ? browseItems : items;
const askUnderVideo = useMemo(() => {
  if (!selected) return items;
  const selKey = selected.id ?? selected.url ?? selected.title;
  return (items || []).filter(
    (it) => (it.id ?? it.url ?? it.title) !== selKey
  );
}, [selected, items]);
const visibleUnderVideo = selected ? (mode === "ask" ? askUnderVideo : []) : listSource;

const tabs = useMemo(() => {
  const out = [];
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
      onClick: () => {
        setSelected(null);
        setMode("price");
      },
    });
  if (tabsEnabled.meeting)
    out.push({ key: "meeting", label: "Schedule Meeting", onClick: openMeeting });
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

const showAskBottom = mode !== "price" || !!priceEstimate;
const embedDomain =
  typeof window !== "undefined" ? window.location.hostname : "";

const logoSrc =
  brandAssets.logo_url ||
  brandAssets.logo_light_url ||
  brandAssets.logo_dark_url ||
  fallbackLogo;

return (
  <div
    className={classNames(
      "w-screen min-h-[100dvh] h-[100dvh] bg-[var(--page-bg)] p-0 md:p-2 md:flex md:items-center md:justify-center transition-opacity duration-200",
      brandReady ? "opacity-100" : "opacity-0"
    )}
    style={liveTheme}
  >
    <div
      ref={frameRef}
      className="w-full max-w-[720px] h-[100dvh] md:h-[90vh] md:max-h-none bg-[var(--card-bg)] rounded-[0.75rem] [box-shadow:var(--shadow-elevation)] flex flex-col overflow-hidden transition-all duration-300"
    >
      {/* Header */}
      <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]"> 
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
            <PriceMirror lines={[]} />
            {!mirrorLines.length ? (
              <div className="text-base font-bold whitespace-pre-line text-[var(--message-fg)]">
                {pricingCopy?.intro ||
                  "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation."}
              </div>
            ) : null}
          </div>
          <div
            ref={priceScrollRef}
            className="px-6 pt-0 pb-6 flex-1 overflow-y-auto"
          >
            {!priceQuestions?.length ? (
              <div className="text-sm text-[var(--helper-fg)]">
                Loading questions…
              </div>
            ) : nextPriceQuestion ? (
              <QuestionBlock
                q={nextPriceQuestion}
                value={priceAnswers[nextPriceQuestion.q_key]}
                onPick={handlePickOption}
              />
            ) : priceEstimate && priceEstimate.custom ? (
              <div className="text-base font-bold whitespace-pre-line text-[var(--message-fg)]">
                {pricingCopy?.custom_notice ||
                  "We’ll follow up with a custom quote tailored to your selection."}
              </div>
            ) : (
              <EstimateCard
                estimate={priceEstimate}
                outroText={pricingCopy?.outro || ""}
              />
            )}
            {priceBusy ? (
              <div className="mt-2 text-sm text-[var(--helper-fg)]">
                Calculating…
              </div>
            ) : null}
            {priceErr ? (
              <div className="mt-2 text-sm text-red-600">{priceErr}</div>
            ) : null}
          </div>
        </>
      ) : (
          <div
            ref={contentRef}
            className="px-6 pt-3 pb-6 flex-1 flex flex-col space-y-4 overflow-y-auto"
          >
            {mode === "meeting" ? (
              <div className="w-full flex-1 flex flex-col" data-patch="meeting-pane">
                <div className="bg-[var(--card-bg)] pt-2 pb-2">
                  {agent?.schedule_header ? (
                    <div className="mb-2 text-sm italic whitespace-pre-line text-[var(--helper-fg)]">
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
                      src={`${agent.calendar_link}${agent.calendar_link.includes('?') ? '&' : '?'}embed_domain=${embedDomain}&embed_type=Inline&session_id=${encodeURIComponent(sessionId||'')}&visitor_id=${encodeURIComponent(visitorId||'')}&bot_id=${encodeURIComponent(botId||'')}&utm_source=${encodeURIComponent(botId||'')}&utm_medium=${encodeURIComponent(sessionId||'')}&utm_campaign=${encodeURIComponent(visitorId||'')}`}
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
              </div>
            ) : selected ? (
              <div className="w-full flex-1 flex flex-col">
                {mode === "docs" ? (
                  <DocIframe
                    apiBase={apiBase}
                    botId={botId}
                    doc={selected}
                    sessionId={sessionId}
                    visitorId={visitorId}
                  />
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
                            // Call /render-doc-iframe so server can log doc_open
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
                                      url: val.url || "", // fallback if server needs it
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
                              // Fallback: still show the doc URL
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
                    <div className="text-base font-bold whitespace-pre-line text-[var(--message-fg)]">
                      {responseText}
                    </div>
                    <DebugPanel debug={debugInfo} />
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
                    <p className="text-base font-bold whitespace-pre-line text-[var(--message-fg)]">
                      {responseText}
                    </p>
                  ) : null}
                </div>
                {helperPhase !== "hidden" && (
                  <div className="flex items-center justify-between mt-3 mb-2">
                    <p className="italic text-[var(--helper-fg)]">
                      Recommended demos
                    </p>
                  </div>
                )}
                {helperPhase === "buttons" && (items || []).length > 0 && (
                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <Row
                        key={it.id || it.url || it.title}
                        item={it}
                        onPick={(val) => normalizeAndSelectDemo(val)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Bottom Ask Bar — divider only */}
        <div
          className="px-4 py-3 border-t border-[var(--border-default)]"
          data-patch="ask-bottom-bar"
        >
          {showAskBottom ? (
            <div className="relative w-full">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full rounded-[0.75rem] px-4 py-2 pr-14 text-base placeholder-gray-400 resize-y min-h-[3rem] max-h-[160px] bg-[var(--card-bg)] border border-[var(--border-default)] focus:border-[var(--border-default)] focus:ring-1 focus:ring-[var(--border-default)] outline-none"
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
                <ArrowUpCircleIcon className="w-8 h-8 text-[var(--send-color)] hover:brightness-110" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {/* ThemeLab (enable with ?themelab=1) — ColorBox only */}
      {themeLabOn && botId ? (
        <ColorBox
          apiBase={apiBase}
          botId={botId}
          frameRef={frameRef}
          onVars={(vars) => setPickerVars(vars)}
        />
      ) : null}
    </div>
  );
}    

/* ================================================================================= *
* END SECTION 5                                                                     *
* ================================================================================= */
