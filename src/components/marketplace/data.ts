// View-model data for the marketplace shell. Shapes match the design's
// template bindings exactly; the taxonomy mirrors the live trycommonplace.com
// mega-menu (parent categories Fitness / Wellness / Vehicles and their real
// subcategories). Real inventory replaces the sample FEED once Postgres is wired.

export interface CatItem {
  name: string;
  slug: string;
}
export interface CatGroup {
  name: string;
  iconPath: string;
  bg: string;
  fg: string;
  items: CatItem[];
}

// Parent categories exactly as they appear on the live site.
export const CAT_GROUPS: CatGroup[] = [
  {
    name: "Fitness",
    iconPath: "M6 12h12M4 9v6M20 9v6M2 10.5v3M22 10.5v3",
    bg: "var(--tint)",
    fg: "var(--maroon)",
    items: [
      { name: "Peloton Bike", slug: "peloton-bike-2nd-gen" },
      { name: "Peloton Bike+", slug: "peloton-bike-plus" },
      { name: "Peloton Bike 3rd Gen", slug: "peloton-bike-3rd-gen" },
      { name: "Peloton Tread", slug: "peloton-tread" },
      { name: "Peloton Tread+", slug: "peloton-tread-plus" },
      { name: "Peloton Row", slug: "peloton-row" },
      { name: "Treadmill", slug: "treadmills" },
      { name: "Elliptical", slug: "elliptical" },
      { name: "Rowing Machine", slug: "rower" },
      { name: "Hydrow", slug: "hydrow-pro-rowing-machine" },
      { name: "Indoor Bike", slug: "indoor-bikes" },
      { name: "Spin Bike", slug: "spin-bike" },
      { name: "Assault Bike", slug: "assault-fitness-bike" },
      { name: "NordicTrack", slug: "nordictrack-treadmill" },
      { name: "BowFlex", slug: "bowflex" },
      { name: "ProForm", slug: "proform-treadmill" },
      { name: "Tonal", slug: "tonal" },
      { name: "Home Gym", slug: "home-gym" },
      { name: "Functional Trainer", slug: "functional-trainer" },
      { name: "Smith Machine", slug: "smith-machine" },
      { name: "Reformer", slug: "reformer" },
      { name: "Dumbbell", slug: "dumbbell" },
    ],
  },
  {
    name: "Wellness",
    iconPath: "M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10Z",
    bg: "var(--blueBg)",
    fg: "var(--blueInk)",
    items: [
      { name: "Hot Tub", slug: "hot-tub" },
      { name: "Swim Spa", slug: "swim-spa" },
      { name: "Massage Chair", slug: "massage-chair" },
      { name: "Jacuzzi", slug: "jacuzzi" },
      { name: "Hot Spring", slug: "hot-spring" },
      { name: "Sauna", slug: "sauna" },
      { name: "Infrared Sauna", slug: "infrared-sauna" },
      { name: "Cold Plunge", slug: "cold-plunge" },
      { name: "Float Pod", slug: "float-pod" },
    ],
  },
  {
    name: "Vehicles",
    iconPath: "M5 16a2 2 0 1 0 4 0M15 16a2 2 0 1 0 4 0M3 16V8h11l4 4h3v4",
    bg: "var(--greenBg)",
    fg: "var(--green)",
    items: [
      { name: "Vehicles", slug: "cars" },
      { name: "Golf Carts", slug: "golf-carts" },
      { name: "ATV", slug: "atv" },
      { name: "RV / Motorhome", slug: "rv-motorhome" },
      { name: "Lawn Mower", slug: "lawn-mower" },
    ],
  },
];

/** Flat list of every category name — used by the create-listing type-ahead. */
export const ALL_CATEGORY_NAMES = CAT_GROUPS.flatMap((g) => g.items.map((i) => i.name));

export function findCategoryBySlug(slug: string): CatItem | undefined {
  for (const g of CAT_GROUPS) {
    const hit = g.items.find((i) => i.slug === slug);
    if (hit) return hit;
  }
  return undefined;
}

export interface Review {
  initial: string;
  name: string;
  text: string;
  avBg: string;
}
export const REVIEWS: Review[] = [
  { initial: "M", name: "Marcus D.", text: "Sold my Peloton in three days. They picked it up, no haggling, money hit my account after delivery.", avBg: "var(--maroon)" },
  { initial: "S", name: "Sarah K.", text: "Bought a hot tub sight unseen and it was exactly as described. White-glove delivery was incredible.", avBg: "var(--blueInk)" },
  { initial: "J", name: "Jenna R.", text: "The team handled everything — inspection, transport, setup. Felt safe the whole way through.", avBg: "var(--green)" },
];

export interface Article {
  name: string;
  quote: string;
  url: string;
  font: string;
}
export const ARTICLES: Article[] = [
  { name: "TechCrunch", quote: "Rethinking how big items get resold.", url: "#", font: "'Inter Tight',sans-serif" },
  { name: "The Verge", quote: "White-glove resale, done right.", url: "#", font: "'Newsreader',serif" },
  { name: "Forbes", quote: "A marketplace built on trust.", url: "#", font: "'Newsreader',serif" },
];

export interface Condition {
  key: string;
  label: string;
}
export const CONDITIONS: Condition[] = [
  { key: "new", label: "New" },
  { key: "like-new", label: "Like new" },
  { key: "excellent", label: "Excellent" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
];

export interface FeedItem {
  id: string;
  ph: string;
  cond: string;
  title: string;
  loc: string;
  dist: string;
  price: string;
  specs: string[];
  categorySlug: string;
}

export const FEED: FeedItem[] = [
  { id: "1", ph: "NordicTrack 1750", cond: "Excellent", title: "NordicTrack Commercial 1750 Treadmill", loc: "Austin, TX", dist: "6 mi", price: "$899", specs: ["Folding", "iFit", "300 lb"], categorySlug: "treadmills" },
  { id: "2", ph: "Peloton Bike+", cond: "Like new", title: "Peloton Bike+ with Shoes & Weights", loc: "Round Rock, TX", dist: "14 mi", price: "$1,295", specs: ["Bike+", "2022", "Cleats"], categorySlug: "peloton-bike-plus" },
  { id: "3", ph: "Master Spas", cond: "Good", title: "Master Spas Twilight Series Hot Tub", loc: "Cedar Park, TX", dist: "18 mi", price: "$4,499", specs: ["6-person", "Saltwater"], categorySlug: "hot-tub" },
  { id: "4", ph: "Tonal", cond: "Excellent", title: "Tonal Smart Home Gym + Accessories", loc: "Austin, TX", dist: "4 mi", price: "$2,100", specs: ["Smart", "Wall-mount"], categorySlug: "tonal" },
  { id: "5", ph: "Sole E95", cond: "Good", title: "Sole E95 Elliptical Trainer", loc: "Pflugerville, TX", dist: "11 mi", price: "$749", specs: ["Commercial", "20 lb"], categorySlug: "elliptical" },
  { id: "6", ph: "Club Car Onward", cond: "Like new", title: "Club Car Onward 4-Passenger Golf Cart", loc: "Georgetown, TX", dist: "22 mi", price: "$7,999", specs: ["Electric", "Lithium"], categorySlug: "golf-carts" },
  { id: "7", ph: "Sun Home Sauna", cond: "New", title: "Sun Home Luminar 2-Person Infrared Sauna", loc: "Austin, TX", dist: "8 mi", price: "$3,899", specs: ["Infrared", "2-person"], categorySlug: "infrared-sauna" },
  { id: "8", ph: "The Plunge", cond: "Excellent", title: "The Plunge — All-In Cold Plunge Tub", loc: "Lakeway, TX", dist: "19 mi", price: "$5,499", specs: ["Chiller", "Filter"], categorySlug: "cold-plunge" },
  { id: "9", ph: "Bowflex Revolution", cond: "Good", title: "Bowflex Revolution Home Gym", loc: "Kyle, TX", dist: "24 mi", price: "$1,199", specs: ["220 lb", "Rowing"], categorySlug: "home-gym" },
  { id: "10", ph: "Peloton Tread", cond: "Like new", title: "Peloton Tread with Guide", loc: "Leander, TX", dist: "17 mi", price: "$1,899", specs: ["Tread", "2023"], categorySlug: "peloton-tread" },
  { id: "11", ph: "Hydrow Rower", cond: "Excellent", title: "Hydrow Pro Rowing Machine", loc: "West Lake Hills, TX", dist: "9 mi", price: "$1,450", specs: ["Live", "Foldaway"], categorySlug: "hydrow-pro-rowing-machine" },
  { id: "12", ph: "Peloton Row", cond: "Like new", title: "Peloton Row with Accessories", loc: "Austin, TX", dist: "7 mi", price: "$2,395", specs: ["2023", "Mat"], categorySlug: "peloton-row" },
  { id: "13", ph: "Precor 885", cond: "Good", title: "Precor 885 Commercial Treadmill", loc: "Buda, TX", dist: "21 mi", price: "$1,150", specs: ["Commercial", "Ground"], categorySlug: "treadmills" },
  { id: "14", ph: "Master Spas Swim", cond: "Good", title: "Master Spas Swim Spa H2X Trainer", loc: "Leander, TX", dist: "17 mi", price: "$12,900", specs: ["Swim", "Heated"], categorySlug: "swim-spa" },
  { id: "15", ph: "Yamaha Golf", cond: "Excellent", title: "Yamaha Drive2 Golf Cart", loc: "Cedar Park, TX", dist: "18 mi", price: "$6,750", specs: ["Gas", "2-seat"], categorySlug: "golf-carts" },
];

export const BROWSE_CHIPS = [
  { label: "All", border: "var(--maroon)", bg: "var(--maroon)", fg: "#fff", slug: "" },
  { label: "Treadmills", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)", slug: "treadmills" },
  { label: "Peloton Bike+", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)", slug: "peloton-bike-plus" },
  { label: "Hot Tubs", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)", slug: "hot-tub" },
  { label: "Golf Carts", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)", slug: "golf-carts" },
  { label: "Saunas", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)", slug: "sauna" },
];
