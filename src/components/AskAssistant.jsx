/* src/components/AskAssistant.jsx */

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpCircleIcon } from "@heroicons/react/24/solid";
import fallbackLogo from "../assets/logo.png";

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
