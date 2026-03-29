"use client";

import { useState, useEffect } from "react";
import { RoastResult } from "@/lib/types";
import { ShareBar } from "./ShareBar";

interface Props {
  result: RoastResult;
}

export function SharePopup({ result }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 7000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
        onClick={() => setVisible(false)}
      />

      {/* Popup */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <p className="text-sm font-semibold text-gray-800">Share your roast 🍞</p>
            <button
              onClick={() => setVisible(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-4">
            <ShareBar result={result} />
          </div>
        </div>
      </div>
    </>
  );
}
