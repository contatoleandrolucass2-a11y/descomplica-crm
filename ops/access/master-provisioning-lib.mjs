const sha256Pattern = /^[0-9a-f]{64}$/u;
const changeRefPattern = /^master-(homologation|production)-\d{4}-\d{2}-\d{2}-\d{2}$/u;
const legalVersionPattern = /^(terms|privacy)-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/u;

function fail(message) {
  throw new Error(message);
}

export function validateMasterProvisioningManifest(rawManifest) {
  if (
    !rawManifest ||
    rawManifest.schemaVersion !== 1 ||
    !Array.isArray(rawManifest.requests) ||
    rawManifest.requests.length === 0
  ) {
    fail("Master provisioning manifest is invalid.");
  }

  const requests = rawManifest.requests.map((request) => {
    if (
      !request ||
      !changeRefPattern.test(request.changeRef ?? "") ||
      !new Set(["homologation", "production"]).has(request.environment) ||
      !sha256Pattern.test(request.targetEmailSha256 ?? "") ||
      !legalVersionPattern.test(request.termsVersion ?? "") ||
      !legalVersionPattern.test(request.privacyVersion ?? "") ||
      !request.termsVersion.startsWith("terms-") ||
      !request.privacyVersion.startsWith("privacy-") ||
      request.status !== "authorized" ||
      Object.keys(request).sort().join(",") !==
        [
          "changeRef",
          "environment",
          "privacyVersion",
          "status",
          "targetEmailSha256",
          "termsVersion",
        ]
          .sort()
          .join(",")
    ) {
      fail("Master provisioning request is invalid.");
    }

    return Object.freeze({ ...request });
  });

  if (
    new Set(requests.map(({ changeRef }) => changeRef)).size !== requests.length ||
    new Set(
      requests.map(({ environment, targetEmailSha256 }) => `${environment}:${targetEmailSha256}`),
    ).size !== requests.length
  ) {
    fail("Master provisioning requests must be unique.");
  }

  return Object.freeze({ schemaVersion: 1, requests: Object.freeze(requests) });
}

export function selectMasterProvisioningRequest(manifest, changeRef, environment) {
  const request = manifest.requests.find((candidate) => candidate.changeRef === changeRef);
  if (!request || request.environment !== environment) {
    fail("Master provisioning request does not match the selected environment.");
  }
  return request;
}

export function parseMasterProvisioningArguments(arguments_) {
  const [mode, ...rest] = arguments_;
  if (!new Set(["preflight", "apply"]).has(mode)) {
    fail("Use preflight or apply.");
  }

  const values = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (
      !value ||
      !new Set([
        "--change-ref",
        "--database-url-file",
        "--environment",
        "--expected-sha",
        "--confirm",
      ]).has(flag) ||
      values.has(flag)
    ) {
      fail("Master provisioning arguments are invalid.");
    }
    values.set(flag, value);
  }

  const result = {
    mode,
    changeRef: values.get("--change-ref"),
    databaseUrlFile: values.get("--database-url-file"),
    environment: values.get("--environment"),
    expectedSha: values.get("--expected-sha"),
    confirmation: values.get("--confirm") ?? null,
  };

  if (
    !changeRefPattern.test(result.changeRef ?? "") ||
    !result.databaseUrlFile?.startsWith("/") ||
    !new Set(["homologation", "production"]).has(result.environment) ||
    !/^[0-9a-f]{40}$/u.test(result.expectedSha ?? "")
  ) {
    fail("Master provisioning arguments are invalid.");
  }

  const expectedConfirmation = `promote:${result.changeRef}:${result.expectedSha}`;
  if (mode === "apply" && result.confirmation !== expectedConfirmation) {
    fail("Apply confirmation does not match the source-controlled request and revision.");
  }
  if (mode === "preflight" && result.confirmation !== null) {
    fail("Preflight does not accept --confirm.");
  }

  return Object.freeze(result);
}
