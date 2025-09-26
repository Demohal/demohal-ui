// FormFillCard.jsx — mocked FormFill UI (fname, lname, email)
// - Uses Heroicons QuestionMarkCircle for field tooltips
// - Replaces "Continue" with circular arrow button (matches Ask send affordance)
// - Adds a more prominent border around the card
// Props:
//   onSubmit(values: { fname: string; lname: string; email: string }): void
//   onCancel?: () => void
//   defaults?: { fname?: string; lname?: string; email?: string }

import React from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline"; // ensure package installed: npm i @heroicons/react

function FieldRow({ id, label, type = "text", tooltip, value, onChange, error, placeholder }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {tooltip ? (
          <div className="relative group inline-flex items-center" aria-label={`Why we ask for ${label}`}>
            {/* Heroicon */}
            <QuestionMarkCircleIcon className="h-5 w-5 text-[var(--helper-fg)] shrink-0" />
            {/* Tooltip */}
            <div className="absolute z-10 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 left-6 -top-2 whitespace-nowrap [box-shadow:var(--shadow-elevation)]">
              {tooltip}
            </div>
          </div>
        ) : null}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[0.75rem] px-3 py-2 text-sm border border-[var(--border-default)] bg-[var(--card-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
      />
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

export default function FormFillCard({ onSubmit, onCancel, defaults }) {
  const [values, setValues] = React.useState({
    fname: defaults?.fname || "",
    lname: defaults?.lname || "",
    email: defaults?.email || "",
  });
  const [errors, setErrors] = React.useState({});

  function validate() {
    const e = {};
    if (!values.fname.trim()) e.fname = "First name is required";
    if (!values.lname.trim()) e.lname = "Last name is required";
    if (!values.email.trim()) e.email = "Email is required";
    else if (!/[^@\s]+@[^@\s]+\.[^@\s]+/.test(values.email)) e.email = "Enter a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSubmit({ ...values });
  }

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl p-4 md:p-5 border-2 border-[var(--border-default)] [box-shadow:var(--shadow-elevation)]">
      <div className="space-y-4">
        <FieldRow
          id="ff_fname"
          label="First name"
          tooltip="We use your name to personalize the experience."
          value={values.fname}
          onChange={(v) => setValues((s) => ({ ...s, fname: v }))}
          error={errors.fname}
          placeholder="e.g., Alex"
        />
        <FieldRow
          id="ff_lname"
          label="Last name"
          tooltip="Helps us keep your records tidy."
          value={values.lname}
          onChange={(v) => setValues((s) => ({ ...s, lname: v }))}
          error={errors.lname}
          placeholder="e.g., Rivera"
        />
        <FieldRow
          id="ff_email"
          type="email"
          label="Work email"
          tooltip="If you ask to be contacted, we'll use this address."
          value={values.email}
          onChange={(v) => setValues((s) => ({ ...s, email: v }))}
          error={errors.email}
          placeholder="name@company.com"
        />
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] hover:bg-black/5"
          >
            Cancel
          </button>
        ) : null}
        {/* Circular arrow submit (mirrors AskInputBar affordance) */}
        <button
          type="button"
          aria-label="Continue"
          onClick={submit}
          className="h-10 w-10 rounded-full bg-[var(--send-color)] text-white flex items-center justify-center shadow hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
