import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthApiError, authApi, setAccessToken, setRefreshHandler } from "./authApi";
import {
  consumeAuthQuery,
  getAuthErrorMessage,
  getOAuthErrorMessage,
} from "./authUtils";
import { getOAuthErrorAuthMode } from "./oauthErrorMessages.js";
import type {
  AccountAction,
  AuthErrorKind,
  AuthMode,
  AuthResponse,
  AuthUser,
  LoginValues,
  LogoutOtherSessionsResponse,
  RegisterValues,
  RevokeSessionResponse,
} from "./authTypes";

type LogoutResult = {
  success: boolean;
  message?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  authError: string | null;
  authErrorKind: AuthErrorKind | null;
  authMode: AuthMode | null;
  accountAction: AccountAction | null;
  openAuthMode: (mode: AuthMode) => void;
  closeAuthMode: () => void;
  clearError: () => void;
  dismissAccountAction: () => void;
  updateUser: (user: AuthUser) => void;
  login: (values: LoginValues) => Promise<boolean>;
  register: (values: RegisterValues) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<string>;
  resendVerification: (email: string) => Promise<string>;
  submitPasswordReset: (password: string, confirmation: string) => Promise<boolean>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmation: string,
  ) => Promise<{ success: boolean; message: string }>;
  revokeSession: (sessionId: string) => Promise<RevokeSessionResponse>;
  logoutOtherSessions: () => Promise<LogoutOtherSessionsResponse>;
  loginWithGoogle: () => void;
  logout: () => Promise<LogoutResult>;
  logoutAll: () => Promise<LogoutResult>;
  refresh: () => Promise<AuthResponse | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

type AuthBroadcast = { type: "signed-in" | "signed-out" };
type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

function isInactiveAccountError(error: unknown) {
  return error instanceof AuthApiError
    && error.status === 403
    && /inactive|suspended/i.test(error.message);
}

function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorKind, setAuthErrorKind] = useState<AuthErrorKind | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthResponse | null> | null>(null);
  const generationRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const bootstrapStartedRef = useRef(false);

  const broadcast = useCallback((message: AuthBroadcast) => {
    channelRef.current?.postMessage(message);
  }, []);

  const clearLocalAuth = useCallback((notify = true) => {
    generationRef.current += 1;
    setAccessToken(null);
    setUser(null);
    if (notify) broadcast({ type: "signed-out" });
  }, [broadcast]);

  const applyAuthResponse = useCallback((response: AuthResponse, expectedGeneration?: number) => {
    if (expectedGeneration !== undefined && expectedGeneration !== generationRef.current) {
      return false;
    }
    setAccessToken(response.token);
    setUser(response.user);
    setAuthError(null);
    setAuthErrorKind(null);
    broadcast({ type: "signed-in" });
    return true;
  }, [broadcast]);

  const updateUser = useCallback((nextUser: AuthUser) => {
    if (nextUser.status !== "ACTIVE") {
      clearLocalAuth();
      return;
    }
    setUser(nextUser);
  }, [clearLocalAuth]);

  const setVisibleError = useCallback((message: string, kind: AuthErrorKind) => {
    setAuthError(message);
    setAuthErrorKind(kind);
  }, []);

  /*
   * The auth modal is opened from here instead of from the Navbar so a
   * `account_exists` OAuth error can bring the modal back after the Google
   * redirect. The modal is never left open behind a successful login because a
   * successful OAuth response runs on a fresh page load.
   */
  const openAuthMode = useCallback((mode: AuthMode) => {
    setAuthError(null);
    setAuthErrorKind(null);
    setAuthMode(mode);
  }, []);

  const closeAuthMode = useCallback(() => {
    setAuthMode(null);
    setAuthError(null);
    setAuthErrorKind(null);
  }, []);

  // Opens the modal first (which clears any stale error) and only then shows the
  // warning, so the notice is rendered inside the modal that is already open.
  const showOAuthError = useCallback((message: string, mode: AuthMode | null) => {
    if (mode) openAuthMode(mode);
    setVisibleError(message, "oauth");
  }, [openAuthMode, setVisibleError]);

  const refresh = useCallback(async () => {
    if (!refreshPromiseRef.current) {
      const generation = generationRef.current;
      const performRefresh = async () => {
        const lockManager = (navigator as Navigator & { locks?: LockManagerLike }).locks;
        const response = lockManager
          ? await lockManager.request("arcadia-auth-refresh", () => authApi.refresh())
          : await authApi.refresh();
        if (generation !== generationRef.current) return null;
        if (!applyAuthResponse(response, generation)) return null;
        return response;
      };

      const promise = performRefresh()
        .catch((error: unknown) => {
          if (generation === generationRef.current && (error instanceof AuthApiError && error.status === 401 || isInactiveAccountError(error))) {
            clearLocalAuth();
            if (isInactiveAccountError(error)) {
              setVisibleError("This account is inactive. Contact support for help.", "form");
            }
          }
          return null;
        })
        .finally(() => {
          refreshPromiseRef.current = null;
        });
      refreshPromiseRef.current = promise;
    }

    return refreshPromiseRef.current;
  }, [applyAuthResponse, clearLocalAuth, setVisibleError]);

  useEffect(() => {
    setRefreshHandler(async () => Boolean(await refresh()));
    return () => setRefreshHandler(null);
  }, [refresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel("arcadia-auth-events");
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<AuthBroadcast>) => {
      if (event.data?.type === "signed-out") {
        clearLocalAuth(false);
      } else if (event.data?.type === "signed-in") {
        void refresh();
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [clearLocalAuth, refresh]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    const {
      code,
      error,
      verificationToken,
      resetToken,
      ambiguous,
    } = consumeAuthQuery();

    try {
      if (ambiguous) {
        clearLocalAuth();
        setVisibleError("Multiple account links were provided. Start again from one link.", "form");
      } else if (verificationToken) {
        setAccountAction({
          kind: "verification",
          status: "loading",
          message: "",
        });

        try {
          const response = await authApi.verifyEmail(verificationToken);
          setAccountAction((current) => current?.kind === "verification"
            ? { ...current, status: "success", message: response.message }
            : current);
        } catch (requestError) {
          setAccountAction((current) => current?.kind === "verification"
            ? {
              ...current,
              status: "error",
              message: getAuthErrorMessage(
                requestError,
                "Email verification could not be completed. Please request a new link.",
              ),
            }
            : current);
        }
        await refresh();
      } else if (resetToken) {
        setAccountAction({
          kind: "reset",
          status: "form",
          token: resetToken,
          message: "",
        });
      } else if (code) {
        const response = await authApi.exchangeGoogleCode(code);
        applyAuthResponse(response);
      } else if (error) {
        // A Google error can only be the result of a Google attempt started from
        // the auth modal, so the modal is reopened with the warning inside it.
        showOAuthError(getOAuthErrorMessage(error), getOAuthErrorAuthMode(error));
        await refresh();
      } else {
        await refresh();
      }
    } catch (requestError) {
      if (
        requestError instanceof AuthApiError
        && (requestError.status === 401 || isInactiveAccountError(requestError))
      ) {
        clearLocalAuth();
      }
      showOAuthError(
        getAuthErrorMessage(requestError, "Authentication could not be completed. Please try again."),
        "login",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthResponse, clearLocalAuth, refresh, setVisibleError, showOAuthError]);

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (values: LoginValues) => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthErrorKind(null);
    const generation = generationRef.current;
    try {
      const response = await authApi.login(values);
      return applyAuthResponse(response, generation);
    } catch (requestError) {
      setVisibleError(
        getAuthErrorMessage(requestError, "Unable to log in. Please try again."),
        "form",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [applyAuthResponse, setVisibleError]);

  const register = useCallback(async (values: RegisterValues) => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthErrorKind(null);
    const generation = generationRef.current;
    try {
      const response = await authApi.register(values);
      return applyAuthResponse(response, generation);
    } catch (requestError) {
      setVisibleError(
        getAuthErrorMessage(requestError, "Unable to create your account. Please try again."),
        "form",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [applyAuthResponse, setVisibleError]);

  const forgotPassword = useCallback(async (email: string) => {
    const response = await authApi.forgotPassword(email);
    return response.message;
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const response = await authApi.resendVerification(email);
    return response.message;
  }, []);

  const submitPasswordReset = useCallback(async (password: string, confirmation: string) => {
    const currentAction = accountAction;
    if (currentAction?.kind !== "reset") return false;
    if (password !== confirmation) {
      setAccountAction({ ...currentAction, status: "error", message: "Passwords do not match." });
      return false;
    }

    setAccountAction({ ...currentAction, status: "submitting", message: "" });
    try {
      const response = await authApi.resetPassword({
        token: currentAction.token,
        password,
      });
      clearLocalAuth();
      setAuthError(null);
      setAuthErrorKind(null);
      setAccountAction({
        kind: "reset",
        status: "success",
        token: "",
        message: response.message,
      });
      return true;
    } catch (requestError) {
      setAccountAction((current) => current?.kind === "reset"
        ? {
          ...current,
          status: "error",
          message: getAuthErrorMessage(requestError, "Password could not be reset. Please request a new link."),
        }
        : current);
      return false;
    }
  }, [accountAction, clearLocalAuth]);

  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string,
    confirmation: string,
  ) => {
    if (newPassword !== confirmation) {
      return { success: false, message: "Passwords do not match." };
    }
    const pendingRefresh = refreshPromiseRef.current;
    if (pendingRefresh) await pendingRefresh;
    const generation = generationRef.current;
    try {
      const response = await authApi.changePassword({ currentPassword, newPassword });
      if (generation === generationRef.current) clearLocalAuth();
      return { success: true, message: response.message };
    } catch (requestError) {
      return {
        success: false,
        message: getAuthErrorMessage(requestError, "Password could not be changed. Please try again."),
      };
    }
  }, [clearLocalAuth]);

  const revokeSession = useCallback(async (sessionId: string) => {
    const response = await authApi.revokeSession(sessionId);
    if (response.current) clearLocalAuth();
    return response;
  }, [clearLocalAuth]);

  const logoutOtherSessions = useCallback(async () => authApi.logoutOtherSessions(), []);

  const loginWithGoogle = useCallback(() => {
    setAuthError(null);
    setAuthErrorKind(null);
    authApi.startGoogleLogin();
  }, []);

  const waitForRefresh = useCallback(async () => {
    const pending = refreshPromiseRef.current;
    if (pending) await pending;
  }, []);

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    generationRef.current += 1;
    await waitForRefresh();
    try {
      await authApi.logout();
      clearLocalAuth();
      return { success: true };
    } catch (requestError) {
      const message = getAuthErrorMessage(
        requestError,
        "Sign-out could not be completed. This device may still be signed in.",
      );
      clearLocalAuth();
      setVisibleError(message, "form");
      return { success: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [clearLocalAuth, setVisibleError, waitForRefresh]);

  const logoutAll = useCallback(async () => {
    setIsSubmitting(true);
    generationRef.current += 1;
    await waitForRefresh();
    try {
      await authApi.logoutAll();
      clearLocalAuth();
      return { success: true };
    } catch (requestError) {
      const message = getAuthErrorMessage(
        requestError,
        "Sign-out could not be completed. This device may still be signed in.",
      );
      clearLocalAuth();
      setVisibleError(message, "form");
      return { success: false, message };
    } finally {
      setIsSubmitting(false);
    }
  }, [clearLocalAuth, setVisibleError, waitForRefresh]);

  const clearError = useCallback(() => {
    setAuthError(null);
    setAuthErrorKind(null);
  }, []);

  const dismissAccountAction = useCallback(() => setAccountAction(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user && user.status === "ACTIVE"),
    isLoading,
    isSubmitting,
    authError,
    authErrorKind,
    authMode,
    accountAction,
    openAuthMode,
    closeAuthMode,
    clearError,
    dismissAccountAction,
    updateUser,
    login,
    register,
    forgotPassword,
    resendVerification,
    submitPasswordReset,
    changePassword,
    revokeSession,
    logoutOtherSessions,
    loginWithGoogle,
    logout,
    logoutAll,
    refresh,
  }), [
    accountAction,
    authError,
    authErrorKind,
    authMode,
    changePassword,
    clearError,
    closeAuthMode,
    dismissAccountAction,
    forgotPassword,
    isLoading,
    isSubmitting,
    login,
    loginWithGoogle,
    logout,
    logoutAll,
    logoutOtherSessions,
    openAuthMode,
    refresh,
    register,
    resendVerification,
    revokeSession,
    submitPasswordReset,
    updateUser,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export { AuthProvider, useAuth };
export default AuthContext;
