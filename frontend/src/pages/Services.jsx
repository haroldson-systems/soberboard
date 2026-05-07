import React, { useEffect, useMemo, useState } from "react";
import { Phone, MapPin } from "lucide-react";
import api from "@/lib/api";
import SponsoredAds from "@/components/SponsoredAds";

export default function Services() {
  const [services, setServices] = useState([]);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    api.get(`/services${category !== "all" ? `?category=${encodeURIComponent(category)}` : ""}`).then(r => setServices(r.data));
  }, [category]);

  const categories = useMemo(() => {
    const set = new Set(services.map(s => s.category));
    return ["all", ...Array.from(set).sort()];
  }, [services.length]); // eslint-disable-line

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12 lg:py-16" data-testid="services-page">
      <p className="sb-overline">Free & low-cost</p>
      <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-[1.05]">Services for the recovery community.</h1>
      <p className="mt-4 text-[#5C6670] text-lg max-w-2xl">
        DUI defense, expungement, insurance navigators, food assistance, mental health, family law.
        All vetted to be recovery-aware and accessible.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" data-testid="service-categories">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-sm border transition ${category === c ? "bg-[#2B4C5F] text-white border-[#2B4C5F]" : "bg-white border-[#EAE5D9] hover:border-[#2B4C5F] text-[#5C6670]"}`}
            data-testid={`service-cat-${c.replace(/\W+/g,'-')}`}
          >
            {c === "all" ? "All categories" : c}
          </button>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {services.map((s, i) => (
            <article key={s.service_id} className="sb-card p-6 sb-fade-up" style={{ animationDelay: `${Math.min(i,8)*60}ms` }} data-testid={`service-card-${s.service_id}`}>
              <div className="sb-overline text-[#C26D53]">{s.category}</div>
              <h3 className="mt-2 font-serif text-xl text-[#2D3339]">{s.name}</h3>
              <p className="text-sm text-[#5C6670] mt-1 inline-flex items-center gap-1.5"><MapPin size={13}/> {s.city}</p>
              <p className="mt-3 text-[#2D3339] text-sm leading-relaxed">{s.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.tags?.map(t => <span key={t} className="sb-chip">{t}</span>)}
              </div>
              <a href={`tel:${s.phone}`} className="mt-5 sb-btn-outline inline-flex items-center gap-2 text-sm" data-testid={`service-call-${s.service_id}`}>
                <Phone size={13}/> {s.phone}
              </a>
            </article>
          ))}
        </div>
        <div className="lg:col-span-3">
          <SponsoredAds slot="sidebar" limit={3}/>
        </div>
      </div>
    </div>
  );
}
