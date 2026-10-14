import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";
import path from "node:path";

// Fixed diagnostics only: browser/QIX failures and cycle validation outcomes.
const FAILURE_CODES = new Set([
  "session_already_used",
  "ranking_configuration",
  "unexpected_origin",
  "access_denied",
  "source_unavailable",
  "csrf_unavailable",
  "collection_unavailable",
  "engine_unavailable",
  "already_running",
  "identity_reused",
  "browser_ranking_unavailable",
  "page_disposal_unconfirmed",
  "transport_timeout",
  "cancelled",
  "invalid_source",
  "definition_limit",
  "invalid_sdk",
  "calculation_failed",
  "unsupported_group",
  "limited_cube",
  "invalid_number",
  "unsafe_cents",
  "invalid_count",
  "invalid_dimension",
  "totals_mismatch",
  "aggregate_limit",
  "invalid_identity",
  "reload_unavailable",
  "object_mismatch",
  "state_mismatch",
  "definition_changed",
  "mapping_invalid",
  "master_pin_mismatch",
  "master_changed",
  "measure_unresolved",
  "non_additive_measure",
  "coverage_limit",
  "incomplete_page",
  "reduced_page",
  "selection_changed",
  "ambiguous_selection",
  "locked_or_excluded_selection",
  "cube_shape",
  "totals_missing",
  "cube_changed",
  "selection_unproven",
  "selection_residual",
  "selection_failed",
  "month_unavailable",
  "duplicate_native_dimension",
  "duplicate_identity",
  "dimension_mismatch",
  "reload_changed",
  "identity_name_changed",
  "annual_mismatch",
  "collection_failed",
  "cleanup_failed",
  "cycle_configuration",
  "cycle_identity",
  "cycle_clock",
  "collection_scope",
  "collection_changed",
  "invalid_observation",
  "staging_unavailable",
  "publication_unavailable",
  "cycle_unavailable",
]);

export function isRankingFailureCode(code) {
  return typeof code === "string" && FAILURE_CODES.has(code);
}

export function rankingCycleArtifact(result, now = new Date()) {
  if (!result || !["running", "succeeded", "reauth_required", "unavailable"].includes(result.state))
    throw new Error("ranking_artifact_state");
  const projected = { state: result.state };
  if (["unavailable", "reauth_required"].includes(result.state)) {
    const code = result.code ?? result.reason;
    if (isRankingFailureCode(code)) projected.code = code;
  }
  if (result.state === "succeeded") {
    for (const key of ["batchId", "requestId"]) {
      if (
        typeof result[key] !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result[key])
      )
        throw new Error("ranking_artifact_receipt");
      projected[key] = result[key];
    }
    if (
      typeof result.contentSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(result.contentSha256) ||
      typeof result.completedAt !== "string" ||
      new Date(result.completedAt).toISOString() !== result.completedAt ||
      Date.parse(result.completedAt) > now.getTime()
    )
      throw new Error("ranking_artifact_receipt");
    projected.contentSha256 = result.contentSha256;
    projected.completedAt = result.completedAt;
  }
  return {
    schemaVersion: 1,
    kind: "qlik_ranking_cycle",
    observedAt: now.toISOString(),
    rankingConnected: result.state === "succeeded",
    result: projected,
  };
}

export async function writeRankingArtifact(
  result,
  { directory = "/run/descomplica-qlik", now = () => new Date() } = {},
) {
  const data = JSON.stringify(rankingCycleArtifact(result, now()));
  if (!path.isAbsolute(directory) || process.platform !== "linux" || !process.getuid?.())
    throw new Error("private_ranking_environment_required");
  const uid = process.getuid();
  const parent = await lstat(directory);
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== uid ||
    (parent.mode & 0o777) !== 0o700
  )
    throw new Error("private_ranking_directory_required");
  const target = path.join(directory, "ranking-status.json");
  try {
    const old = await lstat(target);
    if (
      !old.isFile() ||
      old.isSymbolicLink() ||
      old.uid !== uid ||
      old.nlink !== 1 ||
      (old.mode & 0o777) !== 0o600
    )
      throw new Error("private_ranking_artifact_required");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = path.join(directory, `.ranking-status-${randomUUID()}.tmp`);
  const file = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  let published = false;
  try {
    await file.writeFile(data);
    await file.sync();
    await file.close();
    await rename(temporary, target);
    published = true;
    const dir = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    await file.close().catch(() => {});
    if (!published) await unlink(temporary).catch(() => {});
  }
}
