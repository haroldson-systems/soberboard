import React from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, Bed, Users, PawPrint, Waves, Car, ShieldCheck } from "lucide-react";
import { publicUrl } from "@/components/ImageUploader";
import { useFavorites } from "@/lib/favorites";
import { listingTrustBadges } from "@/lib/listingTrust";

export default function BedCard({ listing, index = 0 }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(listing.listing_id);
  const price = listing.price_weekly
    ? `$${listing.price_weekly}/wk`
    : listing.price_monthly
    ? `$${listing.price_monthly}/mo`
    : "Inquire";

  const fallback = `https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900`;
  const cover = (listing.image_urls && listing.image_urls.length > 0)
    ? publicUrl(listing.image_urls[0])
    : (listing.image_url || fallback);
  const trustBadges = listingTrustBadges(listing).slice(0, 2);

  return (
    <article
      data-testid={`bed-card-${listing.listing_id}`}
      className="sb-card overflow-hidden group block sb-fade-up relative"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link to={`/beds/${listing.listing_id}`} className="block">
        <div className="aspect-[5/4] overflow-hidden relative bg-[#F3EFE7]">
        <img
          src={cover}
          onError={(e) => { e.currentTarget.src = fallback; }}
          alt={listing.house_name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold text-[#2D3339]">
          {listing.beds_open} {listing.beds_open === 1 ? "bed" : "beds"} open
        </div>
        <div className="absolute top-3 right-3 bg-[#C26D53] text-white px-3 py-1 rounded-full text-sm font-semibold">
          {price}
        </div>
      </div>
      </Link>
      <button
        type="button"
        onClick={() => toggleFavorite(listing.listing_id)}
        className={`absolute top-14 right-3 h-9 w-9 rounded-full grid place-items-center border transition ${saved ? "bg-[#C26D53] text-white border-[#C26D53]" : "bg-white/90 text-[#2D3339] border-white hover:text-[#C26D53]"}`}
        aria-label={saved ? `Remove ${listing.house_name} from favorites` : `Save ${listing.house_name} to favorites`}
        data-testid={`favorite-${listing.listing_id}`}
      >
        <Heart size={17} fill={saved ? "currentColor" : "none"} strokeWidth={1.8}/>
      </button>
      <div className="p-5">
        <Link to={`/beds/${listing.listing_id}`} className="block">
          <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl leading-tight text-[#2D3339]">{listing.house_name}</h3>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-[#5C6670]">
          <MapPin size={14} strokeWidth={1.6}/> {listing.city}{listing.state ? `, ${listing.state}` : ""} · {listing.zip_code}
          </p>
        {listing.region && <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8A94A0]">{listing.region}</p>}
        </Link>
        {trustBadges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trustBadges.map(badge => (
              <span key={badge.label} className={`text-[0.7rem] rounded-full px-2.5 py-1 ${badge.tone === "strong" ? "bg-[#E9F2EA] text-[#426245]" : "bg-[#F3EFE7] text-[#5C6670]"}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="sb-chip"><Users size={12} strokeWidth={1.6}/> {listing.people_per_room} per room</span>
          <span className="sb-chip"><Bed size={12} strokeWidth={1.6}/> {listing.gender}</span>
          {listing.accepts_insurance && <span className="sb-chip"><ShieldCheck size={12} strokeWidth={1.6}/> insurance</span>}
          {listing.pets_allowed && <span className="sb-chip"><PawPrint size={12} strokeWidth={1.6}/> pets ok</span>}
          {listing.pool && <span className="sb-chip"><Waves size={12} strokeWidth={1.6}/> pool</span>}
          {listing.parking && listing.parking !== "none" && <span className="sb-chip"><Car size={12} strokeWidth={1.6}/> {listing.parking}</span>}
        </div>
      </div>
    </article>
  );
}
