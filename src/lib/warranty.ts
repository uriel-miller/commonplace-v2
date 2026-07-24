// Commonplace extended-warranty pricing.
//
// Rate model (per the product spec):
//   • Monthly rate = 2% of the listing price ($20/mo on a $1,000 listing).
//   • A standard 12-month plan = 12 × monthly, no adjustment.
//   • Shorter terms cost a little more per month; longer terms a little less:
//       6 mo  → 6 × monthly × 1.10   ($1,000 → 120 × 1.10 = 132 → $135)
//       12 mo → 12 × monthly         ($1,000 → $240)
//       18 mo → 18 × monthly × 0.93  ($1,000 → 360 × 0.93 = 334.8 → $335)
//   • Every total is rounded UP to the nearest $5.
//   • A pay-monthly option is available with a 6-month minimum.
//
// All money is integer cents. Pure + dependency-free; never throws.

export type WarrantyTerm = 6 | 12 | 18;
export const WARRANTY_TERMS: readonly WarrantyTerm[] = [6, 12, 18];
export const WARRANTY_MONTHLY_MINIMUM = 6;

/** Round a cent amount UP to the nearest $5.00. */
function ceilTo5Dollars(cents: number): number {
  return Math.ceil(Math.max(0, cents) / 500) * 500;
}

/** Base monthly rate in cents: 2% of the listing price (min $5/mo). */
export function warrantyMonthlyCents(listingCents: number): number {
  const c = Number.isFinite(listingCents) && listingCents > 0 ? listingCents : 0;
  return Math.max(500, Math.round(c * 0.02));
}

/**
 * Month-to-month renewal rate = the 6-month plan's per-month cost (the priciest
 * per-month tier), so pay-as-you-go always matches the 6-month rate.
 */
export function warrantyRenewalMonthlyCents(listingCents: number): number {
  return Math.round(warrantyTotalCents(listingCents, 6) / 6);
}

const TERM_ADJUST: Record<WarrantyTerm, number> = { 6: 1.1, 12: 1.0, 18: 0.93 };

/** Total upfront price (cents) for a fixed warranty term. */
export function warrantyTotalCents(listingCents: number, term: WarrantyTerm): number {
  const monthly = warrantyMonthlyCents(listingCents);
  return ceilTo5Dollars(monthly * term * (TERM_ADJUST[term] ?? 1));
}

export interface WarrantyQuote {
  term: WarrantyTerm;
  totalCents: number;
  monthlyCents: number; // the pay-monthly rate for this listing
}

/** All standard term quotes plus the monthly rate for a listing. */
export function warrantyQuotes(listingCents: number): WarrantyQuote[] {
  const monthly = warrantyMonthlyCents(listingCents);
  return WARRANTY_TERMS.map((term) => ({ term, totalCents: warrantyTotalCents(listingCents, term), monthlyCents: monthly }));
}
