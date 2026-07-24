// View-model data for the marketplace shell. Shapes match the design's
// template bindings exactly; the taxonomy mirrors the live trycommonplace.com
// mega-menu (parent categories Fitness / Wellness / Vehicles and their real
// subcategories). Real inventory replaces the sample FEED once Postgres is wired.

export interface CatItem {
  name: string;
  slug: string;
  /** Optional third-level subcategories (e.g. Fitness → Strength → Squat Rack). */
  children?: CatItem[];
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
      {
        name: "Peloton",
        slug: "peloton",
        children: [
          { name: "Peloton Bike", slug: "peloton-bike-2nd-gen" },
          { name: "Peloton Bike+", slug: "peloton-bike-plus" },
          { name: "Peloton Tread", slug: "peloton-tread" },
          { name: "Peloton Tread+", slug: "peloton-tread-plus" },
          { name: "Peloton Row", slug: "peloton-row" },
        ],
      },
      {
        name: "Rowing",
        slug: "rower",
        children: [
          { name: "Peloton Row", slug: "peloton-row" },
          { name: "Hydrow", slug: "hydrow-pro-rowing-machine" },
          { name: "Concept2", slug: "concept2" },
          { name: "Ergatta", slug: "ergatta" },
        ],
      },
      {
        name: "Treadmills",
        slug: "treadmills",
        children: [
          { name: "Peloton Tread", slug: "peloton-tread" },
          { name: "Peloton Tread+", slug: "peloton-tread-plus" },
          { name: "NordicTrack", slug: "nordictrack-treadmill" },
          { name: "ProForm", slug: "proform-treadmill" },
        ],
      },
      { name: "Tonal", slug: "tonal" },
      {
        name: "Strength",
        slug: "strength",
        children: [
          { name: "Squat Rack", slug: "squat-rack" },
          { name: "Power Rack", slug: "power-rack" },
          { name: "Cable Machine", slug: "cable-machine" },
          { name: "Functional Trainer", slug: "functional-trainer" },
          { name: "Smith Machine", slug: "smith-machine" },
          { name: "Adjustable Dumbbells", slug: "adjustable-dumbbells" },
        ],
      },
      { name: "Ellipticals", slug: "elliptical" },
      { name: "Spin Bikes", slug: "spin-bike" },
      { name: "Recumbent Bikes", slug: "recumbent-bike" },
      { name: "Air Bikes", slug: "air-bike" },
      { name: "Stair Climbers", slug: "stair-climber" },
      { name: "Home Gyms", slug: "home-gym" },
    ],
  },
  {
    name: "Wellness",
    iconPath: "M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10Z",
    bg: "var(--blueBg)",
    fg: "var(--blueInk)",
    items: [
      { name: "Hot Tubs", slug: "hot-tubs" },
      { name: "Sauna", slug: "sauna" },
      { name: "Swim Spa", slug: "swim-spa" },
      { name: "Massage Chair", slug: "massage-chair" },
      { name: "Cold Plunge", slug: "cold-plunge" },
    ],
  },
  {
    name: "Appliances",
    iconPath: "M6 3h12v18H6zM6 9h12M9 6h.01M9 13h.01",
    bg: "var(--yellowBg)",
    fg: "var(--gold)",
    items: [
      { name: "Refrigerators", slug: "refrigerators" },
      { name: "Washers", slug: "washer" },
      { name: "Dryers", slug: "dryer" },
      { name: "Dishwashers", slug: "dishwasher" },
      { name: "Ranges & Ovens", slug: "electric-range" },
    ],
  },
  {
    name: "Furniture",
    iconPath: "M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M2 16v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1M4 16v3M20 16v3",
    bg: "#efe7f3",
    fg: "var(--purple)",
    items: [
      { name: "Sofas", slug: "sofas" },
      { name: "Sectionals", slug: "sectionals" },
      { name: "Dining Tables", slug: "dining-tables" },
      { name: "Coffee Tables", slug: "coffee-tables" },
      { name: "Desks", slug: "desks" },
      { name: "Dressers", slug: "dressers" },
      { name: "Bookshelves", slug: "bookshelves" },
      { name: "Lamps", slug: "lamps" },
    ],
  },
  {
    name: "Vehicles",
    iconPath: "M5 16a2 2 0 1 0 4 0M15 16a2 2 0 1 0 4 0M3 16V8h11l4 4h3v4",
    bg: "var(--greenBg)",
    fg: "var(--green)",
    items: [
      { name: "All Vehicles", slug: "vehicles" },
      { name: "Cars & Trucks", slug: "cars" },
      { name: "Golf Carts", slug: "golf-carts" },
      { name: "Scooters / Vespa", slug: "scooters" },
      { name: "ATV", slug: "atv" },
      { name: "RV / Motorhome", slug: "rv-motorhome" },
      { name: "Lawn Mower", slug: "lawn-mower" },
    ],
  },
];

/** Every category AND subcategory, flattened — parents first, then their children. */
export const ALL_CATS: CatItem[] = CAT_GROUPS.flatMap((g) =>
  g.items.flatMap((it) => (it.children && it.children.length ? [it, ...it.children] : [it])),
);

/** Flat list of every category name — used by the create-listing type-ahead. */
export const ALL_CATEGORY_NAMES = ALL_CATS.map((i) => i.name);

export function findCategoryBySlug(slug: string): CatItem | undefined {
  return ALL_CATS.find((i) => i.slug === slug);
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
  /** Outlet domain — its favicon is the logo, exactly as the design specifies. */
  domain: string;
}
/** Google's favicon service — the design's `fav()` helper, verbatim. */
export const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
export const ARTICLES: Article[] = [
  { name: "New York Post", quote: "Eye-catching prices", font: "'Newsreader',serif", domain: "nypost.com", url: "https://nypost.com/2024/07/30/business/nyc-startup-peddles-used-pelotons-at-after-pandemic-darling-crash/" },
  { name: "TechCrunch", quote: "Next-day delivery in major cities", font: "'Inter Tight',sans-serif", domain: "techcrunch.com", url: "https://techcrunch.com/2024/08/03/trade-my-spin-is-building-a-business-around-used-peloton-equipment/" },
  { name: "Lifehacker", quote: "I'd buy used every time", font: "'Inter Tight',sans-serif", domain: "lifehacker.com", url: "https://lifehacker.com/health/why-you-should-buy-used-peloton" },
  { name: "CNBC", quote: "Faster & cheaper secondhand", font: "'Inter Tight',sans-serif", domain: "cnbc.com", url: "https://www.cnbc.com/2025/06/03/peloton-launching-resale-market-for-used-bikes-treadmills.html" },
  { name: "Fast Company", quote: "Pickup & delivery handled", font: "'Newsreader',serif", domain: "fastcompany.com", url: "https://www.fastcompany.com/91178440/buying-a-used-peloton-get-ready-for-a-95-activation-fee" },
  { name: "Financial Times", quote: "Marketplace for fitness equipment", font: "'Newsreader',serif", domain: "ft.com", url: "https://www.ft.com/content/0afc00f5-17fc-4e09-9d8f-3443fc9817e0" },
  { name: "Retail Insider", quote: "Alternative to Facebook Marketplace", font: "'Inter Tight',sans-serif", domain: "retail-insider.com", url: "https://retail-insider.com/retail-insider/2026/04/u-s-based-commonplace-marketplace-eyes-expansion-into-canada/" },
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
