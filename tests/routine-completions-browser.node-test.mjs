import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { chromium } from "@playwright/test";
import {
  buildRoutineCompletionsPreview,
  checkRoutineCompletions,
  createRoutineCompletionsFixture,
  openRoutineCompletionsPreview,
} from "../scripts/qa/routine-settings.mjs";
import { routinePreviewOrigin } from "../scripts/qa/routine-completions-preview.mjs";

// Contract tests for the CI checker itself. UI behavior tests belong to routine-settings.test.tsx.
describe(
  "Authenticated completion QA checker against synthetic transport",
  { timeout: 60_000 },
  () => {
    let browser;
    let bundle;
    const environmentKeys = [
      "QA_AUTH_FIXTURE_VERIFICATION",
      "QA_AUTH_EMAIL",
      "QA_AUTH_SUPABASE_URL",
    ];
    const previousEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
    before(async () => {
      process.env.QA_AUTH_FIXTURE_VERIFICATION = "rls-marker-v1";
      process.env.QA_AUTH_EMAIL = "qa.editor@local.invalid";
      process.env.QA_AUTH_SUPABASE_URL = "http://127.0.0.1:54321";
      bundle = await buildRoutineCompletionsPreview();
      browser = await chromium.launch({ headless: true });
    });
    afterEach(async () => {
      for (const context of browser?.contexts() ?? []) await context.close();
    });
    after(async () => {
      await browser?.close();
      for (const [key, value] of previousEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("checks both users, Semana/Hoje, console and axe, then restores each user's initial mark", async () => {
      const fixture = createRoutineCompletionsFixture();
      const activity = {
        role_key: "regional-house",
        row_index: 0,
        day: "Segunda-feira",
        activity_text: fixture.records["regional-house"].rows[0]["Segunda-feira"],
      };
      const identity = JSON.stringify(Object.values(activity));
      fixture.users.set(
        "qa.reader@local.invalid",
        new Map([[fixture.week_start, new Map([[identity, activity]])]]),
      );
      const initialReader = structuredClone(fixture.snapshot("qa.reader@local.invalid"));
      const page = await openRoutineCompletionsPreview(browser, bundle, fixture, {
        user: "qa.editor@local.invalid",
        canEdit: true,
      });
      const readerPage = await openRoutineCompletionsPreview(browser, bundle, fixture);
      const result = await checkRoutineCompletions(
        page,
        routinePreviewOrigin,
        "test-results/routine-completions-preview",
        { readerPage },
      );
      assert.equal(result.passed, true);
      assert.equal(result.distinctReaderUser, true);
      assert.equal(result.checks.length, 4);
      assert.equal(result.consoleErrors, 0);
      assert.deepEqual(fixture.snapshot("qa.editor@local.invalid").completions, []);
      assert.deepEqual(fixture.snapshot("qa.reader@local.invalid"), initialReader);
      assert.deepEqual(fixture.unexpected, []);
    });

    it("refuses a cloned editor or missing reader before completion writes", async () => {
      const fixture = createRoutineCompletionsFixture();
      const options = { user: "qa.editor@local.invalid", canEdit: true };
      const page = await openRoutineCompletionsPreview(browser, bundle, fixture, options);
      await assert.rejects(
        checkRoutineCompletions(
          page,
          routinePreviewOrigin,
          "test-results/routine-completions-preview",
        ),
        /independently authenticated readerPage/,
      );
      const readerPage = await openRoutineCompletionsPreview(browser, bundle, fixture, options);
      await assert.rejects(
        checkRoutineCompletions(
          page,
          routinePreviewOrigin,
          "test-results/routine-completions-preview",
          { readerPage },
        ),
        /not cloned editor credentials/,
      );
      assert.equal(fixture.requests.filter(({ method }) => method === "PUT").length, 0);
    });
  },
);
