import React from "react";
import { Link } from "react-router-dom";
import { Heart, Lock, Users, MapPinned } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-16" data-testid="about-page">
      <p className="sb-overline">Our mission</p>
      <h1 className="mt-3 font-serif text-4xl lg:text-6xl text-[#2D3339] leading-[1.02]">
        Make finding a safe place to live in recovery as simple as searching for an apartment —
        and make it free for everyone involved.
      </h1>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <Block icon={<Heart size={20} strokeWidth={1.6}/>} title="Free for residents and operators">
          No listing fees. No premium tiers. No commission. Local businesses fund the directory through ads —
          just like Craigslist disrupted classifieds.
        </Block>
        <Block icon={<Lock size={20} strokeWidth={1.6}/>} title="No addresses, ever">
          We publish the city and zip — never the address. Operators stay protected from NIMBY blowback,
          and residents reach out before they show up.
        </Block>
        <Block icon={<Users size={20} strokeWidth={1.6}/>} title="Built by the community">
          SoberBoard isn't a treatment center pitching beds. It's the open board your sponsor would have
          wanted on day one of your fourth attempt. Real names, real phone numbers, no funnels.
        </Block>
        <Block icon={<MapPinned size={20} strokeWidth={1.6}/>} title="Hyper-local first">
          Starting in Orange County — ground zero for sober living. Once we're the trusted board here,
          we expand state by state.
        </Block>
      </div>

      <div className="mt-16 rounded-3xl bg-[#F3EFE7] p-10 sb-grain">
        <p className="sb-overline">The vision</p>
        <p className="mt-4 font-serif text-2xl lg:text-3xl text-[#2D3339] leading-snug">
          A world where no one leaving treatment has to make 20 phone calls to find a bed. Where every
          operator has a free way to fill their rooms. Where the recovery community has its own platform —
          not just a directory, but a daily destination for housing, jobs, legal help, and connection.
        </p>
      </div>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link to="/post" className="sb-btn-primary">Post your first bed</Link>
        <Link to="/beds" className="sb-btn-outline">Browse open beds</Link>
      </div>
    </div>
  );
}

function Block({ icon, title, children }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-2xl bg-[#C26D53]/10 text-[#C26D53] grid place-items-center mb-4">{icon}</div>
      <h3 className="font-serif text-xl text-[#2D3339]">{title}</h3>
      <p className="mt-2 text-[#5C6670] leading-relaxed">{children}</p>
    </div>
  );
}
