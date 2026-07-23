// Category-aware sell-form schema.
//
// Known categories get a tailored question set AND category-specific photo
// recommendations; everything else falls back to the generic ("type it in")
// spec. Schemas are keyed by a small set of "kinds" so many category slugs can
// share one spec (every Peloton bike variant → the same bike questions, etc.).
// Adding a category = add a slug→kind mapping (and a kind spec if new); no
// component changes required.

export type FieldType = "text" | "number" | "select" | "chips" | "radio" | "textarea";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  help?: string;
  required?: boolean;
}

export interface SellSpec {
  /** Internal kind id (also used as a stable key). */
  kind: string;
  /** Human label for the resolved category kind. */
  title: string;
  /** Whether this is the generic long-tail fallback. */
  generic?: boolean;
  questions: Field[];
  /** Ordered, specific photo prompts the seller should capture. */
  photoTips: string[];
}

const ISSUES: Field = {
  key: "issues",
  label: "Any issues, wear, or missing parts?",
  type: "textarea",
  placeholder: "Be honest — squeaks, cracks, error codes, missing accessories. It speeds up pickup.",
};

/* --------------------------------- Kind specs --------------------------------- */
export const KIND_SPECS: Record<string, SellSpec> = {
  pelotonBike: {
    kind: "pelotonBike",
    title: "Peloton Bike",
    questions: [
      { key: "model", label: "Model", type: "select", options: ["Bike (Original 2020)", "Bike 2021", "Bike+ (Plus)"], required: true },
      {
        key: "screenGen",
        label: "Screen generation",
        type: "select",
        options: [
          "Gen 3 — model RB1VQ (fully supported)",
          "Gen 2 — model RB1V1 (ages, still plays classes)",
          "Gen 1 — QUARTZ/001 (bricked — no class streaming)",
          "Not sure",
        ],
        help: "Check the sticker on the back of the screen. Gen 1 has an orange power button and a sticker ending in QUARTZ or 001 — Peloton cut off class streaming for it in June 2024. Gen 2 = model RB1V1. Gen 3 = model RB1VQ (baseline standard).",
      },
      { key: "year", label: "Year purchased", type: "number", placeholder: "e.g. 2022" },
      { key: "rides", label: "Approx. total rides / usage", type: "select", options: ["0–50 (low)", "50–250", "250–1000", "1000+"] },
      { key: "accessories", label: "Included accessories", type: "chips", options: ["Cycling shoes", "3 lb weights", "5 lb weights", "10 lb weights", "Mat", "Heart-rate band", "Extra cleats", "Water bottle", "Bike weights holder"] },
      { key: "powersOn", label: "Screen powers on & rotates (Bike+)", type: "radio", options: ["Yes", "No", "N/A"] },
      { key: "subscription", label: "Subscription status", type: "select", options: ["Active", "Cancelled", "Never activated"] },
      ISSUES,
    ],
    photoTips: [
      "Full bike from the side, screen powered ON",
      "Close-up of the touchscreen home screen",
      "Resistance knob and pedals/cleats",
      "Serial number sticker (frame, near the flywheel)",
      "Any scratches, rust, or sweat wear",
    ],
  },
  pelotonTread: {
    kind: "pelotonTread",
    title: "Peloton Tread",
    questions: [
      { key: "model", label: "Model", type: "select", options: ["Tread", "Tread+"], required: true },
      { key: "miles", label: "Approx. miles / hours of use", type: "text", placeholder: "e.g. ~400 mi" },
      { key: "beltCondition", label: "Belt & deck condition", type: "select", options: ["Like new", "Light wear", "Worn but working", "Needs service"] },
      { key: "accessories", label: "Included accessories", type: "chips", options: ["Safety key", "Mat", "Heart-rate band"] },
      ISSUES,
    ],
    photoTips: [
      "Full treadmill from the side, screen ON",
      "Running belt surface (look for wear down the center)",
      "Console / touchscreen home screen",
      "Serial number plate (front frame or under the hood)",
      "Any belt fraying, deck marks, or damage",
    ],
  },
  treadmill: {
    kind: "treadmill",
    title: "Treadmill",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "NordicTrack, ProForm, Sole, Bowflex…", required: true },
      { key: "model", label: "Model", type: "text", placeholder: "e.g. Commercial 1750" },
      { key: "folding", label: "Folds for storage", type: "radio", options: ["Yes", "No"] },
      { key: "capacity", label: "Max user weight", type: "text", placeholder: "e.g. 300 lb" },
      { key: "consoleWorks", label: "Console / incline working", type: "radio", options: ["Yes", "No", "Partly"] },
      { key: "accessories", label: "Included accessories", type: "chips", options: ["Safety key", "Tablet holder", "Mat", "Owner's manual", "Lubricant"] },
      ISSUES,
    ],
    photoTips: [
      "Full treadmill from the side",
      "Console powered on",
      "Running belt (center wear)",
      "Model/serial label (front frame)",
      "Folded position, if it folds",
    ],
  },
  rower: {
    kind: "rower",
    title: "Rowing Machine",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "Hydrow, Peloton, Concept2, Ergatta…", required: true },
      { key: "resistance", label: "Resistance type", type: "select", options: ["Magnetic", "Water", "Air", "Electromagnetic"] },
      { key: "foldable", label: "Folds / stands upright for storage", type: "radio", options: ["Yes", "No"] },
      { key: "accessories", label: "Included accessories", type: "chips", options: ["Mat", "Heart-rate band", "Device holder"] },
      ISSUES,
    ],
    photoTips: [
      "Full rower from the side",
      "Screen / monitor powered on",
      "Seat rail and handle",
      "Serial number label",
      "Stored/upright position",
    ],
  },
  indoorBike: {
    kind: "indoorBike",
    title: "Indoor / Spin Bike",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "NordicTrack, Bowflex, Schwinn, Assault…", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "resistance", label: "Resistance type", type: "select", options: ["Magnetic", "Friction", "Air"] },
      { key: "console", label: "Has a screen / console", type: "radio", options: ["Yes", "No"] },
      ISSUES,
    ],
    photoTips: [
      "Full bike from the side",
      "Console / screen (on, if it has one)",
      "Resistance knob and pedals",
      "Serial number label",
      "Any rust or wear",
    ],
  },
  tonal: {
    kind: "tonal",
    title: "Tonal",
    questions: [
      { key: "generation", label: "Generation", type: "select", options: ["Gen 1", "Gen 2", "Not sure"] },
      { key: "mounted", label: "Currently wall-mounted", type: "radio", options: ["Yes", "No"] },
      { key: "accessories", label: "Smart Accessories included", type: "chips", options: ["Smart Handles", "Smart Bar", "Rope", "Bench", "Roller", "Mat"] },
      { key: "subscription", label: "Subscription status", type: "select", options: ["Active", "Cancelled", "Never activated"] },
      ISSUES,
    ],
    photoTips: [
      "Full unit mounted on the wall, screen ON",
      "Screen home screen close-up",
      "Both arms extended",
      "All included Smart Accessories laid out",
      "Serial number (side or back of unit)",
    ],
  },
  homeGym: {
    kind: "homeGym",
    title: "Home Gym / Strength",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "Bowflex, Life Fitness, Rogue…", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "weightStack", label: "Max weight / stack", type: "text", placeholder: "e.g. 210 lb stack" },
      { key: "attachments", label: "Attachments included", type: "chips", options: ["Lat bar", "Cable handles", "Bench", "Leg developer", "Plates"] },
      ISSUES,
    ],
    photoTips: [
      "Full unit, fully assembled",
      "Weight stack / plates",
      "All cables and attachments",
      "Model/serial label",
      "Any frayed cables or damage",
    ],
  },
  hotTub: {
    kind: "hotTub",
    title: "Hot Tub / Spa",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "Master Spas, Jacuzzi, Hot Spring…", required: true },
      { key: "capacity", label: "Seating capacity", type: "select", options: ["2-person", "3-4 person", "5-6 person", "7+ person"] },
      { key: "water", label: "Water system", type: "select", options: ["Saltwater", "Chlorine/Bromine", "Not sure"] },
      { key: "cover", label: "Cover included", type: "radio", options: ["Yes", "No"] },
      { key: "working", label: "Heater & pumps working", type: "radio", options: ["Yes", "No", "Not sure"] },
      { key: "dims", label: "Approx. dimensions", type: "text", placeholder: "e.g. 84 x 84 x 36 in" },
      ISSUES,
    ],
    photoTips: [
      "Full tub with the cover off",
      "Control panel / topside display",
      "Jets and seating interior",
      "All four cabinet corners",
      "Equipment bay (pump/heater) if accessible",
      "Any cracks, fading, or leaks",
    ],
  },
  swimSpa: {
    kind: "swimSpa",
    title: "Swim Spa",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "length", label: "Length", type: "text", placeholder: "e.g. 15 ft" },
      { key: "swimSystem", label: "Swim system", type: "select", options: ["Jet propulsion", "Paddle wheel / current", "Not sure"] },
      { key: "working", label: "Heater & pumps working", type: "radio", options: ["Yes", "No", "Not sure"] },
      ISSUES,
    ],
    photoTips: [
      "Full swim spa with cover off",
      "Control panel",
      "Swim jets / current system",
      "Cabinet and corners",
      "Any cracks or fading",
    ],
  },
  sauna: {
    kind: "sauna",
    title: "Sauna",
    questions: [
      { key: "type", label: "Type", type: "select", options: ["Infrared", "Traditional (electric)", "Wood-burning"], required: true },
      { key: "capacity", label: "Capacity", type: "select", options: ["1-person", "2-person", "3-4 person", "5+ person"] },
      { key: "wood", label: "Wood type", type: "text", placeholder: "e.g. Canadian hemlock" },
      { key: "working", label: "Heater / panels working", type: "radio", options: ["Yes", "No", "Not sure"] },
      ISSUES,
    ],
    photoTips: [
      "Full exterior of the sauna",
      "Interior with benches and heater",
      "Control panel",
      "Heater / infrared panels close-up",
      "Any wood cracks, warping, or water damage",
    ],
  },
  coldPlunge: {
    kind: "coldPlunge",
    title: "Cold Plunge",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "The Plunge, Ice Barrel, Renu…", required: true },
      { key: "chiller", label: "Chiller included", type: "radio", options: ["Yes", "No"] },
      { key: "tempRange", label: "Min temperature", type: "text", placeholder: "e.g. 39°F" },
      { key: "filtration", label: "Has filtration / ozone", type: "radio", options: ["Yes", "No", "Not sure"] },
      ISSUES,
    ],
    photoTips: [
      "Full tub, empty and clean",
      "Chiller unit (front + ports)",
      "Control display / temperature reading",
      "Interior basin",
      "Any cracks, scale, or leaks",
    ],
  },
  massageChair: {
    kind: "massageChair",
    title: "Massage Chair",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "Osaki, Human Touch, Kahuna…", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "zeroG", label: "Zero-gravity recline", type: "radio", options: ["Yes", "No"] },
      { key: "working", label: "All functions working", type: "radio", options: ["Yes", "No", "Partly"] },
      ISSUES,
    ],
    photoTips: [
      "Full chair, upright",
      "Chair fully reclined",
      "Remote / control panel",
      "Model/serial label (under or back)",
      "Any tears, stains, or wear",
    ],
  },
  car: {
    kind: "car",
    title: "Vehicle",
    questions: [
      { key: "make", label: "Make", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "number", required: true },
      { key: "mileage", label: "Mileage", type: "number", placeholder: "e.g. 62000" },
      { key: "title", label: "Title status", type: "select", options: ["Clean", "Salvage/Rebuilt", "Lien", "No title"] },
      { key: "transmission", label: "Transmission", type: "select", options: ["Automatic", "Manual"] },
      { key: "vin", label: "VIN", type: "text", placeholder: "17-character VIN" },
      ISSUES,
    ],
    photoTips: [
      "Front 3/4 exterior",
      "Rear 3/4 exterior",
      "Full interior (front + back seats)",
      "Odometer reading",
      "Engine bay",
      "Tires and any dents/scratches",
      "VIN plate (dash or door jamb)",
    ],
  },
  golfCart: {
    kind: "golfCart",
    title: "Golf Cart",
    questions: [
      { key: "brand", label: "Brand", type: "text", placeholder: "Club Car, EZGO, Yamaha…", required: true },
      { key: "power", label: "Power", type: "select", options: ["Electric", "Gas", "Lithium"], required: true },
      { key: "battery", label: "Battery type & age (if electric)", type: "text", placeholder: "e.g. Lithium, 1 yr" },
      { key: "seats", label: "Seats", type: "select", options: ["2", "4", "6"] },
      { key: "streetLegal", label: "Street legal / LSV", type: "radio", options: ["Yes", "No"] },
      { key: "accessories", label: "Included accessories", type: "chips", options: ["Charger", "Cover", "Windshield", "Extra seats / rear seat", "Cooler", "Lift kit", "Custom wheels", "Bluetooth / stereo"] },
      ISSUES,
    ],
    photoTips: [
      "Front 3/4 exterior",
      "Rear + cargo/seat",
      "Seats and dash",
      "Battery compartment",
      "Serial/VIN plate",
      "Tires and body scratches",
    ],
  },
  atv: {
    kind: "atv",
    title: "ATV",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "year", label: "Year", type: "number" },
      { key: "engine", label: "Engine size (cc)", type: "text", placeholder: "e.g. 450cc" },
      { key: "hours", label: "Hours / mileage", type: "text" },
      { key: "title", label: "Title status", type: "select", options: ["Clean", "No title", "Bill of sale only"] },
      ISSUES,
    ],
    photoTips: [
      "Front 3/4 exterior",
      "Rear + rack",
      "Odometer / hour meter",
      "Engine and undercarriage",
      "VIN/serial plate",
      "Tires and any damage",
    ],
  },
  rv: {
    kind: "rv",
    title: "RV / Motorhome",
    questions: [
      { key: "class", label: "Type", type: "select", options: ["Class A", "Class B (van)", "Class C", "Travel trailer", "Fifth wheel"], required: true },
      { key: "make", label: "Make", type: "text", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "year", label: "Year", type: "number", required: true },
      { key: "mileage", label: "Mileage (motorized)", type: "number" },
      { key: "length", label: "Length", type: "text", placeholder: "e.g. 32 ft" },
      { key: "sleeps", label: "Sleeps", type: "select", options: ["2", "3-4", "5-6", "7+"] },
      { key: "slides", label: "Slide-outs", type: "select", options: ["0", "1", "2", "3+"] },
      { key: "title", label: "Title status", type: "select", options: ["Clean", "Salvage", "Lien", "No title"] },
      { key: "systems", label: "Systems working (AC, generator, plumbing, slides)", type: "radio", options: ["All working", "Mostly", "Some issues"] },
      ISSUES,
    ],
    photoTips: [
      "Full exterior, driver side",
      "Full exterior, passenger side (slides out)",
      "Interior: living, kitchen, bed, bath",
      "Odometer + dash (motorized)",
      "Roof condition",
      "Tires and any body/water damage",
      "VIN plate and generator hours",
    ],
  },
  mower: {
    kind: "mower",
    title: "Lawn Mower",
    questions: [
      { key: "type", label: "Type", type: "select", options: ["Push", "Self-propelled", "Riding", "Zero-turn"], required: true },
      { key: "brand", label: "Brand", type: "text", placeholder: "John Deere, Toro, Cub Cadet…", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "power", label: "Power", type: "select", options: ["Gas", "Electric (corded)", "Battery"] },
      { key: "deck", label: "Deck size", type: "text", placeholder: "e.g. 42 in" },
      { key: "hours", label: "Hours (riding/zero-turn)", type: "text" },
      { key: "starts", label: "Starts & runs", type: "radio", options: ["Yes", "No", "Needs service"] },
      ISSUES,
    ],
    photoTips: [
      "Full mower, side view",
      "Engine / motor close-up",
      "Deck underside (blades)",
      "Hour meter or dash (riding)",
      "Model/serial plate",
      "Any rust, leaks, or damage",
    ],
  },
  generic: {
    kind: "generic",
    title: "Item details",
    generic: true,
    questions: [
      { key: "brand", label: "Brand / maker", type: "text", placeholder: "Optional" },
      { key: "dims", label: "Approx. dimensions & weight", type: "text", placeholder: "e.g. 80 x 40 x 30 in, ~120 lb" },
      { key: "description", label: "Describe your item", type: "textarea", placeholder: "What it is, condition, what's included, why you're selling.", required: true },
    ],
    photoTips: [
      "A clear front photo in good light",
      "A few angles (sides + back)",
      "Any brand/model or serial labels",
      "Close-ups of any damage or wear",
    ],
  },
};

/* ----------------------------- Slug → kind mapping ----------------------------- */
const SLUG_TO_KIND: Record<string, string> = {
  "peloton-bike-2nd-gen": "pelotonBike",
  "peloton-bike-plus": "pelotonBike",
  "peloton-bike-3rd-gen": "pelotonBike",
  "peloton-bike-2021": "pelotonBike",
  "peloton-bike-original-2020": "pelotonBike",
  "peloton-tread": "pelotonTread",
  "peloton-tread-plus": "pelotonTread",
  treadmills: "treadmill",
  "nordictrack-treadmill": "treadmill",
  "proform-treadmill": "treadmill",
  bowflex: "treadmill",
  rower: "rower",
  "hydrow-pro-rowing-machine": "rower",
  "peloton-row": "rower",
  "indoor-bikes": "indoorBike",
  "spin-bike": "indoorBike",
  "assault-fitness-bike": "indoorBike",
  elliptical: "treadmill",
  tonal: "tonal",
  "home-gym": "homeGym",
  "functional-trainer": "homeGym",
  "smith-machine": "homeGym",
  reformer: "homeGym",
  dumbbell: "generic",
  "hot-tub": "hotTub",
  jacuzzi: "hotTub",
  "hot-spring": "hotTub",
  "swim-spa": "swimSpa",
  sauna: "sauna",
  "infrared-sauna": "sauna",
  "cold-plunge": "coldPlunge",
  "massage-chair": "massageChair",
  "float-pod": "generic",
  cars: "car",
  "golf-carts": "golfCart",
  atv: "atv",
  "rv-motorhome": "rv",
  "lawn-mower": "mower",
};

/** Resolve the sell spec for a category slug (generic fallback for long-tail). */
export function resolveSellSpec(slug: string | null | undefined): SellSpec {
  if (!slug) return KIND_SPECS.generic;
  const kind = SLUG_TO_KIND[slug];
  return (kind && KIND_SPECS[kind]) || KIND_SPECS.generic;
}
