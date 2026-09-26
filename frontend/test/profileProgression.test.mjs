import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath, URL } from "node:url";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const originalConsoleError = console.error;

let dom;
let vite;
let React;
let act;
let createRoot;
let root;
let MyProfileModal;
let MyProfileContainer;
let UsernameOnboarding;
let AuthContext;
let progressionModule;
let authApi;
let AuthApiError;
let originalCheckUsernameAvailability;

/* ------------------------------------------------------------------
   Progression fixtures. Every value is what the backend returns; the
   frontend never computes a level, a title or a badge itself.
   ------------------------------------------------------------------ */

function progression(overrides = {}) {
  return {
    totalXp: 0,
    level: 0,
    currentLevelXp: 0,
    nextLevelXp: 100,
    progressPercent: 0,
    title: "Arcadia Rookie",
    badgeKey: "bronze",
    themeKey: "neutral-grey",
    ...overrides,
  };
}

function accountProfile(overrides = {}) {
  return {
    id: "user-1",
    name: "",
    username: "ankitbuilds",
    usernameSetupRequired: false,
    playerId: "ARC-7K4M2P9Q",
    displayName: "Ankit Das",
    avatar: { type: "local", value: "avatar-01" },
    avatarSource: "local",
    googleAvatarAvailable: false,
    googleAvatarUrl: null,
    authProvider: "PASSWORD",
    email: "user@example.com",
    progression: progression(),
    role: "USER",
    status: "ACTIVE",
    emailVerified: true,
    createdAt: "2026-09-14T10:00:00.000Z",
    updatedAt: null,
    lastLoginAt: null,
    gamingStats: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      bestScore: 0,
      currentStreak: 0,
      winRatePercent: 0,
    },
    ...overrides,
  };
}

function installDom() {
  // The animation frame loop is intentionally left off: these tests assert
  // markup and state, and the rAF loop starves long real-time waits.
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://arcadia.test/",
  });

  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  for (const key of [
    "HTMLElement",
    "HTMLInputElement",
    "HTMLButtonElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "CustomEvent",
    "MutationObserver",
  ]) {
    globalThis[key] = window[key];
  }
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true,
  });
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  if (window.requestAnimationFrame) {
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

before(async () => {
  // Timer driven state updates land while the test is sleeping, so React logs
  // its "not wrapped in act" notice. That warning is expected here; every other
  // console error is still surfaced.
  console.error = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return;
    originalConsoleError(...args);
  };

  installDom();
  React = (await import("react")).default;
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));

  vite = await createServer({
    root: frontendRoot,
    logLevel: "silent",
    server: { middlewareMode: true },
    appType: "custom",
  });
  MyProfileModal = (await vite.ssrLoadModule("/src/pages/Myprofile/MyProfileModal.tsx")).default;
  MyProfileContainer = (await vite.ssrLoadModule("/src/pages/Myprofile/MyProfileContainer.tsx")).default;
  UsernameOnboarding = (await vite.ssrLoadModule("/src/auth/UsernameOnboarding.tsx")).default;
  AuthContext = (await vite.ssrLoadModule("/src/auth/AuthContext.tsx")).default;
  progressionModule = await vite.ssrLoadModule("/src/auth/progression.ts");
  ({ authApi, AuthApiError } = await vite.ssrLoadModule("/src/auth/authApi.ts"));
  originalCheckUsernameAvailability = authApi.checkUsernameAvailability.bind(authApi);
  // Every username surface asks the backend before accepting a name, so the
  // shared module is stubbed once here. Tests that care override it.
  authApi.checkUsernameAvailability = async () => ({ available: true });
});

after(async () => {
  if (authApi && originalCheckUsernameAvailability) {
    authApi.checkUsernameAvailability = originalCheckUsernameAvailability;
  }
  await vite?.close();
  console.error = originalConsoleError;
});

/** Makes the shared availability lookup answer available/unavailable. */
function setUsernameAvailable(available) {
  authApi.checkUsernameAvailability = async (username) => {
    availabilityLookups.push(username);
    return { available };
  };
}

const availabilityLookups = [];

/*
 * The shared availability lookup is reset before every test, so one test's
 * answer can never decide another test's outcome. Tests that care about the
 * answer call setUsernameAvailable / setUsernameLookupFailure themselves.
 */
beforeEach(() => {
  authApi.checkUsernameAvailability = async () => ({ available: true });
  availabilityLookups.length = 0;
});

/** Simulates the availability endpoint being unreachable. */
function setUsernameLookupFailure() {
  authApi.checkUsernameAvailability = async () => {
    throw new Error("network unavailable");
  };
}

async function renderRoot(element) {
  await act(async () => {
    root?.unmount();
  });
  document.body.innerHTML = "";

  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return () => act(async () => root.unmount());
}

function q(selector) {
  return document.querySelector(selector);
}

/** The username value currently shown in the My Profile identity block. */
function usernameText() {
  return q('[data-field="username"]').textContent;
}

/** The Player ID currently shown in the My Profile identity block. */
function playerIdText() {
  return q('[data-field="playerId"]').textContent;
}

function qa(selector) {
  return [...document.querySelectorAll(selector)];
}

function click(node) {
  act(() => {
    node.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function typeInto(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

function submitForm() {
  act(() => {
    q(".unm-modal form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

/* ==================================================================
   Progression view: pure, no DOM, no real-time waits
   ================================================================== */

test("the progression view renders Level 0 from the backend payload", () => {
  const view = progressionModule.getProgressionView(progression());

  assert.equal(view.level, 0);
  assert.equal(view.levelLabel, "LEVEL 00");
  assert.equal(view.title, "Arcadia Rookie");
  assert.equal(view.badgeKey, "bronze");
  assert.equal(view.themeKey, "neutral-grey");
  assert.equal(view.isAnimated, false);
  assert.equal(view.currentLevelXp, 0);
  assert.equal(view.nextLevelXp, 100);
  assert.equal(view.progressPercent, 0);
  assert.equal(view.xpLabel, "0 / 100 XP");
});

test("the progression view renders the documented mid-level example", () => {
  // 180 XP banked inside Level 1, which needs 200 more for Level 2.
  const view = progressionModule.getProgressionView(progression({
    totalXp: 280,
    level: 1,
    currentLevelXp: 180,
    nextLevelXp: 200,
    progressPercent: 90,
    title: "Arcadia Rookie",
    badgeKey: "bronze",
    themeKey: "neutral-grey",
  }));

  assert.equal(view.levelLabel, "LEVEL 01");
  assert.equal(view.xpLabel, "180 / 200 XP");
  assert.equal(view.progressPercent, 90);
  assert.equal(view.nextLevelLabel, "200 XP to Level 2");
});

test("the progression view never renders NaN, Infinity or an out of range bar", () => {
  const hostile = [
    undefined,
    null,
    {},
    { level: Number.NaN, currentLevelXp: Number.NaN, nextLevelXp: Number.NaN, progressPercent: Number.NaN },
    { level: Infinity, currentLevelXp: Infinity, nextLevelXp: Infinity, progressPercent: Infinity },
    { level: -5, currentLevelXp: -50, nextLevelXp: -10, progressPercent: -80 },
    { level: 1.5, currentLevelXp: 1.5, nextLevelXp: 1.5, progressPercent: 12.5 },
    { level: 999999, currentLevelXp: 0, nextLevelXp: 0, progressPercent: 0 },
    { level: 3, title: "", badgeKey: "unknown-badge", themeKey: "unknown-theme" },
  ];

  for (const value of hostile) {
    const view = progressionModule.getProgressionView(value);
    assert.ok(Number.isFinite(view.progressPercent), JSON.stringify(value));
    assert.ok(view.progressPercent >= 0 && view.progressPercent <= 100, JSON.stringify(value));
    assert.ok(Number.isInteger(view.level) && view.level >= 0, JSON.stringify(value));
    assert.ok(Number.isFinite(view.currentLevelXp), JSON.stringify(value));
    assert.ok(Number.isFinite(view.nextLevelXp), JSON.stringify(value));
    assert.ok(Number.isFinite(view.totalXp), JSON.stringify(value));
    assert.doesNotMatch(view.xpLabel, /NaN|Infinity|undefined/, JSON.stringify(value));
    assert.doesNotMatch(view.levelLabel, /NaN|Infinity/, JSON.stringify(value));
    assert.ok(view.title.length > 0, JSON.stringify(value));
  }

  // A missing progression object still produces a usable Level 0 view.
  const empty = progressionModule.getProgressionView(undefined);
  assert.equal(empty.level, 0);
  assert.equal(empty.levelLabel, "LEVEL 00");
  assert.equal(empty.progressPercent, 0);
});

test("only the backend badge key decides the animated flame tier", () => {
  const tiers = [
    ["bronze", "neutral-grey", false],
    ["silver", "bright-green", false],
    ["gold", "deep-cyan", false],
    ["diamond", "crimson-red", false],
    ["crown", "electric-purple", false],
    ["flame", "neon-golden", true],
  ];

  for (const [badgeKey, themeKey, isAnimated] of tiers) {
    const view = progressionModule.getProgressionView(progression({
      level: 30,
      title: "Arcadia Supreme",
      badgeKey,
      themeKey,
    }));
    assert.equal(view.badgeKey, badgeKey);
    assert.equal(view.themeKey, themeKey);
    assert.equal(view.isAnimated, isAnimated, badgeKey);
  }

  // The animation itself is keyed off the badge, never off the theme.
  assert.equal(progressionModule.isAnimatedBadge("flame"), true);
  assert.equal(progressionModule.isAnimatedBadge("gold"), false);
});

test("My Profile leads with the Player ID, then the username, then the badge title", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({
      progression: progression({ level: 4, title: "Arcadia Vanguard", themeKey: "electric-purple" }),
    }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  const identity = q(".mpm-identity");

  // The order is the hierarchy: Player ID, then username, then badge title.
  const fields = [...identity.querySelectorAll("[data-field]")].map((node) => node.dataset.field);
  assert.deepEqual(
    fields.slice(0, 3),
    ["playerId", "username", "progressionTitle"],
    "Player ID leads, the username is the main text, the title follows",
  );

  // Only the Player ID carries a label; the username is a name, not a field.
  assert.deepEqual(
    qa(".mpm-identity .mpm-identity-label").map((node) => node.textContent),
    ["Player ID"],
    "there is no USERNAME label above the username",
  );
  assert.equal(usernameText(), "ankitbuilds", "the username is the main identity text");
  assert.equal(playerIdText(), "ARC-7K4M2P9Q");
  assert.equal(
    q('[data-field="progressionTitle"]').textContent,
    "Arcadia Vanguard",
    "the title comes from the progression, not a hardcoded string",
  );
  assert.equal(
    q('[data-field="progressionTitle"]').className,
    "mpm-identity-title mpm-identity-title--electric-purple",
    "the title pill is tinted by the progression theme",
  );

  const playerValue = q('[data-field="playerId"]');
  const nameValue = q('[data-field="username"]');
  // The Player ID stays secondary to the username and remains copyable. The
  // actual type sizes are a stylesheet concern, asserted in myProfileLayout.
  assert.ok(
    playerValue.classList.contains("mpm-identity-value--player"),
    "the Player ID carries the secondary type treatment",
  );
  assert.ok(
    nameValue.classList.contains("mpm-identity-value--name"),
    "the username carries the main type treatment",
  );
  assert.ok(q('button[aria-label="Copy player ID"]'), "the Player ID is still copyable");
  await unmount();
});

test("the badge title follows the progression and never falls back to a hardcoded name", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({ progression: progression({ level: 2, title: "Ember Scout" }) }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.equal(q('[data-field="progressionTitle"]').textContent, "Ember Scout");
  await unmount();

  // A new progression value updates the title without any other change.
  const updated = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({ progression: progression({ level: 9, title: "Arcadia Sovereign" }) }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));
  assert.equal(
    q('[data-field="progressionTitle"]').textContent,
    "Arcadia Sovereign",
    "the title is a pure function of the progression the backend sent",
  );
  await updated();
});

test("My Profile shows the username and Player ID, and no Google name in the identity block", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.equal(usernameText(), "ankitbuilds");
  assert.equal(playerIdText(), "ARC-7K4M2P9Q");

  // The Google fetched name is not part of the identity block.
  const identity = q(".mpm-identity").textContent;
  assert.doesNotMatch(identity, /Ankit Das/, "the Google display name is not shown");
  assert.equal(q(".mpm-identity-row"), null);

  // The joined date lives in Account Info now, not in the identity block.
  assert.match(
    q('[data-field="joinedDate"]').textContent,
    /^\d{1,2} [A-Z][a-z]+ \d{4}$/,
    "the joined date renders in full",
  );
  assert.equal(q(".mpm-provider-pill"), null, "the header Google badge is gone");

  const googleUnmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({
      authProvider: "GOOGLE",
      avatar: { type: "google", value: "google" },
      avatarSource: "google",
      googleAvatarAvailable: true,
      googleAvatarUrl: "https://lh3.googleusercontent.com/a/test-avatar",
    }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  // Google identity is still represented, under Account Info instead.
  assert.equal(q('[data-field="loginMethod"]').textContent, "Google");
  assert.equal(playerIdText(), "ARC-7K4M2P9Q", "the Player ID is the same on a Google account");
  assert.doesNotMatch(q(".mpm-identity").textContent, /Ankit Das/);
  await googleUnmount();
  await unmount();
});

test("My Profile shows an em dash when an account has no Player ID yet", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({ playerId: null }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.equal(playerIdText(), "—", "a pending Player ID is not shown as a broken value");
  assert.equal(q('button[aria-label="Copy player ID"]').disabled, true, "nothing to copy");
  assert.equal(q('button[aria-label="Copy username"]').disabled, false);
  await unmount();
});

/* ==================================================================
   My Profile: identity, level, avatar and Save Changes
   ================================================================== */

test("My Profile renders the backend level, title and XP progress", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({
      progression: progression({
        totalXp: 1500,
        level: 5,
        currentLevelXp: 0,
        nextLevelXp: 550,
        progressPercent: 0,
        title: "Arcadia Challenger",
        badgeKey: "silver",
        themeKey: "bright-green",
      }),
    }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.equal(q(".mpm-level-badge").textContent, "05");
  assert.equal(q(".mpm-level-title").textContent, "LEVEL 05");
  assert.equal(q(".mpm-level-sub").textContent, "Arcadia Challenger");
  assert.equal(q(".mpm-level-xp").textContent, "0 / 550 XP");
  assert.equal(q(".mpm-level-card").dataset.badge, "silver");
  assert.ok(q(".mpm-level-card").classList.contains("mpm-level-card--bright-green"));
  assert.equal(q(".mpm-progress-fill").style.width, "0%");
  assert.equal(q(".mpm-progress-track").getAttribute("aria-valuemax"), "550");
  await unmount();
});

test("My Profile renders Level 0 and a mid-level progress bar without NaN", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({
      progression: progression({
        totalXp: 280,
        level: 1,
        currentLevelXp: 180,
        nextLevelXp: 200,
        progressPercent: 90,
      }),
    }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.equal(q(".mpm-level-title").textContent, "LEVEL 01");
  assert.equal(q(".mpm-level-xp").textContent, "180 / 200 XP");
  assert.equal(q(".mpm-progress-fill").style.width, "90%");

  const levelZero = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({
      progression: progression({
        level: Number.NaN,
        currentLevelXp: Number.NaN,
        nextLevelXp: Number.NaN,
        progressPercent: Number.NaN,
      }),
    }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.equal(q(".mpm-level-title").textContent, "LEVEL 00");
  assert.equal(q(".mpm-level-xp").textContent, "0 / 0 XP");
  assert.equal(q(".mpm-progress-fill").style.width, "0%");
  assert.doesNotMatch(document.body.textContent, /NaN|Infinity/);
  await levelZero();
  await unmount();
});

test("My Profile is informational and carries no generic action row", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  // The Reset Changes / Save Changes row is gone entirely.
  assert.equal(q(".mpm-actions"), null, "the action row itself is removed");
  assert.equal(q(".mpm-save"), null, "My Profile has no Save Changes button");
  assert.equal(q(".mpm-reset"), null, "My Profile has no Reset Changes button");
  assert.equal(q(".mpm-pending-pill"), null, "nothing can be staged as unsaved");

  // Only the contextual controls that belong to a profile element remain.
  assert.ok(q(".mpm-close"), "the top-right X is still there");
  assert.ok(q('button[aria-label="Edit username"]'), "the username pencil remains");
  assert.ok(q('button[aria-label="Copy username"]'), "the username copy remains");
  assert.ok(q('button[aria-label="Copy player ID"]'), "the Player ID copy remains");
  assert.ok(q('button[aria-label="Change avatar"]'), "the avatar pencil remains");

  // No generic action label was reintroduced anywhere in the dialog.
  const labels = qa(".mpm-modal button")
    .map((node) => `${node.getAttribute("aria-label") ?? ""} ${node.textContent}`.trim().toLowerCase());
  assert.deepEqual(
    labels.filter((label) => /save changes|reset changes|edit profile|^close$/.test(label)),
    [],
    "no generic action labels remain",
  );
  await unmount();
});

test("the Username Modal saves the username and closes only after the write succeeds", async () => {
  const saves = [];
  let resolveSave;
  const onSaveUsername = (username) => {
    saves.push(username);
    return new Promise((resolve) => {
      resolveSave = resolve;
    });
  };

  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername,
  }));

  click(q('button[aria-label="Edit username"]'));
  assert.equal(
    q(".unm-continue").textContent,
    "Save Changes",
    "the username editor's primary action is Save Changes",
  );

  typeInto(q(".unm-input"), "Ankit Renamed");
  await act(async () => {
    q(".unm-modal form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });

  // The username is the only thing the modal persists, and it is sent as a bare
  // string rather than as a partial profile object.
  assert.equal(saves.length, 1, "the write was attempted exactly once");
  assert.equal(saves[0], "Ankit Renamed");

  // While the write is in flight the modal stays open and cannot resubmit.
  assert.ok(q(".unm-modal"), "the modal stays open until the backend confirms");
  assert.equal(q(".unm-continue").disabled, true, "a duplicate submission cannot be sent");
  assert.match(q(".unm-continue").textContent, /Saving/);

  await act(async () => {
    resolveSave();
  });

  assert.equal(q(".unm-modal"), null, "the modal closes only after a successful save");
  assert.equal(q(".mpm-save"), null, "there is no later save step to forget");
  await unmount();
});

/* ==================================================================
   The username is checked with the backend before it is persisted, and
   a refused name leaves everything untouched
   ================================================================== */

function editUsernameInModal(value) {
  click(q('button[aria-label="Edit username"]'));
  assert.ok(q(".unm-modal"), "the username editor opened");
  typeInto(q(".unm-input"), value);
  return act(async () => {
    q(".unm-modal form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

test("a taken username keeps the username modal open and changes nothing", async () => {
  const saves = [];
  availabilityLookups.length = 0;
  setUsernameAvailable(false);

  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername: async (username) => {
      saves.push(username);
    },
  }));

  await editUsernameInModal("Taken Name");

  // The modal stays open, keeps the entered value and shows the warning.
  assert.ok(q(".unm-modal"), "the username modal is not closed");
  assert.equal(q(".unm-input").value, "Taken Name", "the entered value is kept for editing");
  assert.equal(q(".unm-hint--error").textContent, "Username already taken");
  assert.ok(q(".unm-input-box--error"));

  // Nothing downstream moved: no display change, no profile write.
  assert.equal(usernameText(), "ankitbuilds", "the stored username is unchanged");
  assert.equal(saves.length, 0, "the database was never written");
  assert.deepEqual(availabilityLookups, ["Taken Name"], "the backend was asked");

  // Another username can be entered straight away.
  typeInto(q(".unm-input"), "Free Name");
  assert.equal(q(".unm-hint--error"), null, "typing clears the warning");
  await unmount();
});

test("an available username is persisted by the username modal and nothing else", async () => {
  const saves = [];
  availabilityLookups.length = 0;
  setUsernameAvailable(true);

  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername: async (username) => {
      saves.push(username);
    },
  }));

  await editUsernameInModal("Free Name");

  assert.deepEqual(availabilityLookups, ["Free Name"], "the backend was asked first");
  assert.deepEqual(saves, ["Free Name"], "an available name is persisted immediately");
  assert.equal(q(".unm-modal"), null, "the modal closed after the successful write");
  assert.equal(q(".mpm-save"), null, "there is no staged change left behind");

  // The displayed username is the persisted one. The parent re-reads it from the
  // profile it was given, so nothing is held in local state here.
  assert.equal(usernameText(), "ankitbuilds", "the display still reflects the given profile");
  await unmount();
});

test("the username modal persists through the existing account profile write", async () => {
  const writes = [];
  const authState = { username: "ankitbuilds", usernameSetupRequired: false };
  let storedProfile = accountProfile();

  authApi.getProfile = async () => ({ user: storedProfile });

  const contextValue = {
    user: { ...storedProfile, username: authState.username },
    isAuthenticated: true,
    updateProfile: async (changes) => {
      writes.push(changes);
      // The backend is the source of truth: it returns the stored profile.
      storedProfile = accountProfile({ username: changes.username });
      authState.username = storedProfile.username;
      return { ok: true, message: null, status: null, user: storedProfile };
    },
  };

  const unmount = await renderRoot(React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    React.createElement(MyProfileContainer, { onClose: () => {} }),
  ));

  await act(async () => {});
  assert.equal(usernameText(), "ankitbuilds", "loaded from the backend");

  // The username modal performs the one and only write.
  await editUsernameInModal("Persisted Name");

  assert.equal(writes.length, 1, "exactly one profile write");
  assert.deepEqual(writes[0], { username: "Persisted Name" });
  assert.equal(q(".unm-modal"), null, "the modal closed after the write");

  // AuthContext, the stored profile and the display all move together, so the
  // Navbar and the popup read the same value without a second write.
  assert.equal(authState.username, "Persisted Name", "auth state holds the persisted username");
  assert.equal(storedProfile.username, "Persisted Name", "the stored profile holds it too");
  assert.equal(usernameText(), "Persisted Name", "My Profile shows the persisted username");
  assert.equal(writes.length, 1, "the display update did not write again");
  await unmount();
});

test("a username conflict keeps the modal open and the persisted username intact", async () => {
  const writes = [];
  let persisted = accountProfile();
  authApi.getProfile = async () => ({ user: persisted });

  const contextValue = {
    user: persisted,
    isAuthenticated: true,
    updateProfile: async (changes) => {
      writes.push(changes);
      // 409 is what the unique usernameNormalized index produces.
      return {
        ok: false,
        message: "That username is already taken",
        status: 409,
        user: null,
      };
    },
  };

  const unmount = await renderRoot(React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    React.createElement(MyProfileContainer, { onClose: () => {} }),
  ));

  await act(async () => {});
  await editUsernameInModal("Raced Name");

  assert.equal(writes.length, 1, "the write was attempted");
  assert.ok(q(".mpm-modal"), "My Profile stays open");
  assert.ok(q(".unm-modal"), "the username modal stays open so the name can be corrected");

  // A lost race is reported as taken, exactly as the availability lookup would.
  assert.equal(q(".unm-hint--error").textContent, "Username already taken");
  assert.equal(q(".unm-input").value, "Raced Name", "the name is preserved for another attempt");

  // The persisted username never moved.
  assert.equal(contextValue.user.username, "ankitbuilds", "AuthContext is untouched");
  assert.equal(persisted.username, "ankitbuilds", "the stored profile is untouched");
  assert.equal((await authApi.getProfile()).user.username, "ankitbuilds", "the backend still has the old name");
  assert.equal(usernameText(), "ankitbuilds", "My Profile still shows the persisted username");
  assert.equal(q(".mpm-save"), null, "there is no save button to press instead");

  // Retrying is just submitting the modal again.
  await editUsernameInModal("Raced Again");
  assert.equal(writes.length, 2, "retrying sends the request again");
  await unmount();
});

test("a generic username write failure surfaces the server's message in the modal", async () => {
  const writes = [];
  let persisted = accountProfile();
  authApi.getProfile = async () => ({ user: persisted });

  const contextValue = {
    user: persisted,
    isAuthenticated: true,
    updateProfile: async (changes) => {
      writes.push(changes);
      return {
        ok: false,
        message: "Username can be changed once every 60 seconds",
        status: 429,
        user: null,
      };
    },
  };

  const unmount = await renderRoot(React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    React.createElement(MyProfileContainer, { onClose: () => {} }),
  ));

  await act(async () => {});
  await editUsernameInModal("Rate Limited");

  assert.equal(writes.length, 1);
  assert.ok(q(".unm-modal"), "the failure keeps the modal open with the name");
  assert.equal(q(".unm-input").value, "Rate Limited", "the name is still available to edit");
  assert.equal(
    q(".unm-hint--error").textContent,
    "Username can be changed once every 60 seconds",
    "the server's safe message is shown, not a false success",
  );
  assert.equal(contextValue.user.username, "ankitbuilds", "AuthContext is untouched");
  assert.equal(persisted.username, "ankitbuilds", "the stored profile is untouched");
  assert.equal(usernameText(), "ankitbuilds", "My Profile still shows the persisted username");
  await unmount();
});

/* ==================================================================
   Google onboarding: check, then persist, then complete
   ================================================================== */

function googleUserWithoutUsername(overrides = {}) {
  return accountProfile({
    username: null,
    usernameSetupRequired: true,
    authProvider: "GOOGLE",
    avatar: { type: "google", value: "google" },
    avatarSource: "google",
    googleAvatarAvailable: true,
    googleAvatarUrl: "https://lh3.googleusercontent.com/a/test-avatar",
    ...overrides,
  });
}

function renderOnboarding({ updateProfile, user }) {
  const value = {
    user,
    isAuthenticated: true,
    updateProfile,
  };
  return renderRoot(React.createElement(
    AuthContext.Provider,
    { value },
    React.createElement(UsernameOnboarding),
  ));
}

test("a taken username during onboarding keeps the modal open and completes nothing", async () => {
  const writes = [];
  availabilityLookups.length = 0;
  setUsernameAvailable(false);

  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async (changes) => {
      writes.push(changes);
      return { ok: true, message: null, status: null, user: googleUserWithoutUsername() };
    },
  });

  typeInto(q(".unm-input"), "Someone Else");
  await act(async () => {
    submitForm();
  });

  assert.deepEqual(availabilityLookups, ["Someone Else"], "the backend was asked");
  assert.equal(writes.length, 0, "the database was never written");
  assert.ok(q(".unm-modal"), "onboarding is not complete and the modal stays open");
  assert.equal(q(".unm-input").value, "Someone Else", "the entered value is kept");
  assert.equal(q(".unm-hint--error").textContent, "Username already taken");
  assert.equal(q(".unm-close"), null, "there is still no way to skip onboarding");

  // Another username can be entered immediately.
  typeInto(q(".unm-input"), "My Own Name");
  assert.equal(q(".unm-hint--error"), null);
  await unmount();
});

test("an available username during onboarding persists and completes setup", async () => {
  const writes = [];
  availabilityLookups.length = 0;
  setUsernameAvailable(true);

  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async (changes) => {
      writes.push(changes);
      return {
        ok: true,
        message: null,
        status: null,
        user: accountProfile({ username: changes.username, usernameSetupRequired: false }),
      };
    },
  });

  typeInto(q(".unm-input"), "  Arcadia Player  ");
  await act(async () => {
    submitForm();
  });

  // The availability check runs before the write, and only the exact visible
  // username is sent.
  assert.deepEqual(availabilityLookups, ["Arcadia Player"]);
  assert.deepEqual(writes, [{ username: "Arcadia Player" }]);

  // The persisted username is what the rest of the UI reads. In the real app
  // AuthContext flips usernameSetupRequired, which unmounts this modal.
  assert.equal(writes[0].username, "Arcadia Player");
  await unmount();
});

test("an onboarding write that loses the uniqueness race is reported as taken", async () => {
  const writes = [];
  availabilityLookups.length = 0;
  // The pre-check passes, then another account takes the name first.
  setUsernameAvailable(true);

  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async (changes) => {
      writes.push(changes);
      return {
        ok: false,
        message: "That username is already taken",
        status: 409,
        user: null,
      };
    },
  });

  typeInto(q(".unm-input"), "Raced Name");
  await act(async () => {
    submitForm();
  });

  assert.equal(writes.length, 1, "the write was attempted");
  assert.ok(q(".unm-modal"), "the modal stays open, so no false success state");
  assert.equal(q(".unm-hint--error").textContent, "Username already taken");
  assert.equal(q(".unm-input").value, "Raced Name", "the value is kept for another attempt");
  assert.equal(q(".unm-close"), null, "onboarding is still not complete");
  await unmount();
});

test("a non-conflict onboarding failure keeps the modal open with the server message", async () => {
  setUsernameAvailable(true);

  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async () => ({
      ok: false,
      message: "Username can be changed once every 60 seconds",
      status: 429,
      user: null,
    }),
  });

  typeInto(q(".unm-input"), "Rate Limited");
  await act(async () => {
    submitForm();
  });

  assert.ok(q(".unm-modal"));
  assert.equal(q(".unm-hint--error").textContent, "Username can be changed once every 60 seconds");
  assert.equal(q(".unm-input").value, "Rate Limited");
  await unmount();
});

test("an unreachable availability lookup never lets an unchecked name through", async () => {
  setUsernameLookupFailure();

  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async () => ({ ok: true, message: null, status: null, user: null }),
  });

  typeInto(q(".unm-input"), "Unchecked Name");
  await act(async () => {
    submitForm();
  });

  assert.ok(q(".unm-modal"), "nothing is accepted without a backend answer");
  assert.equal(q(".unm-hint--error").textContent, "Unable to check username availability. Please try again.");
  await unmount();
});

test("a duplicate submission during an in-flight write is refused, not silently saved", async () => {
  const writes = [];
  let releaseWrite;
  const persisted = accountProfile();
  authApi.getProfile = async () => ({ user: persisted });

  const contextValue = {
    user: persisted,
    isAuthenticated: true,
    updateProfile: async (changes) => {
      writes.push(changes);
      // The write hangs, so the rest of the test runs with one write in flight.
      await new Promise((resolve) => {
        releaseWrite = resolve;
      });
      return {
        ok: true,
        message: null,
        status: null,
        user: accountProfile({ username: changes.username }),
      };
    },
  };

  const unmount = await renderRoot(React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    React.createElement(MyProfileContainer, { onClose: () => {} }),
  ));

  await act(async () => {});
  click(q('button[aria-label="Edit username"]'));
  typeInto(q(".unm-input"), "First Name");
  await act(async () => {
    q(".unm-modal form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });

  assert.equal(writes.length, 1, "the first write is in flight");
  assert.ok(q(".unm-modal"), "the modal is still open while the write is pending");
  assert.equal(q(".unm-continue").disabled, true, "the primary action is disabled mid-write");

  // Submitting again while the write is pending must not send a second request.
  await act(async () => {
    q(".unm-modal form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(writes.length, 1, "a duplicate write is never sent");
  assert.ok(q(".unm-modal"), "and the modal is not closed as a false success");

  await act(async () => {
    releaseWrite();
  });
  assert.equal(q(".unm-modal"), null, "the real write still closes the modal when it lands");
  assert.equal(writes.length, 1, "still exactly one write");
  await unmount();
});

test("keeping your own username is not treated as a conflict", async () => {
  availabilityLookups.length = 0;
  authApi.checkUsernameAvailability = async (username) => {
    availabilityLookups.push(username);
    return { available: false };
  };

  const saves = [];
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({ username: "AnkitBuilds" }),
    onClose: () => {},
    onSaveUsername: async (username) => {
      saves.push(username);
    },
  }));

  // Same name, and a casing-only change: both are accepted without a lookup,
  // because the account's own record would otherwise answer the question.
  await editUsernameInModal("AnkitBuilds");
  assert.equal(q(".unm-modal"), null, "re-submitting the current name is accepted");
  await editUsernameInModal("ankitbuilds");
  assert.equal(q(".unm-modal"), null, "a case-only change is accepted");
  assert.deepEqual(availabilityLookups, [], "the account's own name is never looked up");
  assert.deepEqual(saves, ["AnkitBuilds", "ankitbuilds"], "both were persisted as entered");
  await unmount();
});

test("the taken-username warning reuses the shared 5 second notice lifecycle", async () => {
  availabilityLookups.length = 0;
  setUsernameAvailable(false);

  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async () => ({ ok: true, message: null, status: null, user: null }),
  });

  typeInto(q(".unm-input"), "Someone Else");
  await act(async () => {
    submitForm();
  });

  const hint = q(".unm-hint--error");
  assert.equal(hint.textContent, "Username already taken");
  assert.equal(hint.classList.contains("is-leaving"), false, "it starts fully visible");
  assert.ok(q(".unm-modal"), "the modal is still open while the warning shows");
  await unmount();
});

test("a failed write keeps the modal open, the name and a visible warning", async () => {
  const saves = [];
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername: async (username) => {
      saves.push(username);
      // The container reports a failed write by throwing the same AuthApiError
      // the profile API raises, so the safe server message survives.
      throw new AuthApiError("That username is already taken", 409);
    },
  }));

  await editUsernameInModal("Taken Name");

  assert.deepEqual(saves, ["Taken Name"], "the write was attempted");
  assert.ok(q(".mpm-modal"), "My Profile stays open after a failure");
  assert.ok(q(".unm-modal"), "the username modal stays open so the edit is not lost");
  assert.equal(q(".unm-input").value, "Taken Name", "the name is preserved for the retry");
  assert.equal(q(".unm-hint--error").textContent, "That username is already taken");
  assert.equal(usernameText(), "ankitbuilds", "the display never shows an unpersisted name");

  // Retrying is just submitting the modal again.
  await editUsernameInModal("Taken Name");
  assert.equal(saves.length, 2, "retrying sends the request again");
  await unmount();
});

test("the avatar pencil stays visible but cannot stage an unsavable change", async () => {
  const saves = [];
  const profile = accountProfile({
    googleAvatarAvailable: true,
    googleAvatarUrl: "https://lh3.googleusercontent.com/a/test-avatar",
  });
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile,
    onClose: () => {},
    onSaveUsername: async (username) => {
      saves.push(username);
    },
  }));

  // The pencil is the entry point for the future Avatar Modal, so it is still
  // rendered in the same place.
  const pencil = q('button[aria-label="Change avatar"]');
  assert.ok(pencil, "the avatar pencil is still visible");
  assert.equal(pencil.disabled, true, "it is inert until avatar editing exists");
  assert.match(pencil.getAttribute("title"), /coming soon/i);

  // Avatar editing is not implemented, so it opens no picker at all. A staged
  // selection with no way to persist it would be a broken state.
  click(pencil);
  assert.equal(q(".mpm-avatar-picker"), null, "no avatar picker is opened");
  assert.equal(qa(".mpm-avatar-option").length, 0, "no avatar choices are offered");
  assert.equal(q(".mpm-save"), null, "and there is no save button to strand a choice on");

  // The stored avatar is untouched and no username write was triggered by it.
  assert.equal(profile.avatar.type, "local", "the stored avatar is unchanged");
  assert.equal(profile.avatar.value, "avatar-01", "and so is the chosen one");
  assert.equal(saves.length, 0, "nothing was written");
  await unmount();
});

test("a Google account reports its login method in Account Info", async () => {
  // Avatar editing is not implemented, so the picker is gone; the Google identity
  // data it used is untouched and still describes the account.
  const withGoogle = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({
      authProvider: "GOOGLE",
      avatar: { type: "google", value: "google" },
      avatarSource: "google",
      googleAvatarAvailable: true,
      googleAvatarUrl: "https://lh3.googleusercontent.com/a/test-avatar",
    }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  assert.ok(q(".mpm-avatar"), "the avatar is rendered");
  assert.equal(
    q('[data-field="loginMethod"]').textContent,
    "Google",
    "the Google identity is reported in Account Info",
  );
  assert.equal(
    q(".mpm-info-grid").textContent.includes("Signed in with Google"),
    false,
    "the old badge is not duplicated anywhere",
  );
  await withGoogle();

  // Without a Google identity there is nothing to report as Google.
  const withoutGoogle = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile({ authProvider: "PASSWORD" }),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));
  assert.equal(
    q('[data-field="loginMethod"]').textContent,
    "Email & Password",
    "a password account reports its own method",
  );
  await withoutGoogle();
});

test("gaming stats and the game breakdown stay neutral empty states", async () => {
  const unmount = await renderRoot(React.createElement(MyProfileModal, {
    profile: accountProfile(),
    onClose: () => {},
    onSaveUsername: async () => {},
  }));

  const statValues = qa(".mpm-stat-value").map((node) => node.textContent);
  assert.deepEqual(statValues.slice(0, 5), ["0", "0", "0", "0", "0%"]);

  // No game records exist, so the breakdown shows no invented numbers.
  const rows = qa(".mpm-table tbody tr");
  assert.equal(rows.length, 5);
  for (const row of rows) {
    const cells = [...row.querySelectorAll("td")].slice(1).map((cell) => cell.textContent);
    assert.deepEqual(cells, ["—", "—", "—"]);
  }
  await unmount();
});

/* ==================================================================
   Google onboarding: the modal itself
   ================================================================== */

test("username onboarding opens for a Google account with no username and cannot be skipped", async () => {
  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async () => ({ ok: true, message: null, status: null, user: null }),
  });

  assert.ok(q(".unm-modal"), "the existing onboarding modal is open");
  assert.equal(q(".unm-title").textContent, "Enter Your Username");
  assert.equal(q(".unm-close"), null, "onboarding has no close button");
  assert.ok(q(".unm-continue"), "the only way forward is Continue");
  await unmount();
});

test("username onboarding renders nothing once the username is stored", async () => {
  const unmount = await renderOnboarding({
    user: accountProfile({ authProvider: "GOOGLE" }),
    updateProfile: async () => ({ ok: true, message: null, status: null, user: null }),
  });

  assert.equal(q(".unm-modal"), null, "a Google account with a username is not onboarded again");
  await unmount();
});

test("username onboarding blocks duplicate submissions while saving", async () => {
  const writes = [];
  availabilityLookups.length = 0;
  setUsernameAvailable(true);
  let resolveWrite;
  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: (changes) => {
      writes.push(changes);
      return new Promise((resolve) => {
        resolveWrite = () => resolve({
          ok: true,
          message: null,
          status: null,
          user: accountProfile({ username: changes.username }),
        });
      });
    },
  });

  typeInto(q(".unm-input"), "Arcadia Player");
  await act(async () => {
    submitForm();
  });
  assert.equal(writes.length, 1);
  assert.equal(q(".unm-continue").disabled, true, "Continue is disabled while saving");

  await act(async () => {
    submitForm();
  });
  assert.equal(writes.length, 1, "a second submit never reaches the backend");

  await act(async () => {
    resolveWrite();
  });
  await unmount();
});

test("the onboarding input keeps the existing username length rules", async () => {
  const writes = [];
  availabilityLookups.length = 0;
  setUsernameAvailable(true);
  const unmount = await renderOnboarding({
    user: googleUserWithoutUsername(),
    updateProfile: async (changes) => {
      writes.push(changes);
      return { ok: true, message: null, status: null, user: accountProfile({ username: changes.username }) };
    },
  });

  const input = q(".unm-input");
  // No native maxLength: it counts UTF-16 units and would reject a valid 20
  // code point emoji username. The code point maximum is enforced by the shared
  // username rules instead.
  assert.equal(input.getAttribute("maxlength"), null);
  assert.equal(q(".unm-counter").textContent, "0 / 20");

  typeInto(input, "ab");
  await act(async () => {
    submitForm();
  });
  assert.equal(writes.length, 0, "an invalid username never reaches the backend");
  assert.equal(availabilityLookups.length, 0, "and is never looked up");
  assert.ok(q(".unm-modal"), "the modal stays open");
  assert.equal(q(".unm-hint--error").textContent, "Username too small");

  typeInto(input, "Ank");
  assert.equal(q(".unm-hint--error"), null, "a usable value clears the warning");
  await act(async () => {
    submitForm();
  });
  assert.equal(writes.length, 1);
  await unmount();
});
