import React, { useState } from "react";
import axios from "axios";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import logo from "../assets/logo.png";
import { PlayIcon } from "@heroicons/react/24/solid";
import { Tooltip } from "react-tooltip";

export default function AskAssistant() {
    const [submitted, setSubmitted] = useState(false);
    const [input, setInput] = useState("");
    const [lastQuestion, setLastQuestion] = useState("");
    const [responseText, setResponseText] = useState("Hello. I am here to answer any questions you may have about what we offer or who we are.\nPlease enter your question below to begin.");
    const [buttons, setButtons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showThinking, setShowThinking] = useState(false);
    const [selectedDemo, setSelectedDemo] = useState(null);

    // Read alias from ?alias=... or from the first path segment (/alias)
    const getAlias = () => {
      try {
        const url = new URL(window.location.href);
        const qp = url.searchParams.get("alias");
        if (qp) return qp.trim();
      } catch {}
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      return seg || "";
    };


    const sendMessage = async () => {
        if (!input.trim()) return;
        setLastQuestion(input);
        setSelectedDemo(null);
        setSubmitted(false);
        setResponseText("");
        setButtons([]);
        setLoading(true);
        setShowThinking(true);
        setInput("");

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com"}/demo-hal`, {
                visitor_id: "local-ui",
                alias: getAlias(),
                user_question: input,
            });

            const { response_text, buttons } = res.data;
            setShowThinking(false);
            setResponseText(response_text);
            setButtons(buttons || []);
        } catch {
            setShowThinking(false);
            setResponseText("Sorry, something went wrong. Please try again.");
            setButtons([]);
        } finally {
            setLoading(false);
        }
    };

    const handleButtonClick = (btn) => {
        if (btn.url) {
            setSelectedDemo(btn);
            setSubmitted(true);
        }
    };

    const renderButtons = () => {
    if (!buttons.length) return null;
    return (
        <>
            <p className="text-base italic mt-2 mb-1 text-gray-700 text-left">Recommended Demos</p>
            <ul className="flex flex-col gap-3 text-left">
                {buttons.map((btn, idx) => (
                    <li
                        key={idx}
                        className="group flex items-center gap-3 cursor-pointer hover:text-red-700 transition"
                        onClick={() => handleButtonClick(btn)}
                        title={btn.description} // basic hover tooltip
                    >
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center group-hover:bg-red-700">
                          <PlayIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-base font-medium">{btn.title}</span>
                    </li>
                ))}
            </ul>
        </>
        );
    };

    return (
        <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
            <div
              className="border rounded-2xl shadow-xl bg-white flex flex-col overflow-hidden transition-all duration-300"
              style={{
                width: "min(720px, 100vw - 16px)",
                height: "auto",
                minHeight: "450px",
                maxHeight: "90vh"
              }}
            >
                <div className="bg-black text-white text-sm flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-4">
                        <img src={logo} alt="DemoHAL logo" className="h-10 object-contain" />
                    </div>
                    <span className="text-white">{selectedDemo ? selectedDemo.title : "Ask the Assistant"}</span>
                </div>

                <div className="p-6 flex-1 flex flex-col text-center space-y-6 overflow-y-auto">
                    {selectedDemo ? (
                        // === Video View ===
                        <>
                            {/* Video frame */}
                            <div className="w-full flex justify-center mt-[-10px]">
                                <iframe
                                    width="471"
                                    height="272"
                                    src={selectedDemo.url || selectedDemo.value}
                                    title={selectedDemo.title}
                                    className="rounded-xl shadow-[0_4px_12px_0_rgba(107,114,128,0.3)]"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>

                            {/* Recommended label + buttons wrapped to tighten spacing */}
                            {buttons.length > 0 && (
                                <div className="w-full space-y-1">
                                    <p className="text-base italic text-gray-700 text-left">Recommended Demos</p>
                                    {/* Buttons under video */}
                                    <div className={`flex flex-col md:flex-row gap-4 w-full ${buttons.length === 1 ? 'justify-start' : 'justify-between'}`}>
                                        {buttons.map((btn, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedDemo(btn)}
                                                className={`rounded-2xl px-3 py-4 w-[234px] h-20 flex items-center justify-center text-md font-semibold text-center border-2 transition cursor-pointer ${selectedDemo && selectedDemo.title === btn.title ? 'bg-gray-300 border-black text-black order-last' : 'bg-black border-red-500 text-white'}`}
                                            >
                                                {btn.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        // === Ask View ===
                        <div className="w-full space-y-4 flex-1 flex flex-col">
                            {!lastQuestion && (
                                <p className="text-xl font-bold leading-snug text-left mt-auto mb-auto whitespace-pre-line">{responseText}</p>
                            )}
                            {lastQuestion && (<>
                                <div className="w-full text-left pt-2">
                                    <p className="text-base text-black italic">“{lastQuestion}”</p>
                                </div>
                                <div className="p-1 text-left">
                                    {showThinking ? (
                                        <p className="text-gray-500 font-bold animate-pulse">Thinking...</p>
                                    ) : (
                                        <>
                                            <p className="text-black text-base font-bold whitespace-pre-line">{responseText}</p>
                                            {renderButtons()}
                                        </>
                                    )}
                                </div>
                            </>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-400 space-y-3">
                    <textarea
                        rows={3}
                        className="w-full border border-gray-400 rounded-lg px-4 py-2 text-base resize-none"
                        placeholder="Ask your question here"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                        disabled={loading}
                    />

                    <div className="w-full flex items-center justify-between gap-2">
                        <button className="bg-green-600 text-white px-4 py-2 rounded-full text-sm" onClick={() => setSubmitted(false)}>
                            Main Menu
                        </button>

                        <div className="flex gap-2 flex-1 justify-end">
                            <button className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700" onClick={sendMessage} disabled={loading}>
                                <PaperAirplaneIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
