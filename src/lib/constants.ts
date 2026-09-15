import type { HardNoId, ItemCategory, OccasionId, PriorityId, ShapeId, TorsoId, VibeId } from "./types";

export const APP_NAME = "Atelier";
export const LOOK_COUNT = 4;

export const SHAPES: { id: ShapeId; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Even through shoulder, waist, and hip" },
  { id: "hourglass", label: "Defined waist", hint: "Shoulder and hip stay in conversation — the hourglass line" },
  { id: "soft-middle", label: "Soft through the middle", hint: "A little more ease at the waist" },
  { id: "broad-shoulder", label: "Broader through the shoulder", hint: "The line starts strong up top" },
  { id: "long-line", label: "A longer line", hint: "Length is the quiet advantage" },
];

export const TORSOS: { id: TorsoId; label: string; hint: string }[] = [
  { id: "long", label: "A longer torso", hint: "More distance from shoulder to waist" },
  { id: "medium", label: "A medium torso", hint: "The usual proportion" },
  { id: "short", label: "A shorter torso", hint: "The waist sits a little higher" },
];

export const OCCASIONS: { id: OccasionId; label: string; icon: "briefcase" | "cup" | "glass" | "plane" | "calendar" }[] = [
  { id: "work", label: "Work", icon: "briefcase" },
  { id: "weekend", label: "Weekend", icon: "cup" },
  { id: "night", label: "Night out", icon: "glass" },
  { id: "travel", label: "Travel", icon: "plane" },
  { id: "event", label: "Event", icon: "calendar" },
];

export const VIBES: { id: VibeId; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "classic", label: "Classic" },
  { id: "street", label: "Street" },
  { id: "soft", label: "Soft" },
];

export const PRIORITIES: { id: PriorityId; label: string }[] = [
  { id: "comfort", label: "Comfort" },
  { id: "fit", label: "A good fit" },
  { id: "fabric", label: "Fabric feel" },
  { id: "ease", label: "Easy care" },
  { id: "versatility", label: "Versatility" },
  { id: "polish", label: "A finished look" },
  { id: "stretch", label: "Room to spend" },
];

export const HARD_NOS: { id: HardNoId; label: string }[] = [
  { id: "logos", label: "Logos" },
  { id: "neon", label: "Neon" },
  { id: "ultra-baggy", label: "Ultra baggy" },
  { id: "heels", label: "Heels" },
];

export const SIZES = ["XS", "S", "M", "L", "XL"];

export const CATEGORIES: { id: ItemCategory | "other"; label: string }[] = [
  { id: "outerwear", label: "Outerwear" },
  { id: "knit", label: "Knit" },
  { id: "shirt", label: "Shirt" },
  { id: "tee", label: "Tee" },
  { id: "trousers", label: "Trousers" },
  { id: "shorts", label: "Shorts" },
  { id: "shoes", label: "Shoes" },
  { id: "accessory", label: "Accessory" },
  { id: "other", label: "Other" },
];

export const DEEP_STEP_TOTAL = 5;

export const DEEP_STEPS = [
  { id: "color", label: "Color", time: "~1 min", href: "/personalize/color" },
  { id: "styles", label: "Visual styles", time: "~1 min", href: "/personalize/styles" },
  { id: "prefs", label: "Occasions & prefs", time: "~1 min", href: "/personalize/prefs" },
  { id: "budget", label: "Budget", time: "~1 min", href: "/personalize/budget" },
] as const;
