import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const routinePreviewOrigin = "http://127.0.0.1:41739";
const weekdays = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
const activityKey = (activity) =>
  JSON.stringify([activity.role_key, activity.row_index, activity.day, activity.activity_text]);

// All state is synthetic and per run. No cookie, token, database or HTTP server is used.
export function createRoutineCompletionsFixture({ saved = true, rowCount = 26 } = {}) {
  const rows = Array.from({ length: rowCount }, (_, index) =>
    Object.fromEntries(
      weekdays.map((day) => [day, day === "Domingo" ? "" : `Atividade QA ${index + 1}: ${day}`]),
    ),
  );
  rows[1]["Terça-feira"] = "";
  const record = {
    role_key: "regional-house",
    rows,
    revision: 1,
    updated_at: "2026-10-12T15:00:00Z",
  };
  const fixture = {
    records: saved ? { "regional-house": record } : {},
    week_start: "2026-10-12",
    resets_at: "2026-10-19T03:00:00Z",
    server_now: "2026-10-12T15:00:00Z",
    users: new Map(),
    requests: [],
    unexpected: [],
    failGet: false,
    failPut: false,
    invalidGet: false,
    invalidPut: false,
    conflictPut: false,
    holdPut: null,
    snapshot(user) {
      return {
        week_start: fixture.week_start,
        resets_at: fixture.resets_at,
        server_now: fixture.server_now,
        completions: [...(fixture.users.get(user)?.get(fixture.week_start)?.values() ?? [])],
      };
    },
    rollover() {
      fixture.week_start = "2026-10-19";
      fixture.server_now = "2026-10-19T03:00:00Z";
      fixture.resets_at = "2026-10-26T03:00:00Z";
    },
  };
  return fixture;
}

export async function buildRoutineCompletionsPreview() {
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const root = path.resolve(".");
  const entry = path.resolve("tests/routine-completions-browser-memory.tsx").replaceAll("\\", "/");
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": root } },
    oxc: { jsx: { runtime: "automatic", development: false } },
    plugins: [
      {
        name: "routine-completions-synthetic-preview",
        resolveId(id) {
          if (id.endsWith("routine-completions-browser-memory.tsx")) return entry;
        },
        load(id) {
          if (id === entry)
            return `
          import { createElement } from "react";
          import { createRoot } from "react-dom/client";
          import "@/app/globals.css";
          import { RoutineSettings } from "@/app/(protected)/app/gestao/rotina/RoutineSettings";
          createRoot(document.getElementById("root")).render(createElement(RoutineSettings));
        `;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: true,
      lib: { entry, name: "RoutineCompletionsQa", formats: ["iife"] },
    },
  });
  const files = (Array.isArray(built) ? built : [built]).flatMap((output) => output.output);
  const script = files
    .filter((file) => file.type === "chunk")
    .map((file) => file.code)
    .join("\n");
  const css = files
    .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
    .map((file) => String(file.source))
    .join("\n");
  assert.ok(script.length && css.length, "Preview must render the real component and styles");
  return {
    script,
    css,
    html: `<!doctype html><html lang="pt-BR" data-theme="light"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Conclusoes individuais QA</title><link rel="stylesheet" href="/fixture.css">
    <style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}
    [data-protected-topbar]{position:sticky;top:0;height:58px;z-index:100;background:#fff;color:#111}</style>
    </head><body><nav data-protected-topbar aria-label="Menu sintético">Menu QA</nav>
    <div id="root"></div><script src="/fixture.js"></script></body></html>`,
  };
}

export async function openRoutineCompletionsPreview(
  browser,
  bundle,
  fixture,
  {
    user = "qa.reader@local.invalid",
    canEdit = false,
    clock = "2026-10-12T15:00:00Z",
    width = 1440,
  } = {},
) {
  assert.match(user, /^qa\.[a-z-]+@local\.invalid$/);
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    timezoneId: "America/Sao_Paulo",
    serviceWorkers: "block",
  });
  try {
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const respond = (json, status = 200) =>
        route.fulfill({ status, json, headers: { "cache-control": "no-store" } });
      if (url.origin !== routinePreviewOrigin) {
        fixture.unexpected.push("external request blocked");
        return route.abort("blockedbyclient");
      }
      if (url.pathname === "/api/routines/completions") {
        const body = method === "PUT" ? request.postDataJSON() : undefined;
        fixture.requests.push({ user, method, endpoint: "completions", body });
        if (method === "GET") {
          if (fixture.failGet) return respond({ error: "synthetic unavailable" }, 503);
          return respond(fixture.invalidGet ? { completions: [] } : fixture.snapshot(user));
        }
        if (method !== "PUT") return respond({ error: "method" }, 405);
        if (fixture.holdPut) await fixture.holdPut;
        if (fixture.failPut) return respond({ error: "synthetic unavailable" }, 503);
        const { completed, expected_week_start, ...activity } = body;
        const saved = fixture.records[activity.role_key];
        if (
          fixture.conflictPut ||
          expected_week_start !== fixture.week_start ||
          !saved ||
          saved.rows[activity.row_index]?.[activity.day] !== activity.activity_text
        ) {
          return respond({ error: "synthetic conflict" }, 409);
        }
        assert.deepEqual(Object.keys(body).sort(), [
          "activity_text",
          "completed",
          "day",
          "expected_week_start",
          "role_key",
          "row_index",
        ]);
        assert.equal(typeof completed, "boolean");
        if (fixture.invalidPut) return respond({ completions: [] });
        if (!fixture.users.has(user)) fixture.users.set(user, new Map());
        const weeks = fixture.users.get(user);
        if (!weeks.has(fixture.week_start)) weeks.set(fixture.week_start, new Map());
        const entries = weeks.get(fixture.week_start);
        if (completed) entries.set(activityKey(activity), activity);
        else entries.delete(activityKey(activity));
        return respond(fixture.snapshot(user));
      }
      if (url.pathname === "/api/routines") {
        fixture.requests.push({ user, method, endpoint: "routines" });
        if (method === "GET")
          return respond({ can_edit: canEdit, routines: Object.values(fixture.records) });
        if (method !== "PUT") return respond({ error: "method" }, 405);
        if (!canEdit) return respond({ error: "synthetic forbidden" }, 403);
        const { role_key, rows, expected_revision } = request.postDataJSON();
        if ((fixture.records[role_key]?.revision ?? 0) !== expected_revision)
          return respond({ error: "synthetic conflict" }, 409);
        fixture.records[role_key] = {
          role_key,
          rows,
          revision: expected_revision + 1,
          updated_at: fixture.server_now,
        };
        return respond(fixture.records[role_key]);
      }
      const asset = {
        "/app/gestao/rotina": ["text/html", bundle.html],
        "/fixture.js": ["application/javascript", bundle.script],
        "/fixture.css": ["text/css", bundle.css],
      }[url.pathname];
      if (asset && method === "GET")
        return route.fulfill({ contentType: asset[0], body: asset[1] });
      fixture.unexpected.push(`${method} ${url.pathname}`);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date(clock) });
    await page.goto(`${routinePreviewOrigin}/app/gestao/rotina`);
    return page;
  } catch (error) {
    await context.close();
    throw error;
  }
}
