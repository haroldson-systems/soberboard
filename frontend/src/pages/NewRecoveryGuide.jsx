import React from "react";
import { Link } from "react-router-dom";
import { Backpack, CheckCircle2, ClipboardList, HelpCircle, Phone, ShieldCheck } from "lucide-react";

const BRING = [
  "Photo ID, insurance card, and any court or treatment paperwork",
  "Seven days of clothes, toiletries, medications, and chargers",
  "Job, outpatient, or meeting schedule if you already have one",
  "Enough money for move-in costs, groceries, and transportation",
];

const ASK = [
  "How many people are in the room and house?",
  "What are the curfew, testing, meeting, and visitor rules?",
  "Who lives on-site and who do I call after hours?",
  "What does move-in cost, what is refundable, and do you accept insurance?",
  "What happens if I relapse or miss curfew?",
];

const EXPECT = [
  "The house manager will usually ask about sobriety date, treatment status, income, and transportation.",
  "You should be able to see common areas and your room before paying.",
  "A real house will have clear rules and should not pressure you to pay before you understand them.",
];

export default function NewRecoveryGuide() {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 lg:px-12 py-12 lg:py-16" data-testid="new-recovery-guide-page">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-7">
          <p className="sb-overline">New to recovery</p>
          <h1 className="mt-3 font-serif text-4xl lg:text-5xl text-[#2D3339] leading-[1.05]">
            What to ask before moving into a sober living home.
          </h1>
          <p className="mt-4 text-[#5C6670] text-lg leading-relaxed">
            Use this as a quick checklist before you call or tour. The goal is simple: understand the house,
            the rules, the money, and who is responsible before you hand anyone a deposit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/beds" className="sb-btn-primary inline-flex items-center gap-2"><Phone size={16}/> Find open beds</Link>
            <Link to="/meetings" className="sb-btn-outline inline-flex items-center gap-2"><CheckCircle2 size={16}/> Find meetings</Link>
          </div>
        </div>
        <aside className="md:col-span-5 rounded-2xl border border-[#EAE5D9] bg-[#F3EFE7] p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="text-[#5E7B62] shrink-0 mt-0.5" strokeWidth={1.6}/>
            <div>
              <p className="font-serif text-xl text-[#2D3339]">Safety first</p>
              <p className="mt-2 text-sm text-[#5C6670] leading-relaxed">
                SoberBoard never publishes street addresses. Always verify the house in person, understand the agreement,
                and avoid paying by irreversible transfer to someone you have not met.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GuideCard icon={<Backpack size={20}/>} title="What to bring" items={BRING}/>
        <GuideCard icon={<HelpCircle size={20}/>} title="What to ask" items={ASK}/>
        <GuideCard icon={<ClipboardList size={20}/>} title="What to expect" items={EXPECT}/>
      </div>

      <section className="mt-14 rounded-2xl border border-[#EAE5D9] bg-white p-6 md:p-8">
        <p className="sb-overline">Red flags</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-[#5C6670]">
          {[
            "No written rules or unclear move-in costs",
            "Pressure to pay before seeing the house",
            "Manager will not give their real name or phone number",
            "Promises of guaranteed sobriety, jobs, or treatment results",
            "No clear answer about relapse, medication, or overnight policy",
            "Street address posted publicly or shared too early online",
          ].map(item => (
            <div key={item} className="flex items-start gap-2.5">
              <CheckCircle2 size={17} className="text-[#C26D53] shrink-0 mt-0.5" strokeWidth={1.7}/>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function GuideCard({ icon, title, items }) {
  return (
    <article className="sb-card p-6">
      <div className="h-10 w-10 rounded-xl bg-[#2B4C5F] text-white grid place-items-center">{icon}</div>
      <h2 className="mt-4 font-serif text-2xl text-[#2D3339]">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm text-[#5C6670] leading-relaxed">
        {items.map(item => (
          <li key={item} className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-[#5E7B62] shrink-0 mt-0.5" strokeWidth={1.7}/>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
