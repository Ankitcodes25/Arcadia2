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

export type AuthUser = {
  id: string;
  name: string;
  username: string | null;
  usernameSetupRequired: boolean;
  displayName: string;
  avatar: AuthAvatar;
  avatarSource: AvatarType;
  googleAvatarAvailable: boolean;
  googleAvatarUrl: string | null;
  authProvider: AuthProvider;
  email: string;
  role: AuthRole;
  status: AuthStatus;
  emailVerified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

export type AccountProfileUser = AuthUser & {
  googleAvatarUrl: string | null;
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
