import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminToken,
  revokeAdminToken,
  verifyAdminCredentials,
  verifyAdminToken,
} from "../src/utils/adminAuth.js";

test("admin sessions authenticate and can be revoked on logout", () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = "admin@rotavoy.test";
  process.env.ADMIN_PASSWORD = "strong-test-password";

  try {
    assert.equal(verifyAdminCredentials("ADMIN@ROTAVOY.TEST", "strong-test-password"), true);
    assert.equal(verifyAdminCredentials("admin@rotavoy.test", "wrong"), false);

    const token = createAdminToken();
    assert.equal(verifyAdminToken(token).email, "admin@rotavoy.test");
    assert.equal(revokeAdminToken(token), true);
    assert.throws(() => verifyAdminToken(token), /Invalid or expired admin session/);
  } finally {
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});
