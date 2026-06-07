export function hasPhotos(listing) {
  return Boolean((listing.image_urls && listing.image_urls.length > 0) || listing.image_url);
}

export function hasPricing(listing) {
  return Boolean(listing.price_weekly || listing.price_monthly || listing.accepts_insurance);
}

export function hasRules(listing) {
  return Boolean(
    (listing.house_rules && listing.house_rules.length > 0) ||
    listing.drug_testing ||
    listing.curfew ||
    listing.meeting_requirements ||
    listing.smoking_policy
  );
}

export function listingTrustBadges(listing) {
  return [
    listing.manager_phone && { label: "Manager phone listed", tone: "strong" },
    listing.expires_at && { label: "Updated within 7 days", tone: "strong" },
    hasPhotos(listing) && { label: "Photos provided", tone: "neutral" },
    hasPricing(listing) && { label: "Payment info provided", tone: "neutral" },
    hasRules(listing) && { label: "House rules provided", tone: "neutral" },
  ].filter(Boolean);
}
