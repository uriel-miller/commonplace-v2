// View-model data for the marketplace shell. Shapes match the design's
// template bindings exactly; content is representative Commonplace inventory
// (real data replaces this once Postgres is wired — the layout is unchanged).

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

export const CAT_GROUPS: CatGroup[] = [
  {
    name: "Fitness equipment",
    iconPath: "M6 12h12M4 9v6M20 9v6M2 10.5v3M22 10.5v3",
    bg: "var(--tint)",
    fg: "var(--maroon)",
    items: [
      { name: "Treadmills", slug: "treadmills" },
      { name: "Peloton", slug: "peloton" },
      { name: "Ellipticals", slug: "ellipticals" },
      { name: "Home gyms", slug: "home-gyms" },
      { name: "Tonal", slug: "tonal" },
    ],
  },
  {
    name: "Wellness & recovery",
    iconPath: "M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10Z",
    bg: "var(--blueBg)",
    fg: "var(--blueInk)",
    items: [
      { name: "Hot tubs", slug: "hot-tubs" },
      { name: "Saunas", slug: "saunas" },
      { name: "Cold plunges", slug: "cold-plunges" },
    ],
  },
  {
    name: "Outdoor & vehicles",
    iconPath: "M5 16a2 2 0 1 0 4 0M15 16a2 2 0 1 0 4 0M3 16V8h11l4 4h3v4",
    bg: "var(--greenBg)",
    fg: "var(--green)",
    items: [
      { name: "Golf carts", slug: "golf-carts" },
      { name: "Vehicles", slug: "vehicles" },
    ],
  },
  {
    name: "Home & living",
    iconPath: "M4 11 12 4l8 7M6 10v9h12v-9",
    bg: "var(--yellowBg)",
    fg: "var(--gold)",
    items: [
      { name: "Furniture", slug: "furniture" },
      { name: "Appliances", slug: "appliances" },
      { name: "Pianos", slug: "pianos" },
      { name: "Pool tables", slug: "pool-tables" },
    ],
  },
];

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
  { id: "2", ph: "Peloton Bike+", cond: "Like new", title: "Peloton Bike+ with Shoes & Weights", loc: "Round Rock, TX", dist: "14 mi", price: "$1,295", specs: ["Bike+", "2022", "Cleats"], categorySlug: "peloton" },
  { id: "3", ph: "Master Spas", cond: "Good", title: "Master Spas Twilight Series Hot Tub", loc: "Cedar Park, TX", dist: "18 mi", price: "$4,499", specs: ["6-person", "Saltwater"], categorySlug: "hot-tubs" },
  { id: "4", ph: "Tonal", cond: "Excellent", title: "Tonal Smart Home Gym + Accessories", loc: "Austin, TX", dist: "4 mi", price: "$2,100", specs: ["Smart", "Wall-mount"], categorySlug: "tonal" },
  { id: "5", ph: "Sole E95", cond: "Good", title: "Sole E95 Elliptical Trainer", loc: "Pflugerville, TX", dist: "11 mi", price: "$749", specs: ["Commercial", "20 lb"], categorySlug: "ellipticals" },
  { id: "6", ph: "Club Car Onward", cond: "Like new", title: "Club Car Onward 4-Passenger Golf Cart", loc: "Georgetown, TX", dist: "22 mi", price: "$7,999", specs: ["Electric", "Lithium"], categorySlug: "golf-carts" },
  { id: "7", ph: "Sun Home Sauna", cond: "New", title: "Sun Home Luminar 2-Person Infrared Sauna", loc: "Austin, TX", dist: "8 mi", price: "$3,899", specs: ["Infrared", "2-person"], categorySlug: "saunas" },
  { id: "8", ph: "The Plunge", cond: "Excellent", title: "The Plunge — All-In Cold Plunge Tub", loc: "Lakeway, TX", dist: "19 mi", price: "$5,499", specs: ["Chiller", "Filter"], categorySlug: "cold-plunges" },
  { id: "9", ph: "Bowflex Revolution", cond: "Good", title: "Bowflex Revolution Home Gym", loc: "Kyle, TX", dist: "24 mi", price: "$1,199", specs: ["220 lb", "Rowing"], categorySlug: "home-gyms" },
  { id: "10", ph: "West Elm Harmony", cond: "Like new", title: "West Elm Harmony 3-Seat Sofa", loc: "Austin, TX", dist: "3 mi", price: "$899", specs: ["Fabric", "3-seat"], categorySlug: "furniture" },
  { id: "11", ph: "Sub-Zero 36in", cond: "Good", title: "Sub-Zero 36\" Built-In Refrigerator", loc: "West Lake Hills, TX", dist: "9 mi", price: "$3,499", specs: ['36"', "Panel-ready"], categorySlug: "appliances" },
  { id: "12", ph: "Yamaha U1", cond: "Excellent", title: "Yamaha U1 Upright Piano", loc: "Austin, TX", dist: "7 mi", price: "$3,799", specs: ["Upright", "Bench"], categorySlug: "pianos" },
  { id: "13", ph: "Precor 885", cond: "Good", title: "Precor 885 Commercial Treadmill", loc: "Buda, TX", dist: "21 mi", price: "$1,150", specs: ["Commercial", "Ground"], categorySlug: "treadmills" },
  { id: "14", ph: "Peloton Tread", cond: "Like new", title: "Peloton Tread with Guide", loc: "Leander, TX", dist: "17 mi", price: "$1,899", specs: ["Tread", "2023"], categorySlug: "peloton" },
  { id: "15", ph: "Brunswick 8ft", cond: "Good", title: "Brunswick 8ft Slate Pool Table", loc: "Cedar Park, TX", dist: "18 mi", price: "$1,650", specs: ["Slate", "8 ft"], categorySlug: "pool-tables" },
];

export const BROWSE_CHIPS = [
  { label: "All", border: "var(--maroon)", bg: "var(--maroon)", fg: "#fff" },
  { label: "Treadmills", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)" },
  { label: "Peloton", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)" },
  { label: "Hot Tubs", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)" },
  { label: "Golf Carts", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)" },
  { label: "Saunas", border: "var(--line)", bg: "var(--paper)", fg: "var(--ink)" },
];
