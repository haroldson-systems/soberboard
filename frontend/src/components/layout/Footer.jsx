import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-[#EAE5D9] bg-[#F3EFE7]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#C26D53] grid place-items-center text-white font-serif text-lg leading-none">sb</div>
            <span className="font-serif text-2xl text-[#2D3339]">SoberBoard</span>
          </div>
          <p className="mt-4 text-[#5C6670] max-w-md leading-relaxed">
            The free MLS for sober living homes. Built by and for the recovery community —
            no listing fees, no signup costs, no addresses ever published.
          </p>
          <p className="sb-overline mt-6">Built in California · expanding nationwide</p>
        </div>

        <div className="md:col-span-2">
          <p className="sb-overline mb-4">Find</p>
          <ul className="space-y-2 text-[#2D3339]">
            <li><Link to="/beds" className="hover:text-[#C26D53]">Beds</Link></li>
            <li><Link to="/jobs" className="hover:text-[#C26D53]">Jobs</Link></li>
            <li><Link to="/services" className="hover:text-[#C26D53]">Services</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <p className="sb-overline mb-4">For Operators</p>
          <ul className="space-y-2 text-[#2D3339]">
            <li><Link to="/post" className="hover:text-[#C26D53]">Post a bed</Link></li>
            <li><Link to="/dashboard" className="hover:text-[#C26D53]">Dashboard</Link></li>
            <li><Link to="/register" className="hover:text-[#C26D53]">Sign up free</Link></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="sb-overline mb-4">In an emergency</p>
          <ul className="space-y-2 text-[#2D3339] text-sm">
            <li>SAMHSA Helpline: <span className="font-semibold">1-800-662-4357</span></li>
            <li>988 — Suicide & Crisis Lifeline</li>
            <li>Find AA / NA: aa.org · na.org</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#EAE5D9]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-[#8A94A0]">
          <span>© {new Date().getFullYear()} SoberBoard. Free, forever.</span>
          <span>SoberBoard is a directory and is not a medical or treatment provider.</span>
        </div>
      </div>
    </footer>
  );
}
