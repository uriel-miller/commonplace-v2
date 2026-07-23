// Typed placeholder data for the Account page. Real auth/data is not wired yet,
// so these are realistic, clearly-typed fixtures the UI renders against. Swap
// the arrays for live data once the account API exists — the shapes are stable.

export type TabKey =
  | "purchases"
  | "offers"
  | "saved"
  | "payments"
  | "addresses"
  | "settings";

export interface AccountProfile {
  name: string;
  /** Single-letter avatar fallback. */
  initial: string;
  city: string;
  memberSince: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  email: string;
  phone: string;
}

/** A warm two-stop tint used for placeholder thumbnails. */
export type Tint = readonly [string, string];

export type PurchaseStatus =
  | "Delivered"
  | "In transit"
  | "Scheduled"
  | "Processing";

export interface Purchase {
  id: string;
  orderNo: string;
  title: string;
  priceCents: number;
  status: PurchaseStatus;
  /** Human-readable order date. */
  date: string;
  /** Delivery estimate for in-flight orders. */
  eta: string | null;
  /** Whether a review can still be left (delivered, not yet reviewed). */
  canReview: boolean;
  tint: Tint;
}

export type OfferStatus =
  | "Countered"
  | "Accepted"
  | "Pending"
  | "Declined"
  | "Expired";

export interface Offer {
  id: string;
  title: string;
  offerCents: number;
  listCents: number;
  when: string;
  status: OfferStatus;
  /** Present when the buyer can take an action (e.g. view a counter). */
  action: string | null;
  tint: Tint;
}

export interface SavedItem {
  id: string;
  title: string;
  priceCents: number;
  retailCents: number | null;
  savingsPct: number | null;
  location: string;
  condition: string;
  tint: Tint;
}

export type CardBrand = "Visa" | "Mastercard" | "Amex" | "Discover";

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  /** MM/YY */
  expiry: string;
  holder: string;
  isDefault: boolean;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  line1: string;
  line2: string | null;
  cityStateZip: string;
  isDefault: boolean;
}

export interface NotificationSetting {
  key: string;
  label: string;
  desc: string;
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const T1: Tint = ["#EDE4D6", "#E5DACA"];
const T2: Tint = ["#efe7dc", "#e7dccc"];
const T3: Tint = ["#e9e0d0", "#e1d4c0"];
const T4: Tint = ["#f1e7dd", "#e9dccd"];

export const PROFILE: AccountProfile = {
  name: "Alex Morgan",
  initial: "A",
  city: "Austin, TX",
  memberSince: "March 2025",
  verified: true,
  rating: 5.0,
  reviewCount: 8,
  email: "alex.morgan@example.com",
  phone: "(512) 555-0192",
};

export const PURCHASES: Purchase[] = [
  {
    id: "p1",
    orderNo: "CP-48213",
    title: "Sole E95 Elliptical Trainer — Commercial Grade",
    priceCents: 70000,
    status: "In transit",
    date: "Jul 21, 2026",
    eta: "Arrives Mon, Jul 27",
    canReview: false,
    tint: T1,
  },
  {
    id: "p2",
    orderNo: "CP-47980",
    title: "West Elm Harmony 82\" Sofa — Performance Velvet",
    priceCents: 82000,
    status: "Scheduled",
    date: "Jul 18, 2026",
    eta: "Delivery Sat, Jul 25 · 10am–1pm",
    canReview: false,
    tint: T2,
  },
  {
    id: "p3",
    orderNo: "CP-46551",
    title: "Peloton Bike+ with Shoes & Weights",
    priceCents: 115000,
    status: "Delivered",
    date: "Jun 30, 2026",
    eta: null,
    canReview: true,
    tint: T3,
  },
  {
    id: "p4",
    orderNo: "CP-45120",
    title: "Herman Miller Aeron Chair — Size B, Fully Loaded",
    priceCents: 62000,
    status: "Delivered",
    date: "Jun 12, 2026",
    eta: null,
    canReview: false,
    tint: T4,
  },
];

export const OFFERS: Offer[] = [
  {
    id: "o1",
    title: "Yamaha U1 Upright Piano — Polished Ebony",
    offerCents: 350000,
    listCents: 379900,
    when: "2h ago",
    status: "Countered",
    action: "View counter",
    tint: T1,
  },
  {
    id: "o2",
    title: "Bullfrog A7L Wood-Fired Hot Tub",
    offerCents: 640000,
    listCents: 699900,
    when: "1d ago",
    status: "Accepted",
    action: "Complete checkout",
    tint: T2,
  },
  {
    id: "o3",
    title: "Rally Pilates Reformer — Studio Edition",
    offerCents: 180000,
    listCents: 199900,
    when: "3d ago",
    status: "Pending",
    action: null,
    tint: T3,
  },
  {
    id: "o4",
    title: "RH Cloud Modular Sectional (3-piece)",
    offerCents: 210000,
    listCents: 259900,
    when: "6d ago",
    status: "Declined",
    action: null,
    tint: T4,
  },
];

export const SAVED_ITEMS: SavedItem[] = [
  {
    id: "s1",
    title: "Solo Stove Yukon 2.0 Fire Pit Bundle",
    priceCents: 34000,
    retailCents: 59999,
    savingsPct: 43,
    location: "Round Rock, TX",
    condition: "Like new",
    tint: T1,
  },
  {
    id: "s2",
    title: "EZGO Freedom RXV Electric Golf Cart",
    priceCents: 520000,
    retailCents: 890000,
    savingsPct: 41,
    location: "Cedar Park, TX",
    condition: "Excellent",
    tint: T2,
  },
  {
    id: "s3",
    title: "Restoration Hardware Cloud Sofa — Ivory",
    priceCents: 240000,
    retailCents: 549900,
    savingsPct: 56,
    location: "Austin, TX",
    condition: "Very good",
    tint: T3,
  },
  {
    id: "s4",
    title: "NordicTrack Commercial 1750 Treadmill",
    priceCents: 68000,
    retailCents: 149900,
    savingsPct: 55,
    location: "Pflugerville, TX",
    condition: "Good",
    tint: T4,
  },
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm1",
    brand: "Visa",
    last4: "4242",
    expiry: "08/28",
    holder: "Alex Morgan",
    isDefault: true,
  },
  {
    id: "pm2",
    brand: "Mastercard",
    last4: "5518",
    expiry: "11/27",
    holder: "Alex Morgan",
    isDefault: false,
  },
  {
    id: "pm3",
    brand: "Amex",
    last4: "1005",
    expiry: "02/29",
    holder: "A. Morgan",
    isDefault: false,
  },
];

export const ADDRESSES: Address[] = [
  {
    id: "a1",
    label: "Home",
    name: "Alex Morgan",
    line1: "2100 Barton Springs Rd",
    line2: "Apt 14",
    cityStateZip: "Austin, TX 78704",
    isDefault: true,
  },
  {
    id: "a2",
    label: "Work",
    name: "Alex Morgan",
    line1: "500 W 2nd St",
    line2: "Suite 1900",
    cityStateZip: "Austin, TX 78701",
    isDefault: false,
  },
];

export const NOTIFICATION_SETTINGS: NotificationSetting[] = [
  {
    key: "offers",
    label: "Offer updates",
    desc: "Counters, acceptances, and expiring offers.",
    enabled: true,
  },
  {
    key: "delivery",
    label: "Delivery alerts",
    desc: "Pickup, transit, and arrival-window texts.",
    enabled: true,
  },
  {
    key: "saved",
    label: "Price drops on saved items",
    desc: "When something on your list gets cheaper.",
    enabled: true,
  },
  {
    key: "digest",
    label: "Weekly picks",
    desc: "A short weekly digest of new inventory near you.",
    enabled: false,
  },
  {
    key: "sms",
    label: "SMS notifications",
    desc: "Receive time-sensitive updates by text.",
    enabled: true,
  },
];

/** Brand mark colors for the payment card chip. */
export const BRAND_STYLE: Record<CardBrand, { bg: string; fg: string }> = {
  Visa: { bg: "#1A1F71", fg: "#ffffff" },
  Mastercard: { bg: "#1a1a1a", fg: "#ffffff" },
  Amex: { bg: "#2E77BC", fg: "#ffffff" },
  Discover: { bg: "#E8781E", fg: "#ffffff" },
};
