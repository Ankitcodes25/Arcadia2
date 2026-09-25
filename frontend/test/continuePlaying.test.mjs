import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath, URL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const catalog = [
  {
    name: "Alpha Game",
    category: "BOARD GAME",
    icon: "A",
    description: "Alpha game description.",
    plays: 10,
  },
  {
    name: "Beta Game",
    category: "ARCADE",
    icon: "B",
    description: "Beta game description.",
    plays: 5,
  },
];

let vite;
let ContinuePlaying;
let openGame;

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    logLevel: "silent",
    server: { middlewareMode: true },
    appType: "custom",
  });
  ContinuePlaying = (
    await vite.ssrLoadModule("/src/pages/Landingpage/Sections/ContinuePlaying.tsx")
  ).default;
  ({ openGame } = await vite.ssrLoadModule(
    "/src/pages/Landingpage/Sections/continuePlayingState.js",
  ));
});

after(async () => {
  await vite?.close();
});

function renderContinuePlaying({
  isAuthenticated = true,
  isLoading = false,
  userId = "user-a",
  gameHistory = [],
} = {}) {
  return renderToStaticMarkup(React.createElement(ContinuePlaying, {
    isAuthenticated,
    isLoading,
    userId,
    gameHistory,
    gameCatalog: catalog,
  }));
}

function historyEntry(overrides = {}) {
  return {
    userId: "user-a",
    gameName: "Alpha Game",
    started: true,
    completed: false,
    progress: 45,
    lastPlayedAt: "2026-09-25T10:00:00.000Z",
    ...overrides,
  };
}

test("A. authenticated user without game history gets no Continue Playing section", () => {
  assert.equal(renderContinuePlaying({ gameHistory: [] }), "");
});

test("B. incomplete game renders the section with CONTINUE", () => {
  const markup = renderContinuePlaying({
    gameHistory: [historyEntry()],
  });

  assert.match(markup, /Continue playing/);
  assert.match(markup, /CONTINUE/);
  assert.doesNotMatch(markup, /PLAY AGAIN/);
});

test("C. completed game renders the section with PLAY AGAIN", () => {
  const markup = renderContinuePlaying({
    gameHistory: [historyEntry({ completed: true, progress: 100 })],
  });

  assert.match(markup, /Continue playing/);
  assert.match(markup, /PLAY AGAIN/);
  assert.doesNotMatch(markup, />CONTINUE</);
});

test("D. mixed history assigns each game's CTA independently", () => {
  const markup = renderContinuePlaying({
    gameHistory: [
      historyEntry({ completed: true, progress: 100 }),
      historyEntry({
        gameName: "Beta Game",
        lastPlayedAt: "2026-09-25T11:00:00.000Z",
      }),
    ],
  });

  assert.match(markup, /Alpha Game/);
  assert.match(markup, /Beta Game/);
  assert.match(markup, /PLAY AGAIN/);
  assert.match(markup, /CONTINUE/);
});

test("E. logged-out user never receives Continue Playing", () => {
  const markup = renderContinuePlaying({
    isAuthenticated: false,
    gameHistory: [historyEntry()],
  });

  assert.equal(markup, "");
});

test("F. switching users cannot leak another user's game history", () => {
  const gameHistory = [
    historyEntry(),
    historyEntry({ userId: "user-b", gameName: "Beta Game" }),
  ];
  const firstUserMarkup = renderContinuePlaying({ userId: "user-a", gameHistory });
  const secondUserMarkup = renderContinuePlaying({ userId: "user-b", gameHistory });

  assert.match(firstUserMarkup, /Alpha Game/);
  assert.doesNotMatch(firstUserMarkup, /Beta Game/);
  assert.match(secondUserMarkup, /Beta Game/);
  assert.doesNotMatch(secondUserMarkup, /Alpha Game/);
});

test("G. existing game-open event navigation remains functional", () => {
  const target = {
    listener: null,
    lastEvent: null,
    addEventListener(type, listener) {
      this.listener = type === "arcadia:game-opened" ? listener : null;
    },
    dispatchEvent(event) {
      this.listener?.(event);
      this.lastEvent = event;
      return true;
    },
  };

  class TestCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  openGame("Alpha Game", target, TestCustomEvent);

  assert.equal(target.lastEvent?.type, "arcadia:game-opened");
  assert.deepEqual(target.lastEvent?.detail, { gameName: "Alpha Game" });
});
