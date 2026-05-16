import React, { useEffect, useState } from "react";
import { Briefcase, MapPin, DollarSign, Clock } from "lucide-react";
import api from "@/lib/api";
import SponsoredAds from "@/components/SponsoredAds";

export default function JobsBoard() {
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(r => setJobs(r.data));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12 lg:py-16" data-testid="jobs-page">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10">
        <div className="md:col-span-7">
          <p className="sb-overline">Work that gets it</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-[1.05]">
            Recovery-aware employers.
          </h1>
          <p className="mt-4 text-[#5C6670] text-lg max-w-xl">
            Businesses that understand the journey and offer support-focused environments — across
            California and growing.
          </p>
        </div>
        <div className="md:col-span-5 md:flex md:items-end">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs or companies…" className="sb-input w-full" data-testid="jobs-search-input"/>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {jobs.map((j, i) => (
            <article key={j.job_id} className="sb-card p-6 sb-fade-up" style={{ animationDelay: `${Math.min(i,8)*60}ms` }} data-testid={`job-card-${j.job_id}`}>
              <div className="flex items-center gap-2 sb-overline text-[#C26D53]">
                <Briefcase size={13} strokeWidth={1.6}/> {j.type}
              </div>
              <h3 className="mt-2 font-serif text-xl text-[#2D3339]">{j.title}</h3>
              <p className="text-[#5C6670] text-sm">{j.company}</p>
              <div className="mt-3 text-sm text-[#5C6670] flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5"><MapPin size={13}/>{j.city}</span>
                <span className="inline-flex items-center gap-1.5"><DollarSign size={13}/>{j.pay}</span>
                <span className="inline-flex items-center gap-1.5"><Clock size={13}/>posted {j.posted_at}</span>
              </div>
              <p className="mt-4 text-[#2D3339] text-sm leading-relaxed">{j.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {j.tags?.map(t => <span key={t} className="sb-chip">{t}</span>)}
              </div>
              <a href={`mailto:${j.contact}`} className="mt-5 sb-btn-outline inline-block text-sm" data-testid={`job-apply-${j.job_id}`}>Apply via {j.contact}</a>
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
