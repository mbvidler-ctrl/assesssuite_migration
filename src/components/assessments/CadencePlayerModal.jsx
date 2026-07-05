import React, { useState } from "react";
import { X, Music, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * CadencePlayerModal — embeds a YouTube cadence/metronome video in a modal.
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   youtubeUrl: string  — full YouTube URL (watch or search)
 *   title: string       — protocol name
 *   cadence: number     — steps/min
 *   description: string
 */
export default function CadencePlayerModal({ isOpen, onClose, youtubeUrl, title, cadence, description }) {
  if (!isOpen) return null;

  // Convert standard watch URL to embed URL
  const getEmbedUrl = (url) => {
    if (!url) return null;
    // Already an embed
    if (url.includes("/embed/")) return url;
    // Search URL — can't embed search pages, open externally
    if (url.includes("youtube.com/results")) return null;
    // Standard watch?v=
    const match = url.match(/[?&]v=([^&]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
    // youtu.be short links
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&rel=0`;
    return null;
  };

  const embedUrl = getEmbedUrl(youtubeUrl);
  const isSearchOnly = youtubeUrl && youtubeUrl.includes("youtube.com/results");

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Music className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-bold text-sm">{title}</p>
              <p className="text-sky-200 text-xs mt-0.5">
                Cadence Guide — {cadence} steps/min
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player */}
        <div className="p-4 space-y-3">
          {embedUrl ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-black" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={embedUrl}
                title={`${title} Cadence`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center space-y-3">
              <Music className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600 font-medium">
                This resource requires opening in YouTube.
              </p>
              <p className="text-xs text-slate-500">{description}</p>
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open on YouTube
              </a>
            </div>
          )}

          {/* Info bar */}
          <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
            <div className="text-xs text-sky-800">
              <span className="font-semibold">{cadence} steps/min</span>
              <span className="text-sky-600 ml-2">— maintain this rhythm throughout the test</span>
            </div>
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:text-sky-800 transition-colors"
                title="Open in YouTube"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {description && (
            <p className="text-xs text-slate-500 leading-relaxed px-1">{description}</p>
          )}
        </div>

        <div className="border-t px-4 py-3 bg-slate-50 flex justify-between items-center">
          <p className="text-xs text-slate-400">Keep this open during the test to maintain cadence</p>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}