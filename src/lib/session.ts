import { cookies } from "next/headers";
import type {
  ChromaId,
  ColorId,
  ColorSourceId,
  ColorSwatch,
  HardNoId,
  MetalPreferenceId,
  OccasionId,
  PriorityId,
  ProfileSession,
  SeasonId,
  ShapeId,
  TorsoId,
  UndertoneId,
  ValueId,
  VibeId,
} from "./types";
import { SESSION_COOKIE } from "./types";
import { FRIEND_GENDER } from "./friend";
import { defaultSession } from "./generate";
import { normalizeSeasonId } from "./color-analysis";
import { normalizeClimateBand } from "./climate-locale";
import { parseAppearance, parseLookAge } from "./appearance";
import { parseFavColors } from "./fav-colors";
import { aggregateStyleSignalsFromVotes, parseStyleSignals } from "./style-signals";

const OCCASIONS = new Set<OccasionId>(["work", "weekend", "night", "travel", "event"]);
const COLORS = new Set<ColorId>([
  "navy",
  "black",
  "white",
  "grey",
  "camel",
  "cream",
  "chocolate",
  "olive",
  "stone",
  "sand",
  "charcoal",
  "red",
  "pink",
  "peach",
  "burgundy",
  "blue",
  "green",
  "multi",
]);
const VIBES = new Set<VibeId>(["minimal", "classic", "street", "soft"]);
const HARD_NOS = new Set<HardNoId>(["logos", "neon", "ultra-baggy", "heels"]);
const PRIORITIES = new Set<PriorityId>(["comfort", "fit", "fabric", "ease", "versatility", "polish", "stretch"]);
const SHAPES = new Set<ShapeId>(["balanced", "soft-middle", "broad-shoulder", "long-line", "hourglass"]);
const TORSOS = new Set<TorsoId>(["long", "medium", "short"]);
const UNDERTONES = new Set<UndertoneId>(["warm", "cool", "neutral"]);
const VALUES = new Set<ValueId>(["light", "medium", "dark", "deep"]);
const CHROMAS = new Set<ChromaId>(["bright", "muted"]);
const COLOR_SOURCES = new Set<ColorSourceId>(["photo", "season", "aspects"]);
const METALS = new Set<MetalPreferenceId>(["gold", "silver", "both"]);

function normalizeHex(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const hex = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{3,8}$/.test(hex) ? hex : null;
}

export function parseSession(raw: string | undefined): ProfileSession | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const data = JSON.parse(decoded) as ProfileSession;
    if (!data || typeof data !== "object") return null;
    return { ...defaultSession(), ...data, gender: FRIEND_GENDER };
  } catch {
    try {
      return { ...defaultSession(), ...(JSON.parse(raw) as ProfileSession), gender: FRIEND_GENDER };
    } catch {
      return null;
    }
  }
}

export async function readSession(): Promise<ProfileSession | null> {
  const jar = await cookies();
  return parseSession(jar.get(SESSION_COOKIE)?.value);
}

export async function writeSession(session: ProfileSession) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, JSON.stringify({ ...session, gender: FRIEND_GENDER }), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: Boolean(process.env.VERCEL),
    maxAge: 60 * 60 * 24 * 30,
  });
}

function allOf<T extends string>(data: FormData, key: string, allowed: Set<T>): T[] {
  return data.getAll(key).map(String).filter((value): value is T => allowed.has(value as T));
}

function optionalCm(data: FormData, key: string): number | undefined {
  const raw = data.get(key);
  if (typeof raw !== "string") return undefined;
  if (raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function mergeSessionFromForm(current: ProfileSession, data: FormData): ProfileSession {
  const next = { ...current, deepDone: { ...current.deepDone } };
  const name = data.get("name");
  if (typeof name === "string" && name.trim()) next.name = name.trim();

  const path = data.get("path");
  if (path === "quick" || path === "deep") next.path = path;

  next.gender = FRIEND_GENDER;

  const shape = data.get("shape");
  if (typeof shape === "string" && SHAPES.has(shape as ShapeId)) next.shape = shape as ShapeId;

  const torso = data.get("torso");
  if (typeof torso === "string" && TORSOS.has(torso as TorsoId)) next.torso = torso as TorsoId;

  const undertone = data.get("undertone");
  if (typeof undertone === "string" && UNDERTONES.has(undertone as UndertoneId)) {
    next.undertone = undertone as UndertoneId;
  }

  const value = data.get("value");
  if (typeof value === "string" && VALUES.has(value as ValueId)) {
    next.value = value === "dark" ? "deep" : (value as ValueId);
  }

  const chroma = data.get("chroma");
  if (typeof chroma === "string" && CHROMAS.has(chroma as ChromaId)) next.chroma = chroma as ChromaId;

  if (data.get("measurementsSet") === "1") {
    next.heightCm = optionalCm(data, "heightCm");
    next.chestCm = optionalCm(data, "chestCm");
    next.waistCm = optionalCm(data, "waistCm");
    next.hipsCm = optionalCm(data, "hipsCm");
    next.inseamCm = optionalCm(data, "inseamCm");
    next.shoulderCm = optionalCm(data, "shoulderCm");
    next.neckCm = optionalCm(data, "neckCm");
  } else {
    const height = data.get("heightCm");
    if (typeof height === "string" && height !== "") {
      const parsed = Number(height);
      if (Number.isFinite(parsed)) next.heightCm = parsed;
    }
  }

  const size = data.get("size");
  if (typeof size === "string" && size.trim()) next.size = size.trim();

  const timezone = data.get("timezone");
  const localeCity = data.get("localeCity");
  const localeRegion = data.get("localeRegion");
  const localeCountry = data.get("localeCountry");
  if (
    (typeof timezone === "string" && timezone.trim()) ||
    (typeof localeCity === "string" && localeCity.trim()) ||
    (typeof localeRegion === "string" && localeRegion.trim()) ||
    (typeof localeCountry === "string" && localeCountry.trim())
  ) {
    next.locale = {
      ...(next.locale ?? {}),
      ...(typeof localeCity === "string" && localeCity.trim() ? { city: localeCity.trim() } : {}),
      ...(typeof localeRegion === "string" && localeRegion.trim() ? { region: localeRegion.trim() } : {}),
      ...(typeof localeCountry === "string" && localeCountry.trim() ? { country: localeCountry.trim() } : {}),
      ...(typeof timezone === "string" && timezone.trim() ? { timezone: timezone.trim() } : {}),
    };
  }
  const climateBand = data.get("climateBand");
  if (typeof climateBand === "string") {
    const normalized = normalizeClimateBand(climateBand);
    if (normalized) next.climateBand = normalized;
  }

  if (data.has("occasion")) next.occasions = allOf(data, "occasion", OCCASIONS);
  const occasionNote = data.get("occasionNote") ?? data.get("styleBrief") ?? data.get("details");
  if (typeof occasionNote === "string") {
    next.styleBrief = occasionNote.trim().slice(0, 280);
  }
  if (data.has("color")) next.colors = allOf(data, "color", COLORS);
  if (data.has("vibe")) next.vibes = allOf(data, "vibe", VIBES);
  if (data.has("hardNo")) next.hardNos = allOf(data, "hardNo", HARD_NOS);
  if (data.get("prioritiesSet") === "1") next.priorities = allOf(data, "priority", PRIORITIES);
  if (data.has("likedStyle")) next.likedStyleIds = data.getAll("likedStyle").map(String);
  const likedAdd = data.get("likedStyleAdd");
  if (typeof likedAdd === "string" && likedAdd && !next.likedStyleIds.includes(likedAdd)) {
    next.likedStyleIds = [...next.likedStyleIds, likedAdd];
  }
  if (data.has("dislikedStyle")) next.dislikedStyleIds = data.getAll("dislikedStyle").map(String);
  const dislikedAdd = data.get("dislikedStyleAdd");
  if (typeof dislikedAdd === "string" && dislikedAdd && !next.dislikedStyleIds.includes(dislikedAdd)) {
    next.dislikedStyleIds = [...next.dislikedStyleIds, dislikedAdd];
    next.likedStyleIds = next.likedStyleIds.filter((id) => id !== dislikedAdd);
  }
  next.dislikedStyleIds = next.dislikedStyleIds ?? [];
  next.likedStyleIds = next.likedStyleIds.filter((id) => !next.dislikedStyleIds.includes(id));
  if (data.has("styleDeck")) {
    next.styleDeckIds = data.getAll("styleDeck").map(String).filter(Boolean);
  }
  if (data.has("styleShown")) {
    const stamp = Date.now();
    const shown = { ...(next.styleCardShownAt ?? {}) };
    for (const id of data.getAll("styleShown").map(String).filter(Boolean)) {
      shown[id] = stamp;
    }
    next.styleCardShownAt = shown;
  }
  const cursor = data.get("styleCursor");
  if (typeof cursor === "string" && cursor !== "") {
    const parsed = Number(cursor);
    if (Number.isFinite(parsed)) next.styleCursor = parsed;
  }

  const notes = data.get("notes");
  if (typeof notes === "string") next.notes = notes;

  const budgetMin = data.get("budgetMin");
  if (typeof budgetMin === "string" && budgetMin !== "") next.budgetMin = Number(budgetMin) || next.budgetMin;
  const budgetMax = data.get("budgetMax");
  if (typeof budgetMax === "string" && budgetMax !== "") next.budgetMax = Number(budgetMax) || next.budgetMax;

  const colorNote = data.get("colorNote");
  if (typeof colorNote === "string") next.colorNote = colorNote;

  const colorSource = data.get("colorSource");
  if (typeof colorSource === "string" && COLOR_SOURCES.has(colorSource as ColorSourceId)) {
    next.colorSource = colorSource as ColorSourceId;
  }

  if (data.get("hasFacePhoto") === "1") next.hasFacePhoto = true;
  if (data.get("hasFacePhoto") === "0") next.hasFacePhoto = false;

  const metal = data.get("metalPreference");
  if (typeof metal === "string" && METALS.has(metal as MetalPreferenceId)) {
    next.metalPreference = metal as MetalPreferenceId;
  }
  if (metal === "" || metal === "skip") next.metalPreference = undefined;

  if (data.has("swatchName") || data.has("swatchHex")) {
    const names = data.getAll("swatchName").map(String);
    const hexes = data.getAll("swatchHex").map(String);
    const swatches: ColorSwatch[] = [];
    for (let i = 0; i < Math.max(names.length, hexes.length); i++) {
      const name = (names[i] ?? "").trim();
      const hex = normalizeHex(hexes[i] ?? "");
      if (name && hex) swatches.push({ name, hex });
    }
    next.colorSwatches = swatches.slice(0, 4);
  }

  if (data.has("favName") || data.has("favHex") || data.get("favColorsSet") === "1") {
    const names = data.getAll("favName").map(String);
    const hexes = data.getAll("favHex").map(String);
    const favs: ColorSwatch[] = [];
    for (let i = 0; i < Math.max(names.length, hexes.length); i++) {
      const name = (names[i] ?? "").trim();
      const hex = normalizeHex(hexes[i] ?? "");
      if (name && hex) favs.push({ name, hex });
    }
    next.favColors = parseFavColors(favs);
  }

  const lookAge = parseLookAge(data.get("lookAge"));
  if (lookAge) next.lookAge = lookAge;
  if (data.get("lookAge") === "skip") next.lookAge = undefined;

  if (
    data.get("appearanceSet") === "1" ||
    data.has("hairColor") ||
    data.has("hairLength") ||
    data.has("eyes") ||
    data.has("skinToneBand")
  ) {
    next.appearance = parseAppearance({
      hairColor: data.has("hairColor") ? data.get("hairColor") : next.appearance?.hairColor,
      hairLength: data.has("hairLength") ? data.get("hairLength") : next.appearance?.hairLength,
      eyes: data.has("eyes") ? data.get("eyes") : next.appearance?.eyes,
      skinToneBand: data.has("skinToneBand") ? data.get("skinToneBand") : next.appearance?.skinToneBand,
    });
  }

  const skipAspects = data.get("skipAspects") === "1";
  const season = data.get("skipColor") === "1" ? "skip" : data.get("season");
  if (season === "" || season === "skip") {
    next.season = undefined;
    next.seasonSecondary = undefined;
    if (data.get("skipColor") === "1") {
      next.undertone = undefined;
      next.value = undefined;
      next.chroma = undefined;
    }
  } else if (typeof season === "string") {
    const normalized = normalizeSeasonId(season);
    if (normalized) {
      next.season = normalized;
      const secondary = data.get("seasonSecondary");
      next.seasonSecondary = typeof secondary === "string" ? normalizeSeasonId(secondary) ?? undefined : undefined;
      if (skipAspects) {
        next.undertone = undefined;
        next.value = undefined;
        next.chroma = undefined;
      }
    }
  }

  for (const step of ["photos", "measurements", "color", "styles", "prefs", "budget"] as const) {
    if (data.get(`done_${step}`) === "1") next.deepDone[step] = true;
  }

  if (data.get("generated") === "1") next.generated = true;
  if (data.get("newSeed") === "1") next.seed = Date.now();
  if (data.get("reset_styles") === "1") {
    next.styleCursor = 0;
    next.likedStyleIds = [];
    next.dislikedStyleIds = [];
    next.styleDeckIds = [];
    next.styleSignals = undefined;
    next.lookFeedback = [];
  }

  const rawSignals = data.get("styleSignals");
  if (typeof rawSignals === "string" && rawSignals.trim()) {
    try {
      const parsed = parseStyleSignals(JSON.parse(rawSignals));
      if (parsed) next.styleSignals = parsed;
    } catch {
      /* keep existing */
    }
  }

  if (data.get("done_styles") === "1") {
    const quiz = aggregateStyleSignalsFromVotes({
      likedIds: next.likedStyleIds,
      dislikedIds: next.dislikedStyleIds ?? [],
      shown: next.styleDeckIds?.length ?? next.likedStyleIds.length + (next.dislikedStyleIds?.length ?? 0),
    });
    next.styleSignals = {
      ...quiz,
      feedback: next.styleSignals?.feedback,
      avoid: next.styleSignals?.avoid,
      budgetBias: next.styleSignals?.budgetBias,
      source: next.styleSignals?.feedback ? "swipe-quiz+look-feedback" : "swipe-quiz",
    };
  }

  return next;
}
