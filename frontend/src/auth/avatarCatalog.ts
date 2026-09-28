/*
 * The one avatar catalogue.
 *
 * There is a single source of truth for what an avatar is: `LOCAL_AVATARS` is
 * the Arcadia catalogue the backend allowlists, and `LEVEL_AVATARS` describes
 * the level tiers that are shown but not yet selectable. The Google picture is
 * never described here: it is the trusted picture the account already owns, so
 * it is validated from the profile instead of being invented as an entry.
 *
 * Nothing in this file is persisted by the client. The stored avatar shape is
 * the backend's `{ type: "local" | "google", value }`; the ids below are exactly
 * the ids the server accepts.
 */

export type LocalAvatarOption = {
  id: string;
  label: string;
  className: string;
  background: string;
};

export const LOCAL_AVATARS: readonly LocalAvatarOption[] = [
  { id: "avatar-01", label: "Nebula", className: "avatar-nebula", background: "linear-gradient(135deg, #7c3aed, #db2777)" },
  { id: "avatar-02", label: "Aurora", className: "avatar-aurora", background: "linear-gradient(135deg, #0f766e, #22d3ee)" },
  { id: "avatar-03", label: "Nova", className: "avatar-nova", background: "linear-gradient(135deg, #1d4ed8, #7c3aed)" },
  { id: "avatar-04", label: "Eclipse", className: "avatar-eclipse", background: "linear-gradient(135deg, #312e81, #4f46e5)" },
  { id: "avatar-05", label: "Comet", className: "avatar-comet", background: "linear-gradient(135deg, #9d174d, #f97316)" },
  { id: "avatar-06", label: "Pulse", className: "avatar-pulse", background: "linear-gradient(135deg, #047857, #84cc16)" },
] as const;

export const DEFAULT_LOCAL_AVATAR_ID = LOCAL_AVATARS[0].id;

export function getLocalAvatarOption(value: string | null | undefined) {
  return LOCAL_AVATARS.find((avatar) => avatar.id === value) || LOCAL_AVATARS[0];
}

/* ------------------------------------------------------------------
   Level tiers

   These mirror the backend level badge tiers (backend/config/levelBadges.js):
   Rookie 0-4, Challenger 5-9, Veteran 10-14, Master 15-19, Legend 20-29 and
   Supreme 30+. The unlock level is therefore read from the same progression
   the badge title already comes from, never hardcoded per screen.

   They are presented as locked and are not selectable yet: the backend
   allowlists only the six `avatar-0N` ids above, so there is no id a level
   avatar could be stored under. `minLevel` is kept so the requirement can be
   shown, and so unlocking them later needs no change to this file.
   ------------------------------------------------------------------ */

export type LevelAvatarOption = {
  id: string;
  label: string;
  glyph: string;
  from: string;
  to: string;
  minLevel: number;
};

export const LEVEL_AVATARS: readonly LevelAvatarOption[] = [
  { id: "rookie", label: "Rookie", glyph: "🛡️", from: "#6b7280", to: "#9ca3af", minLevel: 0 },
  { id: "challenger", label: "Challenger", glyph: "⚔️", from: "#059669", to: "#34d399", minLevel: 5 },
  { id: "veteran", label: "Veteran", glyph: "🎖️", from: "#0891b2", to: "#22d3ee", minLevel: 10 },
  { id: "master", label: "Master", glyph: "👑", from: "#dc2626", to: "#f87171", minLevel: 15 },
  { id: "legend", label: "Legend", glyph: "🏆", from: "#7c3aed", to: "#c084fc", minLevel: 20 },
  { id: "supreme", label: "Supreme", glyph: "💎", from: "#ca8a04", to: "#facc15", minLevel: 30 },
] as const;

export const GOOGLE_AVATAR_ID = "google";

/**
 * The existing Google picture rule, kept in one place.
 *
 * A Google picture URL is only ever used when it is an https URL on a Google
 * image host with no embedded credentials. Anything else is rejected, so an
 * untrusted or malformed URL can never reach an `img` and the caller falls back
 * to the safe local avatar. No token is ever accepted or read from storage.
 */
export function getSafeGoogleAvatarUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trusted = ["googleusercontent.com", "gstatic.com"].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
    if (url.protocol !== "https:" || !trusted || url.username || url.password || url.port) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** A small inline preview for the locked tier art. */
export function levelAvatarPreviewUrl(avatar: LevelAvatarOption): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0%" stop-color="${avatar.from}"/><stop offset="100%" stop-color="${avatar.to}"/>`
    + `</linearGradient></defs>`
    + `<circle cx="60" cy="60" r="60" fill="url(#g)"/>`
    + `<text x="50%" y="56%" font-size="54" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI Emoji, Apple Color Emoji, sans-serif">${avatar.glyph}</text>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
