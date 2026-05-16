import React from "react";
import { ExternalLink, MapPin, Smartphone, Globe, Phone, Calendar, ShieldQuestion } from "lucide-react";

const FELLOWSHIPS = [
  {
    id: "aa",
    name: "Alcoholics Anonymous",
    short: "A.A.",
    tagline: "The canonical source — maintained by A.A. World Services.",
    description:
      "The official AA Meeting Guide app aggregates meeting listings from participating AA Intergroups and General Service entities worldwide. In-person, online, and hybrid. Updated in real time by the fellowship itself.",
    primary: { label: "Open Meeting Guide on the web", href: "https://meetingguide.org" },
    secondary: [
      { label: "Get it on the App Store", href: "https://apps.apple.com/us/app/meeting-guide/id1042822181" },
      { label: "Get it on Google Play", href: "https://play.google.com/store/apps/details?id=org.meetingguide" },
      { label: "aa.org", href: "https://www.aa.org" },
    ],
    accent: "#2B4C5F",
    featured: true,
  },
  {
    id: "na",
    name: "Narcotics Anonymous",
    short: "N.A.",
    tagline: "Worldwide meeting search by city, zip, or virtual.",
    description: "The official NA meeting search, maintained by Narcotics Anonymous World Services.",
    primary: { label: "Open NA Meeting Search", href: "https://www.na.org/meetingsearch/" },
    secondary: [{ label: "na.org", href: "https://www.na.org" }],
    accent: "#5E7B62",
  },
  {
    id: "ca",
    name: "Cocaine Anonymous",
    short: "C.A.",
    tagline: "Find a CA meeting — including the longest-running one in OC.",
    description: "The official Cocaine Anonymous World Services meeting locator.",
    primary: { label: "Open CA Meeting Finder", href: "https://ca.org/meetings/" },
    secondary: [{ label: "ca.org", href: "https://ca.org" }],
    accent: "#A8754A",
  },
  {
    id: "refuge",
    name: "Refuge Recovery",
    short: "RR",
    tagline: "A Buddhist-inspired non-12-step path.",
    description: "Mindfulness-based recovery community with in-person and online meetings.",
    primary: { label: "Find a Refuge meeting", href: "https://refugerecovery.org/meetings" },
    secondary: [{ label: "refugerecovery.org", href: "https://refugerecovery.org" }],
    accent: "#7A6B8F",
  },
  {
    id: "smart",
    name: "SMART Recovery",
    short: "SMART",
    tagline: "Self-management & recovery training — science-based, secular.",
    description: "Evidence-based recovery community with face-to-face and online meetings worldwide.",
    primary: { label: "Find a SMART meeting", href: "https://meetings.smartrecovery.org/" },
    secondary: [{ label: "smartrecovery.org", href: "https://smartrecovery.org" }],
    accent: "#C26D53",
  },
];

const LOCAL_RESOURCES = [
  { name: "OC Intergroup (AA)", region: "Orange County, CA", href: "https://www.oc-aa.org/" },
  { name: "Los Angeles Central Office (AA)", region: "Los Angeles, CA", href: "https://lacoaa.org/" },
  { name: "San Diego Central Office (AA)", region: "San Diego, CA", href: "https://www.aasandiego.org/" },
  { name: "Inland Empire Central Office (AA)", region: "Inland Empire, CA", href: "https://www.aainlandempire.org/" },
  { name: "AA Phoenix", region: "Phoenix, AZ", href: "https://aaphoenix.org/" },
];

export default function Meetings() {
  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 py-12 lg:py-16" data-testid="meetings-page">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
        <div className="md:col-span-7">
          <p className="sb-overline">Find a meeting</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-[1.05]">
            We don't replace the fellowships. We point you to them.
          </h1>
          <p className="mt-4 text-[#5C6670] text-lg max-w-xl leading-relaxed">
            Every program already runs its own meeting directory — maintained by the fellowship itself.
            Use the official sources below to find an in-person, online, or hybrid meeting near you.
          </p>
        </div>
        <div className="md:col-span-5 sb-card p-6 self-start" data-testid="meetings-disclaimer">
          <div className="flex items-start gap-3">
            <ShieldQuestion size={20} strokeWidth={1.6} className="text-[#A8754A] shrink-0 mt-1"/>
            <div>
              <p className="font-serif text-lg text-[#2D3339]">A note on independence</p>
              <p className="mt-2 text-sm text-[#5C6670] leading-relaxed">
                SoberBoard is not affiliated with or endorsed by AA, NA, CA, or any 12-step or recovery
                fellowship. The links below are provided as a courtesy and point you directly to the
                official meeting directories maintained by those programs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURED: AA Meeting Guide */}
      {FELLOWSHIPS.filter(f => f.featured).map(f => (
        <FellowshipFeatured key={f.id} f={f} />
      ))}

      {/* OTHER FELLOWSHIPS */}
      <p className="sb-overline mt-16 mb-4">Other recovery fellowships</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {FELLOWSHIPS.filter(f => !f.featured).map(f => (
          <FellowshipCard key={f.id} f={f} />
        ))}
      </div>

      {/* LOCAL INTERGROUPS */}
      <p className="sb-overline mt-16 mb-4">Local intergroups & central offices</p>
      <div className="sb-card divide-y divide-[#EAE5D9] overflow-hidden">
        {LOCAL_RESOURCES.map(r => (
          <a
            key={r.name}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#F3EFE7]/60 transition"
            data-testid={`local-${r.name.replace(/\W+/g,'-')}`}
          >
            <div>
              <p className="font-serif text-lg text-[#2D3339]">{r.name}</p>
              <p className="text-xs text-[#8A94A0] mt-0.5 inline-flex items-center gap-1.5">
                <MapPin size={12} strokeWidth={1.6}/> {r.region}
              </p>
            </div>
            <ExternalLink size={16} className="text-[#8A94A0] shrink-0"/>
          </a>
        ))}
      </div>

      <p className="mt-14 text-xs text-[#8A94A0] leading-relaxed max-w-2xl">
        Anonymity is a foundation of recovery. SoberBoard does not track which fellowship's link you
        follow, and no data is shared with these external sites by us. We simply open the page.
      </p>
    </div>
  );
}

function FellowshipFeatured({ f }) {
  return (
    <article
      className="relative overflow-hidden rounded-3xl sb-grain p-8 md:p-12 text-white"
      style={{ background: `linear-gradient(135deg, ${f.accent} 0%, ${f.accent}DD 100%)` }}
      data-testid={`fellowship-${f.id}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end relative z-10">
        <div className="md:col-span-7">
          <p className="text-[10px] uppercase font-bold tracking-[0.32em]" style={{ color: "#E8C39A" }}>
            The canonical source · Featured
          </p>
          <h2 className="mt-3 font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight">
            {f.name}
          </h2>
          <p className="mt-3 font-serif text-lg md:text-xl" style={{ color: "#E8C39A" }}>{f.tagline}</p>
          <p className="mt-4 text-white/85 leading-relaxed max-w-xl">{f.description}</p>
        </div>
        <div className="md:col-span-5 space-y-3">
          <a
            href={f.primary.href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#C26D53] hover:bg-[#A85B44] text-white rounded-full px-6 py-3.5 font-semibold transition"
            data-testid={`${f.id}-primary-link`}
          >
            <Globe size={16}/> {f.primary.label} <ExternalLink size={14}/>
          </a>
          {f.secondary.map((s, i) => {
            const isApp = s.label.toLowerCase().includes("store") || s.label.toLowerCase().includes("play");
            return (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white text-white rounded-full px-5 py-2.5 text-sm font-medium transition"
                data-testid={`${f.id}-secondary-${i}`}
              >
                {isApp ? <Smartphone size={14}/> : <ExternalLink size={14}/>} {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function FellowshipCard({ f }) {
  return (
    <article
      className="sb-card p-6 flex flex-col"
      data-testid={`fellowship-${f.id}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-7 px-2.5 rounded-md font-serif font-semibold text-sm leading-7"
          style={{ background: `${f.accent}15`, color: f.accent }}
        >
          {f.short}
        </span>
        <span className="sb-overline">{f.tagline.split(".")[0]}</span>
      </div>
      <h3 className="mt-3 font-serif text-2xl text-[#2D3339]">{f.name}</h3>
      <p className="mt-2 text-[#5C6670] text-sm leading-relaxed flex-1">{f.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={f.primary.href}
          target="_blank"
          rel="noopener noreferrer"
          className="sb-btn-outline text-sm inline-flex items-center gap-1.5"
          style={{ color: f.accent, borderColor: `${f.accent}55` }}
          data-testid={`${f.id}-primary-link`}
        >
          {f.primary.label} <ExternalLink size={12}/>
        </a>
      </div>
    </article>
  );
}
