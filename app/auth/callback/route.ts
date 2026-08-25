import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { hasFreshRecoveryAuthenticationMethod } from "@/lib/auth/mfa/assurance";
import { isRecoveryTokenHash } from "@/lib/auth/recovery-token";
import {
  buildSessionPersistenceCookie,
  issueSessionPersistence,
} from "@/lib/auth/session-persistence";
import { createClient } from "@/lib/auth/supabase/server";
import { noStoreHeaders } from "@/lib/security/api";
import { getApplicationUrl } from "@/lib/security/origin";

function recoveryRedirect(path: "/redefinir-senha" | "/esqueci-senha?status=invalid") {
  const destination = getApplicationUrl(path);
  if (!destination) {
    return new Response(null, { status: 503, headers: noStoreHeaders() });
  }

  return NextResponse.redirect(destination, {
    headers: noStoreHeaders({ "Referrer-Policy": "no-referrer" }),
  });
}

export async function GET(request: Request) {
  if (!getApplicationUrl("/auth/callback")) {
    return new Response(null, { status: 503, headers: noStoreHeaders() });
  }

  const searchParams = new URL(request.url).searchParams;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Supabase Auth renders either the SHA-224 hash or its explicit `pkce_`
  // flow-prefixed form in `.TokenHash`.
  if (type !== "recovery" || !isRecoveryTokenHash(tokenHash)) {
    return recoveryRedirect("/esqueci-senha?status=invalid");
  }

  const supabase = await createClient({ persistence: { kind: "temporary" } });
  // The custom Supabase recovery template targets this no-log callback
  // directly. Verification is a POST with the token hash in its body, so the
  // Supabase gateway never receives a token-bearing query string.
  const { error: exchangeError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  // Invalid token hashes must not mutate a legitimate authenticated session
  // or its remember-browser marker. This also prevents logout-CSRF via a
  // syntactically valid but false callback URL.
  if (exchangeError) {
    return recoveryRedirect("/esqueci-senha?status=invalid");
  }

  // A successful recovery exchange always creates a temporary session. Clear
  // any previous remember-browser marker only after the token was verified.
  const marker = buildSessionPersistenceCookie(issueSessionPersistence(undefined));
  (await cookies()).set(marker.name, marker.value, marker.options);

  const { data, error } = await supabase.auth.getClaims();
  if (!error && hasFreshRecoveryAuthenticationMethod(data?.claims)) {
    return recoveryRedirect("/redefinir-senha");
  }

  await supabase.auth.signOut({ scope: "local" });
  return recoveryRedirect("/esqueci-senha?status=invalid");
}
