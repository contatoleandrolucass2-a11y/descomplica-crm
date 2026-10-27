import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// A release must include the actual published commit, even after an isolated deployment.
export async function verifyCandidateAncestry(repository, publishedSha, targetSha) {
  for (const sha of [publishedSha, targetSha]) {
    if (typeof sha !== "string" || !/^[0-9a-f]{40}$/u.test(sha)) {
      throw new Error("Release ancestry requires exact commit SHAs.");
    }
  }
  try {
    await exec("git", ["merge-base", "--is-ancestor", publishedSha, targetSha], {
      cwd: repository,
      timeout: 10_000,
      maxBuffer: 4096,
    });
  } catch {
    throw new Error(
      "Candidate does not include the published commit; reconcile production before release.",
    );
  }
}
