import type { Game } from "../../../types/game";
import { navigateTo } from "../../../lib/navigation";
import GameLogo from "./GameLogo";

import arcadionPick from "../../../assets/Arcadionpick.png";
import arcadionPickBg from "../../../assets/ArcadionpickBG.png";

type ArcadionPickProps = {
  games: Game[];
};

/* 5600 -> "5.6K+", 950 -> "950+" */
function formatPlays(plays: number) {
  if (plays >= 1000) {
    const k = plays / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(".0", "")}K+`;
  }
  return `${plays}+`;
}

function EmblemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M4 6l14 6 8 10 6-6 6 6 8-10 14-6-6 20-8 6-4 16-10 10-10-10-4-16-8-6z"
        fill="currentColor"
      />
    </svg>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" fill="currentColor" />
      <path d="M2.5 19c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6z" fill="currentColor" />
      <circle cx="17" cy="9" r="2.5" fill="currentColor" opacity="0.7" />
      <path d="M17 13.5c2.6 0 4.5 1.6 4.5 4.5h-4.2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function ArcadionPick({ games }: ArcadionPickProps) {
  const picks = [...games].sort((a, b) => b.plays - a.plays).slice(0, 3);

  return (
    <section className="arcadion-picks" aria-labelledby="arcadion-picks-title">
      {/* Portal ring */}
      <div className="arcadion-picks-ring" aria-hidden="true">
        <img src={arcadionPickBg} alt="" draggable={false} />
      </div>

      {/* Game Master */}
      <div className="arcadion-picks-character" aria-hidden="true">
        <div className="arcadion-picks-character-glow" />
        <img src={arcadionPick} alt="" draggable={false} />
      </div>

      {/* Handwritten note */}
      <div className="arcadion-picks-note" aria-hidden="true">
        <CrownIcon className="arcadion-picks-note-crown" />
        <span>
          Play
          <br />
          what I
          <br />
          picked
        </span>
        <svg viewBox="0 0 60 60" className="arcadion-picks-note-arrow">
          <path
            d="M44 4c2 20-10 34-32 44m0 0l14-2m-14 2l4-13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Heading */}
      <div className="arcadion-picks-heading">
        <div className="arcadion-picks-title-row">
          <EmblemIcon className="arcadion-picks-emblem" />
          <div className="arcadion-picks-title-stack">
            <span className="arcadion-picks-pre">
              <i />
              ARCADION&rsquo;S
              <i />
            </span>
            <h2 id="arcadion-picks-title">PICKS</h2>
          </div>
        </div>

        <div className="arcadion-picks-sub">
          <span className="arcadion-picks-sub-line" />
          <span>CHOSEN BY THE GAME MASTER</span>
          <span className="arcadion-picks-sub-line" />
        </div>

        <p>
          These are the games Arcadion thinks you&rsquo;ll love.
          <br />
          Step in, play, and see if you can impress the Game Master.
        </p>
      </div>

      {/* Cards */}
      <div className="arcadion-picks-list">
        {picks.map((game, index) => (
          <article
            className={`arcadion-pick-card library-card arcadion-pick-card-${index + 1}`}
            key={game.name}
          >
            <div className="arcadion-pick-top">
              <span className="arcadion-pick-tag">{game.category}</span>
              {index === 0 && <CrownIcon className="arcadion-pick-crown" />}
            </div>

            <div className="arcadion-pick-body">
              <div className="arcadion-pick-icon">
                <GameLogo gameName={game.name} />
              </div>

              <div className="arcadion-pick-info">
                <h3>{game.name}</h3>
                <p>{game.description}</p>
              </div>
            </div>

            <div className="arcadion-pick-bottom">
              <span className="arcadion-pick-players">
                <PlayersIcon />
                {formatPlays(game.plays)} PLAYING
              </span>

              <button
                type="button"
                className="arcadion-pick-button"
                onClick={(event) => navigateTo("/games", event)}
              >
                PLAY NOW
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Divider */}
      <div className="arcadion-picks-footer" aria-hidden="true">
        <span className="arcadion-picks-footer-line" />
        <i />
        <EmblemIcon className="arcadion-picks-footer-emblem" />
        <i />
        <span className="arcadion-picks-footer-line arcadion-picks-footer-line-r" />
      </div>
    </section>
  );
}

export default ArcadionPick;