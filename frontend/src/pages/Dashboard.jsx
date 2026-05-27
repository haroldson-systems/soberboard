import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Plus, RotateCcw, EyeOff, MapPin, Phone, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

function timeUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 1) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

const STATUS_STYLE = {
  active:   { label: "Active",   bg: "#5E7B62", color: "#FDFBF7" },
  inactive: { label: "Inactive", bg: "#8A94A0", color: "#FDFBF7" },
  expired:  { label: "Expired",  bg: "#D4A373", color: "#FDFBF7" },
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const r = await api.get("/listings/mine");
      setItems(r.data);
    } catch {
      setItems([]);
      setError("Could not load your listings right now.");
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return <div className="p-20 text-center text-[#8A94A0]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace/>;

  const onDeactivate = async (id) => {
    setBusy(id);
    try {
      await api.post(`/listings/${id}/deactivate`);
      await load();
    } catch {
      setError("Could not update that listing right now.");
    } finally {
      setBusy(null);
    }
  };
  const onReactivate = async (id) => {
    setBusy(id);
    try {
      await api.post(`/listings/${id}/reactivate`);
      await load();
    } catch {
      setError("Could not update that listing right now.");
    } finally {
      setBusy(null);
    }
  };

  const active = items.filter(i => i.status === "active");
  const inactive = items.filter(i => i.status !== "active");

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12" data-testid="dashboard-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="sb-overline">Operator dashboard</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-tight">
            Welcome back, {user.name?.split(" ")[0] || "friend"}.
          </h1>
          <p className="mt-3 text-[#5C6670]">Posting is free. Listings auto-expire after 7 days — reactivate in one click.</p>
        </div>
        <Link to="/post" className="sb-btn-primary inline-flex items-center gap-2" data-testid="dashboard-post-btn"><Plus size={16}/> Post a bed</Link>
      </div>
      {error && <p className="mt-5 text-sm text-[#C26D53]" data-testid="dashboard-error">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
        <Stat label="Total listings" value={items.length}/>
        <Stat label="Active" value={active.length}/>
        <Stat label="Inactive" value={items.filter(i => i.status === "inactive").length}/>
        <Stat label="Expired" value={items.filter(i => i.status === "expired").length}/>
      </div>

      <Section title="Active listings" empty="No active listings — post one to start filling beds.">
        {active.map(it => (
          <ListingRow key={it.listing_id} item={it} onDeactivate={onDeactivate} onReactivate={onReactivate} busy={busy}/>
        ))}
      </Section>

      <Section title="Inactive & expired">
        {inactive.length === 0 ? <p className="text-[#8A94A0] text-sm">Nothing here yet.</p> :
          inactive.map(it => <ListingRow key={it.listing_id} item={it} onDeactivate={onDeactivate} onReactivate={onReactivate} busy={busy}/>)
        }
      </Section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#EAE5D9] bg-white p-5">
      <div className="font-serif text-3xl text-[#2D3339]">{value}</div>
      <div className="sb-overline mt-1">{label}</div>
    </div>
  );
}

function Section({ title, children, empty }) {
  const isEmpty = React.Children.count(children) === 0;
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl text-[#2D3339] mb-4">{title}</h2>
      {isEmpty && empty ? <p className="text-[#8A94A0] text-sm">{empty}</p> : <div className="grid grid-cols-1 gap-4">{children}</div>}
    </section>
  );
}

function ListingRow({ item, onDeactivate, onReactivate, busy }) {
  const status = STATUS_STYLE[item.status] || STATUS_STYLE.expired;
  return (
    <div className="sb-card p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center" data-testid={`dashboard-listing-${item.listing_id}`}>
      <div className="md:col-span-5">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: status.bg, color: status.color }}>{status.label}</span>
          {item.status === "active" && (
            <span className="text-xs text-[#8A94A0] inline-flex items-center gap-1"><Clock size={11}/> {timeUntil(item.expires_at)}</span>
          )}
        </div>
        <h3 className="mt-2 font-serif text-xl text-[#2D3339]">{item.house_name}</h3>
        <p className="text-sm text-[#5C6670] mt-1 inline-flex items-center gap-1.5"><MapPin size={13}/> {item.city} · {item.zip_code}</p>
      </div>
      <div className="md:col-span-3 text-sm text-[#5C6670]">
        <p><span className="font-semibold text-[#2D3339]">{item.beds_open}</span> beds · {item.gender}</p>
        <p>{item.price_weekly ? `$${item.price_weekly}/wk` : item.price_monthly ? `$${item.price_monthly}/mo` : "—"}</p>
      </div>
      <div className="md:col-span-2 text-sm text-[#5C6670] inline-flex items-center gap-1.5"><Phone size={13}/> {item.manager_phone}</div>
      <div className="md:col-span-2 flex md:justify-end gap-2 flex-wrap">
        <Link to={`/beds/${item.listing_id}`} className="sb-btn-outline text-sm" data-testid={`view-listing-${item.listing_id}`}>View</Link>
        {item.status === "active" ? (
          <button disabled={busy === item.listing_id} onClick={() => onDeactivate(item.listing_id)} className="border border-[#EAE5D9] hover:border-[#C26D53] hover:text-[#C26D53] rounded-full px-4 py-1.5 text-sm inline-flex items-center gap-1.5 transition" data-testid={`deactivate-${item.listing_id}`}>
            <EyeOff size={13}/> Mark filled
          </button>
        ) : (
          <button disabled={busy === item.listing_id} onClick={() => onReactivate(item.listing_id)} className="sb-btn-primary text-sm inline-flex items-center gap-1.5" data-testid={`reactivate-${item.listing_id}`}>
            <RotateCcw size={13}/> Reactivate
          </button>
        )}
      </div>
    </div>
  );
}
