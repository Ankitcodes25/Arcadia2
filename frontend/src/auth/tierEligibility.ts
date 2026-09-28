import type { GamingStatsSummary, Progression } from "./authTypes";
import { getProgressionView, type ProgressionView } from "./progression";

/*
 * Badge and level-avatar eligibility.
 *
 * The badge in My Profile and the level avatars in the Avatar Modal are two
 * presentations of ONE progression state, so they are decided here once and read
 * by both. They can therefore never disagree: a tier that is shown as an earned
 * badge is the same tier that is shown as an unlocked avatar.
 *
 * The inputs are the authoritative progression the backend derived from the
 * account's total Arcadion XP, plus the account's completed-match count. Nothing
 * here awards anything: it can only withhold a tier, never grant one. There is
 * no client-side level calculation and no way to set a level, a badge or a match
 * claim from the frontend.
 */

/** The Rookie tier is gated on real play rather than on level. */
export const ROOKIE_TIER_ID = "rookie";

/** How many completed matches Rookie needs. One is the threshold. */
export const MIN_COMPLETED_MATCHES_FOR_ROOKIE = 1;

export type TierEligibility = {
  /** Whether the tier has actually been earned by this account. */
  isEarned: boolean;
  /** Human readable statement of what the tier requires. */
  requirement: string;
};

/**
 * Completed matches on record for the account.
 *
 * IMPORTANT: the backend does not persist a match or game-history record yet, so
 * `gamingStats.gamesPlayed` is currently always 0 and Rookie stays locked. That
 * is deliberate. An unlock has to come from a genuine completed match recorded
 * by the trusted game-result flow, never from signing up, logging in, opening a
 * game or starting an unfinished one. A missing, null, non-numeric or negative
 * value all mean "no match on record", so none of them can unlock anything.
 */
export function getCompletedMatches(
  gamingStats: GamingStatsSummary | null | undefined,
): number {
  const played = gamingStats?.gamesPlayed;
  if (typeof played !== "number" || !Number.isFinite(played)) return 0;
  return Math.max(0, Math.floor(played));
}

/** What a tier requires, stated the same way in the badge and the avatar. */
export function getTierRequirement(
  tierId: string,
  minLevel: number,
): string {
  return tierId === ROOKIE_TIER_ID
    ? `${MIN_COMPLETED_MATCHES_FOR_ROOKIE} completed match`
    : `level ${minLevel}`;
}

/**
 * Whether a level tier has been earned.
 *
 * Every tier is level gated except Rookie, which additionally needs a completed
 * match. The level itself always comes from the backend progression.
 */
export function isTierEarned(
  tier: { id: string; minLevel: number },
  progression: ProgressionView,
  completedMatches: number,
): TierEligibility {
  const requirement = getTierRequirement(tier.id, tier.minLevel);
  const isEarned = tier.id === ROOKIE_TIER_ID
    ? completedMatches >= MIN_COMPLETED_MATCHES_FOR_ROOKIE
    : progression.level >= tier.minLevel;

  return { isEarned, requirement };
}

/**
 * The tier the account's level places it in, together with whether that tier has
 * actually been earned.
 *
 * At level 0 with no completed match the level says Rookie, but Rookie has not
 * been earned, so the caller renders the neutral unearned state rather than an
 * earned bronze badge.
 */
export function getEarnedTier(
  progression: ProgressionView,
  completedMatches: number,
): { tierId: string; title: string; isEarned: boolean; requirement: string } {
  if (progression.badgeKey === "bronze") {
    return {
      tierId: ROOKIE_TIER_ID,
      title: progression.title,
      isEarned: completedMatches >= MIN_COMPLETED_MATCHES_FOR_ROOKIE,
      requirement: `${MIN_COMPLETED_MATCHES_FOR_ROOKIE} completed match`,
    };
  }

  // Every tier above Rookie is purely level gated, and the level already came
  // from the backend tier table, so it is earned by definition.
  return {
    tierId: progression.badgeKey,
    title: progression.title,
    isEarned: true,
    requirement: `level ${progression.level}`,
  };
}

/**
 * The badge as it should be displayed: the tier's own theme once it is earned,
 * and the neutral unearned theme before that.
 */
export function getBadgeDisplay(
  progression: ProgressionView,
  completedMatches: number,
): { title: string; themeKey: ProgressionView["themeKey"]; isEarned: boolean; requirement: string } {
  const tier = getEarnedTier(progression, completedMatches);
  return {
    title: tier.title,
    themeKey: tier.isEarned ? progression.themeKey : progression.unearnedThemeKey,
    isEarned: tier.isEarned,
    requirement: tier.requirement,
  };
}

/**
 * Reads the authoritative progression and the completed-match count off a
 * profile, so a caller that holds a whole user does not have to remember both.
 */
export function readEligibilitySource(
  user: { progression?: Progression | null; gamingStats?: GamingStatsSummary | null } | null | undefined,
): { progression: ProgressionView; completedMatches: number } {
  return {
    progression: getProgressionView(user?.progression),
    completedMatches: getCompletedMatches(user?.gamingStats),
  };
}
