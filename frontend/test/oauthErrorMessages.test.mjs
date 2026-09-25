import assert from "node:assert/strict";
import test from "node:test";
import { getOAuthErrorMessage } from "../src/auth/oauthErrorMessages.js";

const ACCOUNT_EXISTS_MESSAGE =
  "Account already exists. Please use your existing email and password to log in.";
const GENERIC_GOOGLE_ERROR_MESSAGE =
  "Google sign-in could not be completed. Please try again.";

test("account_exists maps to the password-login guidance", () => {
  assert.equal(getOAuthErrorMessage("account_exists"), ACCOUNT_EXISTS_MESSAGE);
});

test("unknown Google OAuth errors remain generic", () => {
  assert.equal(getOAuthErrorMessage("authentication_failed"), GENERIC_GOOGLE_ERROR_MESSAGE);
  assert.equal(getOAuthErrorMessage("unexpected_provider_error"), GENERIC_GOOGLE_ERROR_MESSAGE);
  assert.equal(getOAuthErrorMessage(null), GENERIC_GOOGLE_ERROR_MESSAGE);
});
