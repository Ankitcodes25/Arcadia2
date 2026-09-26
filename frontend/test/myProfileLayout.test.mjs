import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import postcss from "postcss";

const css = readFileSync(
  fileURLToPath(new URL("../src/pages/Myprofile/MyProfileModal.css", import.meta.url)),
  "utf8",
);
const root = postcss.parse(css);

/**
 * Every declaration of `prop` on `selector`, in source order, each paired with
 * the media query it sits inside (or null for an unconditional rule).
 */
function declarationsFor(selector, prop) {
  const found = [];
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const media = rule.parent.type === "atrule" && rule.parent.name === "media"
      ? rule.parent.params
      : null;
    rule.walkDecls(prop, (decl) => {
      found.push({ value: decl.value.trim(), media, line: decl.source.start.line });
    });
  });
  return found;
}

test("the My Profile modal is widened by a desktop-only rule", () => {
  const widths = declarationsFor(".mpm-modal", "width");

  // The base width is unchanged, and it is the only unconditional one.
  const unconditional = widths.filter((entry) => entry.media === null);
  assert.equal(unconditional.length, 1, "exactly one unconditional modal width");
  assert.equal(unconditional[0].value, "min(100%, 660px)", "the base width is untouched");

  // The wider width exists, and only inside a min-width query, so it cannot
  // match at or below the tablet breakpoint.
  const widened = widths.filter((entry) => entry.value === "min(100%, 880px)");
  assert.equal(widened.length, 1, "one widened desktop width");
  assert.match(widened[0].media, /min-width/, `the widening must be min-width, got ${widened[0].media}`);

  // Nothing else touches the modal width.
  assert.deepEqual(
    widths.map((entry) => entry.value),
    ["min(100%, 660px)", "min(100%, 880px)"],
    "no other width was introduced or removed",
  );
});

test("no max-width query changes the modal width, so tablet and mobile are preserved", () => {
  const offenders = declarationsFor(".mpm-modal", "width")
    .filter((entry) => entry.media && entry.media.includes("max-width"));
  assert.deepEqual(offenders, [], "the tablet and mobile widths are exactly as they were");
});

test("Account Info is a 2x2 grid on desktop and collapses only on small phones", () => {
  const columns = declarationsFor(".mpm-info-grid", "grid-template-columns");
  const desktop = columns.find((entry) => entry.media === null);
  assert.ok(desktop, "the grid has a base column count");
  assert.equal(desktop.value, "repeat(2, minmax(0, 1fr))", "2x2 by default, so 2x2 on laptop and desktop");

  // The single-column fallback is the pre-existing small-phone breakpoint and
  // does not touch the tablet range.
  for (const entry of columns.filter((e) => e.media)) {
    assert.match(entry.media, /max-width:\s*560px/, `unexpected breakpoint ${entry.media}`);
  }
});

test("the removed action row and avatar picker have no styles left behind", () => {
  for (const selector of [
    ".mpm-actions",
    ".mpm-save",
    ".mpm-reset",
    ".mpm-pending-pill",
    ".mpm-identity-value--pending",
    ".mpm-avatar-picker",
    ".mpm-avatar-picker-grid",
    ".mpm-avatar-picker-cancel",
    ".mpm-avatar-option",
    ".mpm-avatar-option--selected",
    ".mpm-avatar-option--google",
    ".mpm-avatar-google-preview",
  ]) {
    const found = [];
    root.walkRules((rule) => {
      if (rule.selectors.includes(selector)) found.push(rule.source.start.line);
    });
    assert.deepEqual(found, [], `${selector} is no longer rendered, so it has no styles`);
  }
});

test("each Account Info item has its own icon and the active tone is a green accent", () => {
  const selectors = [];
  root.walkRules((rule) => selectors.push(...rule.selectors));

  for (const selector of [
    ".mpm-info-icon",
    ".mpm-info-label",
    ".mpm-info-value",
    ".mpm-info-hint",
    ".mpm-info-card",
    ".mpm-info-grid",
  ]) {
    assert.ok(selectors.includes(selector), `${selector} is styled`);
  }
  assert.ok(selectors.includes(".mpm-info-value--active"), "the active status tone exists");
  assert.ok(selectors.includes(".mpm-info-value--inactive"), "the inactive status tone exists");

  const active = declarationsFor(".mpm-info-value--active", "color");
  assert.equal(active.length, 1, "one active colour");
  assert.match(active[0].value, /#6ee7b7/i, "a restrained green");
});

test("the modal still scrolls internally and stays centred", () => {
  assert.deepEqual(
    declarationsFor(".mpm-modal", "overflow-y").map((e) => e.value),
    ["auto"],
    "vertical scrolling is unchanged",
  );
  assert.deepEqual(
    declarationsFor(".mpm-backdrop", "justify-content").map((e) => e.value),
    ["center"],
    "the backdrop still centres the dialog",
  );
});

test("the identity hierarchy types the Player ID below the username", () => {
  // The username inherits the base identity size; the Player ID overrides it.
  const name = declarationsFor(".mpm-identity-value", "font-size");
  const player = declarationsFor(".mpm-identity-value--player", "font-size");

  assert.equal(name.length, 1, "the username has an explicit size");
  assert.equal(player.length, 1, "the Player ID has an explicit size");
  assert.ok(
    parseFloat(player[0].value) < parseFloat(name[0].value),
    `the Player ID (${player[0].value}) must be smaller than the username (${name[0].value})`,
  );

  // The Player ID keeps the secondary accent colour, the username is white.
  assert.match(
    declarationsFor(".mpm-identity-value--player", "color")[0].value,
    /#d9a9ff/i,
    "the Player ID stays a muted accent",
  );
  assert.match(
    declarationsFor(".mpm-identity-value--name", "color")[0].value,
    /white/i,
    "the username is the bright value",
  );
});

test("My Profile is layered above the Profile Popup that opens it", () => {
  const popupCss = readFileSync(
    fileURLToPath(new URL("../src/components/ProfilePopupmodal.css", import.meta.url)),
    "utf8",
  );
  const popupRoot = postcss.parse(popupCss);

  const zIndexes = (root) => {
    const found = [];
    root.walkRules((rule) => {
      rule.walkDecls("z-index", (decl) => {
        found.push({ selector: rule.selector, value: Number(decl.value.trim()) });
      });
    });
    return found;
  };

  const backdrop = zIndexes(root).find((entry) => entry.selector === ".mpm-backdrop");
  const popup = zIndexes(popupRoot).find((entry) => entry.selector === ".profile-popup");

  assert.ok(backdrop, "the My Profile backdrop declares a z-index");
  assert.ok(popup, "the Profile Popup declares a z-index");
  assert.ok(
    backdrop.value > popup.value,
    `My Profile (${backdrop.value}) must sit above the Profile Popup (${popup.value}), otherwise the popup would float over the dialog`,
  );
});

test("the Account Info cards use the Game Breakdown luminous edge treatment", () => {
  // The Game Breakdown container is the reference treatment.
  const reference = declarationsFor(".mpm-section--highlight .mpm-table-scroll", "box-shadow")[0];
  assert.ok(reference, "the Game Breakdown glow exists");

  const card = declarationsFor(".mpm-info-card", "box-shadow")[0];
  assert.ok(card, "the Account Info cards declare a glow too");

  // Same outer glow and inset wash, so the two read as one system.
  assert.match(card.value, /0 0 22px rgba\(224, 105, 255, 0\.2\)/, "the same outer purple glow");
  assert.match(card.value, /inset 0 0 16px rgba\(224, 105, 255, 0\.06\)/, "the same inset wash");

  // Same border weight and brightness family, and the same radius family. The
  // Game Breakdown uses a longhand override, so compare the resolved colour.
  const cardBorder = declarationsFor(".mpm-info-card", "border")[0].value;
  assert.match(cardBorder, /^1px solid /, "the same 1px border weight");
  const cardAlpha = Number(cardBorder.match(/rgba\(224, 105, 255, ([\d.]+)\)/)[1]);
  const tableBorder = declarationsFor(".mpm-section--highlight .mpm-table-scroll", "border-color")[0].value;
  assert.equal(
    cardAlpha,
    Number(tableBorder.match(/rgba\(224, 105, 255, ([\d.]+)\)/)[1]),
    "the card border alpha matches the Game Breakdown border",
  );

  const cardRadius = parseFloat(declarationsFor(".mpm-info-card", "border-radius")[0].value);
  const tableRadius = parseFloat(declarationsFor(".mpm-table-scroll", "border-radius")[0].value);
  assert.equal(cardRadius, tableRadius, "the same corner-radius family");

  // The interior stays dark purple, and the glow is restrained rather than loud.
  assert.match(declarationsFor(".mpm-info-card", "background")[0].value, /rgba\(28, 13, 52/, "a dark purple interior");
  const alpha = Number(card.value.match(/0 0 22px rgba\(224, 105, 255, ([\d.]+)\)/)[1]);
  assert.ok(alpha <= 0.3, `the glow must stay restrained, got alpha ${alpha}`);
});

test("the removed identity wrapper has no styles left behind", () => {
  for (const selector of [".mpm-identity-fields", ".mpm-identity-field"]) {
    const found = [];
    root.walkRules((rule) => {
      if (rule.selectors.includes(selector)) found.push(rule.source.start.line);
    });
    assert.deepEqual(found, [], `${selector} is no longer rendered, so it has no styles`);
  }
});
