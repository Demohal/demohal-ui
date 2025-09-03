// src/components/screens/PriceEstimate.jsx
import React from "react";

/**
 * PriceEstimate — question/estimate flow (presentational).
 *
 * Props:
 *  mirrorLines        string[]
 *  uiCopy             { intro?, outro? }
 *  nextQuestion       object|null       // next required estimation question to answer
 *  estimate           object|null       // result from backend
 *  estimating         boolean
 *  errorQuestions     string|""
 *  errorEstimate      string|""
 *
 *  onPickOption(q, opt)   => void       // pick for choice/multi_choice (parent decides toggle vs set)
 *
 *  // for multi-step layouts you might also pass:
 *  // onBack, onReset, etc. (not required here)
 */

function PriceMirror({ lines }) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <div className="mb-3">
      {lines.map((ln, i) => (
        <div key={i} className="text-base italic text-gray-700 whitespace-pre-line">
          {ln}
        </div>
      ))}
    </div>
  );
}

function OptionButton({ opt, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-center rounded-xl px-4 py-3 shadow transition-colors text-white border " +
        (selected
          ? "ring-2 ring-white/70 border-gray-700 bg-gradient-to-b from-gray-600 to-gray-700"
          : "border-gray-700 bg-gradient-to-b from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600")
      }
      title={opt.tooltip || ""}
    >
      <div className="font-extrabold text-xs sm:text-sm">{opt.label}</div>
      {opt.tooltip ? <div className="mt-1 text-[0.7rem] sm:text-[0.75rem] opacity-90">{opt.tooltip}</div> : null}
    </button>
  );
}

function QuestionBlock({ q, value, onPickOption }) {
  const isMulti = q.type === "multi_choice";
  const isPicked = (key) => (isMulti ? Array.isArray(value) && value.includes(key) : value === key);

  return (
    <div className="w-full rounded-lg px-4 py-3 text-base bg-white border border-gray-300">
      <div className="text-black font-bold text-base">{q.prompt}</div>
      {q.help_text ? <div className="text-xs text-black italic mt-1">{q.help_text}</div> : null}
      {Array.isArray(q.options) && q.options.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {q.options.map((opt) => (
            <OptionButton
              key={opt.key || opt.id}
              opt={opt}
              selected={isPicked(opt.key)}
              onClick={() => onPickOption(q, opt)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-600">No options available.</div>
      )}
    </div>
  );
}

function EstimateCard({ estimate, outroText }) {
  if (!estimate) return null;
  return (
    <div>
      <div className="border rounded-xl p-4 bg-white shadow">
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

export default function PriceEstimate({
  mirrorLines = [],
  uiCopy = {},
  nextQuestion = null,
  estimate = null,
  estimating = false,
  errorQuestions = "",
  errorEstimate = "",
  onPickOption = () => {},
}) {
  const introHeading = (uiCopy?.intro?.heading || "").trim();
  const introBody =
    uiCopy?.intro?.body ||
    "This tool provides a quick estimate based on your selections. Final pricing may vary by configuration, usage, and implementation.";
  const outroHeading = (uiCopy?.outro?.heading || "").trim();
  const outroBody = uiCopy?.outro?.body || "";
  const outroText = `${outroHeading ? `${outroHeading}\n\n` : ""}${outroBody}`;

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* Intro or mirror lines */}
      <div className="px-1 pt-3 pb-2">
        {mirrorLines?.length ? (
          <PriceMirror lines={mirrorLines} />
        ) : (
          <div className="text-black text-base font-bold whitespace-pre-line">
            {`${introHeading ? `${introHeading}\n\n` : ""}${introBody}`}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="pt-0 pb-2 flex-1">
        {errorQuestions ? <div className="mt-2 text-sm text-red-600">{errorQuestions}</div> : null}
        {nextQuestion ? (
          <QuestionBlock q={nextQuestion} value={nextQuestion._value} onPickOption={onPickOption} />
        ) : (
          <EstimateCard estimate={estimate} outroText={outroText} />
        )}
        {estimating ? <div className="mt-2 text-sm text-gray-500">Calculating…</div> : null}
        {errorEstimate ? <div className="mt-2 text-sm text-red-600">{errorEstimate}</div> : null}
      </div>
    </div>
  );
}
