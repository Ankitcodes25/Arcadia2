import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath, URL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const user = {
  id: "user-1",
  name: "Ankit Das",
  username: "ankitbuilds",
  usernameSetupRequired: false,
  displayName: "Ankit Das",
  avatar: { type: "google", value: "google" },
  avatarSource: "google",
  googleAvatarAvailable: true,
  googleAvatarUrl: "https://lh3.googleusercontent.com/a/test-avatar",
  authProvider: "GOOGLE",
  email: "user@example.com",
  role: "USER",
  status: "ACTIVE",
  emailVerified: true,
  createdAt: null,
  updatedAt: null,
  lastLoginAt: null,
};

let vite;
let ProfilePopupModal;

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    logLevel: "silent",
    server: { middlewareMode: true },
    appType: "custom",
  });
  ProfilePopupModal = (
    await vite.ssrLoadModule("/src/components/ProfilePopupmodal.tsx")
  ).default;
});

after(async () => {
  await vite?.close();
});

function renderPopup() {
  return renderToStaticMarkup(React.createElement(ProfilePopupModal, {
    user,
    onClose: () => {},
    onLogout: () => {},
    isLoggingOut: false,
  }));
}

test("profile header shows Arcadia username beside the avatar, not Google display name", () => {
  const markup = renderPopup();

  assert.match(markup, /ankitbuilds/);
  assert.doesNotMatch(markup, /Ankit Das/);
  assert.match(markup, /profile-popup-avatar/);
});

test("profile popup contains exactly the five approved menu options", () => {
  const markup = renderPopup();

  for (const label of ["My Profile", "Leaderboards", "Settings", "Help &amp; Support", "Logout"]) {
    assert.match(markup, new RegExp(`>${label}<`));
  }
  for (const label of ["Favorite Games", "Trophies", "Achievements", "Account Settings"]) {
    assert.doesNotMatch(markup, new RegExp(`>${label}<`));
  }
  assert.equal((markup.match(/class="profile-popup-item/g) || []).length, 5);
});
