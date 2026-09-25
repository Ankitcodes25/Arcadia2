const MAX_VISIBLE_GAMES = 2;

function getTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getContinuePlayingItems({
  userId,
  gameHistory,
  gameCatalog,
}) {
  if (!userId) return [];

  const gamesByName = new Map(
    gameCatalog.map((game) => [game.name, game]),
  );

  return gameHistory
    .filter((entry) => (
      entry.userId === userId
      && (entry.started || entry.completed)
      && gamesByName.has(entry.gameName)
    ))
    .sort((left, right) => (
      getTimestamp(right.lastPlayedAt) - getTimestamp(left.lastPlayedAt)
    ))
    .slice(0, MAX_VISIBLE_GAMES)
    .map((entry) => {
      const progress = Number.isFinite(entry.progress)
        ? Math.min(100, Math.max(0, entry.progress))
        : 0;

      return {
        game: gamesByName.get(entry.gameName),
        progress,
        cta: entry.completed ? "PLAY AGAIN" : "CONTINUE",
      };
    });
}

export function shouldRenderContinuePlaying({
  isLoading,
  isAuthenticated,
  userId,
  items,
}) {
  return !isLoading
    && isAuthenticated
    && Boolean(userId)
    && items.length > 0;
}

export function openGame(gameName, target, EventConstructor = globalThis.CustomEvent) {
  if (!gameName || typeof EventConstructor !== "function") return;

  target.dispatchEvent(new EventConstructor("arcadia:game-opened", {
    detail: { gameName },
  }));
}
