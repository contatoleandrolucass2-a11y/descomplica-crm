import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  devtoolsEnvironment,
  projectRoot,
  resolveRuntime,
  resolveServer,
  servers,
} from "./devtools.mjs";

// Reuse the protocol SDK already shipped by the pinned Next MCP; no new dependency.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next-devtools-mcp/package.json"));
const { Client } = await import(
  pathToFileURL(nextRequire.resolve("@modelcontextprotocol/sdk/client/index.js")).href
);
const { StdioClientTransport } = await import(
  pathToFileURL(nextRequire.resolve("@modelcontextprotocol/sdk/client/stdio.js")).href
);

export async function checkServer(name, { command = resolveRuntime() } = {}) {
  const server = resolveServer(name);
  const client = new Client({ name: "descomplica-local-devtools-check", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command,
    args: [path.join(projectRoot, "scripts/knowledge/devtools.mjs"), name],
    cwd: projectRoot,
    env: devtoolsEnvironment(),
    stderr: "pipe",
  });
  // Drain package diagnostics without storing or echoing environment/host details.
  transport.stderr?.resume();
  try {
    await client.connect(transport, { timeout: 20_000 });
    const info = client.getServerVersion();
    if (info?.version !== server.version) throw new Error(`${name}: versao MCP inesperada.`);
    const { tools } = await client.listTools({}, { timeout: 20_000 });
    const names = tools.map((tool) => tool.name);
    const missing = server.tools.filter((tool) => !names.includes(tool));
    if (missing.length) throw new Error(`${name}: tools/list sem ${missing.join(", ")}.`);
    let docs;
    if (name === "next") {
      const response = await client.callTool(
        { name: "nextjs_docs", arguments: { topic: "mcp" } },
        undefined,
        { timeout: 10_000 },
      );
      const content = response.content?.find((item) => item.type === "text");
      const result = JSON.parse(content?.text ?? "null");
      if (
        response.isError ||
        result?.status !== "use_bundled_docs" ||
        !result.docsAvailable ||
        result.versionSource !== "installed"
      ) {
        throw new Error("next: nextjs_docs nao encontrou a documentacao instalada deste checkout.");
      }
      docs = {
        status: result.status,
        nextVersion: result.nextVersion,
        docsAvailable: result.docsAvailable,
      };
    }
    return {
      server: name,
      version: info.version,
      protocol: "initialize + tools/list",
      availableTools: names,
      enabledTools: server.tools,
      ...(docs ? { docs } : {}),
    };
  } finally {
    await client.close();
    await transport.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for (const name of Object.keys(servers)) console.log(JSON.stringify(await checkServer(name)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
