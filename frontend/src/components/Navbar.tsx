import "./Navbar.css";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import logo from "../assets/ArcadialogoA.png";
import { navigateTo } from "../lib/navigation";
import LoginSignupModal from "./LoginSignupModal";
import ProfilePopupModal from "./ProfilePopupmodal";

const AUTH_HISTORY_KEY = "arcadia-auth-history";

type NavItem = "home" | "games" | "popular" | "about";

/* -------------------------------------------------------
   Initial active navigation item
------------------------------------------------------- */

function getInitialNavItem(): NavItem {
  const pathname = window.location.pathname;
  const hash = window.location.hash;

  if (pathname === "/games") {
    return "games";
  }

  if (hash === "#popular") {
    return "popular";
  }

  if (hash === "#about") {
    return "about";
  }

  return "home";
}

function Navbar() {
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [activeNavItem, setActiveNavItem] =
    useState<NavItem>(getInitialNavItem);

  const navbarNavRef = useRef<HTMLElement>(null);

  const isGamesPage = window.location.pathname === "/games";

  /* -------------------------------------------------------
     ACTIVE NAVIGATION

     Home page behavior:

     Hero                  -> Home
     Popular Games         -> Popular
     Continue Playing     -> Home
     Daily Challenge      -> Home
     Other sections       -> Home
     About                 -> About
  ------------------------------------------------------- */

  useEffect(() => {
    if (isGamesPage) {
      setActiveNavItem("games");
      return;
    }

    const updateActiveSection = () => {
      const navbar = document.querySelector<HTMLElement>(".navbar");

      const navbarHeight = navbar?.offsetHeight ?? 60;

      /*
       * This is the point on the screen used to decide
       * which navigation area we are currently in.
       *
       * We intentionally use a fixed percentage instead of
       * "closest section", because Popular must NOT become
       * active while the user is still inside the Hero.
       */
      const referencePoint =
        window.scrollY + navbarHeight + window.innerHeight * 0.35;

      const popularSection = document.getElementById("popular");
      const continuePlayingSection =
        document.getElementById("continue-playing");
      const aboutSection = document.getElementById("about");

      const popularTop =
        popularSection?.offsetTop ?? Number.POSITIVE_INFINITY;

      const continuePlayingTop =
        continuePlayingSection?.offsetTop ?? Number.POSITIVE_INFINITY;

      const aboutTop =
        aboutSection?.offsetTop ?? Number.POSITIVE_INFINITY;

      /* ---------------------------------------------------
         ABOUT

         Once About reaches the reference point,
         About becomes active.
      --------------------------------------------------- */

      if (aboutTop <= referencePoint) {
        setActiveNavItem("about");
        return;
      }

      /* ---------------------------------------------------
         CONTINUE PLAYING

         Once Continue Playing reaches the reference point,
         we deliberately return to HOME.

         This means:
         Popular -> Popular
         Continue Playing -> Home
         Daily Challenge -> Home
         --------------------------------------------------- */

      if (continuePlayingTop <= referencePoint) {
        setActiveNavItem("home");
        return;
      }

      /* ---------------------------------------------------
         POPULAR

         Popular becomes active only after its own section
         reaches the reference point.
      --------------------------------------------------- */

      if (popularTop <= referencePoint) {
        setActiveNavItem("popular");
        return;
      }

      /* ---------------------------------------------------
         HERO + ALL OTHER HOME SECTIONS
      --------------------------------------------------- */

      setActiveNavItem("home");
    };

    updateActiveSection();

    window.addEventListener("scroll", updateActiveSection, {
      passive: true,
    });

    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [isGamesPage]);

  /* -------------------------------------------------------
     NAVBAR ACTIVE INDICATOR
  ------------------------------------------------------- */

  useLayoutEffect(() => {
    const nav = navbarNavRef.current;

    if (!nav) return;

    const activeLink = nav.querySelector<HTMLElement>(
      `[data-nav-item="${activeNavItem}"]`
    );

    const indicator =
      nav.querySelector<HTMLElement>(".navbar-indicator");

    if (!activeLink || !indicator) return;

    indicator.style.width = `${activeLink.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeLink.offsetLeft}px)`;
    indicator.style.opacity = "1";
  }, [activeNavItem]);

  /* -------------------------------------------------------
     AUTH
  ------------------------------------------------------- */

  const handleAuthSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    window.localStorage.setItem(
      AUTH_HISTORY_KEY,
      "true"
    );

    setIsSignedIn(true);
    setAuthMode(null);
  };

  const handleLogout = () => {
    setIsSignedIn(false);
    setIsProfileOpen(false);
  };

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* -------------------------------------------------
            LOGO
        ------------------------------------------------- */}

        <a
          href="/"
          className="navbar-brand"
          aria-label="Arcadia Home"
          onClick={(event) =>
            navigateTo("/", event)
          }
        >
          <div className="brand-logo">
            <span className="brand-ray"></span>

            <img
              src={logo}
              alt=""
              className="brand-image"
            />
          </div>

          <span className="brand-name">
            ARCADIA
          </span>
        </a>

        {/* -------------------------------------------------
            NAVIGATION
        ------------------------------------------------- */}

        <nav
          className="navbar-nav"
          ref={navbarNavRef}
        >
          {/* HOME */}

          <a
            className={
              activeNavItem === "home"
                ? "active"
                : ""
            }
            data-nav-item="home"
            href="/"
            onClick={(event) =>
              navigateTo("/", event)
            }
          >
            Home
          </a>

          {/* GAMES */}

          <a
            className={
              activeNavItem === "games"
                ? "active"
                : ""
            }
            data-nav-item="games"
            href="/games"
            onClick={(event) =>
              navigateTo("/games", event)
            }
          >
            Games
          </a>

          {/* POPULAR */}

          <a
            className={
              activeNavItem === "popular"
                ? "active"
                : ""
            }
            data-nav-item="popular"
            href="/#popular"
            onClick={(event) =>
              navigateTo("/#popular", event)
            }
          >
            Popular
          </a>

          {/* ABOUT */}

          <a
            className={
              activeNavItem === "about"
                ? "active"
                : ""
            }
            data-nav-item="about"
            href="/#about"
            onClick={(event) =>
              navigateTo("/#about", event)
            }
          >
            About
          </a>

          {/* ACTIVE UNDERLINE */}

          <span
            className="navbar-indicator"
            aria-hidden="true"
          />
        </nav>

        {/* -------------------------------------------------
            AUTH / PROFILE
        ------------------------------------------------- */}

        <div className="navbar-actions">

          {isSignedIn ? (
            <div className="profile-menu-wrapper">

              <button
                type="button"
                className="avatar-button"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
                onPointerDown={(event) =>
                  event.stopPropagation()
                }
                onClick={() =>
                  setIsProfileOpen(
                    (open) => !open
                  )
                }
              >
                A
              </button>

              {isProfileOpen && (
                <ProfilePopupModal
                  onClose={() =>
                    setIsProfileOpen(false)
                  }
                  onLogout={handleLogout}
                />
              )}
            </div>
          ) : (
            <div className="auth-actions">

              <button
                type="button"
                className="auth-button auth-button-primary"
                onClick={() =>
                  setAuthMode("signup")
                }
              >
                Sign up
              </button>

              <button
                type="button"
                className="auth-button"
                onClick={() =>
                  setAuthMode("login")
                }
              >
                Log in
                <span className="auth-arrow">
                  →
                </span>
              </button>

            </div>
          )}

        </div>
      </div>

      {/* ---------------------------------------------------
          AUTH MODAL
      --------------------------------------------------- */}

      {authMode && (
        <LoginSignupModal
          authMode={authMode}
          onClose={() =>
            setAuthMode(null)
          }
          onSubmit={handleAuthSubmit}
          onSwitchMode={() =>
            setAuthMode(
              authMode === "login"
                ? "signup"
                : "login"
            )
          }
        />
      )}
    </header>
  );
}

export default Navbar;