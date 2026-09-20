import type { Game } from "../../../types/game";
import { navigateTo } from "../../../lib/navigation";

import heroBg from "../../../assets/HeroBg.webp";
import arcadionFull from "../../../assets/ArcadionFull.png";
import arcadionCube from "../../../assets/Arcadioncube.png";

type HeroSectionProps = {
  games: Game[];
};

/* Small horned-mask emblem (bottom-left label).
   Swap with your own logo <img> if you have one. */
function ArcadionEmblem() {
  return (
    <svg
      className="arcadia-emblem"
      viewBox="0 0 48 52"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 3 L15 13 L24 9 L33 13 L44 3 L41 24 L30 38 L24 49 L18 38 L7 24 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M15 20 L24 26 L33 20 L29 32 L24 38 L19 32 Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

function HeroSection({ games: _games }: HeroSectionProps) {
  return (
    <section className="arcadia-hero">
      {/*
        STAGE — everything visual (bg, glow, character, cube, particles).
        The stage is masked in CSS so its top and bottom dissolve
        into the real page background → no patch / seam.
      */}
      <div className="arcadia-hero-stage">
        <div
          className="arcadia-hero-background"
          style={{ backgroundImage: `url(${heroBg})` }}
        />

        <div className="arcadia-hero-atmosphere" />

        <div className="arcadia-hero-character">
          {/* soft breathing aura behind the whole figure */}
          <div className="arcadia-character-glow" />

          {/* body: halo + image "breathe" together */}
          <div className="arcadia-character-body">
            <img
              src={arcadionFull}
              alt=""
              aria-hidden="true"
              className="arcadia-character-halo"
            />

            <img
              src={arcadionFull}
              alt="Arcadion"
              className="arcadia-character-image"
            />

          </div>

          {/* cube floating right above the open hand */}
          <div className="arcadia-cube-wrap">
            <div className="arcadia-cube-glow" />

            <img
              src={arcadionCube}
              alt=""
              aria-hidden="true"
              className="arcadia-cube"
            />

            <div className="arcadia-cube-sparkles" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="arcadia-hero-particles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* Left content */}
      <div className="arcadia-hero-content">
        <span className="arcadia-hero-eyebrow">WELCOME TO</span>

        <h1 className="arcadia-hero-title">ARCADIA</h1>

        <div className="arcadia-hero-tagline">
          <span>PLAY</span>
          <i>•</i>
          <span>CHALLENGE</span>
          <i>•</i>
          <span>CONQUER</span>
        </div>

        <p className="arcadia-hero-description">
          Step into Arcadia — where every game is a new story,
          every challenge a new chance, and every victory
          brings you closer to something greater.
        </p>

        <button
          type="button"
          className="arcadia-hero-button"
          onClick={() => navigateTo("/games")}
        >
          <span className="arcadia-hero-button-icon">▷</span>
          <span>START PLAYING</span>
        </button>
      </div>

      {/* Top-right quote */}
      <div className="arcadia-hero-quote" aria-hidden="true">
        <span>GAMES</span>
        <span>ARE JUST</span>
        <span>THE BEGINNING</span>
        <i />
      </div>

      {/* Bottom-left label */}
      <div className="arcadia-hero-master" aria-hidden="true">
        <ArcadionEmblem />

        <div className="arcadia-hero-master-text">
          <strong>ARCADION</strong>
          <span>THE GAME MASTER</span>
        </div>

        <i className="arcadia-hero-master-line" />
      </div>
    </section>
  );
}

export default HeroSection;