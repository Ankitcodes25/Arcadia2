import { useMemo, useState } from "react";
import {
  ArrowRight,
  Crown,
  Flame,
  Gamepad2,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";

type LeaderboardMode = "score" | "streak" | "games";

type Player = {
  name: string;
  avatar: string;
  score: number;
  streak: number;
  games: number;
};

const PLAYERS: Player[] = [
  { name: "PlayerOne", avatar: "🧑🏻‍🎮", score: 12840, streak: 7, games: 86 },
  { name: "ShadowX", avatar: "🥷", score: 11920, streak: 5, games: 74 },
  { name: "Nova", avatar: "🐱‍👤", score: 10740, streak: 4, games: 68 },
  { name: "PixelRush", avatar: "👾", score: 9860, streak: 3, games: 61 },
  { name: "Void", avatar: "🧙🏻‍♀️", score: 9120, streak: 3, games: 57 },
  { name: "Arcadion", avatar: "🤖", score: 8940, streak: 2, games: 53 },
  { name: "GhostByte", avatar: "🐺", score: 8760, streak: 1, games: 49 },
  { name: "NeonFox", avatar: "😈", score: 8210, streak: 1, games: 44 },
  { name: "Drift", avatar: "😎", score: 7860, streak: 1, games: 39 },
  { name: "Zyro", avatar: "😵‍💫", score: 7420, streak: 1, games: 35 },
];

const MODES: {
  id: LeaderboardMode;
  label: string;
  icon: typeof Trophy;
}[] = [
  { id: "score", label: "Top by Score", icon: Trophy },
  { id: "streak", label: "Longest Streaks", icon: Flame },
  { id: "games", label: "Games Played", icon: Gamepad2 },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function LeaderboardHome() {
  const [mode, setMode] = useState<LeaderboardMode>("score");

  const rankedPlayers = useMemo(() => {
    return [...PLAYERS].sort((a, b) => {
      if (mode === "streak") return b.streak - a.streak || b.score - a.score;
      if (mode === "games") return b.games - a.games || b.score - a.score;
      return b.score - a.score;
    });
  }, [mode]);

  const metricLabel = mode === "score" ? "Score" : mode === "streak" ? "day streak" : "games";

  return (
    <section className="leaderboard-home" aria-labelledby="leaderboard-home-title">
      <div className="leaderboard-home-header">
        <div className="leaderboard-home-copy">
          <div className="leaderboard-home-kicker">
            <Crown aria-hidden="true" />
            <span>MAIN CHARACTER BOARD</span>
          </div>

          <h2 id="leaderboard-home-title" className="leaderboard-home-title">
            Top 10 <span>Players</span>
          </h2>

          <p className="leaderboard-home-subtitle">
            See who&apos;s ruling Arcadia right now. Scores, streaks and pure
            main-character energy.
          </p>

          <div className="leaderboard-home-tabs" role="tablist" aria-label="Leaderboard category">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={`leaderboard-home-tab ${
                  mode === id ? "is-active" : ""
                }`}
                onClick={() => setMode(id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="leaderboard-home-visual" aria-hidden="true">
          <div className="leaderboard-home-orbit" />

          <Sparkles className="leaderboard-home-spark leaderboard-home-spark-one" />
          <Sparkles className="leaderboard-home-spark leaderboard-home-spark-two" />
          <Sparkles className="leaderboard-home-spark leaderboard-home-spark-three" />

          <div className="leaderboard-home-crown">
            <Crown />
          </div>

          <div className="leaderboard-home-visual-copy">
            Play
            <br />
            Compete
            <br />
            Be Legendary
          </div>
        </div>
      </div>

      <div className="leaderboard-home-board">
        <div className="leaderboard-home-grid">
          {rankedPlayers.slice(0, 10).map((player, index) => {
            const rank = index + 1;
            const isFirst = rank === 1;

            const metricValue =
              mode === "score"
                ? formatNumber(player.score)
                : mode === "streak"
                  ? `${player.streak} day`
                  : `${player.games}`;

            const streakText =
              player.streak === 1
                ? "1 day streak"
                : `${player.streak} day streak`;

            return (
              <article
                className={`leaderboard-home-card ${
                  isFirst ? "is-first" : ""
                }`}
                key={player.name}
              >
                <span className="leaderboard-home-rank">
                  {String(rank).padStart(2, "0")}
                </span>

                <div className="leaderboard-home-avatar" aria-hidden="true">
                  {player.avatar}
                </div>

                <div className="leaderboard-home-player">{player.name}</div>

                <div className="leaderboard-home-score" title={metricLabel}>
                  {mode === "score" ? (
                    <>
                      <Star aria-hidden="true" />
                      {metricValue}
                    </>
                  ) : mode === "streak" ? (
                    <>
                      <Flame aria-hidden="true" />
                      {metricValue}
                    </>
                  ) : (
                    <>
                      <Gamepad2 aria-hidden="true" />
                      {metricValue}
                    </>
                  )}
                </div>

                <div className="leaderboard-home-streak">
                  <Flame aria-hidden="true" />
                  <span>{streakText}</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="leaderboard-home-footer">
          <a className="leaderboard-home-link" href="/leaderboard">
            <span>View full leaderboard</span>
            <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
