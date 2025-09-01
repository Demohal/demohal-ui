/* src/components/AskAssistant.jsx
   Shell-migration cleanup: legacy component removed.
   This shim keeps import paths stable while delegating to the new shell. */

export { default } from "./shell/AppShell";

/* REVISION
   Date: 2025-09-01
   Notes: Remove when all routes import AppShell directly. */
