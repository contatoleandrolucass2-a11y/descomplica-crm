import { lstat } from "node:fs/promises";
import { privateJsonStore } from "../../scripts/release/private-json-store.mjs";
import { withFileLock } from "../../scripts/release/production-release-lock.mjs";

const HOME = "/var/lib/descomplica-qlik";
const FILE = `${HOME}/login-attempt.json`;
const LOCK = `${HOME}/.login-attempt.lock`;

export function validateLoginAttempt(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 3 ||
    !["schemaVersion", "state", "observedAt"].every((key) => Object.hasOwn(value, key)) ||
    value.schemaVersion !== 1 ||
    !["pending", "attention", "authenticated"].includes(value.state) ||
    typeof value.observedAt !== "string" ||
    !Number.isFinite(Date.parse(value.observedAt)) ||
    new Date(value.observedAt).toISOString() !== value.observedAt
  )
    throw new Error("invalid_login_attempt");
  return value;
}

export function createLoginAttemptStore({ store, locked, now = () => new Date() }) {
  async function read() {
    try {
      return validateLoginAttempt(await store.read());
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new Error("login_attempt_unavailable");
    }
  }
  function next(state, previous) {
    const observedAt = now().toISOString();
    if (previous && observedAt < previous.observedAt) throw new Error("login_attempt_clock");
    return { schemaVersion: 1, state, observedAt };
  }
  return {
    async canAttempt() {
      const current = await read();
      return current === null || current.state === "authenticated";
    },
    async claimAttempt() {
      return locked(async () => {
        const current = await read();
        if (current && current.state !== "authenticated") return false;
        await store.compareAndWrite(current, next("pending", current));
        return true;
      });
    },
    async finishAttempt(state) {
      if (!["authenticated", "attention"].includes(state)) throw new Error("invalid_login_outcome");
      await locked(async () => {
        const current = await read();
        await store.compareAndWrite(current, next(state, current));
      });
    },
  };
}

export function loginAttemptStore() {
  const uid = process.getuid?.();
  if (process.platform !== "linux" || !Number.isInteger(uid) || uid <= 0)
    throw new Error("dedicated_login_environment_required");
  const store = privateJsonStore(FILE, validateLoginAttempt, uid);
  async function privateHome() {
    const info = await lstat(HOME);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== uid ||
      (info.mode & 0o777) !== 0o700
    )
      throw new Error("private_login_home_required");
  }
  const guarded = {
    async read() {
      await privateHome();
      return store.read();
    },
    async compareAndWrite(previous, next) {
      await privateHome();
      return store.compareAndWrite(previous, next);
    },
  };
  return createLoginAttemptStore({
    store: guarded,
    locked: async (action) => {
      await privateHome();
      return withFileLock(LOCK, action, uid);
    },
  });
}
