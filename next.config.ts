/**
 * Next.js configuration — descomplica-platform, Milestone 1 baseline.
 *
 * Mantido mínimo intencionalmente. Headers de segurança (CSP, X-Frame-Options,
 * Referrer-Policy, etc.) são adicionados no Milestone 3 via middleware.
 * Referência: AUTH_SECURITY.md > HTTP Security Headers
 */
import type { NextConfig } from "next";

const deploymentId = process.env.DEPLOYMENT_VERSION;

const nextConfig: NextConfig = {
  output: "standalone",
  ...(deploymentId ? { deploymentId } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
