import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, Users, Bed, PawPrint, Waves, Car, CheckCircle2, Calendar, ExternalLink, ClipboardCheck, ShieldCheck, Heart } from "lucide-react";
import api from "@/lib/api";
import SponsoredAds from "@/components/SponsoredAds";
import { publicUrl } from "@/components/ImageUploader";
import { getDemoListing, shouldUseDemoFallback } from "@/lib/demoData";
import { useFavorites } from "@/lib/favorites";

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    api.get(`/listings/${id}`).then(r => setListing(r.data)).catch(() => {
      const demoListing = shouldUseDemoFallback ? getDemoListing(id) : null;
      if (demoListing) setListing(demoListing);
      else setError("Listing not found");
    });
  }, [id]);

  if (error) return <div className="max-w-3xl mx-auto px-5 py-20 text-center"><p className="font-serif text-3xl">{error}</p><Link to="/beds" className="sb-btn-outline mt-6 inline-block">Back to beds</Link></div>;
  if (!listing) return <div className="max-w-3xl mx-auto px-5 py-20 text-[#8A94A0]">Loading…</div>;

  const fallback = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1400";
  const uploaded = (listing.image_urls || []).map(publicUrl);
  const photos = uploaded.length > 0 ? uploaded : [listing.image_url || fallback];
  const cover = photos[0];
  const rest = photos.slice(1, 5);
  const price = listing.price_weekly ? `$${listing.price_weekly}/week` : listing.price_monthly ? `$${listing.price_monthly}/month` : "Inquire";
  const monthly = listing.price_monthly ? ` · $${listing.price_monthly}/mo` : "";
  const saved = isFavorite(listing.listing_id);
  const ruleRows = [
    listing.drug_testing && ["Drug testing", listing.drug_testing],
    listing.curfew && ["Curfew", listing.curfew],
    listing.meeting_requirements && ["Meetings", listing.meeting_requirements],
    listing.smoking_policy && ["Smoking", listing.smoking_policy],
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-10" data-testid="listing-detail-page">
      <Link to="/beds" className="inline-flex items-center gap-1.5 text-[#5C6670] hover:text-[#C26D53] text-sm mb-6" data-testid="back-to-beds-link">
        <ArrowLeft size={14}/> Back to listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8">
          <div className={`grid gap-3 ${rest.length > 0 ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"}`}>
            <div className={`rounded-3xl overflow-hidden border border-[#EAE5D9] bg-[#F3EFE7] ${rest.length > 0 ? "md:col-span-8" : ""}`}>
              <img
                src={cover}
                onError={(e) => { e.currentTarget.src = fallback; }}
                alt={listing.house_name}
                className="w-full aspect-[16/10] object-cover"
                data-testid="listing-cover-image"
              />
            </div>
            {rest.length > 0 && (
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-3">
                {rest.map((src, i) => (
                  <div key={src + i} className="rounded-2xl overflow-hidden border border-[#EAE5D9] bg-[#F3EFE7]" data-testid={`listing-photo-${i + 1}`}>
                    <img src={src} onError={(e) => { e.currentTarget.src = fallback; }} alt={`${listing.house_name} ${i + 2}`} className="w-full h-full aspect-[4/3] object-cover"/>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <p className="sb-overline">{listing.region || (listing.gender === "any" ? "Co-ed" : listing.gender === "men" ? "Men's" : "Women's")} · {listing.city}{listing.state ? `, ${listing.state}` : ""}</p>
            <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-tight">{listing.house_name}</h1>
            <p className="mt-3 flex items-center gap-1.5 text-[#5C6670]"><MapPin size={16} strokeWidth={1.6}/> {listing.city}{listing.state ? `, ${listing.state}` : ", CA"} · {listing.zip_code}<span className="ml-2 text-[#8A94A0] text-sm">(no address shown for resident safety)</span></p>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Beds open" value={listing.beds_open}/>
            <Stat label="Per room" value={listing.people_per_room}/>
            <Stat label="Parking" value={listing.parking}/>
            <Stat label="Pets" value={listing.pets_allowed ? "Yes" : "No"}/>
          </div>

          {(listing.accepts_insurance || listing.insurance_notes) && (
            <div className="mt-8 rounded-2xl border border-[#EAE5D9] bg-white p-5 flex gap-3" data-testid="listing-insurance">
              <ShieldCheck size={22} className="text-[#5E7B62] shrink-0 mt-0.5" strokeWidth={1.6}/>
              <div>
                <h2 className="font-serif text-xl text-[#2D3339]">Insurance accepted</h2>
                <p className="mt-1 text-[#5C6670]">{listing.insurance_notes || "Call the house manager to verify benefits and payment details."}</p>
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="font-serif text-2xl text-[#2D3339]">About this house</h2>
            <p className="mt-3 text-[#5C6670] leading-relaxed text-lg whitespace-pre-line">{listing.description}</p>
          </div>

          <div className="mt-10">
            <h2 className="font-serif text-2xl text-[#2D3339]">Amenities</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {listing.amenities?.map(a => (
                <div key={a} className="flex items-center gap-2.5 text-[#2D3339]">
                  <CheckCircle2 size={18} className="text-[#5E7B62]" strokeWidth={1.6}/> {a}
                </div>
              ))}
              {listing.pool && <div className="flex items-center gap-2.5 text-[#2D3339]"><Waves size={18} className="text-[#5E7B62]" strokeWidth={1.6}/> Pool in backyard</div>}
              {listing.pets_allowed && <div className="flex items-center gap-2.5 text-[#2D3339]"><PawPrint size={18} className="text-[#5E7B62]" strokeWidth={1.6}/> Pet friendly</div>}
            </div>
          </div>

          {(listing.house_rules?.length > 0 || ruleRows.length > 0) && (
            <div className="mt-10" data-testid="listing-house-rules">
              <h2 className="font-serif text-2xl text-[#2D3339]">House rules</h2>
              {listing.house_rules?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.house_rules.map(rule => <span key={rule} className="sb-chip"><ClipboardCheck size={12} strokeWidth={1.6}/> {rule}</span>)}
                </div>
              )}
              {ruleRows.length > 0 && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ruleRows.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-[#EAE5D9] bg-white p-4">
                      <p className="sb-overline">{label}</p>
                      <p className="mt-2 text-[#2D3339]">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-5">
          <div className="sb-card p-7" data-testid="contact-card">
            <p className="sb-overline">Pricing</p>
            <p className="mt-2 font-serif text-3xl text-[#2D3339]">{price}{monthly}</p>
            <button
              type="button"
              onClick={() => toggleFavorite(listing.listing_id)}
              className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold border transition ${saved ? "bg-[#C26D53] text-white border-[#C26D53]" : "bg-white text-[#2D3339] border-[#EAE5D9] hover:border-[#C26D53] hover:text-[#C26D53]"}`}
              data-testid="detail-favorite-btn"
            >
              <Heart size={16} fill={saved ? "currentColor" : "none"}/> {saved ? "Saved for compare" : "Save for compare"}
            </button>
            <div className="sb-divider my-5"/>
            <p className="sb-overline">House manager</p>
            <p className="mt-2 font-serif text-xl text-[#2D3339]">{listing.manager_name}</p>
            <a href={`tel:${listing.manager_phone}`} className="mt-4 sb-btn-primary w-full inline-flex items-center justify-center gap-2" data-testid="call-manager-btn">
              <Phone size={16}/> {listing.manager_phone}
            </a>
            <p className="mt-3 text-xs text-[#8A94A0] leading-relaxed text-center">
              SoberBoard does not screen residents or operators. Always verify in person before paying any deposit.
            </p>

            <div className="sb-divider my-5"/>
            <p className="sb-overline">Meetings nearby</p>
            <p className="mt-2 text-sm text-[#5C6670] leading-relaxed">
              Find AA, NA, CA, and other meetings near {listing.city}. We point to the official directories
              maintained by each fellowship.
            </p>
            <Link
              to="/meetings"
              className="mt-3 sb-btn-outline w-full inline-flex items-center justify-center gap-2 text-sm"
              data-testid="find-meetings-btn"
            >
              Browse meeting finders <ExternalLink size={13}/>
            </Link>
          </div>

          <SponsoredAds slot="sidebar" limit={2}/>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#EAE5D9] bg-white p-4">
      <div className="font-serif text-2xl text-[#2D3339] capitalize">{value}</div>
      <div className="text-xs uppercase tracking-[0.18em] text-[#8A94A0] mt-1">{label}</div>
    </div>
  );
}
