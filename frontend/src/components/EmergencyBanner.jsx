import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, HeartPulse, MapPin } from "lucide-react";

export default function EmergencyBanner() {
  return (
    <div className="bg-[#2B4C5F] text-white" data-testid="emergency-banner">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={15} strokeWidth={1.8}/> Crisis or overdose risk
          </span>
          <a href="tel:988" className="hover:underline">Call or text 988</a>
          <a href="tel:18006624357" className="hover:underline">SAMHSA: 1-800-662-4357</a>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/85">
          <a href="https://www.cdph.ca.gov/Programs/CCDPHP/sapb/Pages/Naloxone.aspx" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
            <HeartPulse size={14} strokeWidth={1.8}/> Narcan resources
          </a>
          <Link to="/new-to-recovery" className="inline-flex items-center gap-1.5 hover:text-white">
            <MapPin size={14} strokeWidth={1.8}/> New to recovery guide
          </Link>
        </div>
      </div>
    </div>
  );
}
