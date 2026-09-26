import type {
  AuthUser,
  LevelBadgeKey,
  LevelThemeKey,
  Progression,
} from "./authTypes";

/*
 * Presentation only.
 *
 * Every number, level, title and badge in this file comes from the backend
 * progression response. There is deliberately no level range table, no XP
 * requirement formula and no title mapping here: the backend is the only place
 * that decides which level a total earns and which badge and title belong to it.
 *
 * What this module does add is defensive rendering. A value is normalised to a
 * finite number and a bounded percentage before it reaches the DOM, so a missing
 * or malformed field can never render as `NaN`, `Infinity` or a broken progress
 * bar. Level 0 and very high levels render through exactly the same path.
 */

export type ProgressionView = {
  level: number;
  /** Zero padded level number for the badge chip, e.g. `05`. */
  levelDigits: string;
  /** `LEVEL 05` style label used by the My Profile heading. */
  levelLabel: string;
  title: string;
  badgeKey: LevelBadgeKey;
  themeKey: LevelThemeKey;
  /** The animated flame tier is presentation, so it is keyed off the badge. */
  isAnimated: boolean;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  /** `180 / 300 XP` label for the current level. */
  xpLabel: string;
  nextLevelLabel: string;
};

const DEFAULT_BADGE_KEY: LevelBadgeKey = "bronze";
const DEFAULT_THEME_KEY: LevelThemeKey = "neutral-grey";
const ANIMATED_BADGE_KEYS: readonly LevelBadgeKey[] = ["flame"];

const BADGE_KEYS: readonly LevelBadgeKey[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
  "crown",
  "flame",
];

const THEME_KEYS: readonly LevelThemeKey[] = [
  "neutral-grey",
  "bright-green",
  "deep-cyan",
  "crimson-red",
  "electric-purple",
  "neon-golden",
];

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toCount(value: unknown): number {
  return Math.max(0, Math.floor(toFiniteNumber(value, 0)));
}

function toPercent(value: unknown): number {
  return Math.min(100, Math.max(0, toFiniteNumber(value, 0)));
}

function toBadgeKey(value: unknown): LevelBadgeKey {
  return BADGE_KEYS.includes(value as LevelBadgeKey)
    ? (value as LevelBadgeKey)
    : DEFAULT_BADGE_KEY;
}

function toThemeKey(value: unknown): LevelThemeKey {
  return THEME_KEYS.includes(value as LevelThemeKey)
    ? (value as LevelThemeKey)
    : DEFAULT_THEME_KEY;
}

function padLevel(level: number): string {
  return String(level).padStart(2, "0");
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function isAnimatedBadge(badgeKey: LevelBadgeKey): boolean {
  return ANIMATED_BADGE_KEYS.includes(badgeKey);
}

/** Normalises a backend progression payload into values that are safe to render. */
export function getProgressionView(
  progression: Progression | null | undefined,
): ProgressionView {
  const source = progression ?? ({} as Progression);
  const level = toCount(source.level);
  const currentLevelXp = toCount(source.currentLevelXp);
  const nextLevelXp = toCount(source.nextLevelXp);
  const badgeKey = toBadgeKey(source.badgeKey);
  const title = typeof source.title === "string" && source.title.trim()
    ? source.title
    : "Arcadia Rookie";

  return {
    level,
    levelDigits: padLevel(level),
    levelLabel: `LEVEL ${padLevel(level)}`,
    title,
    badgeKey,
    themeKey: toThemeKey(source.themeKey),
    isAnimated: isAnimatedBadge(badgeKey),
    totalXp: toCount(source.totalXp),
    currentLevelXp,
    nextLevelXp,
    progressPercent: toPercent(source.progressPercent),
    xpLabel: `${formatNumber(currentLevelXp)} / ${formatNumber(nextLevelXp)} XP`,
    nextLevelLabel: `${formatNumber(nextLevelXp)} XP to Level ${formatNumber(level + 1)}`,
  };
}

/** The progression of an authenticated user, already safe to render. */
export function getUserProgressionView(
  user: Pick<AuthUser, "progression"> | null | undefined,
): ProgressionView {
  return getProgressionView(user?.progression);
}
