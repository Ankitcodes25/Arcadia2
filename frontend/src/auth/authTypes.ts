export type AuthRole = "USER" | "ADMIN";

export type AuthStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type AuthMode = "login" | "signup";

export type AuthErrorKind = "form" | "oauth";

export type AuthProvider = "PASSWORD" | "GOOGLE";

export type AvatarType = "local" | "google";

export type AuthAvatar = {
  type: AvatarType;
  value: string;
};

/**
 * Stable badge identifiers owned by the backend. The badge artwork and any
 * animation stay a frontend concern; the key is all the backend decides.
 */
export type LevelBadgeKey = "bronze" | "silver" | "gold" | "diamond" | "crown" | "flame";

/** Stable visual theme identifiers owned by the backend. */
export type LevelThemeKey =
  | "neutral-grey"
  | "bright-green"
  | "deep-cyan"
  | "crimson-red"
  | "electric-purple"
  | "neon-golden";

/**
 * Progression is always derived on the backend from the account's total Arcadion
 * XP, so it is read-only here. There is no client-side level calculation and no
 * way to set a level, a title or a badge from the frontend.
 */
export type Progression = {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  title: string;
  badgeKey: LevelBadgeKey;
  themeKey: LevelThemeKey;
};

/**
 * Gaming statistics stay neutral zeros until the game systems exist. They are
 * owned by the backend account profile so real values can replace them in one
 * place, and XP progression never reads from them.
 */
export type GamingStatsSummary = {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  bestScore: number;
  currentStreak: number;
  winRatePercent: number;
  /**
   * Total gameplay time in minutes. The backend does not track playtime yet, so
   * this is intentionally optional and normally absent: the profile then shows a
   * neutral placeholder instead of an invented number. When real gameplay
   * tracking lands, the backend populates this one field and Total Hours Played
   * becomes a real value with no other change.
   */
  totalMinutesPlayed?: number | null;
};

export type AuthUser = {
  id: string;
  name: string;
  username: string | null;
  usernameSetupRequired: boolean;
  /**
   * The permanent public Arcadia Player ID, e.g. ARC-7K4M2P9Q. It is generated
   * and stored by the server and is never editable, so the client only ever
   * displays the value it was given. It is `null` for an account whose ID has
   * not been issued yet, and it is not an authorization credential.
   */
  playerId: string | null;
  displayName: string;
  avatar: AuthAvatar;
  avatarSource: AvatarType;
  googleAvatarAvailable: boolean;
  googleAvatarUrl: string | null;
  authProvider: AuthProvider;
  email: string;
  progression: Progression;
  role: AuthRole;
  status: AuthStatus;
  emailVerified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

export type AccountProfileUser = AuthUser & {
  googleAvatarUrl: string | null;
  gamingStats: GamingStatsSummary;
};

/** The identity fields My Profile is allowed to change. */
export type ProfileUpdate = {
  displayName?: string;
  username?: string;
  avatar?: AuthAvatar;
};

export type ProfileUpdateResult = {
  ok: boolean;
  message: string | null;
  /** HTTP status of a rejected write, so a 409 uniqueness conflict is detectable. */
  status: number | null;
  user: AccountProfileUser | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
  verificationEmailSent?: boolean;
};

export type AuthFormValues = {
  username: string;
  email: string;
  password: string;
};

export type LoginValues = Pick<AuthFormValues, "email" | "password">;

export type RegisterValues = AuthFormValues;

export type AuthMessageResponse = {
  message: string;
};

export type AccountProfileResponse = {
  user: AccountProfileUser;
};

export type AccountSettingsResponse = {
  settings: AccountProfileUser;
};

export type UsernameAvailabilityResponse = {
  available: boolean;
};

export type AccountSession = {
  id: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  current: boolean;
  device: string;
};

export type AccountSessionsResponse = {
  sessions: AccountSession[];
};

export type RevokeSessionResponse = {
  current: boolean;
  message: string;
};

export type LogoutOtherSessionsResponse = {
  revokedCount: number;
  message: string;
};

export type AccountAction =
  | {
      kind: "verification";
      status: "loading" | "success" | "error";
      message: string;
    }
  | {
      kind: "reset";
      status: "form" | "submitting" | "success" | "error";
      token: string;
      message: string;
    };
