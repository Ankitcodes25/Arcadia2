import { useEffect, useState, type CSSProperties } from "react";
import type { Game } from "../../../types/game";
import { navigateTo } from "../../../lib/navigation";

import heroBg from "../../../assets/HeroBg.webp";
import arcadionFull from "../../../assets/ArcadionFull.png";
import arcadionCube from "../../../assets/Arcadioncube.png";

type HeroSectionProps = {
  games: Game[];
};

const TITLE = "ARCADIA";

/* Typewriter: W se type → 3s blink → wapas W tak erase → W par ruko → repeat */
type TypewriterProps = {
  text: string;
  typeSpeed?: number;    // ms per character while typing
  deleteSpeed?: number;  // ms per character while erasing
  holdMs?: number;       // full text visible for this long
  restartMs?: number;    // pause after fully erased
};

function TypewriterText({
  text,
  typeSpeed = 110,
  deleteSpeed = 60,
  holdMs = 3000,
  restartMs = 700,
}: TypewriterProps) {
  // "W" par hi ruk kar wahin se dobara type hota hai (poora nahi mitta)
  const [count, setCount] = useState(1);
  const [deleting, setDeleting] = useState(true);
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reduceMotion) return;

    let delay: number;
    if (!deleting) {
      delay = count < text.length ? typeSpeed : holdMs;
    } else {
      delay = count > 1 ? deleteSpeed : restartMs;
    }

    const id = window.setTimeout(() => {
      if (!deleting) {
        if (count < text.length) setCount((c) => c + 1);
        else setDeleting(true);
      } else if (count > 1) {
        setCount((c) => c - 1);
      } else {
        setDeleting(false);
      }
    }, delay);

    return () => window.clearTimeout(id);
  }, [count, deleting, text, typeSpeed, deleteSpeed, holdMs, restartMs, reduceMotion]);

  if (reduceMotion) return <span>{text}</span>;

  const busy = deleting ? count > 1 : count < text.length;

  return (
    <>
      <span className="arcadia-sr-only">{text}</span>
      <span className="arcadia-typewriter-text" aria-hidden="true">
        {text.slice(0, count)}
      </span>
      <span
        className="arcadia-typewriter-cursor"
        data-busy={busy}
        aria-hidden="true"
      />
    </>
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
        <span className="arcadia-hero-eyebrow">
          <TypewriterText text="WELCOME TO" />
        </span>

        <h1 className="arcadia-hero-title" aria-label={TITLE} data-text={TITLE}>
          <span className="arcadia-title-aura" aria-hidden="true" />
          {TITLE.split("").map((letter, i) => (
            <span
              key={i}
              className="arcadia-title-letter"
              style={{ "--i": i } as CSSProperties}
              aria-hidden="true"
            >
              {letter}
            </span>
          ))}
        </h1>

        <div className="arcadia-hero-tagline">
          <span>PLAY</span>
          <i aria-hidden="true" />
          <span>CHALLENGE</span>
          <i aria-hidden="true" />
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
    </section>
  );
}

export default HeroSection;