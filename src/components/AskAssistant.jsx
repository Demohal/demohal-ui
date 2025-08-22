# =====================================================================
# BEGIN FILE: app/routes.py  (DemoHAL – Retrofit: New UI + Old Assistant Behavior)
# =====================================================================

# ===== SECTION 1: IMPORTS & GLOBAL CONFIG =============================
import os
import json
import time
import uuid
import re
from typing import Any, Dict, List, Optional
from collections import defaultdict

from flask import Blueprint, jsonify, request, current_app
from supabase import create_client, Client
from openai import OpenAI

# ===== END SECTION 1 ==================================================


# ===== SECTION 2: BLUEPRINT & CLIENTS =================================
demo_hal_bp = Blueprint("demo_hal_bp", __name__)

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_API_KEY")
    or ""
)

# NOTE: Keep the previous writer model variable but comment it out per Sea Change.
# _WRITER_MODEL = os.getenv("WRITER_MODEL", "gpt-4o")  # (legacy: functions canon)

# === Production parity (take verbatim from prod): ===
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o")
DEBUG_COMPLETIONS = os.getenv("DEBUG_COMPLETIONS", "1") == "1"

_OA_TIMEOUT = float(os.getenv("OA_TIMEOUT", "20"))

_sb: Optional[Client] = None

def sb() -> Client:
    global _sb
    if _sb is None:
        if not _SUPABASE_URL or not _SUPABASE_KEY:
            raise RuntimeError("Supabase client not configured")
        _sb = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _sb

_oa = OpenAI()  # requires OPENAI_API_KEY

# ===== END SECTION 2 ==================================================


# ===== SECTION 3: UTILS ===============================================

def _log(msg: str):
    try:
        current_app.logger.warning(msg)
    except Exception:
        print(msg)


def _now() -> str:
    return f"{time.time():.3f}"


def _short(text: str, n: int) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    return text if len(text) <= n else text[: n - 3] + "..."

# ===== END SECTION 3 ==================================================


# ===== SECTION 4: DATA HELPERS (Sea Change: no functions/supergroups) ===
# Everything below mirrors the production app’s data access and ranking.


def _fetch_all_demos(bot_id: str) -> List[Dict[str, Any]]:
    try:
        res = (
            sb()
            .table("demo_videos")
            .select("id, title, description, url, type, active")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        _log(f"[fetch_all_demos] error: {e}")
        return []



def _fetch_all_documents(bot_id: str) -> List[Dict[str, Any]]:
    try:
        res = (
            sb()
            .table("documents")
            .select("id, title, description, url, active")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .execute()
        )
        docs = res.data or []
        out = []
        for d in docs:
            out.append({
                "id": str(d.get("id") or d.get("url")),
                "title": d.get("title"),
                "url": d.get("url"),
                "description": d.get("description") or "",
                "type": "document"
            })
        return out
    except Exception as e:
        _log(f"[fetch_all_documents] error: {e}")
        return []


def _get_bot_settings(bot_id: str) -> Dict[str, Any]:
    """Return production-parity settings used by the assistant layer.
    Fields:
      - prompt_override (db text)
      - has_demos (bool)
    """
    try:
        r = (
            sb()
            .table("bots")
            .select("prompt_override, has_demos")
            .eq("id", bot_id)
            .single()
            .execute()
        )
        data = r.data or {}
        return {
            "prompt_override": data.get("prompt_override"),
            "has_demos": data.get("has_demos", True),
        }
    except Exception as e:
        _log(f"[get_bot_settings] warn: {e}")
        return {"prompt_override": None, "has_demos": True}


# Minimal in-memory cache for optional knowledge (mirrors prod behavior)
_demo_knowledge_cache: Dict[str, List[Dict[str, Any]] ] = {}


def _preload_knowledge(bot_id: str):
    try:
        res = (
            sb()
            .table("demo_knowledge")
            .select("id, content, active")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .execute()
        )
        _demo_knowledge_cache[bot_id] = res.data or []
    except Exception as e:
        _log(f"[preload_knowledge] error: {e}")
        _demo_knowledge_cache[bot_id] = []


def _rank_demos_by_question(demos: List[Dict[str, Any]], question: str, k: int = 24) -> List[Dict[str, Any]]:
    if not demos:
        return []
    q_words = set(re.findall(r"[a-z0-9]+", (question or "").lower()))

    def score(d: Dict[str, Any]) -> int:
        text = f"{d.get('title','')} {d.get('description','')}".lower()
        words = set(re.findall(r"[a-z0-9]+", text))
        return len(q_words & words)

    ranked = sorted(demos, key=score, reverse=True)
    return ranked[:k]


# ===== SECTION 5: MODEL CALL (production schema + tool) ===============

def _call_model_with_schema(system_text: str, user_text: str) -> Dict[str, Any]:
    """Call OpenAI using the production tool/function schema and parse output.
    Returns { ok: bool, args?: dict, raw?: str, error?: str }
    """
    tools = [{
        "type": "function",
        "function": {
            "name": "deliver_demo_answer",
            "description": "Return a short natural-language answer and a list of demos/documents to recommend.",
            "parameters": {
                "type": "object",
                "properties": {
                    "response_text": {"type": "string"},
                    "demos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["id", "action", "title"],
                            "properties": {
                                "id": {"type": "string"},
                                "action": {"type": "string", "enum": ["demo", "document"]},
                                "title": {"type": "string"}
                            }
                        }
                    }
                },
                "required": ["response_text", "demos"]
            }
        }
    }]

    resp = _oa.chat.completions.create(
        model=CHAT_MODEL,
        temperature=0.2,
        max_tokens=1100,
        tools=tools,
        tool_choice={"type": "function", "function": {"name": "deliver_demo_answer"}},
        messages=[
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
        ],
    )

    msg = resp.choices[0].message
    if DEBUG_COMPLETIONS:
        try:
            _log(f"USAGE: {resp.usage}")
        except Exception:
            pass

    # Tool call path
    if getattr(msg, "tool_calls", None):
        tc = msg.tool_calls[0]
        raw = (tc.function.arguments or "{}")
        if DEBUG_COMPLETIONS:
            _log(f"MODEL RAW (tool): {raw}")
        try:
            args = json.loads(raw)
            return {"ok": True, "args": args, "raw": raw}
        except Exception as e:
            return {"ok": False, "error": f"bad-tool-json: {e}", "raw": raw}

    # Content-as-JSON path
    content = (msg.content or "").strip()
    if DEBUG_COMPLETIONS:
        _log(f"MODEL RAW (content): {content}")
    try:
        if "```json" in content:
            s = content.find("```json") + len("```json")
            e = content.find("```", s)
            if e != -1:
                content = content[s:e].strip()
        data = json.loads(content)
        return {"ok": True, "args": data, "raw": content}
    except Exception as e:
        return {"ok": False, "error": f"no-tool-and-no-json: {e}", "raw": content}


# ===== SECTION 6: PUBLIC ENDPOINTS ====================================

@demo_hal_bp.get("/bot-by-alias")
def bot_by_alias():
    try:
        alias = (request.args.get("alias") or "").strip()
        r = sb().table("bots").select("*").eq("alias", alias).eq("active", True).limit(1).execute()
        rows = r.data or []
        if not rows:
            return jsonify({"error": "not found"}), 404
        return jsonify({"bot": rows[0]})
    except Exception as e:
        _log(f"[bot-by-alias] error: {e}")
        return jsonify({"error": "server error"}), 500


@demo_hal_bp.get("/browse-demos")
def browse_demos():
    """Return buttons for all active demos using the same schema as /demo-hal."""
    try:
        bot_id = (request.args.get("bot_id") or "").strip()
        if not bot_id:
            return jsonify({"buttons": [], "type": "browse_buttons"})
        demos = _fetch_all_demos(bot_id)
        demos.sort(key=lambda d: (d.get("title") or "").lower())
        buttons = []
        for d in demos:
            title = d.get("title")
            url = d.get("url")
            desc = d.get("description") or ""
            label = f'Watch the "{title}" demo'
            action = "demo"
            iid = d.get("id")
            buttons.append({
                "label": label,
                "action": action,
                "value": url,
                "title": title,
                "description": desc,
                # Duplicate keys for UI compatibility
                "button_label": label,
                "button_action": action,
                "button_value": url,
                "button_title": title,
                "summary": desc,
                "id": iid,
            })
        return jsonify({"buttons": buttons, "type": "browse_buttons"})
    except Exception as e:
        _log(f"[browse-demos] error: {e}")
        return jsonify({"buttons": [], "type": "browse_buttons"})
    """Sea Change: Return a flat list of demos only (no functions/supergroups).
    The previous function/industry grouping code is intentionally removed/commented.
    """
    try:
        bot_id = (request.args.get("bot_id") or "").strip()
        if not bot_id:
            return jsonify({"items": [], "demos": []})
        demos = _fetch_all_demos(bot_id)
        demos.sort(key=lambda d: (d.get("title") or "").lower())
        # items == demos for backward UI compatibility (title/url only)
        items = [{"id": d["id"], "title": d.get("title"), "url": d.get("url") } for d in demos]
        return jsonify({
            "items": items,
            "demos": [{"id": x["id"], "title": x.get("title"), "url": x.get("url")} for x in items],
            "type": "flat_items",
        })
    except Exception as e:
        _log(f"[browse-demos] error: {e}")
        return jsonify({"items": [], "demos": []})


@demo_hal_bp.post("/demo-hal")
def demo_hal():
    """Production behavior: new UI, old assistant logic.

    Request JSON:
      { bot_id, user_question (aka text/question), mode? }
    """
    try:
        payload = request.get_json(silent=True) or {}
        if DEBUG_COMPLETIONS:
            _log(f"=== /demo-hal {_now()} ===\nREQ: {payload}")

        mode = payload.get("mode")
        bot_id: str = (payload.get("bot_id") or "").strip()
        question: str = (
            payload.get("user_question")
            or payload.get("text")
            or payload.get("question")
            or ""
        ).strip()

        if not bot_id or not question:
            return jsonify({"error": "Missing bot_id or user_question"}), 400

        # Optional knowledge warm-up
        if mode == "preload":
            _preload_knowledge(bot_id)
            demos = _fetch_all_demos(bot_id)
            return jsonify({
                "status": "ok",
                "demos": len(demos),
                "knowledge": len(_demo_knowledge_cache.get(bot_id, []))
            })

        # Load production-parity settings
        settings = _get_bot_settings(bot_id)
        prompt_override = (settings.get("prompt_override") or "").strip()
        has_demos = settings.get("has_demos", True)

        demos = _fetch_all_demos(bot_id) if has_demos else []
        docs = _fetch_all_documents(bot_id) if has_demos else []

        if has_demos and not demos and not docs:
            return jsonify({
                "type": "message_only",
                "response_text": "Sorry - I could not load resources right now. Please try again."
            })

        # Ranked shortlist (title/description keyword overlap)
        top_demos = _rank_demos_by_question(demos, question, k=24)

        # Build the resource list the model must pick from
        resource_lines: List[str] = []
        for d in top_demos:
            desc = _short(d.get("description", ""), 120)
            resource_lines.append(
                f'- "{_short(d.get("title",""), 120)}" (type: demo, id: {d.get("id")}, url: {d.get("url")}) {desc}'
            )
        for doc in docs[:10]:
            resource_lines.append(
                f'- "{_short(doc.get("title",""), 120)}" (type: document, id: {doc.get("id")}, url: {doc.get("url")})'
            )

        # (Optional) lightweight knowledge lines
        kn = _demo_knowledge_cache.get(bot_id, [])[:3]
        knowledge_lines = [f'- {_short(k.get("content",""), 180)}' for k in kn]

        # === System & user text — copied from production logic ===
        system_text = (
            "You are a helpful sales assistant for WAC Solution Partners and Acumatica.\n"
            "- Keep answers concise and professional.\n"
            "- Do not thank the user and do not repeat the user question.\n"
            "- Recommend only from the resource list provided; never invent titles or URLs.\n"
            "- If price or cost is mentioned, end with: If you would like, you can talk to a product expert by clicking Show me options.\n"
            "- Always return your result by calling the function deliver_demo_answer."
        )

        user_text = ""
        if prompt_override:
            user_text += prompt_override + "\n\n"
        user_text += "User question:\n" + question + "\n\n"
        user_text += "Available resources:\n" + "\n".join(resource_lines[:34])
        if knowledge_lines:
            user_text += "\n\nAdditional product info:\n" + "\n".join(knowledge_lines)

        # Model call with tool schema
        result = _call_model_with_schema(system_text, user_text)
        if DEBUG_COMPLETIONS and not result.get("ok"):
            _log(f"MODEL ERR: {result.get('error')}")

        response_text = "Here are some resources that might help."
        picked: List[Dict[str, Any]] = []

        if result.get("ok"):
            args = result.get("args") or {}
            response_text = (args.get("response_text") or response_text).strip()
            if isinstance(args.get("demos"), list):
                picked = args["demos"]

        # Map ids to titles/urls/descriptions for button construction
        title_by_id = {d["id"]: d.get("title") for d in demos}
        url_by_id   = {d["id"]: d.get("url") for d in demos}
        desc_by_id  = {d["id"]: d.get("description") for d in demos}
        desc_by_id  = {d["id"]: d.get("description") for d in demos}
        for doc in docs:
            title_by_id[doc["id"]] = doc.get("title")
            url_by_id[doc["id"]]   = doc.get("url")
            # Intentionally do NOT add documents to desc_by_id

        buttons: List[Dict[str, Any]] = []
        for item in picked:
            iid = item.get("id")
            action = item.get("action")
            title = title_by_id.get(iid) or item.get("title")
            url = url_by_id.get(iid) or (iid if action == "document" else None)
            if not (iid and title):
                continue
            desc = desc_by_id.get(iid) if action != "document" else None
            label = f'Read "{title}"' if action == "document" else f'Watch the "{title}" demo'
            buttons.append({
                "label": label,
                "action": "document" if action == "document" else "demo",
                "value": url,
                "title": title,
                "description": (desc or ""),
                # Duplicate keys for UI compatibility
                "button_label": label,
                "button_action": "document" if action == "document" else "demo",
                "button_value": url,
                "button_title": title,
                "summary": (desc or ""),
                "id": iid
            })

        # Standard trailing buttons
        buttons.append({"label": "Continue", "action": "continue", "value": None})
        buttons.append({"label": "Show me options", "action": "options", "value": None})

        return jsonify({
            "type": "message_with_buttons",
            "response_text": response_text,
            "buttons": buttons,
        })

    except Exception as e:
        _log(f"[demo-hal] fatal: {e}")
        return jsonify({"error": "internal_error"}), 500


# === Optional parity helpers (kept for UI compatibility) ==============
@demo_hal_bp.post("/all-demos")
def all_demos():
    try:
        data = request.get_json(silent=True) or {}
        bot_id = data.get("bot_id")
        if not bot_id:
            return jsonify({"error": "Missing bot_id"}), 400
        demos = _fetch_all_demos(bot_id)
        buttons = [{
            "button_label": f'Watch the "{d["title"]}" demo',
            "button_value": d.get("url"),
            "button_title": d.get("title"),
            "button_action": "demo",
        } for d in demos]
        return jsonify({"type": "demo_list", "buttons": buttons})
    except Exception as e:
        return jsonify({"error": "Failed to retrieve demos", "details": str(e)}), 500


@demo_hal_bp.post("/all-docs")
def all_docs():
    try:
        data = request.get_json(silent=True) or {}
        bot_id = data.get("bot_id")
        if not bot_id:
            return jsonify({"error": "Missing bot_id"}), 400
        docs = _fetch_all_documents(bot_id)
        buttons = [{
            "button_label": f'Read "{d["title"]}"',
            "button_value": d.get("url"),
            "button_title": d.get("title"),
            "button_action": "document",
        } for d in docs]
        return jsonify({"type": "doc_list", "buttons": buttons})
    except Exception as e:
        return jsonify({"error": "Failed to retrieve documents", "details": str(e)}), 500


@demo_hal_bp.post("/render-video-iframe")
def render_video_iframe():
  try:
      data = request.get_json(silent=True) or {}
      video_url = data.get("video_url")
      if not video_url:
          return jsonify({"error": "Missing video_url"}), 400

      if "youtube.com" in video_url or "youtu.be" in video_url:
          vid = None
          if "youtu.be/" in video_url:
              vid = video_url.split("youtu.be/")[-1].split("?\")")[0]
          elif "v=" in video_url:
              vid = video_url.split("v=")[-1].split("&")[0]
          if not vid:
              return jsonify({"error": "Invalid YouTube URL"}), 400
          return jsonify({"video_url": f"https://www.youtube.com/embed/{vid}"})

      if "vimeo.com" in video_url:
          vid = video_url.split("/")[-1]
          return jsonify({"video_url": f"https://player.vimeo.com/video/{vid}"})

      if "wistia" in video_url:
          vid = video_url.rstrip("/").split("/")[-1]
          return jsonify({"video_url": f"https://fast.wistia.net/embed/iframe/{vid}"})

      return jsonify({"error": "Unsupported video type"}), 400
  except Exception as e:
      _log(f"[render-video-iframe] fatal: {e}")
      return jsonify({"error": "Server error", "details": str(e)}), 500


# =====================================================================
# Pricing Endpoints (no code sharing with other modules)
# =====================================================================

def _normalize_key(s: str) -> str:
    return (s or "").strip().lower().replace("-", "_").replace(" ", "_")


def _get_bot(alias: Optional[str], bot_id: Optional[str]) -> Optional[Dict[str, Any]]:
    try:
        if alias:
            r = sb().table("bots").select("id, alias, ui_copy, active").eq("alias", alias).eq("active", True).limit(1).execute()
            rows = r.data or []
            return rows[0] if rows else None
        if bot_id:
            r = sb().table("bots").select("id, alias, ui_copy, active").eq("id", bot_id).eq("active", True).single().execute()
            return r.data
    except Exception as e:
        _log(f"[_get_bot] {e}")
    return None


def _build_options_for_question(bot_id: str, question_id: str, q_key: str) -> List[Dict[str, Any]]:
    """Priority:
       1) price_options (if any)
       2) derive from price_products for edition-like q_keys
       3) derive from price_tiers for transaction/tier-like q_keys
    """
    try:
        r = (
            sb()
            .table("price_options")
            .select("id, opt_key, label, tooltip, sort_order")
            .eq("question_id", question_id)
            .order("sort_order", desc=False)
            .execute()
        )
        opts = r.data or []
        if opts:
            return [
                {
                    "id": str(o.get("id")),
                    "key": o.get("opt_key"),
                    "label": o.get("label"),
                    "tooltip": o.get("tooltip"),
                }
                for o in opts
            ]
    except Exception as e:
        _log(f"[build_options:price_options] {e}")

    key = _normalize_key(q_key)
    if key in {"edition", "editions", "product", "products", "industry_edition", "industry"}:
        try:
            pr = (
                sb()
                .table("price_products")
                .select("id, prod_key, name, tooltip")
                .eq("bot_id", bot_id)
                .order("sort_order", desc=False)
                .execute()
            )
            rows = pr.data or []
            return [
                {"id": str(x["id"]), "key": x["prod_key"], "label": x["name"], "tooltip": x.get("tooltip")}
                for x in rows
            ]
        except Exception as e:
            _log(f"[build_options:products] {e}")

    if key in {"transactions", "transaction_volume", "volume", "tier", "tiers"}:
        try:
            tr = (
                sb()
                .table("price_tiers")
                .select("id, tier_key, label, min_inclusive, max_inclusive, sort_order")
                .eq("bot_id", bot_id)
                .order("sort_order", desc=False)
                .execute()
            )
            rows = tr.data or []
            return [
                {"id": str(x["id"]), "key": x["tier_key"], "label": x["label"], "tooltip": None}
                for x in rows
            ]
        except Exception as e:
            _log(f"[build_options:tiers] {e}")

    return []


@demo_hal_bp.get("/pricing/questions")
def pricing_questions():
    """Return questions + derived options + ui_copy for a bot."""
    try:
        alias = (request.args.get("alias") or "").strip()
        bot_id = (request.args.get("bot_id") or "").strip()
        bot = _get_bot(alias if alias else None, bot_id if bot_id else None)
        if not bot:
            return jsonify({"ok": False, "error": "bot_not_found"}), 404

        qr = (
            sb()
            .table("price_questions")
            .select("id, q_key, q_type, q_group, prompt, help_text, required, sort_order")
            .eq("bot_id", bot["id"])
            .order("sort_order", desc=False)
            .execute()
        )
        qrows = qr.data or []

        out = []
        for q in qrows:
            opts = _build_options_for_question(str(bot["id"]), str(q["id"]), q.get("q_key") or "")
            out.append({
                "id": str(q["id"]),
                "q_key": q.get("q_key"),
                "type": q.get("q_type"),
                "group": q.get("q_group"),
                "prompt": q.get("prompt"),
                "help_text": q.get("help_text"),
                "required": bool(q.get("required")),
                "options": opts,
            })

        return jsonify({
            "ok": True,
            "bot_id": str(bot["id"]),
            "ui_copy": bot.get("ui_copy") or {},
            "questions": out
        })
    except Exception as e:
        _log(f"[pricing_questions] fatal: {e}")
        return jsonify({"ok": False, "error": "server_error"}), 500


def _resolve_product(bot_id: str, value: str) -> Optional[Dict[str, Any]]:
    try_id = (
        sb()
        .table("price_products")
        .select("id, prod_key, name")
        .eq("bot_id", bot_id)
        .eq("id", value)
        .limit(1)
        .execute()
    )
    rows = try_id.data or []
    if rows:
        return rows[0]
    try_key = (
        sb()
        .table("price_products")
        .select("id, prod_key, name")
        .eq("bot_id", bot_id)
        .eq("prod_key", value)
        .limit(1)
        .execute()
    )
    rows = try_key.data or []
    return rows[0] if rows else None


def _resolve_tier(bot_id: str, value: str) -> Optional[Dict[str, Any]]:
    try_id = (
        sb()
        .table("price_tiers")
        .select("id, tier_key, label, min_inclusive, max_inclusive")
        .eq("bot_id", bot_id)
        .eq("id", value)
        .limit(1)
        .execute()
    )
    rows = try_id.data or []
    if rows:
        return rows[0]
    try_key = (
        sb()
        .table("price_tiers")
        .select("id, tier_key, label, min_inclusive, max_inclusive")
        .eq("bot_id", bot_id)
        .eq("tier_key", value)
        .limit(1)
        .execute()
    )
    rows = try_key.data or []
    return rows[0] if rows else None


def _get_included_products(bot_id: str) -> List[Dict[str, Any]]:
    r = (
        sb()
        .table("price_products")
        .select("id, prod_key, name")
        .eq("bot_id", bot_id)
        .eq("is_included", True)
        .order("sort_order", desc=False)
        .execute()
    )
    return r.data or []


def _get_features_for_products(product_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    if not product_ids:
        return {}
    r = (
        sb()
        .table("price_features")
        .select("product_id, name, description, is_standard, sort_order")
        .in_("product_id", product_ids)
        .order("sort_order", desc=False)
        .execute()
    )
    rows = r.data or []
    out: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        pid = str(row.get("product_id"))
        out.setdefault(pid, []).append({
            "name": row.get("name"),
            "description": row.get("description"),
            "is_standard": bool(row.get("is_standard")),
        })
    return out


def _get_matrix(bot_id: str, product_id: str, tier_id: str) -> Optional[Dict[str, Any]]:
    r = (
        sb()
        .table("price_matrix")
        .select("currency_code, price_min, price_max")
        .eq("bot_id", bot_id)
        .eq("product_id", product_id)
        .eq("tier_id", tier_id)
        .limit(1)
        .execute()
    )
    rows = r.data or []
    return rows[0] if rows else None


@demo_hal_bp.post("/pricing/estimate")
def pricing_estimate():
    """Compute estimate using: included products + optional selected product × chosen tier."""
    try:
        payload = request.get_json(silent=True) or {}
        bot_alias = (payload.get("bot_alias") or "").strip()
        bot_id = (payload.get("bot_id") or "").strip()
        answers = payload.get("answers") or {}

        bot = _get_bot(bot_alias if bot_alias else None, bot_id if bot_id else None)
        if not bot:
            return jsonify({"ok": False, "error": "bot_not_found"}), 404

        # Resolve tier (required)
        tier_ans = answers.get("Transactions") or answers.get("transactions") or answers.get("tier")
        if not tier_ans:
            return jsonify({"ok": False, "error": "missing_transactions_answer"}), 400
        tier = _resolve_tier(str(bot["id"]), str(tier_ans))
        if not tier:
            return jsonify({"ok": False, "error": "tier_not_found"}), 404

        # Products: included + optional selected edition
        products = _get_included_products(str(bot["id"]))
        edition_ans = answers.get("Edition") or answers.get("edition") or answers.get("product") or answers.get("products")
        if edition_ans:
            sel = _resolve_product(str(bot["id"]), str(edition_ans))
            if sel:
                if all(str(p["id"]) != str(sel["id"]) for p in products):
                    products.append(sel)

        if not products:
            return jsonify({"ok": False, "error": "no_products_defined"}), 400

        product_ids = [str(p["id"]) for p in products]
        feat_map = _get_features_for_products(product_ids)

        # Build line items
        line_items: List[Dict[str, Any]] = []
        total_min = 0.0
        total_max = 0.0
        currency = "USD"

        for p in products:
            m = _get_matrix(str(bot["id"]), str(p["id"]), str(tier["id"]))
            if not m:
                continue
            currency = m.get("currency_code") or currency
            pmin = float(m.get("price_min") or 0)
            pmax = float(m.get("price_max") or 0)
            total_min += pmin
            total_max += pmax
            line_items.append({
                "product": {"id": str(p["id"]), "key": p.get("prod_key"), "name": p.get("name")},
                "tier": {
                    "id": str(tier["id"]),
                    "key": tier.get("tier_key"),
                    "label": tier.get("label"),
                    "min_inclusive": tier.get("min_inclusive"),
                    "max_inclusive": tier.get("max_inclusive"),
                },
                "price_min": pmin,
                "price_max": pmax,
                "currency_code": currency,
                "features": feat_map.get(str(p["id"]), []),
            })

        return jsonify({
            "ok": True,
            "bot_id": str(bot["id"]),
            "tier": {
                "id": str(tier["id"]),
                "key": tier.get("tier_key"),
                "label": tier.get("label"),
                "min_inclusive": tier.get("min_inclusive"),
                "max_inclusive": tier.get("max_inclusive"),
            },
            "line_items": line_items,
            "total_min": round(total_min, 2),
            "total_max": round(total_max, 2),
            "currency_code": currency,
        })
    except Exception as e:
        _log(f"[pricing_estimate] fatal: {e}")
        return jsonify({"ok": False, "error": "server_error"}), 500


# =====================================================================
# END FILE: app/routes.py
# =====================================================================


@demo_hal_bp.get("/browse-docs")
def browse_docs():
    """Return buttons for all active documents (flat list) for the given bot."""
    try:
        bot_id = (request.args.get("bot_id") or "").strip()
        if not bot_id:
            return jsonify({"buttons": [], "type": "browse_docs"})
        docs = _fetch_all_documents(bot_id)
        buttons = [{
            "label": f'Read "{d.get("title")}"',
            "action": "document",
            "value": d.get("url"),
            "title": d.get("title"),
            "description": d.get("description") if isinstance(d, dict) and "description" in d else "",
            "button_label": f'Read "{d.get("title")}"',
            "button_action": "document",
            "button_value": d.get("url"),
            "button_title": d.get("title"),
            "summary": d.get("description") if isinstance(d, dict) and "description" in d else "",
            "id": d.get("id") or d.get("url"),
        } for d in docs]
        return jsonify({"buttons": buttons, "type": "browse_docs"})
    except Exception as e:
        _log(f"[browse-docs] error: {e}")
        return jsonify({"buttons": [], "type": "browse_docs"})
