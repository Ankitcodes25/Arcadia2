import type { Game } from "../../../types/game";

export type GameHistoryEntry = {
  userId: string;
  gameName: string;
  started: boolean;
  completed: boolean;
  progress: number;
  lastPlayedAt: string;
};

export type ContinuePlayingItem = {
  game: Game;
  progress: number;
  cta: "CONTINUE" | "PLAY AGAIN";
};

export function getContinuePlayingItems(input: {
  userId: string | null;
  gameHistory: readonly GameHistoryEntry[];
  gameCatalog: readonly Game[];
}): ContinuePlayingItem[];

export function shouldRenderContinuePlaying(input: {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  items: readonly ContinuePlayingItem[];
}): boolean;

export function openGame(
  gameName: string,
  target: EventTarget,
  eventConstructor?: typeof CustomEvent,
): void;
