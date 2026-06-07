import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bed, MapPin, ShieldCheck } from "lucide-react";

function hashToUnit(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function pinPosition(listing) {
  const seed = `${listing.zip_code}-${listing.city}-${listing.listing_id}`;
  const x = 12 + hashToUnit(`${seed}-x`) * 76;
  const y = 16 + hashToUnit(`${seed}-y`) * 68;
  return { left: `${x}%`, top: `${y}%` };
}

export default function ListingMap({ listings }) {
  const [activeId, setActiveId] = useState(listings[0]?.listing_id || "");
  const active = listings.find(listing => listing.listing_id === activeId) || listings[0];
  const positions = useMemo(
    () => listings.map(listing => ({ listing, style: pinPosition(listing) })),
    [listings]
  );

  if (!listings.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-testid="listing-map-view">
      <div className="lg:col-span-8 rounded-2xl border border-[#DCD4C0] bg-[#E8EFEA] min-h-[520px] relative overflow-hidden sb-grain">
        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-[10%] top-[18%] h-[1px] w-[82%] rotate-[-8deg] bg-white/70"/>
          <div className="absolute left-[5%] top-[56%] h-[1px] w-[90%] rotate-[6deg] bg-white/70"/>
          <div className="absolute left-[28%] top-0 h-full w-[1px] rotate-[10deg] bg-white/70"/>
          <div className="absolute left-[70%] top-0 h-full w-[1px] rotate-[-12deg] bg-white/70"/>
        </div>
        <div className="absolute left-4 top-4 rounded-2xl bg-white/90 backdrop-blur px-4 py-3 max-w-xs">
          <p className="sb-overline">Approximate map</p>
          <p className="mt-1 text-xs text-[#5C6670] leading-relaxed">
            Pins are randomized inside the ZIP/city area. No street address is shown or stored here.
          </p>
        </div>
        {positions.map(({ listing, style }) => {
          const on = listing.listing_id === active?.listing_id;
          return (
            <button
              key={listing.listing_id}
              type="button"
              onClick={() => setActiveId(listing.listing_id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 h-11 w-11 rounded-full grid place-items-center shadow-lg transition ${on ? "bg-[#C26D53] text-white scale-110" : "bg-white text-[#2B4C5F] hover:bg-[#2B4C5F] hover:text-white"}`}
              style={style}
              aria-label={`Show ${listing.house_name}`}
              data-testid={`map-pin-${listing.listing_id}`}
            >
              <MapPin size={22} fill={on ? "currentColor" : "none"} strokeWidth={1.8}/>
            </button>
          );
        })}
      </div>

      <aside className="lg:col-span-4">
        {active && (
          <div className="sb-card p-6 sticky top-28" data-testid="map-active-listing">
            <p className="sb-overline">{active.city}, {active.state} · {active.zip_code}</p>
            <h2 className="mt-3 font-serif text-3xl text-[#2D3339] leading-tight">{active.house_name}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="sb-chip"><Bed size={12}/> {active.beds_open} beds</span>
              {active.accepts_insurance && <span className="sb-chip"><ShieldCheck size={12}/> insurance</span>}
              <span className="sb-chip">{active.price_weekly ? `$${active.price_weekly}/wk` : active.price_monthly ? `$${active.price_monthly}/mo` : "Inquire"}</span>
            </div>
            <p className="mt-4 text-sm text-[#5C6670] leading-relaxed">{active.description}</p>
            <Link to={`/beds/${active.listing_id}`} className="mt-5 sb-btn-primary inline-flex w-full justify-center">
              View listing
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
