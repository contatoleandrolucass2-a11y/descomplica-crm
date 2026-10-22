import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseReleaseArguments } from "./production-release.mjs";
import {
  assertEnvironmentChangeContents,
  assertMetaAdsContainerDigests,
  environmentSha256,
  metaAdsContainerDigestScript,
  metaAdsEnvironmentValues,
  selectEnvironmentChange,
  transformMetaAdsReleaseEnvironment,
  assertMetaAdsApiContainerDigests,
  metaAdsApiContainerDigestScript,
  metaAdsApiEnvironmentValues,
  transformMetaAdsApiReleaseEnvironment,
} from "./salesforce-release-environment.mjs";

const oldSha = "a".repeat(40);
const newSha = "b".repeat(40);
const secrets = {
  META_ADS_STATUS_SECRET: "a1".repeat(48),
  META_ADS_CONSOLE_PASSWORD: "aB+/19zZ",
};
const before = `# Preserve every unrelated assignment byte\nIMAGE_TAG=${oldSha}\nSUPABASE_SECRET_KEY=sb_secret_${"fixture".repeat(5)}\nSALESFORCE_INGEST_SECRET=${"s".repeat(48)}\nSALESFORCE_INGEST_ENABLED=true\nSALESFORCE_REFRESH_ENABLED=false\nSALESFORCE_STATUS_SECRET=${"t".repeat(48)}\nSALESFORCE_CONSOLE_PASSWORD=otherVnc\nQLIK_RANKING_V2_ENABLED=true\nQLIK_RANKING_V2_HMAC_SECRET=${"q".repeat(48)}\nOTHER="preserved $VALUE"\n`;
const after = transformMetaAdsReleaseEnvironment(before, oldSha, newSha, secrets);
const change = {
  backupId: "bbbbbbbb-2222-4333-8444-555555555555",
  beforeSha256: environmentSha256(before),
  afterSha256: environmentSha256(after),
};
const backup = { schemaVersion: 2, kind: "meta-ads-session", ...change, before, after };
const expectedMeta = `META_ADS_STATUS_ENABLED=true\nMETA_ADS_STATUS_SECRET=${secrets.META_ADS_STATUS_SECRET}\nMETA_ADS_CONSOLE_ENABLED=true\nMETA_ADS_CONSOLE_PASSWORD=${secrets.META_ADS_CONSOLE_PASSWORD}\n`;

test("Meta Ads changes only the four integration settings and the exact release image", () => {
  assert.equal(after, before.replace(oldSha, newSha) + expectedMeta);
  assert.deepEqual(metaAdsEnvironmentValues(before), {
    META_ADS_STATUS_ENABLED: "false",
    META_ADS_STATUS_SECRET: "",
    META_ADS_CONSOLE_ENABLED: "false",
    META_ADS_CONSOLE_PASSWORD: "",
  });
  for (const newline of ["\n", "\r\n"]) {
    const source = (
      before +
      "export META_ADS_STATUS_ENABLED = 'false' # prior\nMETA_ADS_STATUS_SECRET=\nMETA_ADS_CONSOLE_ENABLED=\"\"\nMETA_ADS_CONSOLE_PASSWORD=\n"
    ).replaceAll("\n", newline);
    assert.equal(
      transformMetaAdsReleaseEnvironment(source, oldSha, newSha, secrets),
      (before.replace(oldSha, newSha) + expectedMeta).replaceAll("\n", newline),
    );
  }
});

test("Meta Ads rejects unsafe secret syntax, invalid byte lengths and shared credentials", () => {
  for (const [key, invalid] of [
    ["META_ADS_STATUS_SECRET", "x".repeat(31)],
    ["META_ADS_STATUS_SECRET", "x".repeat(257)],
    ["META_ADS_STATUS_SECRET", secrets.META_ADS_STATUS_SECRET + "$"],
    ["META_ADS_STATUS_SECRET", secrets.META_ADS_STATUS_SECRET + "\n"],
    ["META_ADS_STATUS_SECRET", "é".repeat(48)],
    ["META_ADS_STATUS_SECRET", null],
    ["META_ADS_CONSOLE_PASSWORD", "abcdefg"],
    ["META_ADS_CONSOLE_PASSWORD", "abcdefghi"],
    ["META_ADS_CONSOLE_PASSWORD", "abc$defg"],
    ["META_ADS_CONSOLE_PASSWORD", "abc defg"],
    ["META_ADS_CONSOLE_PASSWORD", "abc'defg"],
    ["META_ADS_CONSOLE_PASSWORD", "abc\ndefg"],
    ["META_ADS_CONSOLE_PASSWORD", "ébcdefgh"],
  ]) {
    assert.throws(
      () =>
        transformMetaAdsReleaseEnvironment(before, oldSha, newSha, { ...secrets, [key]: invalid }),
      /secrets are invalid/u,
    );
  }
  for (const length of [32, 256])
    assert.doesNotThrow(() =>
      transformMetaAdsReleaseEnvironment(before, oldSha, newSha, {
        ...secrets,
        META_ADS_STATUS_SECRET: "x".repeat(length),
      }),
    );
  for (const key of [
    "SUPABASE_SECRET_KEY",
    "SALESFORCE_INGEST_SECRET",
    "SALESFORCE_STATUS_SECRET",
    "SALESFORCE_REFRESH_SECRET",
    "SALESFORCE_CONSOLE_PASSWORD",
    "QLIK_RANKING_V2_HMAC_SECRET",
    "QLIK_RELAY_HMAC_SECRET",
  ]) {
    const source =
      before.replace(new RegExp(`^${key}=.*\\n`, "mu"), "") +
      `${key}=${secrets.META_ADS_STATUS_SECRET}\n`;
    assert.throws(
      () => transformMetaAdsReleaseEnvironment(source, oldSha, newSha, secrets),
      /separate/u,
    );
  }
  assert.throws(
    () =>
      transformMetaAdsReleaseEnvironment(before, oldSha, newSha, {
        ...secrets,
        META_ADS_CONSOLE_PASSWORD: "otherVnc",
      }),
    /separate/u,
  );
});

test("Meta Ads requires a new exact SHA, unique assignments and recoverable prior literals", () => {
  for (const [source, expected, target] of [
    [before, oldSha, oldSha],
    [before, newSha, oldSha],
    [before, oldSha, "latest"],
    [before + "META_ADS_STATUS_ENABLED=false\nMETA_ADS_STATUS_ENABLED=true\n", oldSha, newSha],
    [before + "META_ADS_CONSOLE_PASSWORD=$PASSWORD\n", oldSha, newSha],
    [before + "OTHER=duplicate\n", oldSha, newSha],
  ])
    assert.throws(() => transformMetaAdsReleaseEnvironment(source, expected, target, secrets));
});

test("Meta Ads backup restricts the transformation and restores exact bytes through full CAS", () => {
  assert.equal(
    selectEnvironmentChange(before, backup, change, {
      expectedCurrentSha: oldSha,
      targetSha: newSha,
    }),
    after,
  );
  for (const [contents, expectedCurrentSha] of [
    [before, oldSha],
    [after, newSha],
  ]) {
    assert.equal(
      selectEnvironmentChange(contents, backup, change, {
        expectedCurrentSha,
        targetSha: oldSha,
        restoreEnvironment: true,
      }),
      before,
    );
    assert.throws(
      () =>
        selectEnvironmentChange(contents + "EXTERNAL=changed\n", backup, change, {
          expectedCurrentSha,
          targetSha: oldSha,
          restoreEnvironment: true,
        }),
      /compare-and-swap/u,
    );
  }
  for (const invalid of [
    { ...backup, kind: "qlik-ranking-v2" },
    { ...backup, schemaVersion: 1 },
    { ...backup, after: after + "UNRELATED=true\n" },
    { ...backup, extra: true },
  ])
    assert.throws(() => assertEnvironmentChangeContents(after, invalid, change, false));
  const forgedAfter = after.replace(
    "SALESFORCE_INGEST_ENABLED=true",
    "SALESFORCE_INGEST_ENABLED=false",
  );
  const forgedChange = { ...change, afterSha256: environmentSha256(forgedAfter) };
  assert.throws(
    () =>
      assertEnvironmentChangeContents(
        forgedAfter,
        { ...backup, ...forgedChange, after: forgedAfter },
        forgedChange,
        false,
      ),
    /unrelated transformation/u,
  );
});

test("container verification hashes all four values without exposing secrets and matches Compose defaults", () => {
  const compose = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");
  for (const key of ["META_ADS_STATUS_ENABLED", "META_ADS_CONSOLE_ENABLED"])
    assert.ok(compose.includes(`${key}: \u0024{${key}:-false}`));
  for (const [contents, env] of [
    [before, {}],
    [after, metaAdsEnvironmentValues(after)],
  ]) {
    const output = execFileSync(process.execPath, ["--eval", metaAdsContainerDigestScript], {
      env,
      encoding: "utf8",
    });
    const hashes = JSON.parse(output);
    assertMetaAdsContainerDigests(contents, hashes);
    for (const value of Object.values(secrets)) assert.equal(output.includes(value), false);
    for (const key of Object.keys(hashes)) {
      assert.throws(
        () =>
          assertMetaAdsContainerDigests(contents, {
            ...hashes,
            [key]: environmentSha256("different"),
          }),
        /Effective Meta Ads/u,
      );
      assert.throws(
        () => assertMetaAdsContainerDigests(contents, { ...hashes, [key]: null }),
        /Effective Meta Ads/u,
      );
    }
    assert.throws(() =>
      assertMetaAdsContainerDigests(contents, { ...hashes, extra: "unexpected" }),
    );
  }
});

test("CLI accepts only explicit protected deploy activation, excludes mixed options and raw credentials", () => {
  const args = [
    "deploy",
    "--expected-deployment-id",
    change.backupId,
    "--expected-sha",
    oldSha,
    "--sha",
    newSha,
    "--image-id",
    `sha256:${"1".repeat(64)}`,
    "--ci-run-id",
    "123",
  ];
  assert.equal(
    parseReleaseArguments([...args, "--meta-ads", "enable"]).values["meta-ads"],
    "enable",
  );
  for (const invalid of ["true", "false", "disable", secrets.META_ADS_STATUS_SECRET])
    assert.throws(() => parseReleaseArguments([...args, "--meta-ads", invalid]));
  for (const flag of ["salesforce-ingestion", "qlik-ranking", "meta-ads", "meta-ads-api"])
    assert.throws(() =>
      parseReleaseArguments([...args, "--meta-ads", "enable", `--${flag}`, "enable"]),
    );
  for (const operation of [
    "status",
    "recover",
    "initialize",
    "qlik-status",
    "qlik-deploy",
    "qlik-recover",
  ])
    assert.throws(() => parseReleaseArguments([operation, "--meta-ads", "enable"]));
  assert.throws(() =>
    parseReleaseArguments([...args, "--meta-ads-status-secret", secrets.META_ADS_STATUS_SECRET]),
  );
});

test("Meta Ads API activation stores only the read-only credential and fixed account contract", () => {
  const token = `EAA${"a1B2".repeat(30)}`;
  const apiAfter = transformMetaAdsApiReleaseEnvironment(before, oldSha, newSha, token);
  assert.equal(
    apiAfter,
    before.replace(oldSha, newSha) +
      `META_ADS_API_ENABLED=true\nMETA_ADS_ACCESS_TOKEN=${token}\nMETA_ADS_ACCOUNT_ID=1080988750909489\nMETA_ADS_API_VERSION=v26.0\n`,
  );
  assert.deepEqual(metaAdsApiEnvironmentValues(before), {
    META_ADS_API_ENABLED: "false",
    META_ADS_ACCESS_TOKEN: "",
    META_ADS_ACCOUNT_ID: "",
    META_ADS_API_VERSION: "v26.0",
  });
  const disabledOutput = execFileSync(
    process.execPath,
    ["--eval", metaAdsApiContainerDigestScript],
    {
      env: metaAdsApiEnvironmentValues(before),
      encoding: "utf8",
    },
  );
  assertMetaAdsApiContainerDigests(before, JSON.parse(disabledOutput));
  for (const invalid of ["short", "x".repeat(4097), "x y".repeat(20), "x$y".repeat(20)])
    assert.throws(
      () => transformMetaAdsApiReleaseEnvironment(before, oldSha, newSha, invalid),
      /credential is invalid/u,
    );
  const apiChange = {
    backupId: "aaaaaaaa-2222-4333-8444-555555555555",
    beforeSha256: environmentSha256(before),
    afterSha256: environmentSha256(apiAfter),
  };
  const apiBackup = {
    schemaVersion: 2,
    kind: "meta-ads-api",
    ...apiChange,
    before,
    after: apiAfter,
  };
  assert.equal(
    selectEnvironmentChange(before, apiBackup, apiChange, {
      expectedCurrentSha: oldSha,
      targetSha: newSha,
    }),
    apiAfter,
  );
  const output = execFileSync(process.execPath, ["--eval", metaAdsApiContainerDigestScript], {
    env: metaAdsApiEnvironmentValues(apiAfter),
    encoding: "utf8",
  });
  assertMetaAdsApiContainerDigests(apiAfter, JSON.parse(output));
  assert.equal(output.includes(token), false);
});

test("CLI isolates official Meta Ads API activation from every other integration", () => {
  const args = [
    "deploy",
    "--expected-deployment-id",
    change.backupId,
    "--expected-sha",
    oldSha,
    "--sha",
    newSha,
    "--image-id",
    `sha256:${"1".repeat(64)}`,
    "--ci-run-id",
    "123",
  ];
  assert.equal(
    parseReleaseArguments([...args, "--meta-ads-api", "enable"]).values["meta-ads-api"],
    "enable",
  );
  for (const flag of ["salesforce-ingestion", "qlik-ranking", "meta-ads"])
    assert.throws(() =>
      parseReleaseArguments([...args, "--meta-ads-api", "enable", `--${flag}`, "enable"]),
    );
  for (const invalid of ["true", "false", "disable"])
    assert.throws(() => parseReleaseArguments([...args, "--meta-ads-api", invalid]));
});
