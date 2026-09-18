import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Crown, Star } from "lucide-react";

type Player = {
  name: string;
  avatar: string;
  score: number;
};

const PLAYERS: Player[] = [
  {
    name: "PlayerOne",
    avatar: "🧑🏻‍🎮",
    score: 12840,
  },
  {
    name: "ShadowX",
    avatar: "🥷",
    score: 11920,
  },
  {
    name: "Nova",
    avatar: "🐱‍👤",
    score: 10740,
  },
  {
    name: "PixelRush",
    avatar: "👾",
    score: 9860,
  },
  {
    name: "Void",
    avatar: "🧙🏻‍♀️",
    score: 9120,
  },
  {
    name: "Arcadion",
    avatar: "🤖",
    score: 8940,
  },
  {
    name: "GhostByte",
    avatar: "🐺",
    score: 8760,
  },
  {
    name: "NeonFox",
    avatar: "😈",
    score: 8210,
  },
  {
    name: "Drift",
    avatar: "😎",
    score: 7860,
  },
  {
    name: "Zyro",
    avatar: "😵‍💫",
    score: 7420,
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getRankClass(rank: number) {
  if (rank === 1) return "is-first";
  if (rank === 2) return "is-second";
  if (rank === 3) return "is-third";

  return "";
}

export default function LeaderboardHome() {
  const gridRef = useRef<HTMLDivElement>(null);

  const [canGoPrevious, setCanGoPrevious] = useState(false);
  const [canGoNext, setCanGoNext] = useState(true);

  const updateArrowState = () => {
    const grid = gridRef.current;

    if (!grid) return;

    const maxScrollLeft = grid.scrollWidth - grid.clientWidth;

    setCanGoPrevious(grid.scrollLeft > 5);
    setCanGoNext(grid.scrollLeft < maxScrollLeft - 5);
  };

  const scrollCards = (direction: "previous" | "next") => {
    const grid = gridRef.current;

    if (!grid) return;

    const card = grid.querySelector<HTMLElement>(
      ".leaderboard-home-card"
    );

    if (!card) return;

    const cardWidth = card.getBoundingClientRect().width;

    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || styles.gap || "0");

    const scrollAmount = cardWidth + gap;

    grid.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });

    window.setTimeout(updateArrowState, 350);
  };

  return (
    <section
      className="leaderboard-home"
      aria-labelledby="leaderboard-home-title"
    >
      <div className="leaderboard-home-header">
        <div className="leaderboard-home-copy">
          <h2
            id="leaderboard-home-title"
            className="leaderboard-home-title"
          >
            Top 10 Players
          </h2>

          <p className="leaderboard-home-subtitle">
            See who&apos;s ruling Arcadia right now. Rack up the score and
            take your place at the top.
          </p>
        </div>
      </div>

      <div className="leaderboard-home-board">
        <div className="leaderboard-home-carousel">
          <button
            type="button"
            className="leaderboard-home-arrow leaderboard-home-arrow-left"
            onClick={() => scrollCards("previous")}
            disabled={!canGoPrevious}
            aria-label="Previous players"
          >
            <ArrowLeft aria-hidden="true" />
          </button>

          <div
            ref={gridRef}
            className="leaderboard-home-grid"
            aria-label="Top 10 Arcadia players"
            onScroll={updateArrowState}
          >
            {PLAYERS.map((player, index) => {
              const rank = index + 1;

              return (
                <article
                  key={player.name}
                  className={`leaderboard-home-card ${getRankClass(rank)}`}
                >
                  {rank <= 3 && (
                    <Crown
                      className="leaderboard-home-medal"
                      aria-hidden="true"
                    />
                  )}

                  <span className="leaderboard-home-rank">
                    #{rank}
                  </span>

                  <div
                    className="leaderboard-home-avatar"
                    aria-hidden="true"
                  >
                    {player.avatar}
                  </div>

                  <div className="leaderboard-home-player">
                    {player.name}
                  </div>

                  <div className="leaderboard-home-score">
                    <Star aria-hidden="true" />
                    <span>{formatNumber(player.score)}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <button
            type="button"
            className="leaderboard-home-arrow leaderboard-home-arrow-right"
            onClick={() => scrollCards("next")}
            disabled={!canGoNext}
            aria-label="Next players"
          >
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className="leaderboard-home-footer">
          <a
            href="/leaderboard"
            className="leaderboard-home-link"
          >
            <span>View full leaderboard</span>
            <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}