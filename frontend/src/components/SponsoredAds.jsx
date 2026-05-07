import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Scale, Shield, Car, HeartPulse, UtensilsCrossed, Brain } from "lucide-react";

const ICONS = {
  Legal: Scale,
  Insurance: Shield,
  Auto: Car,
  Treatment: HeartPulse,
  Food: UtensilsCrossed,
  "Mental Health": Brain,
};

export default function SponsoredAds({ slot = "sidebar", limit = 3 }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    let active = true;
    api.get(`/ads?slot=${slot}&limit=${limit}`).then(r => active && setAds(r.data)).catch(() => {});
    return () => { active = false; };
  }, [slot, limit]);

  if (!ads.length) return null;
  const isInline = slot === "inline";

  return (
    <aside data-testid={`sponsored-ads-${slot}`} className={isInline ? "grid grid-cols-1 md:grid-cols-3 gap-5" : "space-y-4"}>
      <p className="sb-overline col-span-full">Sponsored · supports the directory</p>
      {ads.map(ad => {
        const Icon = ICONS[ad.category] || Shield;
        return (
          <a
            key={ad.ad_id}
            href="#"
            data-testid={`ad-${ad.ad_id}`}
            className="block rounded-2xl p-5 border border-[#EAE5D9] sb-grain overflow-hidden relative transition-transform hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg, ${ad.color}, ${ad.color}DD)` }}
          >
            <div className="relative z-10 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={18} strokeWidth={1.6}/>
                <span className="text-xs uppercase tracking-[0.2em] font-semibold opacity-85">{ad.category}</span>
              </div>
              <h4 className="font-serif text-xl leading-snug">{ad.title}</h4>
              <p className="text-sm opacity-90 mt-1.5">{ad.subtitle}</p>
              <p className="mt-4 text-sm font-semibold underline-offset-4 underline decoration-white/40 inline-block">{ad.cta} →</p>
            </div>
          </a>
        );
      })}
    </aside>
  );
}
