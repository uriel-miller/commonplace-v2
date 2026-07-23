// Core marketplace domain types.
// These mirror the shape we'll later back with Prisma models, so components
// built against them won't change when we swap mock data for the database.

export type Condition =
  | "new"
  | "like-new"
  | "excellent"
  | "good"
  | "fair";

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  "like-new": "Like new",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

export interface Category {
  /** URL-safe identifier, e.g. "treadmills" */
  slug: string;
  /** Display name, e.g. "Treadmills" */
  name: string;
  /** Whether this is a "popular family" (gets a rich per-category question set)
   *  vs a long-tail category (gets the generic Facebook-style form). */
  popular: boolean;
  /** Approx live inventory count, for the category rail badges. */
  count: number;
  /** Short accent token name from the design palette (for placeholder tint). */
  tint: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  categorySlug: string;
  priceCents: number;
  condition: Condition;
  /** City/area the item is located in. */
  location: string;
  /** Distance from the viewer, in miles (pre-computed for mock). */
  distanceMi: number;
  /** Placeholder tint token until real imagery is wired. */
  tint: string;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
