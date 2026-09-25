import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import LandingPage from "./pages/Landingpage/Landingpage";
import Allgames from "./pages/Allgames/Allgames";
import { onNavigation } from "./lib/navigation";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { shouldShowGlobalAuthNotice } from "./auth/authUtils";
import { NOTICE_FADING_CLASS, useAutoDismissNotice } from "./auth/authNotice";
import AccountActionPanel from "./auth/AccountActionPanel";
import AuthLoading from "./auth/AuthLoading";

function AuthNotice() {
  const { authError, authErrorKind, authMode, clearError } = useAuth();
  // While the auth modal is open the same warning is rendered inside the modal,
  // so this component stays hidden and its timer stays stopped.
  const isVisible = shouldShowGlobalAuthNotice({ authError, authErrorKind, authMode });
  const isFading = useAutoDismissNotice(
    isVisible ? authError : null,
    clearError,
  );

  if (!isVisible || !authError) {
    return null;
  }

  return (
    <div className={`auth-global-notice${isFading ? ` ${NOTICE_FADING_CLASS}` : ""}`} role="alert">
      <span>{authError}</span>
      <button type="button" aria-label="Dismiss authentication message" onClick={clearError}>
        ×
      </button>
    </div>
  );
}

function AppContent() {
  const getLocationKey = () => {
    const url = new URL(window.location.href);
    const authKeys = ["oauth_code", "oauth_error", "verification_token", "reset_token"];
    authKeys.forEach((key) => url.searchParams.delete(key));
    const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    authKeys.forEach((key) => fragment.delete(key));
    const remainingFragment = fragment.toString();
    url.hash = remainingFragment ? `#${remainingFragment}` : "";
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const [path, setPath] = useState(getLocationKey);
  const { isLoading } = useAuth();

  useEffect(() => onNavigation(() => setPath(getLocationKey())), []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    requestAnimationFrame(() => {
      const targetSection = document.getElementById(hash.slice(1));
      if (!targetSection) return;
      const navbarHeight = document.querySelector<HTMLElement>(".navbar")?.offsetHeight ?? 60;
      const topOffset = navbarHeight + 38;
      window.scrollTo({
        top: window.scrollY + targetSection.getBoundingClientRect().top - topOffset,
        behavior: "smooth",
      });
    });
  }, [path]);

  if (isLoading) {
    return <AuthLoading />;
  }

  const isGamesPage = path.startsWith("/games");

  return (
    <>
      <Navbar />
      <AccountActionPanel />
      <AuthNotice />
      <div
        key={isGamesPage ? "games-page" : "home-page"}
        className="page-transition"
      >
        {isGamesPage ? <Allgames /> : <LandingPage />}
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
