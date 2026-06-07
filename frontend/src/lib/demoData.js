export const shouldUseDemoFallback =
  process.env.NODE_ENV === "development" || process.env.REACT_APP_ENABLE_DEMO_FALLBACK === "true";

export const demoListings = [
  {
    listing_id: "demo-garden-grove",
    house_name: "Garden Grove Sober House",
    city: "Garden Grove",
    state: "CA",
    region: "Orange County",
    zip_code: "92840",
    beds_open: 2,
    price_weekly: 175,
    price_monthly: 700,
    accepts_insurance: false,
    insurance_notes: "",
    people_per_room: 2,
    gender: "men",
    pets_allowed: false,
    pool: true,
    parking: "driveway",
    amenities: ["Pool in backyard", "Plenty of parking", "Cable & WiFi", "Weekly house meetings"],
    drug_testing: "Random testing and testing after overnight passes",
    curfew: "10 PM weekdays, midnight weekends",
    meeting_requirements: "Five meetings per week with sponsor contact encouraged",
    smoking_policy: "Outside only",
    house_rules: ["Drug testing required", "Curfew enforced", "Meeting attendance required"],
    description: "Quiet 6-bed home in Garden Grove. Walking distance to AA meetings. House manager lives on-site.",
    manager_name: "Marcus Reyes",
    manager_phone: "(714) 555-0142",
    image_url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900",
  },
  {
    listing_id: "demo-costa-mesa",
    house_name: "Costa Mesa Recovery Residence",
    city: "Costa Mesa",
    state: "CA",
    region: "Orange County",
    zip_code: "92626",
    beds_open: 1,
    price_weekly: 200,
    price_monthly: 800,
    accepts_insurance: true,
    insurance_notes: "PPO benefits may be verified before intake.",
    people_per_room: 2,
    gender: "men",
    pets_allowed: false,
    pool: false,
    parking: "street",
    amenities: ["Cable & WiFi", "Bike storage", "Bus line nearby"],
    drug_testing: "Scheduled and random UA",
    curfew: "11 PM nightly",
    meeting_requirements: "12-step required",
    smoking_policy: "Outside only",
    house_rules: ["Drug testing required", "Meeting attendance required", "Sponsor required"],
    description: "3-man room available. Drug-tested house, structured environment, 12-step required.",
    manager_name: "David Kim",
    manager_phone: "(949) 555-0188",
    image_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900",
  },
  {
    listing_id: "demo-huntington-hope",
    house_name: "Huntington Hope House",
    city: "Huntington Beach",
    state: "CA",
    region: "Orange County",
    zip_code: "92647",
    beds_open: 3,
    price_weekly: 225,
    price_monthly: 900,
    accepts_insurance: false,
    insurance_notes: "",
    people_per_room: 3,
    gender: "women",
    pets_allowed: true,
    pool: true,
    parking: "garage",
    amenities: ["Pool", "Garage parking", "Pet friendly", "Surf gear storage"],
    drug_testing: "Random testing",
    curfew: "10:30 PM weekdays",
    meeting_requirements: "Four meetings per week",
    smoking_policy: "No smoking indoors",
    house_rules: ["Drug testing required", "Curfew enforced", "Meeting attendance required"],
    description: "Beautiful women's house 1 mile from the beach. Cats welcome, no dogs. Sponsor required.",
    manager_name: "Janet Cole",
    manager_phone: "(714) 555-0203",
    image_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900",
  },
  {
    listing_id: "demo-long-beach",
    house_name: "Long Beach Lighthouse",
    city: "Long Beach",
    state: "CA",
    region: "Los Angeles County",
    zip_code: "90803",
    beds_open: 2,
    price_weekly: 195,
    price_monthly: 780,
    accepts_insurance: true,
    insurance_notes: "Call manager to check accepted plans.",
    people_per_room: 2,
    gender: "any",
    pets_allowed: false,
    pool: false,
    parking: "street",
    amenities: ["Walk to beach", "Bus line", "Furnished"],
    drug_testing: "Random testing",
    curfew: "By phase",
    meeting_requirements: "Recovery meeting plan required",
    smoking_policy: "Outside only",
    house_rules: ["Drug testing required", "Meeting attendance required"],
    description: "Co-ed sober living near the beach. LGBTQ+ welcoming.",
    manager_name: "Jordan Pierce",
    manager_phone: "(562) 555-0211",
    image_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900",
  },
  {
    listing_id: "demo-san-diego",
    house_name: "Hillcrest Hope House",
    city: "San Diego",
    state: "CA",
    region: "San Diego",
    zip_code: "92103",
    beds_open: 2,
    price_weekly: 220,
    price_monthly: 880,
    accepts_insurance: false,
    insurance_notes: "",
    people_per_room: 2,
    gender: "any",
    pets_allowed: true,
    pool: false,
    parking: "street",
    amenities: ["LGBTQ+ welcoming", "Walk to meetings", "Pet-friendly"],
    drug_testing: "Random testing",
    curfew: "11 PM weekdays",
    meeting_requirements: "Three recovery meetings per week",
    smoking_policy: "Designated outdoor area",
    house_rules: ["Drug testing required", "Curfew enforced"],
    description: "Co-ed recovery home in Hillcrest. Strong LGBTQ+ recovery community.",
    manager_name: "Robin Aguirre",
    manager_phone: "(619) 555-0432",
    image_url: "https://images.unsplash.com/photo-1581993192873-bf6d9b6b7f0a?w=900",
  },
  {
    listing_id: "demo-phoenix",
    house_name: "Phoenix Sun Recovery",
    city: "Phoenix",
    state: "AZ",
    region: "Phoenix Metro",
    zip_code: "85016",
    beds_open: 3,
    price_weekly: 165,
    price_monthly: 660,
    accepts_insurance: true,
    insurance_notes: "Insurance verification available before move-in.",
    people_per_room: 2,
    gender: "any",
    pets_allowed: false,
    pool: true,
    parking: "garage",
    amenities: ["Pool", "AC", "Garage parking", "Bus line"],
    drug_testing: "Scheduled and random UA",
    curfew: "10 PM first 30 days",
    meeting_requirements: "Four meetings per week",
    smoking_policy: "Outside only",
    house_rules: ["Drug testing required", "Curfew enforced", "Meeting attendance required"],
    description: "Co-ed Phoenix recovery home. 100+ AA meetings within 3 miles.",
    manager_name: "Brett Donovan",
    manager_phone: "(602) 555-0133",
    image_url: "https://images.unsplash.com/photo-1564013434775-f71db0030976?w=900",
  },
];

export const demoRegions = Object.values(
  demoListings.reduce((acc, listing) => {
    const key = `${listing.state}-${listing.region}`;
    if (!acc[key]) {
      acc[key] = { state: listing.state, region: listing.region, beds: 0, listings: 0 };
    }
    acc[key].beds += listing.beds_open;
    acc[key].listings += 1;
    return acc;
  }, {})
);

export const demoStats = {
  active_listings: demoListings.length,
  total_open_beds: demoListings.reduce((sum, listing) => sum + listing.beds_open, 0),
  cities_covered: new Set(demoListings.map((listing) => listing.city)).size,
  regions_covered: demoRegions.length,
  states_covered: new Set(demoListings.map((listing) => listing.state)).size,
};

export const demoReflection = {
  text: "Recovery starts with one honest connection at a time.",
  author: "SoberBoard",
};

export function getDemoListings({ q = "", city = "", state = "", region = "", gender = "", pets = false, insurance = false, maxPrice = "" } = {}) {
  const normalizedQuery = q.trim().toLowerCase();
  return demoListings.filter((listing) => {
    if (normalizedQuery) {
      const haystack = `${listing.house_name} ${listing.city} ${listing.region} ${listing.zip_code}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    if (city && listing.city !== city) return false;
    if (state && listing.state !== state) return false;
    if (region && listing.region !== region) return false;
    if (gender && gender !== "any") {
      if (gender === "coed" && listing.gender !== "any") return false;
      if (gender !== "coed" && listing.gender !== gender) return false;
    }
    if (pets && !listing.pets_allowed) return false;
    if (insurance && !listing.accepts_insurance) return false;
    if (maxPrice && listing.price_weekly && listing.price_weekly > Number(maxPrice)) return false;
    return true;
  });
}

export function getDemoListing(listingId) {
  return demoListings.find((listing) => listing.listing_id === listingId);
}
