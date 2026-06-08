import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Megaphone, Plus, RefreshCw, Wrench, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

const emptyJob = { title: "", company: "", city: "", pay: "", type: "Full-time", schedule: "", recovery_notes: "", description: "", contact: "" };
const emptyService = { name: "", category: "Mental Health", city: "", region: "", phone: "", url: "", description: "", tags: [] };
const emptyAd = { slot: "sidebar", category: "Treatment", title: "", subtitle: "", cta: "", url: "", image_url: "", target_region: "", target_category: "", budget: "", duration: "" };

export default function BusinessPortal() {
  const { user, loading } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [services, setServices] = useState([]);
  const [ads, setAds] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [job, setJob] = useState(emptyJob);
  const [service, setService] = useState(emptyService);
  const [ad, setAd] = useState(emptyAd);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const requests = [
        api.get("/business/jobs"),
        api.get("/business/services"),
        api.get("/business/ads"),
      ];
      if (user?.role === "admin") {
        requests.push(api.get("/admin/business-submissions?status=pending_review"));
      }
      const [jobRes, serviceRes, adRes, reviewRes] = await Promise.all(requests);
      setJobs(jobRes.data);
      setServices(serviceRes.data);
      setAds(adRes.data);
      setReviewQueue(reviewRes?.data || []);
    } catch {
      setJobs([]);
      setServices([]);
      setAds([]);
      setReviewQueue([]);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === "business" || user?.role === "admin") load();
  }, [user, load]);

  if (loading) return <div className="p-20 text-center text-[#8A94A0]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "business" && user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const submit = async (type, payload, reset) => {
    setBusy(type);
    try {
      await api.post(`/business/${type}`, payload);
      reset();
      await load();
      toast.success("Submitted for review.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit right now.");
    } finally {
      setBusy("");
    }
  };

  const reviewSubmission = async (item, status) => {
    setBusy(`${item.submission_type}-${item.submission_id}-${status}`);
    try {
      await api.post(`/admin/business-submissions/${item.submission_type}/${item.submission_id}/status`, { status });
      await load();
      toast.success(status === "approved" ? "Submission approved." : "Submission rejected.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not update review status.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12" data-testid="business-portal-page">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="sb-overline">Business portal</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-tight">Submit jobs, services, and ads.</h1>
          <p className="mt-3 max-w-2xl text-[#5C6670]">
            Submissions are reviewed before publishing. Payments and sponsored placement checkout will come later.
          </p>
        </div>
        <button onClick={load} className="sb-btn-outline inline-flex items-center justify-center gap-2">
          <RefreshCw size={15}/> Refresh
        </button>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <PortalForm icon={<Briefcase size={18}/>} title="Job posting" onSubmit={() => submit("jobs", job, () => setJob(emptyJob))} busy={busy === "jobs"}>
          <Field label="Title" value={job.title} onChange={v => setJob({ ...job, title: v })} required />
          <Field label="Company" value={job.company} onChange={v => setJob({ ...job, company: v })} required />
          <Field label="City" value={job.city} onChange={v => setJob({ ...job, city: v })} required />
          <Field label="Pay" value={job.pay} onChange={v => setJob({ ...job, pay: v })} placeholder="$20-$24/hr" />
          <Field label="Schedule/type" value={job.type} onChange={v => setJob({ ...job, type: v })} />
          <Field label="Recovery-friendly notes" value={job.recovery_notes} onChange={v => setJob({ ...job, recovery_notes: v })} />
          <Area label="Description" value={job.description} onChange={v => setJob({ ...job, description: v })} />
          <Field label="Contact email" type="email" value={job.contact} onChange={v => setJob({ ...job, contact: v })} required />
        </PortalForm>

        <PortalForm icon={<Wrench size={18}/>} title="Service listing" onSubmit={() => submit("services", service, () => setService(emptyService))} busy={busy === "services"}>
          <Field label="Business name" value={service.name} onChange={v => setService({ ...service, name: v })} required />
          <Field label="Category" value={service.category} onChange={v => setService({ ...service, category: v })} required />
          <Field label="City" value={service.city} onChange={v => setService({ ...service, city: v })} required />
          <Field label="Region" value={service.region} onChange={v => setService({ ...service, region: v })} placeholder="Orange County" />
          <Field label="Phone" value={service.phone} onChange={v => setService({ ...service, phone: v })} required />
          <Field label="Website" value={service.url} onChange={v => setService({ ...service, url: v })} placeholder="https://" />
          <Area label="Description" value={service.description} onChange={v => setService({ ...service, description: v })} required />
          <Field label="Tags" value={(service.tags || []).join(", ")} onChange={v => setService({ ...service, tags: v.split(",").map(t => t.trim()).filter(Boolean) })} placeholder="Sliding scale, bilingual" />
        </PortalForm>

        <PortalForm icon={<Megaphone size={18}/>} title="Ad submission" onSubmit={() => submit("ads", ad, () => setAd(emptyAd))} busy={busy === "ads"}>
          <Field label="Headline" value={ad.title} onChange={v => setAd({ ...ad, title: v })} required />
          <Field label="Subhead" value={ad.subtitle} onChange={v => setAd({ ...ad, subtitle: v })} />
          <Field label="Category" value={ad.category} onChange={v => setAd({ ...ad, category: v })} />
          <Field label="Placement" value={ad.slot} onChange={v => setAd({ ...ad, slot: v })} placeholder="sidebar or inline" />
          <Field label="CTA" value={ad.cta} onChange={v => setAd({ ...ad, cta: v })} placeholder="Call today" />
          <Field label="Destination URL" value={ad.url} onChange={v => setAd({ ...ad, url: v })} placeholder="https://" />
          <Field label="Target region" value={ad.target_region} onChange={v => setAd({ ...ad, target_region: v })} />
          <Field label="Budget/duration" value={ad.budget} onChange={v => setAd({ ...ad, budget: v })} placeholder="$300 / 30 days" />
        </PortalForm>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        <SubmissionList title="Jobs" items={jobs} getTitle={item => item.title} getMeta={item => `${item.company} · ${item.city}`} />
        <SubmissionList title="Services" items={services} getTitle={item => item.name} getMeta={item => `${item.category} · ${item.city}`} />
        <SubmissionList title="Ads" items={ads} getTitle={item => item.title} getMeta={item => `${item.slot} · ${item.category}`} />
      </div>

      {user.role === "admin" && (
        <section className="mt-12 rounded-2xl border border-[#EAE5D9] bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="sb-overline">Admin review</p>
              <h2 className="mt-2 font-serif text-3xl text-[#2D3339]">Pending business submissions</h2>
            </div>
            <span className="text-sm text-[#5C6670]">{reviewQueue.length} waiting</span>
          </div>
          <div className="mt-5 grid gap-3">
            {reviewQueue.length === 0 ? (
              <p className="text-sm text-[#8A94A0]">No pending submissions.</p>
            ) : reviewQueue.map(item => (
              <div key={`${item.submission_type}-${item.submission_id}`} className="rounded-xl border border-[#EAE5D9] p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-[#2B4C5F]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#2B4C5F]">
                      {item.submission_type}
                    </span>
                    <p className="mt-2 font-semibold text-[#2D3339]">{item.title || item.name}</p>
                    <p className="text-sm text-[#5C6670]">{item.company || item.category || item.slot} · {item.city || item.target_region || "No region"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => reviewSubmission(item, "approved")}
                      disabled={busy === `${item.submission_type}-${item.submission_id}-approved`}
                      className="sb-btn-primary"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewSubmission(item, "rejected")}
                      disabled={busy === `${item.submission_type}-${item.submission_id}-rejected`}
                      className="sb-btn-outline"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-sm text-[#5C6670]">
        Looking for bed posting instead? <Link to="/dashboard" className="font-semibold text-[#C26D53]">Go to the house manager dashboard</Link>.
      </p>
    </div>
  );
}

function PortalForm({ icon, title, children, onSubmit, busy }) {
  return (
    <form
      onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
      className="sb-card p-5"
    >
      <div className="mb-4 flex items-center gap-2 text-[#C26D53]">
        {icon}
        <h2 className="font-serif text-2xl text-[#2D3339]">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
      <button disabled={busy} type="submit" className="mt-5 sb-btn-primary inline-flex items-center gap-2">
        <Plus size={15}/> {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", required = false }) {
  return (
    <label className="block text-sm text-[#2D3339]">
      <span className="mb-1 block font-semibold">{label}</span>
      <input required={required} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="sb-input w-full" />
    </label>
  );
}

function Area({ label, value, onChange, required = false }) {
  return (
    <label className="block text-sm text-[#2D3339]">
      <span className="mb-1 block font-semibold">{label}</span>
      <textarea required={required} value={value} onChange={e => onChange(e.target.value)} rows={4} className="sb-input w-full resize-none" />
    </label>
  );
}

function SubmissionList({ title, items, getTitle, getMeta }) {
  return (
    <section className="rounded-2xl border border-[#EAE5D9] bg-white p-5">
      <h2 className="font-serif text-2xl text-[#2D3339]">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-[#8A94A0]">No submissions yet.</p>
        ) : items.map(item => (
          <div key={item.job_id || item.service_id || item.ad_id} className="rounded-xl border border-[#EAE5D9] p-3">
            <p className="font-semibold text-[#2D3339]">{getTitle(item)}</p>
            <p className="text-sm text-[#5C6670]">{getMeta(item)}</p>
            <span className="mt-2 inline-flex rounded-full bg-[#D4A373]/20 px-2.5 py-1 text-xs font-semibold text-[#8A5A2B]">
              {item.status || "seeded"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
