import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Phone, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { demoListings, shouldUseDemoFallback } from "@/lib/demoData";
import { setFavoriteIds, useFavorites } from "@/lib/favorites";

export default function Compare() {
  const { favoriteIds } = useFavorites();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/listings")
      .then(r => setListings(r.data))
      .catch(() => setListings(shouldUseDemoFallback ? demoListings : []))
      .finally(() => setLoading(false));
  }, []);

  const saved = useMemo(
    () => favoriteIds.map(id => listings.find(listing => listing.listing_id === id)).filter(Boolean),
    [favoriteIds, listings]
  );

  const remove = (id) => setFavoriteIds(favoriteIds.filter(item => item !== id));

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12 lg:py-16" data-testid="compare-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="sb-overline">Favorites / Compare</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-tight">
            Compare the beds you saved.
          </h1>
          <p className="mt-3 text-[#5C6670] max-w-2xl">
            Save houses side by side, then call the manager when one feels like the next right step.
          </p>
        </div>
        <Link to="/beds" className="sb-btn-primary">Find more beds</Link>
      </div>

      {loading ? (
        <p className="mt-12 text-[#8A94A0]">Loading…</p>
      ) : saved.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[#EAE5D9] bg-white p-10 text-center">
          <Heart className="mx-auto text-[#C26D53]" size={30} strokeWidth={1.7}/>
          <p className="mt-3 font-serif text-2xl text-[#2D3339]">No favorites saved yet.</p>
          <p className="mt-1 text-[#5C6670]">Tap the heart on any bed listing to add it here.</p>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto">
          <div className="grid gap-4 min-w-[760px]" style={{ gridTemplateColumns: `180px repeat(${saved.length}, minmax(220px, 1fr))` }}>
            <Cell header>House</Cell>
            {saved.map(listing => (
              <div key={listing.listing_id} className="sb-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/beds/${listing.listing_id}`} className="font-serif text-xl text-[#2D3339] hover:text-[#C26D53]">{listing.house_name}</Link>
                  <button onClick={() => remove(listing.listing_id)} className="text-[#8A94A0] hover:text-[#C26D53]" aria-label={`Remove ${listing.house_name}`}>
                    <Trash2 size={16}/>
                  </button>
                </div>
                <p className="mt-1 text-sm text-[#5C6670]">{listing.city}, {listing.state} · {listing.zip_code}</p>
              </div>
            ))}

            <CompareRow label="Price" listings={saved} value={l => l.price_weekly ? `$${l.price_weekly}/wk` : l.price_monthly ? `$${l.price_monthly}/mo` : "Inquire"}/>
            <CompareRow label="Beds" listings={saved} value={l => `${l.beds_open} open · ${l.people_per_room}/room`}/>
            <CompareRow label="House type" listings={saved} value={l => l.gender}/>
            <CompareRow label="Insurance" listings={saved} value={l => l.accepts_insurance ? "Accepted" : "Not listed"}/>
            <CompareRow label="Curfew" listings={saved} value={l => l.curfew || "Ask manager"}/>
            <CompareRow label="Testing" listings={saved} value={l => l.drug_testing || "Ask manager"}/>
            <CompareRow label="Meetings" listings={saved} value={l => l.meeting_requirements || "Ask manager"}/>
            <CompareRow label="Smoking" listings={saved} value={l => l.smoking_policy || "Ask manager"}/>
            <CompareRow label="Pets" listings={saved} value={l => l.pets_allowed ? "Allowed" : "No / ask"}/>

            <Cell header>Call</Cell>
            {saved.map(listing => (
              <Cell key={`${listing.listing_id}-phone`}>
                <a href={`tel:${listing.manager_phone}`} className="sb-btn-outline inline-flex items-center gap-2 text-sm">
                  <Phone size={14}/> {listing.manager_phone}
                </a>
              </Cell>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, listings, value }) {
  return (
    <>
      <Cell header>{label}</Cell>
      {listings.map(listing => <Cell key={`${listing.listing_id}-${label}`}>{value(listing)}</Cell>)}
    </>
  );
}

function Cell({ header = false, children }) {
  return (
    <div className={header ? "rounded-2xl bg-[#F3EFE7] p-4 sb-overline flex items-center" : "rounded-2xl border border-[#EAE5D9] bg-white p-4 text-sm text-[#2D3339]"}>
      {children}
    </div>
  );
}
