import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, BellOff, BookmarkPlus, ChevronDown, Grid2X2, Search, SlidersHorizontal, MapPin, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import BedCard from "@/components/BedCard";
import SponsoredAds from "@/components/SponsoredAds";
import DemoBanner from "@/components/DemoBanner";
import ListingMap from "@/components/ListingMap";
import { demoRegions, getDemoListings, shouldUseDemoFallback } from "@/lib/demoData";
import { useAuth } from "@/contexts/AuthContext";

export default function BedsDirectory() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [savedBusy, setSavedBusy] = useState("");

  const q = params.get("q") || "";
  const city = params.get("city") || "";
  const state = params.get("state") || "";
  const region = params.get("region") || "";
  const gender = params.get("gender") || "";
  const pets = params.get("pets") === "true";
  const insurance = params.get("insurance") === "true";
  const maxPrice = params.get("max_price") || "";
  const view = params.get("view") === "map" ? "map" : "list";
  const hasFilters = Boolean(q || city || state || region || gender || pets || insurance || maxPrice);
  const savedSearchFilters = useMemo(() => {
    const filters = {};
    if (q) filters.q = q;
    if (city) filters.city = city;
    if (state) filters.state = state;
    if (region) filters.region = region;
    if (gender) filters.gender = gender;
    if (pets) filters.pets = true;
    if (insurance) filters.insurance = true;
    if (maxPrice) filters.max_price = maxPrice;
    return filters;
  }, [q, city, state, region, gender, pets, insurance, maxPrice]);

  useEffect(() => {
    api.get("/regions").then(r => setRegions(r.data)).catch(() => {
      if (shouldUseDemoFallback) setRegions(demoRegions);
    });
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
    if (insurance) search.set("insurance", "true");
    if (maxPrice) search.set("max_price", maxPrice);
    api.get(`/listings?${search.toString()}`)
      .then(r => setAll(r.data))
      .catch(() => setAll(shouldUseDemoFallback ? getDemoListings({ q, city, state, region, gender, pets, insurance, maxPrice }) : []))
      .finally(() => setLoading(false));
  }, [q, city, state, region, gender, pets, insurance, maxPrice]);

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

  useEffect(() => {
    if (hasFilters) setFiltersOpen(true);
  }, [hasFilters]);

  const loadSavedSearches = useCallback(async () => {
    if (!user) {
      setSavedSearches([]);
      return;
    }
    try {
      const r = await api.get("/saved-searches");
      setSavedSearches(r.data);
    } catch {
      setSavedSearches([]);
    }
  }, [user]);

  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (view === "map") next.set("view", "map");
    setParams(next);
    setFiltersOpen(false);
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

  const defaultSearchName = () => {
    const parts = [];
    if (region) parts.push(region);
    else if (city) parts.push(city);
    else if (q) parts.push(q);
    else parts.push("Beds");
    if (gender) parts.push(genderLabel(gender));
    if (maxPrice) parts.push(`under $${maxPrice}/wk`);
    if (insurance) parts.push("insurance");
    if (pets) parts.push("pets");
    return parts.join(" · ");
  };

  const saveCurrentSearch = async () => {
    if (!user) return;
    if (!hasFilters) {
      toast.error("Add at least one filter before saving.");
      return;
    }
    setSavedBusy("create");
    try {
      await api.post("/saved-searches", {
        name: defaultSearchName(),
        filters: savedSearchFilters,
        alerts_enabled: true,
      });
      await loadSavedSearches();
      toast.success("Search saved. Alerts are on.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save that search.");
    } finally {
      setSavedBusy("");
    }
  };

  const applySavedSearch = (saved) => {
    const next = new URLSearchParams();
    Object.entries(saved.filters || {}).forEach(([key, value]) => {
      if (value === true) next.set(key, "true");
      else if (value) next.set(key, String(value));
    });
    if (view === "map") next.set("view", "map");
    setParams(next);
    setFiltersOpen(true);
  };

  const toggleSavedSearchAlerts = async (saved) => {
    setSavedBusy(saved.saved_search_id);
    try {
      await api.put(`/saved-searches/${saved.saved_search_id}`, {
        name: saved.name,
        filters: saved.filters,
        alerts_enabled: !saved.alerts_enabled,
      });
      await loadSavedSearches();
    } catch {
      toast.error("Could not update alerts for that search.");
    } finally {
      setSavedBusy("");
    }
  };

  const deleteSavedSearch = async (saved) => {
    setSavedBusy(saved.saved_search_id);
    try {
      await api.delete(`/saved-searches/${saved.saved_search_id}`);
      await loadSavedSearches();
      toast.success("Saved search removed.");
    } catch {
      toast.error("Could not remove that saved search.");
    } finally {
      setSavedBusy("");
    }
  };

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
        <div className="md:col-span-5 md:self-end md:justify-self-end">
          <div className="inline-flex rounded-full border border-[#EAE5D9] bg-white p-1" data-testid="beds-view-toggle">
            <button
              type="button"
              onClick={() => setParam("view", "list")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${view === "list" ? "bg-[#2B4C5F] text-white" : "text-[#5C6670] hover:text-[#2D3339]"}`}
            >
              <Grid2X2 size={14}/> List
            </button>
            <button
              type="button"
              onClick={() => setParam("view", "map")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${view === "map" ? "bg-[#2B4C5F] text-white" : "text-[#5C6670] hover:text-[#2D3339]"}`}
            >
              <MapPin size={14}/> Map
            </button>
          </div>
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

      <div className="bg-white border border-[#EAE5D9] rounded-2xl p-4 md:p-5 mb-10" data-testid="beds-filter-bar">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7 flex items-center gap-2 sb-input">
            <Search size={16} className="text-[#8A94A0]"/>
            <input
              value={q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Search city, name, or zip"
              className="flex-1 outline-none bg-transparent"
              data-testid="beds-search-input"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="md:col-span-3 sb-btn-outline inline-flex items-center justify-center gap-2"
            data-testid="beds-filters-toggle"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={16}/> Filters {hasFilters && <span className="rounded-full bg-[#C26D53] px-2 py-0.5 text-xs text-white">On</span>}
            <ChevronDown size={16} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}/>
          </button>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className={`md:col-span-2 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold border transition ${hasFilters ? "border-[#EAE5D9] text-[#2D3339] hover:border-[#C26D53] hover:text-[#C26D53] bg-white" : "border-[#EAE5D9] text-[#B9B0A0] bg-[#F8F5EF] cursor-not-allowed"}`}
            data-testid="beds-clear-filters"
          >
            <X size={15}/> Clear
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-5 pt-5 border-t border-[#EAE5D9] grid grid-cols-1 md:grid-cols-12 gap-3" data-testid="beds-advanced-filters">
            <select className="sb-input md:col-span-3" value={city} onChange={(e) => setParam("city", e.target.value)} data-testid="beds-city-filter">
              {cities.map(c => <option key={c} value={c === "All cities" ? "" : c}>{c}</option>)}
            </select>
            <select className="sb-input md:col-span-3" value={gender || "any"} onChange={(e) => setParam("gender", e.target.value)} data-testid="beds-gender-filter">
              <option value="any">Any housing</option>
              <option value="men">Men's</option>
              <option value="women">Women's</option>
              <option value="couples">Couples</option>
              <option value="coed">Co-ed</option>
            </select>
            <select className="sb-input md:col-span-3" value={maxPrice} onChange={(e) => setParam("max_price", e.target.value)} data-testid="beds-price-filter">
              <option value="">Any price</option>
              <option value="175">≤ $175/wk</option>
              <option value="225">≤ $225/wk</option>
              <option value="300">≤ $300/wk</option>
            </select>
            <div className="md:col-span-3 flex flex-wrap items-center gap-x-5 gap-y-3 px-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2D3339]">
                <input type="checkbox" checked={pets} onChange={(e) => setParam("pets", e.target.checked ? "true" : "")} data-testid="beds-pets-filter"/> Pets allowed
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2D3339]">
                <input type="checkbox" checked={insurance} onChange={(e) => setParam("insurance", e.target.checked ? "true" : "")} data-testid="beds-insurance-filter"/> Insurance accepted
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="mb-10 rounded-2xl border border-[#EAE5D9] bg-[#F8F5EF] p-4 md:p-5" data-testid="saved-searches-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="sb-overline">Saved searches</p>
            <h2 className="mt-1 font-serif text-2xl text-[#2D3339]">Watch for the right opening.</h2>
            <p className="mt-1 text-sm text-[#5C6670]">
              Save filters like region, price, housing type, pets, or insurance accepted.
            </p>
          </div>
          {user ? (
            <button
              type="button"
              onClick={saveCurrentSearch}
              disabled={!hasFilters || savedBusy === "create"}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition ${hasFilters ? "bg-[#2B4C5F] text-white hover:bg-[#203D4C]" : "bg-white text-[#B9B0A0] border border-[#EAE5D9] cursor-not-allowed"}`}
              data-testid="save-current-search"
            >
              <BookmarkPlus size={16}/> {savedBusy === "create" ? "Saving…" : "Save current search"}
            </button>
          ) : (
            <Link to="/login" className="sb-btn-primary inline-flex items-center justify-center gap-2" data-testid="saved-search-login-link">
              <BookmarkPlus size={16}/> Sign in to save searches
            </Link>
          )}
        </div>

        {user && (
          <div className="mt-5 grid gap-3" data-testid="saved-search-list">
            {savedSearches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#EAE5D9] bg-white px-4 py-3 text-sm text-[#8A94A0]">
                No saved searches yet. Set filters above, then save the search.
              </p>
            ) : (
              savedSearches.map(saved => (
                <div key={saved.saved_search_id} className="rounded-xl border border-[#EAE5D9] bg-white p-4 md:flex md:items-center md:justify-between md:gap-4" data-testid={`saved-search-${saved.saved_search_id}`}>
                  <button type="button" onClick={() => applySavedSearch(saved)} className="text-left">
                    <p className="font-semibold text-[#2D3339]">{saved.name}</p>
                    <p className="mt-1 text-sm text-[#5C6670]">{describeSavedFilters(saved.filters)}</p>
                  </button>
                  <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
                    <button
                      type="button"
                      onClick={() => toggleSavedSearchAlerts(saved)}
                      disabled={savedBusy === saved.saved_search_id}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${saved.alerts_enabled ? "border-[#5E7B62] text-[#5E7B62] bg-[#5E7B62]/10" : "border-[#EAE5D9] text-[#5C6670] hover:border-[#2B4C5F]"}`}
                      data-testid={`saved-search-alerts-${saved.saved_search_id}`}
                    >
                      {saved.alerts_enabled ? <Bell size={13}/> : <BellOff size={13}/>} Alerts {saved.alerts_enabled ? "on" : "off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedSearch(saved)}
                      disabled={savedBusy === saved.saved_search_id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#EAE5D9] px-3 py-1.5 text-sm text-[#5C6670] transition hover:border-[#C26D53] hover:text-[#C26D53]"
                      data-testid={`saved-search-delete-${saved.saved_search_id}`}
                    >
                      <Trash2 size={13}/> Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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
            view === "map" ? (
              <ListingMap listings={all}/>
            ) : (
              <>
                <p className="text-[#5C6670] text-sm mb-4" data-testid="beds-result-count">{all.length} {all.length === 1 ? "listing" : "listings"} available</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {all.map((l, i) => <BedCard key={l.listing_id} listing={l} index={i}/>)}
                </div>
              </>
            )
          )}
        </div>
        <div className="lg:col-span-3">
          <SponsoredAds slot="sidebar" limit={3}/>
        </div>
      </div>
    </div>
  );
}

function genderLabel(gender) {
  return {
    men: "men's",
    women: "women's",
    couples: "couples",
    coed: "co-ed",
    any: "any housing",
  }[gender] || gender;
}

function describeSavedFilters(filters = {}) {
  const parts = [];
  if (filters.region) parts.push(`${filters.region}${filters.state ? `, ${filters.state}` : ""}`);
  else if (filters.city) parts.push(filters.city);
  if (filters.q) parts.push(`search: ${filters.q}`);
  if (filters.gender) parts.push(genderLabel(filters.gender));
  if (filters.max_price) parts.push(`≤ $${Math.round(Number(filters.max_price))}/wk`);
  if (filters.insurance) parts.push("insurance accepted");
  if (filters.pets) parts.push("pets allowed");
  return parts.length ? parts.join(" · ") : "All open beds";
}
