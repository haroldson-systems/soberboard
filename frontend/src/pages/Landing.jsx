import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ArrowRight, Heart, Sun, Quote, MapPin } from "lucide-react";
import api from "@/lib/api";
import BedCard from "@/components/BedCard";
import SponsoredAds from "@/components/SponsoredAds";

const HERO_IMG = "https://images.unsplash.com/photo-1737224695288-0f2b8d030d33?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxzb3V0aGVybiUyMGNhbGlmb3JuaWElMjBiZWFjaCUyMHN1bnJpc2V8ZW58MHx8fHwxNzc4MTM0MTI5fDA&ixlib=rb-4.1.0&q=85";
const REFLECTION_IMG = "https://images.unsplash.com/photo-1575835760958-07fb64d1f659?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHw0fHxzb3V0aGVybiUyMGNhbGlmb3JuaWElMjBiZWFjaCUyMHN1bnJpc2V8ZW58MHx8fHwxNzc4MTM0MTI5fDA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({ active_listings: 0, total_open_beds: 0, cities_covered: 0, regions_covered: 0, states_covered: 0 });
  const [featured, setFeatured] = useState([]);
  const [reflection, setReflection] = useState(null);
  const [regions, setRegions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/listings").then(r => setFeatured(r.data.slice(0, 6))).catch(() => {});
    api.get("/reflection/today").then(r => setReflection(r.data)).catch(() => {});
    api.get("/regions").then(r => setRegions(r.data)).catch(() => {});
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/beds${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <div data-testid="landing-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="Southern California sunrise" className="h-full w-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-b from-[#FDFBF7]/30 via-[#2B4C5F]/40 to-[#2B4C5F]/85"/>
        </div>
        <div className="sb-grain relative z-10 max-w-7xl mx-auto px-5 md:px-8 lg:px-12 pt-24 pb-32 lg:pt-36 lg:pb-44">
          <p className="sb-overline text-white/80" data-testid="hero-eyebrow">Free · Built for Recovery · California, expanding nationwide</p>
          <h1 className="mt-5 font-serif text-white text-4xl sm:text-5xl lg:text-[5.25rem] leading-[1.02] tracking-tight max-w-4xl">
            A free home for finding a <em className="text-[#F3EFE7]">home</em> in recovery.
          </h1>
          <p className="mt-6 text-white/85 text-lg max-w-2xl leading-relaxed">
            SoberBoard is the MLS for sober living. House managers post open beds — for free.
            People in recovery search by city, zip, or region — for free. Addresses stay private.
          </p>

          <form onSubmit={onSearch} className="mt-10 max-w-2xl bg-white rounded-2xl p-2 flex items-center gap-2 shadow-lg shadow-black/20" data-testid="hero-search-form">
            <Search size={18} strokeWidth={1.6} className="ml-3 text-[#8A94A0]"/>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search city, zip, or region — Long Beach, 92103, San Diego…"
              className="flex-1 outline-none px-1 py-2 text-[#2D3339] placeholder-[#8A94A0]"
              data-testid="hero-search-input"
            />
            <button type="submit" className="sb-btn-primary inline-flex items-center gap-2" data-testid="hero-search-submit">
              Find a bed <ArrowRight size={16}/>
            </button>
          </form>

          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 text-white">
            <Stat label="open beds" value={stats.total_open_beds}/>
            <Stat label="active listings" value={stats.active_listings}/>
            <Stat label="regions" value={stats.regions_covered ?? stats.cities_covered}/>
            <Stat label="states" value={stats.states_covered ?? 1}/>
            <Stat label="listing fees" value="$0"/>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-20 lg:py-28">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-5">
            <p className="sb-overline">How it works</p>
            <h2 className="mt-3 font-serif text-3xl lg:text-4xl text-[#2D3339] leading-tight">
              Like Craigslist for sober living. Without the fees, scams, or addresses.
            </h2>
          </div>
          <p className="md:col-span-7 md:col-start-7 text-[#5C6670] text-lg leading-relaxed">
            We're not a treatment center. We're not a placement service. We're the free, simple
            board where the recovery community finds beds, jobs, and the help most directories
            charge for. Forever free for residents and operators.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Search by city or zip", d: "Filter by price, gender, pets, room layout. No address is ever published — just the area." },
            { n: "02", t: "Call the house manager", d: "Every listing has a real name and phone. No middlemen, no booking fees, no ghosting." },
            { n: "03", t: "Operators post free", d: "Listings auto-expire after 7 days so the board stays current. Reactivate in one click." },
          ].map(s => (
            <div key={s.n} className="sb-card p-7" data-testid={`how-step-${s.n}`}>
              <span className="sb-overline text-[#C26D53]">Step {s.n}</span>
              <h3 className="mt-3 font-serif text-2xl text-[#2D3339]">{s.t}</h3>
              <p className="mt-3 text-[#5C6670] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED BEDS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-10 lg:py-16">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="sb-overline">Open right now</p>
            <h2 className="mt-2 font-serif text-3xl lg:text-4xl text-[#2D3339]">Open beds across California & beyond</h2>
          </div>
          <Link to="/beds" className="hidden sm:inline-flex items-center gap-2 text-[#C26D53] font-semibold hover:gap-3 transition-all" data-testid="featured-see-all">
            See all listings <ArrowRight size={16}/>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((l, i) => <BedCard key={l.listing_id} listing={l} index={i}/>)}
        </div>
        <div className="mt-10 sm:hidden">
          <Link to="/beds" className="sb-btn-outline inline-flex items-center gap-2">See all listings <ArrowRight size={16}/></Link>
        </div>
      </section>

      {/* WHERE WE ARE — region coverage */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-10 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-8">
          <div className="md:col-span-7">
            <p className="sb-overline">Where we are</p>
            <h2 className="mt-2 font-serif text-3xl lg:text-4xl text-[#2D3339]">Starting in California — building everywhere next.</h2>
          </div>
          <p className="md:col-span-5 text-[#5C6670]">
            We started in Orange County. We're already live across LA County, San Diego, the Inland Empire,
            and beyond California. House manager somewhere we haven't covered? Post a bed — we'll go where you are.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="regions-grid">
          {regions.slice(0, 10).map(r => (
            <Link
              key={`${r.state}-${r.region}`}
              to={`/beds?state=${encodeURIComponent(r.state)}&region=${encodeURIComponent(r.region)}`}
              className="sb-card p-5 group"
              data-testid={`region-card-${r.region.replace(/\W+/g,'-')}`}
            >
              <div className="flex items-center gap-1.5 text-xs text-[#8A94A0] uppercase tracking-[0.2em]"><MapPin size={11}/>{r.state}</div>
              <h3 className="mt-2 font-serif text-lg text-[#2D3339]">{r.region}</h3>
              <p className="mt-2 text-sm text-[#5C6670]">
                <span className="font-semibold text-[#C26D53]">{r.beds}</span> beds · {r.listings} {r.listings === 1 ? "house" : "houses"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* DAILY REFLECTION + ECOSYSTEM */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 relative rounded-3xl overflow-hidden min-h-[340px] sb-grain" data-testid="daily-reflection-card">
          <img src={REFLECTION_IMG} alt="Pacific ocean" className="absolute inset-0 h-full w-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-br from-[#2B4C5F]/85 via-[#2B4C5F]/55 to-transparent"/>
          <div className="relative p-8 lg:p-12 text-white h-full flex flex-col justify-between">
            <div className="flex items-center gap-2 text-white/80">
              <Sun size={16} strokeWidth={1.6}/>
              <span className="sb-overline text-white/80">Daily reflection</span>
            </div>
            <div className="mt-10">
              <Quote size={36} strokeWidth={1} className="text-white/60"/>
              <p className="mt-4 font-serif text-2xl lg:text-3xl leading-snug max-w-2xl">
                {reflection ? reflection.body : "One day at a time."}
              </p>
              <p className="mt-6 text-white/75 text-sm">
                {reflection?.title} · {reflection?.source}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 gap-5">
          <EcoCard to="/jobs" title="Jobs board" desc="Recovery-friendly employers across California (and growing). Background-aware, second-chance hiring." kicker="Hiring now"/>
          <EcoCard to="/services" title="Services & legal help" desc="DUI attorneys, expungement, insurance navigators, food assistance, mental health." kicker="Free & low-cost"/>
          <EcoCard to="/about" title="Why SoberBoard is free" desc="Local businesses fund the board. We never charge operators or residents. Ever." kicker="Our promise" icon={<Heart size={18} strokeWidth={1.6}/>}/>
        </div>
      </section>

      {/* INLINE ADS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 pb-20">
        <SponsoredAds slot="inline" limit={3}/>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 pb-28">
        <div className="rounded-3xl bg-[#2B4C5F] p-10 lg:p-16 text-white relative overflow-hidden sb-grain" data-testid="operator-cta">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <p className="sb-overline text-white/70">For house managers & operators</p>
              <h2 className="mt-3 font-serif text-3xl lg:text-5xl leading-[1.05] max-w-2xl">
                Stop paying to list your beds.
              </h2>
              <p className="mt-4 text-white/80 max-w-xl text-lg">
                Posts are free, posts auto-expire after 7 days so your listings never go stale,
                and reactivating takes one click. No commission, no premium tiers, no funny business.
              </p>
            </div>
            <div className="md:col-span-5 flex flex-wrap gap-3 md:justify-end">
              <Link to="/register" className="bg-[#C26D53] hover:bg-[#A85B44] text-white rounded-full px-6 py-3 font-semibold transition" data-testid="cta-register-btn">Sign up free</Link>
              <Link to="/post" className="border border-white/30 hover:border-white text-white rounded-full px-6 py-3 font-semibold transition" data-testid="cta-post-btn">Post a bed</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-serif text-3xl lg:text-4xl">{value}</div>
      <div className="text-white/70 text-sm uppercase tracking-[0.18em] mt-1">{label}</div>
    </div>
  );
}

function EcoCard({ to, title, desc, kicker, icon }) {
  return (
    <Link to={to} className="sb-card p-6 group flex items-start justify-between gap-4" data-testid={`eco-${title.toLowerCase().replace(/\W+/g,'-')}`}>
      <div>
        <div className="flex items-center gap-2 sb-overline text-[#C26D53]">{icon}{kicker}</div>
        <h3 className="mt-2 font-serif text-xl text-[#2D3339]">{title}</h3>
        <p className="mt-1.5 text-[#5C6670] text-sm leading-relaxed">{desc}</p>
      </div>
      <ArrowRight size={18} className="text-[#8A94A0] mt-1 group-hover:text-[#C26D53] group-hover:translate-x-1 transition"/>
    </Link>
  );
}
