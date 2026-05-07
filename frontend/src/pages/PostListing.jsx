import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatApiError } from "@/lib/api";

const AMENITY_OPTIONS = [
  "Pool in backyard", "Plenty of parking", "Cable & WiFi", "Furnished",
  "Walking distance to meetings", "Bus line", "Bike storage",
  "Laundry on-site", "Quiet street", "Pet friendly", "Yoga / wellness room",
  "On-site house manager", "BBQ / outdoor space",
];

export default function PostListing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    house_name: "",
    city: "",
    state: "CA",
    region: "",
    zip_code: "",
    beds_open: 1,
    price_weekly: "",
    price_monthly: "",
    people_per_room: 2,
    gender: "men",
    pets_allowed: false,
    pool: false,
    parking: "driveway",
    amenities: [],
    description: "",
    manager_name: user?.name || "",
    manager_phone: user?.phone || "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="p-20 text-center text-[#8A94A0]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace/>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAmenity = (a) => set("amenities", form.amenities.includes(a) ? form.amenities.filter(x => x !== a) : [...form.amenities, a]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        beds_open: Number(form.beds_open),
        people_per_room: Number(form.people_per_room),
        price_weekly: form.price_weekly ? Number(form.price_weekly) : null,
        price_monthly: form.price_monthly ? Number(form.price_monthly) : null,
      };
      const r = await api.post("/listings", payload);
      navigate(`/beds/${r.data.listing_id}`);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-12" data-testid="post-listing-page">
      <p className="sb-overline">Free · auto-expires in 7 days · reactivate anytime</p>
      <h1 className="mt-3 font-serif text-4xl text-[#2D3339]">Post a bed</h1>
      <p className="mt-3 text-[#5C6670]">No address is ever published. Only the city and zip are shown to residents.</p>

      <form onSubmit={submit} className="mt-10 space-y-7">
        <Field label="House name" hint="The friendly name residents will see — e.g. 'Garden Grove Sober House'.">
          <input required className="sb-input" value={form.house_name} onChange={(e) => set("house_name", e.target.value)} data-testid="post-house-name"/>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field label="City"><input required className="sb-input" value={form.city} onChange={(e) => set("city", e.target.value)} data-testid="post-city"/></Field>
          <Field label="State">
            <select className="sb-input" value={form.state} onChange={(e) => set("state", e.target.value)} data-testid="post-state">
              <option value="CA">California</option>
              <option value="AZ">Arizona</option>
              <option value="NV">Nevada</option>
              <option value="OR">Oregon</option>
              <option value="WA">Washington</option>
              <option value="TX">Texas</option>
              <option value="FL">Florida</option>
              <option value="NY">New York</option>
              <option value="CO">Colorado</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Zip code"><input required maxLength={5} pattern="[0-9]{5}" className="sb-input" value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} data-testid="post-zip"/></Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Field label="Beds open"><input type="number" min={1} max={50} required className="sb-input" value={form.beds_open} onChange={(e) => set("beds_open", e.target.value)} data-testid="post-beds-open"/></Field>
          <Field label="Per room"><input type="number" min={1} max={8} required className="sb-input" value={form.people_per_room} onChange={(e) => set("people_per_room", e.target.value)} data-testid="post-per-room"/></Field>
          <Field label="$ / week"><input type="number" placeholder="e.g. 175" className="sb-input" value={form.price_weekly} onChange={(e) => set("price_weekly", e.target.value)} data-testid="post-price-weekly"/></Field>
          <Field label="$ / month"><input type="number" placeholder="e.g. 700" className="sb-input" value={form.price_monthly} onChange={(e) => set("price_monthly", e.target.value)} data-testid="post-price-monthly"/></Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Gender">
            <select className="sb-input" value={form.gender} onChange={(e) => set("gender", e.target.value)} data-testid="post-gender">
              <option value="men">Men's</option>
              <option value="women">Women's</option>
              <option value="any">Any</option>
              <option value="coed">Co-ed (separate floors)</option>
            </select>
          </Field>
          <Field label="Parking">
            <select className="sb-input" value={form.parking} onChange={(e) => set("parking", e.target.value)} data-testid="post-parking">
              <option value="driveway">Driveway</option>
              <option value="street">Street</option>
              <option value="garage">Garage</option>
              <option value="none">None</option>
            </select>
          </Field>
        </div>

        <div className="flex gap-6">
          <label className="inline-flex items-center gap-2 cursor-pointer" data-testid="post-pets-toggle">
            <input type="checkbox" checked={form.pets_allowed} onChange={(e) => set("pets_allowed", e.target.checked)}/> Pets allowed
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer" data-testid="post-pool-toggle">
            <input type="checkbox" checked={form.pool} onChange={(e) => set("pool", e.target.checked)}/> Pool in backyard
          </label>
        </div>

        <Field label="Amenities" hint="Pick anything that helps residents picture the house.">
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map(a => {
              const on = form.amenities.includes(a);
              return (
                <button type="button" key={a} onClick={() => toggleAmenity(a)} className={`px-3 py-1.5 rounded-full text-sm border transition ${on ? "bg-[#C26D53] text-white border-[#C26D53]" : "bg-white border-[#EAE5D9] hover:border-[#C26D53] text-[#5C6670]"}`} data-testid={`amenity-toggle-${a.replace(/\W+/g,'-')}`}>
                  {on && <CheckCircle2 size={12} className="inline mr-1"/>}{a}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Description" hint="A few sentences about the house, vibe, requirements.">
          <textarea required rows={5} className="sb-input" value={form.description} onChange={(e) => set("description", e.target.value)} data-testid="post-description"/>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Manager name"><input required className="sb-input" value={form.manager_name} onChange={(e) => set("manager_name", e.target.value)} data-testid="post-manager-name"/></Field>
          <Field label="Manager phone"><input required className="sb-input" placeholder="(714) 555-0100" value={form.manager_phone} onChange={(e) => set("manager_phone", e.target.value)} data-testid="post-manager-phone"/></Field>
        </div>

        {error && <p className="text-[#C26D53] text-sm" data-testid="post-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="sb-btn-outline" onClick={() => navigate("/dashboard")}>Cancel</button>
          <button type="submit" disabled={submitting} className="sb-btn-primary" data-testid="post-submit-btn">{submitting ? "Posting…" : "Post listing"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="sb-overline block mb-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[#8A94A0] mt-1.5">{hint}</span>}
    </label>
  );
}
