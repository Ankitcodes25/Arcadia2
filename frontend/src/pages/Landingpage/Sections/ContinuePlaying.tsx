import type { CSSProperties } from "react";
import type { Game } from "../../../types/game";
import GameLogo from "../../Allgames/Sections/GameLogo";
import {
  getContinuePlayingItems,
  openGame,
  shouldRenderContinuePlaying,
} from "./continuePlayingState.js";
import type { GameHistoryEntry } from "./continuePlayingState.js";

type ContinuePlayingProps = {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  gameHistory: readonly GameHistoryEntry[];
  gameCatalog: readonly Game[];
};

function ContinuePlaying({
  isLoading,
  isAuthenticated,
  userId,
  gameHistory,
  gameCatalog,
}: ContinuePlayingProps) {
  const items = getContinuePlayingItems({
    userId,
    gameHistory,
    gameCatalog,
  });

  if (!shouldRenderContinuePlaying({
    isLoading,
    isAuthenticated,
    userId,
    items,
  })) {
    return null;
  }

  return (
    <section
      className="continue-playing"
      id="continue-playing"
    >
      <div className="continue-playing-heading">
        <div>
          <span className="continue-playing-label">
            JUMP BACK IN
          </span>

          <h2>Continue playing</h2>
        </div>
      </div>

      <div className="continue-playing-grid">
        {items.map(({ game, progress, cta }, index) => (
          <article
            className="continue-game-card"
            key={game.name}
            style={
              {
                "--continue-delay": `${index * 90}ms`,
              } as CSSProperties
            }
          >
            <div className="continue-game-glow" />

            <div className="continue-game-top">
              <span className="continue-game-category">
                {game.category}
              </span>

              <span className="continue-game-status">
                Recently played
              </span>
            </div>

            <div className="continue-game-main">
              <div className="continue-game-art unified-game-logo">
                <GameLogo gameName={game.name} />
              </div>

              <div className="continue-game-info">
                <h3>{game.name}</h3>

                <p>{game.description}</p>
              </div>
            </div>

            <div className="continue-game-progress">
              <div className="continue-progress-track">
                <span
                  className="continue-progress-fill"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>

            <div className="continue-game-footer">
              <button
                type="button"
                className="continue-game-button"
                onClick={() => openGame(game.name, window, window.CustomEvent)}
              >
                {cta}
                <span>→</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ContinuePlaying;
