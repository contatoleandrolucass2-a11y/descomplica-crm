import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { request } from "@playwright/test";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { calculateWf13, wf13InputSchema } from "@/lib/crm/simulators/official/wf13";

// @ts-expect-error JavaScript QA harness consumed directly by the existing release gate.
import * as concurrentAssociativo from "../scripts/qa/concurrent-associativo.mjs";

const {
  assertCalculation,
  requestJson,
  runConcurrentAssociativo,
  simulatorEndpoint,
  syntheticProposal,
  selectConcurrentAccounts,
} = concurrentAssociativo;

function envelope(index: number) {
  const input = syntheticProposal(index);
  return {
    schemaVersion: 1,
    engineKey: "simulator.wf13",
    correlationId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    formulaVersion: "test-version",
    sourceSha256: "test-source",
    result: calculateWf13(wf13InputSchema.parse(input), { today: input.entryDate }),
  };
}

describe("Associativo concurrent assertions", () => {
  it("uses twelve valid, distinguishable synthetic proposals with the real calculator", () => {
    const fingerprints = new Set();
    for (let index = 0; index < 12; index += 1) {
      const response = envelope(index);
      expect(response.result.ok).toBe(true);
      expect(() => assertCalculation(response, syntheticProposal(index))).not.toThrow();
      fingerprints.add(JSON.stringify([response.result.financing, response.result.entryAmount]));
    }
    expect(fingerprints.size).toBe(12);
  });

  it("fails on crossed proposals, reused responses and serial/concurrent drift", () => {
    const reference = envelope(0);
    expect(() => assertCalculation(envelope(1), syntheticProposal(0))).toThrow(
      "proposal_response_mixed",
    );
    expect(() => assertCalculation(reference, syntheticProposal(0), reference)).toThrow(
      "reused_correlation",
    );
    const changed = {
      ...reference,
      correlationId: envelope(1).correlationId,
      result: { ...reference.result, deductions: -1 },
    };
    expect(() => assertCalculation(changed, syntheticProposal(0), reference)).toThrow(
      "serial_concurrent_result_mismatch",
    );
  });

  it("requires a successful business calculation in addition to HTTP success", () => {
    expect(() =>
      assertCalculation(
        { ...envelope(0), result: { ok: false, errors: [] } },
        syntheticProposal(0),
      ),
    ).toThrow("calculation_rejected");
  });

  it("blocks live upstream and nonlocal targets before issuing HTTP", async () => {
    const client = { fetch: vi.fn() };
    await expect(requestJson(client, "https://crm.example.com", simulatorEndpoint)).rejects.toThrow(
      "invalid_local_origin",
    );
    await expect(
      requestJson(client, "http://localhost:4173", "/api/inventory", { expectedStatus: 403 }),
    ).rejects.toThrow("inventory_isolation_required");
    expect(client.fetch).not.toHaveBeenCalled();
  });

  it("rejects redirects without following them, leaked denial bodies and HTTP 500", async () => {
    let status = 302;
    let body: object = {};
    let redirectVisits = 0;
    const server = createServer((incoming, response) => {
      if (incoming.url === "/escape") redirectVisits += 1;
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
        location: "/escape",
      });
      response.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No loopback port");
    const client = await request.newContext();
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      await expect(requestJson(client, origin, simulatorEndpoint)).rejects.toThrow(
        "http_status_302_expected_200",
      );
      expect(redirectVisits).toBe(0);
      status = 403;
      body = { error: "forbidden", proposal: "synthetic foreign proposal" };
      await expect(
        requestJson(client, origin, simulatorEndpoint, {
          expectedStatus: 403,
          expectedError: "forbidden",
        }),
      ).rejects.toThrow("denial_payload_leaked");
      body = { error: "forbidden" };
      await expect(
        requestJson(client, origin, simulatorEndpoint, {
          expectedStatus: 403,
          expectedError: "forbidden",
        }),
      ).resolves.toEqual(body);
      status = 500;
      await expect(requestJson(client, origin, simulatorEndpoint)).rejects.toThrow(
        "http_status_500_expected_200",
      );
    } finally {
      await client.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed before launching Chromium for real accounts", async () => {
    await expect(
      runConcurrentAssociativo({
        origin: "http://localhost:4173",
        accounts: [
          { role: "master", email: "someone@example.com", password: "not-a-synthetic-account" },
        ],
      }),
    ).rejects.toThrow("synthetic_accounts_required");
  });

  it("selects four distinct identities, including two independently provisioned masters", () => {
    const accounts = ["master", "broker", "pending", "master"].map((role, index) => ({
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      role,
      email: `qa.rls-${role}-abcdef${index}@local.invalid`,
      password: "synthetic-fixture-password-123",
    }));
    const selected = selectConcurrentAccounts(accounts);
    expect(selected).toEqual([accounts[0], accounts[3], accounts[1], accounts[2]]);
    expect(new Set(selected.map((account: { id: string }) => account.id)).size).toBe(4);
    expect(() => selectConcurrentAccounts(accounts.slice(0, 3))).toThrow(
      "synthetic_accounts_required",
    );
    expect(() => selectConcurrentAccounts([...accounts.slice(0, 3), accounts[0]])).toThrow(
      "distinct_qa_users_required",
    );
    expect(() =>
      selectConcurrentAccounts([
        ...accounts.slice(0, 3),
        { ...accounts[3], email: accounts[0]!.email },
      ]),
    ).toThrow("distinct_qa_users_required");
  });

  it("is included in the existing release gate before mutable browser scenarios", async () => {
    const harness = await readFile(
      new URL("../scripts/qa/local-rls-api.mjs", import.meta.url),
      "utf8",
    );
    const integration = harness.slice(harness.indexOf("    if (nextServer) {"));
    expect(integration).toContain("await runConcurrentAssociativo({");
    expect(integration.indexOf("await runConcurrentAssociativo({")).toBeLessThan(
      integration.indexOf("await runBrowserE2e("),
    );
    expect(integration).toContain("signal: concurrentQaCancellation.signal");
    expect(harness).toContain("concurrentQaCancellation.abort()");
    expect(integration).toContain('createEphemeralAccount(adminClient, "master", `${runId}01`)');
    expect(integration).toContain("concurrentAccounts.push(secondMaster)");
    expect(integration.indexOf("concurrentAccounts.push(secondMaster)")).toBeLessThan(
      integration.indexOf("public.bootstrap_master_user("),
    );
    expect(integration).toContain("verifyAccountThroughRest(local, secondMaster, fixtures)");
    const source = ts.createSourceFile(
      "local-rls-api.mjs",
      harness,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const cleanupArguments: string[][] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "removeEphemeralState") {
        cleanupArguments.push(node.arguments.map((argument) => argument.getText(source)));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(cleanupArguments).toEqual([
      ["local", "adminClient", "[...accounts, ...concurrentAccounts]", "fixtures"],
    ]);
    expect(integration).toContain(
      "await runBrowserE2e(nextServer.origin, local.mailpitUrl, accounts)",
    );
  });
});
