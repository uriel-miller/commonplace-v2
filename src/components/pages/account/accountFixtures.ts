// Typed placeholder data for the rebuilt WooCommerce-style My Account page.
// Real auth/customer data is not wired yet, so these are realistic, clearly
// typed fixtures the UI renders against. Anything that DOES have an API
// (orders, offers, listings) is fetched live and fails soft to these shapes.

export interface AccountCustomer {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
}

export interface AddressCard {
  kind: "billing" | "shipping";
  title: string;
  name: string | null;
  company: string | null;
  line1: string | null;
  line2: string | null;
  cityStateZip: string | null;
  country: string | null;
  phone: string | null;
}

export type CardBrand = "Visa" | "Mastercard" | "Amex" | "Discover";

export interface SavedCard {
  id: string;
  brand: CardBrand;
  last4: string;
  /** MM/YY */
  expiry: string;
  holder: string;
  isDefault: boolean;
}

/** Fallback listing row for the seller "My Listings" table when the API is empty. */
export interface ListingRow {
  id: number;
  sku: string;
  title: string;
  image: string | null;
  priceCents: number;
  /** ISO date the listing was created. */
  createdAt: string;
  status: "publish" | "pending" | "draft";
  permalink: string;
}

/* ------------------------------------------------------------------ */

export const CUSTOMER: AccountCustomer = {
  firstName: "Alex",
  lastName: "Morgan",
  displayName: "Alex Morgan",
  email: "alex.morgan@example.com",
};

export const ADDRESSES: AddressCard[] = [
  {
    kind: "billing",
    title: "Billing address",
    name: "Alex Morgan",
    company: null,
    line1: "2100 Barton Springs Rd",
    line2: "Apt 14",
    cityStateZip: "Austin, TX 78704",
    country: "United States (US)",
    phone: "(512) 555-0192",
  },
  {
    kind: "shipping",
    title: "Shipping address",
    name: "Alex Morgan",
    company: null,
    line1: "2100 Barton Springs Rd",
    line2: "Apt 14",
    cityStateZip: "Austin, TX 78704",
    country: "United States (US)",
    phone: null,
  },
];

export const SAVED_CARDS: SavedCard[] = [
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
];

export const LISTINGS_FALLBACK: ListingRow[] = [
  {
    id: 90211,
    sku: "CP-ELL-0912",
    title: "Sole E95 Elliptical Trainer — Commercial Grade",
    image: null,
    priceCents: 70000,
    createdAt: "2026-07-02T15:30:00.000Z",
    status: "publish",
    permalink: "#",
  },
  {
    id: 90188,
    sku: "CP-SOFA-0455",
    title: 'West Elm Harmony 82" Sofa — Performance Velvet',
    image: null,
    priceCents: 82000,
    createdAt: "2026-06-24T18:05:00.000Z",
    status: "publish",
    permalink: "#",
  },
  {
    id: 90140,
    sku: "CP-HTUB-0231",
    title: "Bullfrog A7L Wood-Fired Hot Tub",
    image: null,
    priceCents: 699900,
    createdAt: "2026-06-18T13:12:00.000Z",
    status: "pending",
    permalink: "#",
  },
  {
    id: 90099,
    sku: "CP-BIKE-0177",
    title: "Peloton Bike+ with Shoes & Weights",
    image: null,
    priceCents: 115000,
    createdAt: "2026-06-09T20:44:00.000Z",
    status: "draft",
    permalink: "#",
  },
];

/** Brand mark colors for the payment card chip. */
export const CARD_BRAND_STYLE: Record<CardBrand, { bg: string; fg: string }> = {
  Visa: { bg: "#1A1F71", fg: "#ffffff" },
  Mastercard: { bg: "#1a1a1a", fg: "#ffffff" },
  Amex: { bg: "#2E77BC", fg: "#ffffff" },
  Discover: { bg: "#E8781E", fg: "#ffffff" },
};

export const LISTING_STATUS_STYLE: Record<
  ListingRow["status"],
  { label: string; bg: string; color: string }
> = {
  publish: { label: "Publish", bg: "var(--greenBg)", color: "var(--green)" },
  pending: { label: "Pending", bg: "#F7EDCE", color: "var(--gold)" },
  draft: { label: "Draft", bg: "var(--putty)", color: "var(--muted)" },
};
