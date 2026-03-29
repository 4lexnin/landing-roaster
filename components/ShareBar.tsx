"use client";

import { useState } from "react";
import { RoastResult } from "@/lib/types";

interface Props {
  result: RoastResult;
}

function buildShareText(hostname: string, score: number): string {
  return `I just roasted my landing page (${hostname}) and scored ${score}/10 🍞\n\nGet your free roast 👇`;
}

export function ShareBar({ result }: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const hostname = (() => {
    try { return new URL(result.url).hostname; } catch { return result.url; }
  })();

  const { breakdown, total_score } = result.score;

  const shareParams = new URLSearchParams({
    hostname,
    score: String(total_score),
    clarity: String(breakdown.clarity),
    value: String(breakdown.value),
    structure: String(breakdown.structure),
    conversion: String(breakdown.conversion),
    trust: String(breakdown.trust),
  });

  const shareUrl = `${window.location.origin}/r?${shareParams}`;
  const imageUrl = `/api/share-image?${shareParams}`;
  const shareText = buildShareText(hostname, total_score);

  function handleCopy() {
    navigator.clipboard.writeText(shareText + "\n" + shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `roast-${hostname}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Share your results
      </h2>

      {/* Image preview */}
      <div className="rounded-xl overflow-hidden border border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Share card preview" className="w-full" />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          Download
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {copied ? (
            <><span className="text-green-500">✓</span> Copied!</>
          ) : (
            <>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy text
            </>
          )}
        </button>

        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </a>

        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#0077B5] text-white hover:bg-[#005f8f] transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Share on LinkedIn
        </a>
      </div>
    </div>
  );
}
