import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isSalesforceWorkspaceUrl,
  refreshSalesforceSession,
  safeCdpEndpoint,
} from "./browser-session.mjs";

test("accepts only loopback CDP endpoints without embedded credentials", () => {
  assert.equal(safeCdpEndpoint(), "http://127.0.0.1:9222/");
  assert.equal(
    safeCdpEndpoint("ws://localhost:9222/devtools/browser/id"),
    "ws://localhost:9222/devtools/browser/id",
  );
  assert.equal(safeCdpEndpoint("http://[::1]:9222"), "http://[::1]:9222/");
  assert.throws(() => safeCdpEndpoint("http://192.0.2.10:9222"), /must use loopback/);
  assert.throws(() => safeCdpEndpoint("http://user:secret@127.0.0.1:9222"), /must use loopback/);
});

test("recognizes only the dedicated Salesforce workspace origins", () => {
  assert.equal(isSalesforceWorkspaceUrl("https://direcional.my.salesforce.com/lightning"), true);
  assert.equal(isSalesforceWorkspaceUrl("https://direcional.lightning.force.com/lightning"), true);
  assert.equal(isSalesforceWorkspaceUrl("https://login.salesforce.com/"), false);
  assert.equal(isSalesforceWorkspaceUrl("https://example.com/"), false);
});

test("reloads the workspace and returns only the target-origin session", async () => {
  let reloaded = false;
  const page = {
    url: () => "https://direcional.lightning.force.com/lightning/page/home",
    reload: async (options) => {
      assert.deepEqual(options, { waitUntil: "domcontentloaded", timeout: 45_000 });
      reloaded = true;
    },
  };
  const context = {
    pages: () => [{ url: () => "https://example.com/", reload: async () => {} }, page],
    cookies: async (origin) => {
      assert.equal(origin, "https://direcional.my.salesforce.com");
      return [{ name: "sid", value: "synthetic-session", domain: ".salesforce.com" }];
    },
  };

  assert.equal(await refreshSalesforceSession(context), "synthetic-session");
  assert.equal(reloaded, true);
});

test("fails closed when the refreshed page requests login or loses the session", async () => {
  let currentUrl = "https://direcional.my.salesforce.com/lightning";
  const redirectedContext = {
    pages: () => [
      {
        url: () => currentUrl,
        reload: async () => {
          currentUrl = "https://login.salesforce.com/";
        },
      },
    ],
    cookies: async () => [],
  };
  await assert.rejects(refreshSalesforceSession(redirectedContext), /manual login required/);

  const missingCookieContext = {
    pages: () => [
      {
        url: () => "https://direcional.my.salesforce.com/lightning",
        reload: async () => {},
      },
    ],
    cookies: async () => [],
  };
  await assert.rejects(refreshSalesforceSession(missingCookieContext), /manual login required/);
});
