import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, MapPin } from "lucide-react";
import api from "@/lib/api";
import BedCard from "@/components/BedCard";
import SponsoredAds from "@/components/SponsoredAds";
import DemoBanner from "@/components/DemoBanner";

export default function BedsDirectory() {
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  const q = params.get("q") || "";
  const city = params.get("city") || "";
  const state = params.get("state") || "";
  const region = params.get("region") || "";
  const gender = params.get("gender") || "";
  const pets = params.get("pets") === "true";
  const maxPrice = params.get("max_price") || "";

  useEffect(() => {
    api.get("/regions").then(r => setRegions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (city) search.set("city", city);
    if (state) search.set("state", state);
    if (region) search.set("region", region);
    if (gender) search.set("gender", gender);
    if (pets) search.set("pets", "true");
    if (maxPrice) search.set("max_price", maxPrice);
    api.get(`/listings?${search.toString()}`)
      .then(r => setAll(r.data))
      .finally(() => setLoading(false));
  }, [q, city, state, region, gender, pets, maxPrice]);

  const cities = useMemo(() => {
    const s = new Set(all.map(l => l.city));
    return ["All cities", ...Array.from(s)];
  }, [all]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (!v || v === "All cities" || v === "any") next.delete(k);
    else next.set(k, v);
    setParams(next);
  };

  const setRegion = (r) => {
    const next = new URLSearchParams(params);
    if (!r) {
      next.delete("region");
      next.delete("state");
    } else {
      next.set("region", r.region);
      next.set("state", r.state);
    }
    setParams(next);
  };

  const activeRegionKey = region ? `${state}-${region}` : "";

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12 lg:py-16" data-testid="beds-directory-page">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10">
        <div className="md:col-span-7">
          <p className="sb-overline">Open beds across {regions.length} {regions.length === 1 ? "region" : "regions"}</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-[1.05]">
            Find a bed today.
          </h1>
          <p className="mt-4 text-[#5C6670] text-lg max-w-xl">
            Every listing is from a real house manager. Call directly, no middleman.
          </p>
        </div>
      </div>

      <DemoBanner className="mb-6" />

      {regions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" data-testid="region-chips">
          <button
            onClick={() => setRegion(null)}
            className={`px-4 py-2 rounded-full text-sm border transition ${!region ? "bg-[#2B4C5F] text-white border-[#2B4C5F]" : "bg-white border-[#EAE5D9] hover:border-[#2B4C5F] text-[#5C6670]"}`}
            data-testid="region-chip-all"
          >
            All regions
          </button>
          {regions.map(r => {
            const key = `${r.state}-${r.region}`;
            const on = activeRegionKey === key;
            return (
              <button
                key={key}
                onClick={() => setRegion(r)}
                className={`px-4 py-2 rounded-full text-sm border transition inline-flex items-center gap-1.5 ${on ? "bg-[#2B4C5F] text-white border-[#2B4C5F]" : "bg-white border-[#EAE5D9] hover:border-[#2B4C5F] text-[#5C6670]"}`}
                data-testid={`region-chip-${r.region.replace(/\W+/g,'-')}`}
              >
                <MapPin size={12}/> {r.region}<span className="opacity-70 text-xs ml-1">{r.state}</span>
                <span className={`ml-1 text-xs ${on ? "text-white/80" : "text-[#8A94A0]"}`}>· {r.beds}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-white border border-[#EAE5D9] rounded-2xl p-4 md:p-5 mb-10 grid grid-cols-1 md:grid-cols-12 gap-3" data-testid="beds-filter-bar">
        <div className="md:col-span-4 flex items-center gap-2 sb-input">
          <Search size={16} className="text-[#8A94A0]"/>
          <input
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search city, name, or zip"
            className="flex-1 outline-none bg-transparent"
            data-testid="beds-search-input"
          />
        </div>
        <select className="sb-input md:col-span-3" value={city} onChange={(e) => setParam("city", e.target.value)} data-testid="beds-city-filter">
          {cities.map(c => <option key={c} value={c === "All cities" ? "" : c}>{c}</option>)}
        </select>
        <select className="sb-input md:col-span-2" value={gender || "any"} onChange={(e) => setParam("gender", e.target.value)} data-testid="beds-gender-filter">
          <option value="any">Any housing</option>
          <option value="men">Men's</option>
          <option value="women">Women's</option>
          <option value="couples">Couples</option>
          <option value="coed">Co-ed</option>
        </select>
        <select className="sb-input md:col-span-2" value={maxPrice} onChange={(e) => setParam("max_price", e.target.value)} data-testid="beds-price-filter">
          <option value="">Any price</option>
          <option value="175">≤ $175/wk</option>
          <option value="225">≤ $225/wk</option>
          <option value="300">≤ $300/wk</option>
        </select>
        <label className="md:col-span-1 flex items-center gap-2 px-2 cursor-pointer text-sm text-[#2D3339]">
          <input type="checkbox" checked={pets} onChange={(e) => setParam("pets", e.target.checked ? "true" : "")} data-testid="beds-pets-filter"/> Pets
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-9">
          {loading ? (
            <p className="text-[#8A94A0]">Loading…</p>
          ) : all.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[#EAE5D9] rounded-2xl">
              <SlidersHorizontal className="mx-auto text-[#8A94A0]" size={28}/>
              <p className="mt-3 font-serif text-2xl text-[#2D3339]">No beds match those filters.</p>
              <p className="text-[#5C6670] mt-1">Try widening your search.</p>
            </div>
          ) : (
            <>
              <p className="text-[#5C6670] text-sm mb-4" data-testid="beds-result-count">{all.length} {all.length === 1 ? "listing" : "listings"} available</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {all.map((l, i) => <BedCard key={l.listing_id} listing={l} index={i}/>)}
              </div>
            </>
          )}
        </div>
        <div className="lg:col-span-3">
          <SponsoredAds slot="sidebar" limit={3}/>
        </div>
      </div>
    </div>
  );
}
