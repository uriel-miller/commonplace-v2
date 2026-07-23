// Category-aware sell-form schema.
//
// Known categories get a tailored question set AND category-specific photo
// recommendations; everything else falls back to the generic ("type it in")
// spec. Schemas are keyed by a small set of "kinds" so many category slugs can
// share one spec (every Peloton bike variant → the same bike questions, etc.).
// Adding a category = add a slug→kind mapping (and a kind spec if new); no
// component changes required.
//
// questions[] mirror the REAL Commonplace WooCommerce ACF field groups
// (`listing-seller-form-acf` plugin), verbatim and in ACF menu_order. ACF type
// → Field.type mapping: checkbox → "chips", radio → "radio", select → "select",
// true_false → "radio" ["Yes","No"], text → "text", number → "number",
// textarea → "textarea", date_picker(year) → "number". The COMMON fields
// (asking/floor/original price, description, photos, seller contact) are
// rendered globally by the form and are intentionally NOT repeated here.

export type FieldType = "text" | "number" | "select" | "chips" | "radio" | "textarea";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** Only show this field when another field's (chips) answer includes a value. */
  showWhen?: { field: string; includes: string };
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

/* ------------------------------- Option lists ------------------------------- */
// Shared, reusable option arrays. Kept verbatim to the ACF choice lists.

const YES_NO = ["Yes", "No"];
const NEW_TO_POOR = ["New", "Like New", "Good", "Fair", "Poor"];
const EXCELLENT_TO_POOR = ["Excellent", "Good", "Fair", "Poor"];

function yearRange(start: number, endInclusive: number, trailing?: string): string[] {
  const out: string[] = [];
  for (let y = start; y <= endInclusive; y++) out.push(String(y));
  if (trailing) out.push(trailing);
  return out;
}

function numberRange(start: number, endInclusive: number): string[] {
  const out: string[] = [];
  for (let n = start; n <= endInclusive; n++) out.push(String(n));
  return out;
}

/* --------------------------------- Kind specs --------------------------------- */
export const KIND_SPECS: Record<string, SellSpec> = {
  // Peloton Bike — ACF group 8207
  pelotonBike: {
    kind: "pelotonBike",
    title: "Peloton Bike",
    questions: [
      { key: "year", label: "Year", type: "radio", required: true, options: ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025-present"] },
      {
        key: "condition",
        label: "Condition",
        type: "radio",
        required: true,
        options: ["Excellent (0-50 Rides)", "Very Good (51-200 Rides)", "Works Well (201-500 Rides)", "Over 500 Rides", "Need Some Love"],
      },
      {
        key: "accessories",
        label: "Accessories",
        type: "chips",
        options: ["Shoes", "Mat", "Weights", "Heart rate monitor", "Fan", "Laptop tray", "Pedal cages", "Seat cushion", "Sweat guard"],
      },
      { key: "shoes_size", label: "Shoe Size", type: "radio", options: numberRange(36, 47), showWhen: { field: "accessories", includes: "Shoes" } },
      {
        key: "damage",
        label: "Issues",
        type: "chips",
        required: true,
        options: [
          "No Damage",
          "Cracked or broken screen",
          "Bike does not turn on",
          "Bike makes noise while pedaling",
          "Resistance not calibrated",
          "Rust on or under bike",
          "Missing floor pegs",
          "Missing bottle holder",
          "Missing charging cable",
          "Staining or damage to handles",
          "Damaged seat",
          "Damaged pedals",
          "Dogs in home",
          "Cats in home",
          "Smoked in home",
        ],
      },
      { key: "serial_number", label: "Serial Number", type: "text" },
    ],
    photoTips: [
      "Full bike from the side, screen powered ON",
      "Close-up of the touchscreen home screen",
      "Resistance knob and pedals/cleats",
      "Serial number sticker (frame, near the flywheel)",
      "Any scratches, rust, or sweat wear",
    ],
  },

  // Peloton Tread — ACF group 72772
  pelotonTread: {
    kind: "pelotonTread",
    title: "Peloton Tread",
    questions: [
      { key: "condition", label: "Condition", type: "select", required: true, options: EXCELLENT_TO_POOR },
      { key: "year_of_manufacture", label: "Year of Manufacture", type: "number", required: true, placeholder: "e.g. 2023" },
      { key: "usage_count_rides", label: "Usage Count (Rides)", type: "text" },
      { key: "motor_functionality", label: "Motor Functionality", type: "select", required: true, options: YES_NO },
      { key: "touchscreen_condition", label: "Touchscreen Condition", type: "select", required: true, options: ["Fully Functional", "Minor Issues", "Major Issues", "Not Working"] },
      { key: "incline_functionality", label: "Incline Functionality", type: "select", required: true, options: YES_NO },
      { key: "speed_range_functionality", label: "Speed Range Functionality", type: "select", required: true, options: YES_NO },
      { key: "includes_mat", label: "Includes Mat", type: "select", options: YES_NO },
      { key: "subscription_status", label: "Subscription Status", type: "select", options: ["Active", "Inactive", "Not Applicable"] },
    ],
    photoTips: [
      "Full treadmill from the side, screen ON",
      "Running belt surface (look for wear down the center)",
      "Console / touchscreen home screen",
      "Serial number plate (front frame or under the hood)",
      "Any belt fraying, deck marks, or damage",
    ],
  },

  // Peloton Row — ACF group 72949
  pelotonRow: {
    kind: "pelotonRow",
    title: "Peloton Row",
    questions: [
      { key: "condition", label: "Condition", type: "select", required: true, options: EXCELLENT_TO_POOR },
      { key: "usage_rides", label: "Usage (Rides)", type: "number" },
      { key: "year_of_manufacture", label: "Year of Manufacture", type: "number", required: true, placeholder: "e.g. 2023" },
      { key: "accessories_included", label: "Accessories Included", type: "select", options: YES_NO },
      { key: "screen_functionality", label: "Screen Functionality", type: "select", required: true, options: ["Fully Functional", "Partially Functional", "Not Working"] },
      { key: "resistance_levels_working", label: "Resistance Levels Working", type: "select", required: true, options: YES_NO },
      { key: "damage_reported", label: "Damage Reported", type: "select", required: true, options: YES_NO },
      { key: "foldable_feature_working", label: "Foldable Feature Working", type: "select", options: YES_NO },
    ],
    photoTips: [
      "Full rower from the side, screen ON",
      "Seat rail and handle",
      "Screen / monitor home screen",
      "Serial number label",
      "Stored/upright position, any wear",
    ],
  },

  // Treadmill — ACF group 12946
  treadmill: {
    kind: "treadmill",
    title: "Treadmill",
    questions: [
      {
        key: "brand",
        label: "Brand",
        type: "radio",
        required: true,
        options: ["NordicTrack", "Sole Fitness", "ProForm", "Horizon Fitness", "Bowflex", "Echelon", "Life Fitness", "Precor", "TRUE Fitness", "Assault"],
      },
      { key: "model", label: "Model", type: "text" },
      {
        key: "type",
        label: "Type",
        type: "radio",
        options: [
          "Manual Treadmills",
          "Motorized Treadmills",
          "Folding Treadmills",
          "Compact Treadmills",
          "Incline Treadmills",
          "Desk Treadmills (Under-Desk/Walking Pad)",
          "Commercial Treadmills",
          "Curved Treadmills",
          "Hybrid Treadmills (Treadmill-Bike Combos)",
          "Medical/Rehabilitation Treadmills",
        ],
      },
      { key: "year", label: "Year", type: "select", required: true, options: yearRange(2010, 2024, "2025-Present") },
      {
        key: "condition",
        label: "Tread Usage/condition",
        type: "radio",
        required: true,
        options: ["Excellent (0-50 uses)", "Very Good (51-200 Rides)", "Work Well (201-500 Runs)", "Need Some Love"],
      },
      {
        key: "damage",
        label: "Issues",
        type: "chips",
        required: true,
        options: [
          "Motor not running",
          "Belt slipping or misalignment",
          "Screen freezing or unresponsive",
          "Bluetooth connectivity problems (app sync)",
          "Noisy operation (e.g., squeaking, grinding)",
          "Incline failure",
          "Power supply failure (won't turn on)",
          "Frame instability or wobble",
          "Speed sensor inaccuracy",
          "NO DAMAGE",
        ],
      },
      { key: "accessories", label: "Accessories", type: "chips", required: true, options: ["None", "Mat", "Weights", "Heart rate monitor", "Fan", "Laptop tray"] },
    ],
    photoTips: [
      "Full treadmill from the side",
      "Console powered on",
      "Running belt (center wear)",
      "Model/serial label (front frame)",
      "Folded position, if it folds",
    ],
  },

  // Elliptical — ACF group 72668
  elliptical: {
    kind: "elliptical",
    title: "Elliptical",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "number" },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "usage_hours", label: "Usage Hours", type: "number" },
      { key: "adjustable_resistance", label: "Adjustable Resistance", type: "select", options: YES_NO },
      { key: "adjustable_stride", label: "Adjustable Stride", type: "select", options: YES_NO },
      { key: "max_user_weight", label: "Maximum User Weight (lbs)", type: "number" },
      { key: "digital_display", label: "Digital Display", type: "select", options: YES_NO },
      { key: "heart_rate_monitor", label: "Heart Rate Monitor", type: "select", options: YES_NO },
    ],
    photoTips: [
      "Full elliptical from the side",
      "Console / display (on, if it has one)",
      "Pedals and handlebars",
      "Model/serial label",
      "Any rust or wear",
    ],
  },

  // Rower (rowing machine) — ACF group 72866
  rower: {
    kind: "rower",
    title: "Rowing Machine",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model_year", label: "Model Year", type: "number", required: true },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "usage_hours", label: "Usage Hours", type: "text" },
      { key: "resistance_type", label: "Resistance Type", type: "select", options: ["Magnetic", "Water", "Air", "Hydraulic"] },
      { key: "built_in_display", label: "Built-in Display", type: "select", options: YES_NO },
      { key: "subscription_required", label: "Subscription Required", type: "select", options: YES_NO },
      { key: "accessories_included", label: "Accessories Included", type: "text" },
    ],
    photoTips: [
      "Full rower from the side",
      "Screen / monitor powered on",
      "Seat rail and handle",
      "Serial number label",
      "Stored/upright position",
    ],
  },

  // Exercise Bike — ACF group 133615
  exerciseBike: {
    kind: "exerciseBike",
    title: "Exercise Bike",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text" },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "resistance_levels", label: "Resistance Levels", type: "number" },
      { key: "digital_display", label: "Digital Display", type: "select", options: YES_NO },
      { key: "adjustable_seat", label: "Adjustable Seat", type: "select", options: YES_NO },
      { key: "weight_capacity", label: "Weight Capacity (lbs)", type: "number" },
      { key: "foldable_design", label: "Foldable Design", type: "select", options: YES_NO },
    ],
    photoTips: [
      "Full bike from the side",
      "Console / screen (on, if it has one)",
      "Resistance knob and pedals",
      "Serial number label",
      "Any rust or wear",
    ],
  },

  // Hot Tub — ACF group 12953
  hotTub: {
    kind: "hotTub",
    title: "Hot Tub / Spa",
    questions: [
      {
        key: "brand",
        label: "Brand",
        type: "radio",
        required: true,
        options: [
          "Jacuzzi",
          "Hot Spring Spas",
          "Sundance Spas",
          "Bullfrog Spas",
          "Caldera Spas",
          "Master Spas",
          "Cal Spas",
          "Marquis Spas",
          "Dimension One Spas (D1)",
          "ThermoSpas",
          "Arctic Spas",
          "Wellis Spas",
          "Nordic Hot Tubs",
          "Beachcomber Hot Tubs",
          "Vita Spa",
          "Hydropool Hot Tubs",
          "Coast Spas",
          "Freeflow Spas",
          "Fantasy Spas",
          "Strong Spas",
        ],
      },
      { key: "Model", label: "Model", type: "text", required: true },
      { key: "condition", label: "Condition", type: "select", required: true, options: ["New", "Like New", "Excellent", "Good", "Fair"] },
      { key: "year", label: "Year", type: "number", placeholder: "e.g. 2021" },
      {
        key: "usage",
        label: "Usage",
        type: "radio",
        options: [
          "0-100 Hours (Near New)",
          "100-500 Hours (Lightly Used)",
          "500-1,000 Hours (Moderately Used)",
          "1,000-2,000 Hours (Well Used)",
          "2,000+ Hours (Extensively Used)",
        ],
      },
      {
        key: "accessories",
        label: "Accessories",
        type: "chips",
        options: [
          "No Accessories",
          "Insulated Cover",
          "Cover Lifter",
          "Steps or Ladder",
          "Jet Upgrade (e.g., extra or specialty jets)",
          "Filtration System (e.g., cartridge filters)",
          "Ozonator",
          "LED Lighting (e.g., multicolor)",
          "Bluetooth Audio System",
          "Waterfall Feature",
          "Maintenance Kit (e.g., chemicals, test strips)",
          "Towel Rack or Hooks",
        ],
      },
      {
        key: "issues",
        label: "Issues",
        type: "chips",
        required: true,
        options: [
          "No Issues",
          "Heater not warming properly",
          "Leaks in the tub or plumbing",
          "Jet pump failure or weak pressure",
          "Electrical problems (e.g., tripped breaker)",
          "Water quality issues (e.g., cloudy water)",
          "Control panel malfunction",
          "Excessive noise (e.g., pump or jets)",
          "Overheating components",
          "Rust or corrosion",
          "Filter clogs or breakdowns",
          "Insulation failure",
          "Cracks or wear in the shell",
          "Cover deterioration (e.g., rips, waterlogged)",
        ],
      },
      { key: "maximum_temperature", label: "Maximum Temperature", type: "number" },
      { key: "capa", label: "Capacity", type: "radio", options: ["2-3 Person", "4-5 Person", "6+ Person"] },
      { key: "Power_Requirements", label: "Power Requirements", type: "radio", options: ["110V (15-20 Amp)", "220V (30-50 Amp)", "240V (50-60 Amp)"] },
      { key: "seats", label: "Seats", type: "number" },
      { key: "jet_count", label: "Jet Count", type: "number" },
      { key: "sanitation_system", label: "Sanitation System", type: "radio", options: ["Chlorine", "Bromine", "Ionizers (copper/metal)", "Saltwater", "Ozone", "Other"] },
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

  // Sauna — ACF group 72826 (term 114)
  sauna: {
    kind: "sauna",
    title: "Sauna",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "number", required: true },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "capacity_people", label: "Capacity (People)", type: "number" },
      { key: "width_ft", label: "Width (ft)", type: "number" },
      { key: "depth_ft", label: "Depth (ft)", type: "number" },
      { key: "height_ft", label: "Height (ft)", type: "number" },
      { key: "infrared_technology", label: "Infrared Technology", type: "select", options: YES_NO },
      { key: "chromotherapy_lights", label: "Chromotherapy Lights", type: "select", options: YES_NO },
      { key: "bluetooth_speakers", label: "Bluetooth Speakers", type: "select", options: YES_NO },
      { key: "included_accessories", label: "Included Accessories", type: "text" },
    ],
    photoTips: [
      "Full exterior of the sauna",
      "Interior with benches and heater",
      "Control panel",
      "Heater / infrared panels close-up",
      "Any wood cracks, warping, or water damage",
    ],
  },

  // Cold Plunge — ACF group 73196 (term 119)
  coldPlunge: {
    kind: "coldPlunge",
    title: "Cold Plunge",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model_year", label: "Model Year", type: "number", required: true },
      { key: "motor_power_hp", label: "Motor Power (HP)", type: "number" },
      { key: "min_temperature_f", label: "Minimum Temperature (°F)", type: "number" },
      { key: "capacity_persons", label: "Capacity (Persons)", type: "number", required: true },
      { key: "material", label: "Material", type: "select", options: ["Plastic", "Metal", "Composite", "Other"] },
      { key: "insulated_cover_included", label: "Insulated Cover Included", type: "select", options: YES_NO },
      { key: "heating_function", label: "Heating Function", type: "select", options: YES_NO },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
    ],
    photoTips: [
      "Full tub, empty and clean",
      "Chiller / motor unit (front + ports)",
      "Control display / temperature reading",
      "Interior basin",
      "Any cracks, scale, or leaks",
    ],
  },

  // Swim Spa — ACF group 73632
  swimSpa: {
    kind: "swimSpa",
    title: "Swim Spa",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model_year", label: "Model Year", type: "number", required: true },
      { key: "dimensions", label: "Dimensions (ft)", type: "text" },
      { key: "water_capacity", label: "Water Capacity (gallons)", type: "number" },
      { key: "number_of_jets", label: "Number of Jets", type: "number" },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "heater_included", label: "Heater Included", type: "select", options: YES_NO },
      { key: "cover_included", label: "Cover Included", type: "select", options: YES_NO },
      { key: "installation_type", label: "Installation Type", type: "select", options: ["Above Ground", "In-Ground"] },
      { key: "power_requirement", label: "Power Requirement (Volts)", type: "number" },
    ],
    photoTips: [
      "Full swim spa with cover off",
      "Control panel",
      "Swim jets / current system",
      "Cabinet and corners",
      "Any cracks or fading",
    ],
  },

  // Tonal — ACF group 13646
  tonal: {
    kind: "tonal",
    title: "Tonal",
    questions: [
      { key: "year", label: "Year", type: "radio", required: true, options: yearRange(2018, 2024, "2025-Present") },
      {
        key: "condition",
        label: "Condition",
        type: "radio",
        required: true,
        options: ["Need Some Love", "Work Well (201-500 uses)", "Very Good (51-200 uses)", "Excellent (0-50 uses)"],
      },
      {
        key: "accessories",
        label: "Accessories",
        type: "chips",
        options: ["Smart Handles", "Smart Bar", "Bench", "Rope", "Workout Mat", "Roller", "Clips/Cables", "Wall Mount Hardware", "Heart Rate Monitor", "Cleaning Kit"],
      },
      {
        key: "damage",
        label: "Issues",
        type: "chips",
        required: true,
        options: [
          "No Issues",
          "Screen Malfunction",
          "Weight Arm Failure",
          "Software Glitches",
          "Cable Wear",
          "Power Supply Issues",
          "Mounting Damage",
          "Sensor Errors",
          "Cosmetic Damage",
          "Missing Accessories",
        ],
      },
      { key: "model", label: "Model", type: "radio", options: ["Tonal 1", "Tonal 2"] },
    ],
    photoTips: [
      "Full unit mounted on the wall, screen ON",
      "Screen home screen close-up",
      "Both arms extended",
      "All included Smart Accessories laid out",
      "Serial number (side or back of unit)",
    ],
  },

  // Home Gyms — ACF group 73314
  homeGym: {
    kind: "homeGym",
    title: "Home Gym / Strength",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "Bowflex" },
      { key: "model", label: "Model", type: "text", required: true, placeholder: "Xtreme 2 SE" },
      { key: "year", label: "Year", type: "number" },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "max_resistance_lbs", label: "Maximum Resistance (lbs)", type: "number" },
      { key: "upgradable_resistance", label: "Upgradable Resistance", type: "select", options: YES_NO },
      { key: "number_of_exercises", label: "Number of Exercises", type: "number" },
      { key: "includes_lat_tower", label: "Includes Lat Tower", type: "select", options: YES_NO },
      { key: "includes_leg_extension_curl", label: "Includes Leg Extension/Curl", type: "select", options: YES_NO },
      { key: "includes_rowing_station", label: "Includes Rowing Station", type: "select", options: YES_NO },
      { key: "assembly_required", label: "Assembly Required", type: "select", options: YES_NO },
      { key: "seat_material", label: "Seat Material", type: "text" },
    ],
    photoTips: [
      "Full unit, fully assembled",
      "Weight stack / plates",
      "All cables and attachments",
      "Model/serial label",
      "Any frayed cables or damage",
    ],
  },

  // Cable / Functional Trainer Machine — ACF group 73270
  functionalTrainer: {
    kind: "functionalTrainer",
    title: "Functional Trainer",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model_year", label: "Model Year", type: "number", required: true },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "max_weight_stack", label: "Maximum Weight Stack (lbs)", type: "number" },
      { key: "dimensions", label: "Dimensions (HxWxD in inches)", type: "text" },
      { key: "included_attachments", label: "Included Attachments", type: "text" },
      { key: "assembly_required", label: "Assembly Required", type: "select", required: true, options: YES_NO },
      { key: "equipment_weight", label: "Weight of Equipment (lbs)", type: "number" },
    ],
    photoTips: [
      "Full unit, fully assembled",
      "Weight stacks (both sides)",
      "All cable arms and attachments",
      "Model/serial label",
      "Any frayed cables or damage",
    ],
  },

  // Massage Chair — ACF group 76752
  massageChair: {
    kind: "massageChair",
    title: "Massage Chair",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "number", required: true },
      { key: "condition", label: "Condition", type: "select", required: true, options: ["Like New", "Good", "Fair", "Poor"] },
      { key: "usage_hours", label: "Usage Hours", type: "number" },
      { key: "length_inches", label: "Length (inches)", type: "number" },
      { key: "width_inches", label: "Width (inches)", type: "number" },
      { key: "height_inches", label: "Height (inches)", type: "number" },
      { key: "extended_length_inches", label: "Extended Length (inches)", type: "number" },
      { key: "has_remote_control", label: "Has Remote Control", type: "select", options: YES_NO },
      { key: "massage_programs", label: "Massage Programs", type: "text" },
      { key: "weight_capacity_lbs", label: "Weight Capacity (lbs)", type: "number" },
    ],
    photoTips: [
      "Full chair, upright",
      "Chair fully reclined",
      "Remote / control panel",
      "Model/serial label (under or back)",
      "Any tears, stains, or wear",
    ],
  },

  // Golf Carts — ACF group 101405
  golfCart: {
    kind: "golfCart",
    title: "Golf Cart",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "number" },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "battery_type", label: "Battery Type", type: "select", options: ["Lead-Acid", "Lithium-Ion", "Other"] },
      { key: "seating_capacity", label: "Seating Capacity", type: "number" },
      { key: "color", label: "Color", type: "text" },
      { key: "has_canopy", label: "Has Canopy", type: "select", options: YES_NO },
      { key: "mileage", label: "Mileage", type: "number" },
      { key: "charging_time_hours", label: "Charging Time (Hours)", type: "number" },
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

  // ATV — ACF group 131882
  atv: {
    kind: "atv",
    title: "ATV",
    questions: [
      { key: "brand", label: "Brand", type: "text", required: true },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "year", label: "Year", type: "number", required: true },
      { key: "engine_size_cc", label: "Engine Size (cc)", type: "number" },
      { key: "condition", label: "Condition", type: "select", required: true, options: NEW_TO_POOR },
      { key: "mileage_hours", label: "Mileage (hours)", type: "number" },
      { key: "drive_type", label: "Drive Type", type: "select", options: ["2WD", "4WD"] },
      { key: "color", label: "Color", type: "text" },
      { key: "has_title", label: "Has Title", type: "select", required: true, options: YES_NO },
      { key: "accessories_included", label: "Accessories Included", type: "text" },
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
  // Peloton Bike (all screen/gen variants share one spec)
  "peloton-bike": "pelotonBike",
  "peloton-bike-2nd-gen": "pelotonBike",
  "peloton-bike-3rd-gen": "pelotonBike",
  "peloton-bike-plus": "pelotonBike",
  "peloton-bike-2021": "pelotonBike",
  "peloton-bike-original-2020": "pelotonBike",
  // Peloton Tread
  "peloton-tread": "pelotonTread",
  "peloton-tread-plus": "pelotonTread",
  // Peloton Row
  "peloton-row": "pelotonRow",
  // Treadmills
  treadmills: "treadmill",
  "treadmill-entry-level": "treadmill",
  "treadmill-premium": "treadmill",
  "nordictrack-treadmill": "treadmill",
  "proform-treadmill": "treadmill",
  bowflex: "treadmill",
  // Elliptical
  elliptical: "elliptical",
  // Rowers
  rower: "rower",
  "rowing-machine": "rower",
  "hydrow-pro-rowing-machine": "rower",
  // Exercise / indoor / spin / assault bikes
  "exercise-bike": "exerciseBike",
  "indoor-bikes": "exerciseBike",
  "spin-bike": "exerciseBike",
  "assault-fitness-bike": "exerciseBike",
  // Hot tubs / spas
  "hot-tub": "hotTub",
  "hot-tubs": "hotTub",
  jacuzzi: "hotTub",
  "hot-spring": "hotTub",
  // Sauna
  sauna: "sauna",
  "infrared-sauna": "sauna",
  // Cold plunge
  "cold-plunge": "coldPlunge",
  // Swim spa
  "swim-spa": "swimSpa",
  // Tonal
  tonal: "tonal",
  // Home gym / strength
  "home-gym": "homeGym",
  "home-gyms": "homeGym",
  "smith-machine": "homeGym",
  // Functional / cable trainer
  "functional-trainer": "functionalTrainer",
  "cable-functional-trainer-machine": "functionalTrainer",
  // Massage chair
  "massage-chair": "massageChair",
  // Golf carts
  "golf-carts": "golfCart",
  // ATV
  atv: "atv",
  // Long-tail → generic
  reformer: "generic",
  dumbbell: "generic",
  "float-pod": "generic",
};

/** Resolve the sell spec for a category slug (generic fallback for long-tail). */
export function resolveSellSpec(slug: string | null | undefined): SellSpec {
  if (!slug) return KIND_SPECS.generic;
  const kind = SLUG_TO_KIND[slug];
  return (kind && KIND_SPECS[kind]) || KIND_SPECS.generic;
}
