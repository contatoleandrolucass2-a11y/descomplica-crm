import { NextRequest, NextResponse } from "next/server";

import { getMfaAssurance } from "@/lib/auth/mfa/assurance";
import { factorIdSchema, mfaVerificationFlowSchema, totpCodeSchema } from "@/lib/auth/mfa/schemas";
import { createRouteClient } from "@/lib/auth/supabase/route";
import { noStoreHeaders } from "@/lib/security/api";
import { getApplicationOrigin } from "@/lib/security/origin";

const RESPONSE_HEADERS = noStoreHeaders({ "Referrer-Policy": "no-referrer" });
const MAX_BODY_BYTES = 512;
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

function emptyResponse(status: number) {
  return new NextResponse(null, { status, headers: RESPONSE_HEADERS });
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const applicationOrigin = getApplicationOrigin();
  let requestOrigin: string | null = null;
  try {
    const originHeader = request.headers.get("origin");
    requestOrigin = originHeader ? new URL(originHeader).origin : null;
  } catch {
    requestOrigin = null;
  }
  if (!applicationOrigin || requestOrigin !== applicationOrigin.origin) return emptyResponse(403);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const contentLengthHeader = request.headers.get("content-length");
  const declaredLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (
    contentType !== FORM_CONTENT_TYPE ||
    (declaredLength !== null &&
      (!Number.isSafeInteger(declaredLength) ||
        declaredLength < 0 ||
        declaredLength > MAX_BODY_BYTES))
  ) {
    return emptyResponse(400);
  }

  const encodedBody = await readBoundedBody(request);
  if (encodedBody === null) return emptyResponse(400);

  const formData = new URLSearchParams(encodedBody);
  const expectedKeys = new Set(["flow", "factorId", "code"]);
  if (
    [...formData.keys()].some((key) => !expectedKeys.has(key)) ||
    [...expectedKeys].some((key) => formData.getAll(key).length !== 1)
  ) {
    return emptyResponse(400);
  }

  const flow = mfaVerificationFlowSchema.safeParse(formData.get("flow"));
  const factorId = factorIdSchema.safeParse(formData.get("factorId"));
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!flow.success || !factorId.success || !code.success) return emptyResponse(400);

  let routeClient: ReturnType<typeof createRouteClient>;
  try {
    routeClient = createRouteClient(request);
  } catch {
    return emptyResponse(503);
  }
  const { applyCookies, supabase } = routeClient;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) return applyCookies(emptyResponse(503));
  if (!user) return applyCookies(emptyResponse(401));

  const assurance = await getMfaAssurance(supabase);
  const assuranceAllowed =
    flow.data === "enrollment"
      ? assurance.status === "optional" || assurance.status === "verified"
      : assurance.status === "required";
  if (!assuranceAllowed) return applyCookies(emptyResponse(403));

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors) return applyCookies(emptyResponse(503));

  const factor =
    flow.data === "enrollment"
      ? factors.all.find(
          (candidate) =>
            candidate.id === factorId.data &&
            candidate.factor_type === "totp" &&
            candidate.status === "unverified",
        )
      : factors.totp.find((candidate) => candidate.id === factorId.data);
  if (!factor) return applyCookies(emptyResponse(403));

  const verification = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.data,
  });
  if (verification.error || !verification.data) return applyCookies(emptyResponse(400));

  // Verify the server-issued AAL2 token directly. Passing the explicit token
  // avoids asking the same client to reacquire its session lock while the MFA
  // auth-state callback is persisting the replacement cookies.
  const claimsResult = await supabase.auth.getClaims(verification.data.access_token);
  const claims = claimsResult.data?.claims;
  if (
    claimsResult.error ||
    !claims ||
    claims.aal !== "aal2" ||
    claims.sub !== user.id ||
    verification.data.user.id !== user.id
  ) {
    // challengeAndVerify already activated the factor. Discard the buffered
    // AAL2 cookies and fail closed; the prior AAL1 session is then forced
    // through the normal /mfa challenge on its next request.
    return emptyResponse(503);
  }

  return applyCookies(emptyResponse(204));
}
