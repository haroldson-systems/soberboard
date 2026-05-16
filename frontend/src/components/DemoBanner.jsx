import React from "react";
import { Info } from "lucide-react";

export default function DemoBanner({ className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-[#EAE5D9] bg-[#F3EFE7]/60 px-4 py-3 flex items-start gap-3 ${className}`}
      data-testid="demo-banner"
    >
      <Info size={16} strokeWidth={1.6} className="text-[#A8754A] shrink-0 mt-0.5" />
      <p className="text-sm text-[#5C6670] leading-relaxed">
        <span className="font-semibold text-[#2D3339]">Demo Mode</span> — these listings are for
        demonstration purposes only to showcase the platform's capabilities.
      </p>
    </div>
  );
}
