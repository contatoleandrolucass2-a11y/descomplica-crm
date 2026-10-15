import assert from "node:assert/strict";
import test from "node:test";
import { createLoginAttemptStore, validateLoginAttempt } from "./login-attempt.mjs";

function fixture() {
  let current = null;
  let time = new Date("2026-10-15T13:00:00.000Z");
  let queue = Promise.resolve();
  const dependencies = {
    store: {
      async read() {
        if (current === null) throw Object.assign(new Error(), { code: "ENOENT" });
        return structuredClone(current);
      },
      async compareAndWrite(expected, value) {
        assert.deepEqual(current, expected);
        current = structuredClone(value);
      },
    },
    locked(action) {
      const result = queue.then(action);
      queue = result.catch(() => {});
      return result;
    },
    now: () => time,
  };
  return {
    create: () => createLoginAttemptStore(dependencies),
    current: () => current,
    setTime: (value) => (time = new Date(value)),
  };
}

test("pending and uncertain password attempts remain blocked across owner restarts", async () => {
  const f = fixture();
  assert.equal(await f.create().canAttempt(), true);
  assert.equal(await f.create().claimAttempt(), true);
  assert.equal(f.current().state, "pending");
  assert.equal(await f.create().canAttempt(), false);
  assert.equal(await f.create().claimAttempt(), false);
  await f.create().finishAttempt("attention");
  assert.equal(await f.create().claimAttempt(), false);
  await f.create().finishAttempt("authenticated");
  assert.equal(await f.create().canAttempt(), true);
  assert.equal(await f.create().claimAttempt(), true);
});

test("two concurrent consumers cannot both claim a password attempt", async () => {
  const f = fixture();
  assert.deepEqual(await Promise.all([f.create().claimAttempt(), f.create().claimAttempt()]), [
    true,
    false,
  ]);
});

test("a verified existing session can clear attention without exposing account information", async () => {
  const f = fixture();
  await f.create().finishAttempt("authenticated");
  assert.deepEqual(Object.keys(f.current()).sort(), ["observedAt", "schemaVersion", "state"]);
  assert.equal(await f.create().claimAttempt(), true);
});

test("clock regression and arbitrary outcomes do not clear a pending attempt", async () => {
  const f = fixture();
  await f.create().claimAttempt();
  f.setTime("2026-10-15T12:59:59.000Z");
  await assert.rejects(f.create().finishAttempt("authenticated"), /login_attempt_clock/);
  await assert.rejects(f.create().finishAttempt("password rejected"), /invalid_login_outcome/);
  assert.equal(f.current().state, "pending");
});

test("corrupt or expanded records fail closed", () => {
  for (const value of [
    null,
    [],
    {},
    { schemaVersion: 1, state: "authenticated", observedAt: "invalid" },
    { schemaVersion: 1, state: "success", observedAt: "2026-10-15T13:00:00.000Z" },
    {
      schemaVersion: 1,
      state: "authenticated",
      observedAt: "2026-10-15T13:00:00.000Z",
      username: "not allowed",
    },
  ])
    assert.throws(() => validateLoginAttempt(value), /invalid_login_attempt/);
});
