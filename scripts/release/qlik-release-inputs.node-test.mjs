import assert from "node:assert/strict";
import { constants } from "node:fs";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertProtectedParents,
  assertQlikDependencies,
  idPattern,
  inspectQlikCredential,
  parseQlikUnit,
  qlikReleaseFiles,
  qlikCredentialPath,
  readProtectedText,
  renderQlikUnit,
  sha256,
  shaPattern,
} from "./qlik-release-inputs.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const deploymentId = "01234567-89ab-4cde-8fab-0123456789ab";
const home = "Environment=HOME=/var/lib/descomplica-qlik\n";
const loginCredentials =
  "LoadCredentialEncrypted=qlik-login:/etc/descomplica-qlik/qlik-login.cred\nSetCredential=qlik-login:{}\n";
const template = [
  "[Unit]",
  "Description=Synthetic Qlik service",
  "[Service]",
  "User=descomplica-qlik",
  "WorkingDirectory=@RELEASE@",
  home.trimEnd(),
  loginCredentials.trimEnd(),
  "ExecStart=/usr/local/bin/node ops/qlik/launch-browser.mjs",
  "[Install]",
  "WantedBy=multi-user.target",
  "",
].join("\n");
const protectedError = /Qlik input is not a protected regular file\./u;
const changedError = /Qlik input changed\./u;
const parentError = /Qlik release parent is unsafe\./u;
const virtualRoot = path.resolve(os.tmpdir(), "qlik-release-inputs-synthetic");
const virtualFile = path.join(virtualRoot, "input.json");
const linuxOnly = {
  skip:
    process.platform !== "linux" &&
    "Physical owners/modes/links require Linux; synthetic checks run on every OS.",
};

function metadata(overrides = {}) {
  const { kind = "file", ...fields } = overrides;
  return {
    uid: 0,
    mode: kind === "directory" ? 0o755 : 0o600,
    nlink: 1,
    ino: 101,
    dev: 1,
    size: 3,
    mtimeMs: 1000,
    ctimeMs: 1000,
    isFile: () => kind === "file",
    isDirectory: () => kind === "directory",
    isSymbolicLink: () => kind === "symlink",
    ...fields,
  };
}

// Built-in mocks are process-global. Top-level tests stay sequential and restore
// both the default object and named ESM bindings, including on assertion failure.
async function withFilesystem(t, operations, action) {
  const patches = [];
  try {
    for (const name of ["lstat", "open", "realpath", "readdir", "readlink"]) {
      patches.push(
        t.mock.method(
          filesystem,
          name,
          operations[name] ??
            (async () => {
              assert.fail(`Unexpected filesystem operation: ${name}`);
            }),
        ),
      );
    }
    syncBuiltinESMExports();
    return await action();
  } finally {
    for (const patch of patches.reverse()) patch.mock.restore();
    syncBuiltinESMExports();
  }
}

function reading(options = {}) {
  const data = Buffer.from(options.contents ?? "abc");
  const before = metadata({ size: data.length, ...options.before });
  const opened = metadata({ ...before, ...options.opened });
  const after = metadata({ ...opened, ...options.after });
  const current = metadata({ ...after, ...options.current });
  const calls = { opens: 0, closes: 0, reads: 0, bytes: 0, lstats: 0, stats: 0 };
  return {
    calls,
    operations: {
      lstat: async (file) => {
        assert.equal(file, virtualFile);
        return ++calls.lstats === 1 ? before : current;
      },
      open: async (file, flags) => {
        assert.equal(file, virtualFile);
        assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        calls.opens++;
        if (options.openError) throw options.openError;
        return {
          stat: async () => (++calls.stats === 1 ? opened : after),
          read: async (buffer, offset, length, position) => {
            calls.reads++;
            assert.equal(position, null);
            if (options.readError) throw options.readError;
            const bytesRead = Math.min(length, options.chunk ?? length, data.length - calls.bytes);
            data.copy(buffer, offset, calls.bytes, calls.bytes + bytesRead);
            calls.bytes += bytesRead;
            return { bytesRead, buffer };
          },
          close: async () => {
            calls.closes++;
          },
        };
      },
    },
  };
}

test("release inventory is frozen, unique and includes every reviewed input", () => {
  assert.deepEqual(qlikReleaseFiles, [
    "ops/qlik/launch-browser.mjs",
    "ops/qlik/browser-login.mjs",
    "ops/qlik/login-credential.mjs",
    "ops/qlik/prepare-login-credential.mjs",
    "ops/qlik/login-attempt.mjs",
    "ops/qlik/credential-vault.mjs",
    "ops/qlik/browser-preflight.mjs",
    "ops/qlik/qix-metadata.mjs",
    "ops/qlik/collection-loop.mjs",
    "ops/qlik/metadata-artifact.mjs",
    "ops/qlik/ranking-cycle.mjs",
    "ops/qlik/browser-ranking.mjs",
    "ops/qlik/qix-ranking.mjs",
    "ops/qlik/ranking-mapping.mjs",
    "ops/qlik/ranking-artifact.mjs",
    "ops/qlik/ranking-credential.mjs",
    "ops/qlik/publish-ranking.mjs",
    "ops/qlik/status-monitor.mjs",
    "lib/crm/qlik/status-contract.ts",
    "lib/crm/qlik/contracts-v2.ts",
    "ops/qlik/vps/descomplica-qlik-browser.service",
    "scripts/release/private-json-store.mjs",
    "scripts/release/production-release-lock.mjs",
    "package.json",
    "pnpm-lock.yaml",
  ]);
  assert.equal(Object.isFrozen(qlikReleaseFiles), true);
  assert.equal(new Set(qlikReleaseFiles).size, qlikReleaseFiles.length);
  assert.throws(() => qlikReleaseFiles.push("unreviewed"), TypeError);
});

test("ranking unit has only the fixed opt-in and credential, without metadata collection", () => {
  const rendered = renderQlikUnit(template, sha, false, true);
  assert.ok(
    rendered.includes(
      home +
        loginCredentials +
        `Environment=QLIK_RANKING_COLLECTION=enabled\nLoadCredential=qlik-ranking-hmac:${qlikCredentialPath}\n`,
    ),
  );
  assert.ok(!rendered.includes("QLIK_METADATA_PREFLIGHT"));
  assert.deepEqual(parseQlikUnit(rendered, template), {
    sha,
    unitHash: sha256(rendered),
    preflight: false,
    ranking: true,
  });
  const legacy = rendered.replace(loginCredentials, "");
  assert.deepEqual(parseQlikUnit(legacy, template), {
    sha,
    unitHash: sha256(legacy),
    preflight: false,
    ranking: true,
  });
  assert.notEqual(sha256(legacy), sha256(rendered));
  for (const source of [rendered, legacy]) {
    for (const extra of [
      "LoadCredential=other:/tmp/key\n",
      "SetCredential=qlik-login:{}\n",
      "Environment=EXTRA=true\n",
    ])
      assert.throws(() => parseQlikUnit(source + extra, template));
  }
  assert.throws(() => renderQlikUnit(template, sha, true, true));
  for (const value of [null, 0, "enable", {}, []])
    assert.throws(() => renderQlikUnit(template, sha, false, value));
  for (const changed of [
    rendered.replace(qlikCredentialPath, "/tmp/key"),
    rendered.replace("qlik-ranking-hmac:", "other:"),
    rendered.replace("COLLECTION=enabled", "COLLECTION=true"),
    rendered + "Environment=EXTRA=true\n",
    rendered.replace("LoadCredential=", "LoadCredentialEncrypted="),
    rendered.replace("Environment=QLIK_RANKING_COLLECTION=enabled\n", ""),
    rendered.replace(`LoadCredential=qlik-ranking-hmac:${qlikCredentialPath}\n`, ""),
    rendered.replace(home, home + "Environment=QLIK_METADATA_PREFLIGHT=enabled\n"),
  ])
    assert.throws(() => parseQlikUnit(changed, template));
  for (const directive of ["QLIK_RANKING_COLLECTION", "LoadCredential", "LoadCredentialEncrypted"])
    assert.throws(() => renderQlikUnit(template + directive, sha, false, true));
});

test("credential inspection is fixed-path metadata only, root:root 0600 without links", async (t) => {
  for (const change of [
    null,
    { uid: 1000 },
    { gid: 1000 },
    { mode: 0o640 },
    { mode: 0o4600 },
    { nlink: 2 },
    { kind: "symlink" },
    { kind: "directory" },
    { size: 42 },
    { size: 131 },
    "escape",
    "missing",
  ]) {
    await t.test(JSON.stringify(change), async (t) => {
      const info = metadata({ gid: 0, size: 43, ...(typeof change === "object" ? change : {}) });
      await withFilesystem(
        t,
        {
          lstat: async (file) => {
            if (file !== qlikCredentialPath) return metadata({ kind: "directory" });
            if (change === "missing") throw Object.assign(new Error("missing"), { code: "ENOENT" });
            return info;
          },
          realpath: async (file) =>
            change === "escape" && file === qlikCredentialPath ? "/tmp/key" : file,
        },
        async () => {
          if (change !== null) await assert.rejects(inspectQlikCredential());
          else
            assert.deepEqual(await inspectQlikCredential(), {
              dev: 1,
              ino: 101,
              size: 43,
              mtimeMs: 1000,
              ctimeMs: 1000,
            });
        },
      );
    });
  }
});

test("SHA-256 matches independent standard vectors and hashes bytes exactly", () => {
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256(Buffer.from([97, 98, 99])), sha256("abc"));
  assert.notEqual(sha256("abc\n"), sha256("abc"));
  assert.notEqual(sha256("abc\r\n"), sha256("abc\n"));
});

test("SHA and deployment ID require full lowercase SHA and UUID v4/variant", () => {
  assert.equal(shaPattern.test(sha), true);
  assert.equal(idPattern.test(deploymentId), true);
  for (const value of [
    "",
    sha.slice(1),
    `${sha}0`,
    sha.toUpperCase(),
    "g".repeat(40),
    ` ${sha}`,
    `${sha}\0`,
  ]) {
    assert.equal(shaPattern.test(value), false, JSON.stringify(value));
  }
  for (const value of [
    deploymentId.toUpperCase(),
    deploymentId.replace("-4cde", "-3cde"),
    deploymentId.replace("-8fab", "-7fab"),
    `${deploymentId}a`,
    "",
  ]) {
    assert.equal(idPattern.test(value), false, value);
  }
});

for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
  test(`identity patterns reject trailing ${JSON.stringify(suffix)}`, () => {
    assert.equal(shaPattern.test(sha + suffix), false, "SHA must consume the complete input");
    assert.equal(
      idPattern.test(deploymentId + suffix),
      false,
      "UUID must consume the complete input",
    );
  });
}

for (const preflight of [false, true]) {
  test(`unit render/parse round-trip is byte-exact with preflight=${preflight}`, () => {
    const expected = template
      .replace("@RELEASE@", `/srv/descomplica-crm-releases/${sha}`)
      .replace(
        home + loginCredentials,
        home +
          loginCredentials +
          (preflight ? "Environment=QLIK_METADATA_PREFLIGHT=enabled\n" : ""),
      );
    assert.equal(renderQlikUnit(template, sha, preflight), expected);
    assert.deepEqual(parseQlikUnit(expected, template), {
      sha,
      preflight,
      unitHash: sha256(expected),
    });
    assert.equal(template.includes("@RELEASE@"), true);
  });
  test(`legacy unit parse preserves its exact bytes and ledger shape with preflight=${preflight}`, () => {
    const current = renderQlikUnit(template, sha, preflight);
    const legacy = current.replace(loginCredentials, "");
    assert.deepEqual(parseQlikUnit(legacy, template), {
      sha,
      preflight,
      unitHash: sha256(legacy),
    });
    assert.notEqual(sha256(legacy), sha256(current), "Unit hash must include login configuration");
  });
}

for (const [label, value] of [
  ["missing release", template.replace("@RELEASE@", "/tmp/release")],
  ["duplicate release", `${template}# @RELEASE@\n`],
  ["missing HOME", template.replace(home, "")],
  ["duplicate HOME", template + home],
  ["existing preflight", `${template}Environment=QLIK_METADATA_PREFLIGHT=disabled\n`],
  ["commented preflight", `${template}# QLIK_METADATA_PREFLIGHT\n`],
  ["CRLF template", template.replaceAll("\n", "\r\n")],
  ["missing login credentials", template.replace(loginCredentials, "")],
  ["changed login path", template.replace("/qlik-login.cred", "/other.cred")],
  ["changed login default", template.replace("qlik-login:{}", "qlik-login:secret")],
  ["login before HOME", template.replace(home + loginCredentials, loginCredentials + home)],
]) {
  test(`unit renderer rejects ${label}`, () => {
    assert.throws(() => renderQlikUnit(value, sha, false), /Qlik unit template rejected\./u);
  });
}

for (const value of [undefined, null, 0, 1, "false", "true", {}, []]) {
  test(`unit renderer rejects non-boolean preflight ${JSON.stringify(value)}`, () => {
    assert.throws(() => renderQlikUnit(template, sha, value), /Qlik unit template rejected\./u);
  });
}

for (const [label, value] of [
  ["short", sha.slice(1)],
  ["uppercase", sha.toUpperCase()],
  ["traversal", `../${sha}`],
  ["newline", `${sha}\n`],
  ["boxed string", Object(sha)],
  ["array", [sha]],
]) {
  test(`unit renderer rejects ${label} SHA`, () => {
    assert.throws(() => renderQlikUnit(template, value, false), /Qlik unit template rejected\./u);
  });
}

test("unit renderer rejects SHA coercion that changes between validation and rendering", () => {
  let conversions = 0;
  const value = {
    toString() {
      return ++conversions === 1 ? sha : `${sha}\nExecStartPost=/bin/true`;
    },
  };
  assert.throws(() => renderQlikUnit(template, value, false), /Qlik unit template rejected\./u);
});

const rendered = template.replace("@RELEASE@", `/srv/descomplica-crm-releases/${sha}`);
for (const [label, change] of [
  ["extra newline", (value) => value + "\n"],
  ["missing final newline", (value) => value.trimEnd()],
  ["CRLF", (value) => value.replaceAll("\n", "\r\n")],
  ["extra command", (value) => value + "ExecStartPost=/bin/true\n"],
  [
    "duplicate identity",
    (value) => value + `WorkingDirectory=/srv/descomplica-crm-releases/${sha}\n`,
  ],
  ["different user", (value) => value.replace("User=descomplica-qlik", "User=root")],
  [
    "disabled preflight",
    (value) => value.replace(home, home + "Environment=QLIK_METADATA_PREFLIGHT=disabled\n"),
  ],
  ["missing identity", (value) => value.replace("WorkingDirectory=", "#WorkingDirectory=")],
  ["uppercase identity", (value) => value.replace(sha, sha.toUpperCase())],
  ["foreign release root", (value) => value.replace("/srv/descomplica-crm-releases/", "/tmp/")],
  ["changed login path", (value) => value.replace("/qlik-login.cred", "/other.cred")],
  ["changed login default", (value) => value.replace("qlik-login:{}", "qlik-login:secret")],
  [
    "missing encrypted load only",
    (value) => value.replace(loginCredentials.split("\n")[0] + "\n", ""),
  ],
  ["missing default only", (value) => value.replace("SetCredential=qlik-login:{}\n", "")],
  ["duplicate credentials", (value) => value + loginCredentials],
  ["extra credentials", (value) => value + "LoadCredential=other:/etc/unreviewed\n"],
  ["credential directory override", (value) => value + "Environment=CREDENTIALS_DIRECTORY=/tmp\n"],
  [
    "different login order",
    (value) =>
      value.replace(
        loginCredentials,
        loginCredentials.split("\n").filter(Boolean).reverse().join("\n") + "\n",
      ),
  ],
]) {
  test(`unit parser rejects ${label}`, () => {
    assert.throws(
      () => parseQlikUnit(change(rendered), template),
      /Qlik (unit differs|release identity unavailable)/u,
    );
  });
}

test("legacy unit compatibility never accepts additional service directives", () => {
  for (const preflight of [false, true]) {
    const legacy = renderQlikUnit(template, sha, preflight).replace(loginCredentials, "");
    for (const extra of [
      "ExecStartPost=/bin/true\n",
      "User=root\n",
      "LoadCredentialEncrypted=qlik-login:/etc/other.cred\n",
      "SetCredential=qlik-login:{}\n",
      "Environment=CREDENTIALS_DIRECTORY=/tmp\n",
      "[Service]\nProtectSystem=false\n",
    ])
      assert.throws(() => parseQlikUnit(legacy + extra, template), /Qlik unit differs/u);
  }
});

test("the real unit template preserves the public default, exact login pair and legacy parse", async () => {
  const actual = await filesystem.readFile(
    new URL("../../ops/qlik/vps/descomplica-qlik-browser.service", import.meta.url),
    "utf8",
  );
  for (const preflight of [false, true]) {
    const current = renderQlikUnit(actual, sha, preflight);
    assert.ok(current.includes(home + loginCredentials));
    assert.equal(parseQlikUnit(current, actual).unitHash, sha256(current));
    const legacy = current.replace(loginCredentials, "");
    assert.equal(parseQlikUnit(legacy, actual).unitHash, sha256(legacy));
  }
});

for (const [label, contents, maximum, chunk] of [
  ["empty at zero limit", "", 0, 1],
  ["exact byte boundary", "abc", 3, 1],
  ["UTF-8 split across reads", "a\u00e9", 3, 1],
  ["default 256 KiB boundary", "x".repeat(262144), undefined, 8191],
]) {
  test(`protected read accepts ${label} and closes descriptor`, async (t) => {
    const fixture = reading({ contents, chunk });
    await withFilesystem(t, fixture.operations, async () => {
      assert.equal(await readProtectedText(virtualFile, { maximum }), contents);
    });
    assert.equal(fixture.calls.closes, 1);
    assert.equal(fixture.calls.bytes, Buffer.byteLength(contents));
  });
}

for (const [label, before] of [
  ["foreign owner", { uid: 1001 }],
  ["group writable", { mode: 0o620 }],
  ["world writable", { mode: 0o602 }],
  ["directory", { kind: "directory" }],
  ["symlink", { kind: "symlink" }],
  ["FIFO", { kind: "fifo" }],
  ["extra hardlink", { nlink: 2 }],
  ["unlinked inode", { nlink: 0 }],
  ["oversize", { size: 262145 }],
]) {
  test(`protected read rejects ${label} before open`, async (t) => {
    const fixture = reading({ before });
    await withFilesystem(t, fixture.operations, () =>
      assert.rejects(readProtectedText(virtualFile), protectedError),
    );
    assert.equal(fixture.calls.opens, 0);
  });
}

test("protected read accepts explicit UID and exact mode, rejects mode mismatch", async (t) => {
  const fixture = reading({ before: { uid: 1001, mode: 0o640 } });
  await withFilesystem(t, fixture.operations, async () => {
    assert.equal(await readProtectedText(virtualFile, { uid: 1001, mode: 0o640 }), "abc");
    await assert.rejects(
      readProtectedText(virtualFile, { uid: 1001, mode: 0o600 }),
      protectedError,
    );
  });
  assert.equal(fixture.calls.closes, 1);
});

for (const [label, options, error] of [
  ["opened inode replaced", { opened: { ino: 102 } }, changedError],
  ["opened device replaced", { opened: { dev: 2 } }, changedError],
  ["opened owner replaced", { opened: { uid: 1001 } }, protectedError],
  ["opened writable", { opened: { mode: 0o622 } }, protectedError],
  ["opened hardlinked", { opened: { nlink: 2 } }, protectedError],
  ["opened oversize", { opened: { size: 262145 } }, protectedError],
  ["pathname inode replaced", { current: { ino: 102 } }, changedError],
  ["pathname device replaced", { current: { dev: 2 } }, changedError],
  [
    "pathname symlink swapped",
    { current: { isFile: () => false, isSymbolicLink: () => true } },
    protectedError,
  ],
  ["pathname owner changed", { current: { uid: 1001 } }, protectedError],
  ["pathname writable", { current: { mode: 0o622 } }, protectedError],
  ["descriptor mtime changed", { after: { mtimeMs: 1001 } }, changedError],
  ["descriptor ctime changed", { after: { ctimeMs: 1001 } }, changedError],
  ["descriptor size changed", { after: { size: 4 } }, changedError],
  ["pathname mtime changed after final fstat", { current: { mtimeMs: 1001 } }, changedError],
  ["pathname ctime changed after final fstat", { current: { ctimeMs: 1001 } }, changedError],
  ["pathname size changed after final fstat", { current: { size: 4 } }, changedError],
  [
    "path changed after final fstat",
    { current: { mtimeMs: 1001, ctimeMs: 1001, size: 4 } },
    changedError,
  ],
]) {
  test(`protected read rejects race: ${label}`, async (t) => {
    const fixture = reading(options);
    await withFilesystem(t, fixture.operations, () =>
      assert.rejects(readProtectedText(virtualFile), error),
    );
    assert.equal(fixture.calls.closes, 1);
  });
}

test("protected read caps a growing file at maximum + 1 bytes", async (t) => {
  const fixture = reading({
    contents: "abcdefgh",
    before: { size: 3 },
    opened: { size: 3 },
    after: { size: 3 },
  });
  await withFilesystem(t, fixture.operations, () =>
    assert.rejects(readProtectedText(virtualFile, { maximum: 3 }), changedError),
  );
  assert.equal(fixture.calls.bytes, 4);
  assert.equal(fixture.calls.closes, 1);
});

test("protected read closes on I/O failure and propagates the original error", async (t) => {
  const failure = Object.assign(new Error("synthetic EIO"), { code: "EIO" });
  const fixture = reading({ readError: failure });
  await withFilesystem(t, fixture.operations, () =>
    assert.rejects(readProtectedText(virtualFile), (error) => error === failure),
  );
  assert.equal(fixture.calls.closes, 1);
});

test("protected read rejects a symlink swap at open with ELOOP", async (t) => {
  const failure = Object.assign(new Error("synthetic O_NOFOLLOW refusal"), { code: "ELOOP" });
  const fixture = reading({ openError: failure });
  await withFilesystem(t, fixture.operations, () =>
    assert.rejects(readProtectedText(virtualFile), { code: "ELOOP" }),
  );
  assert.equal(fixture.calls.closes, 0);
  assert.equal(fixture.calls.reads, 0);
});

test("protected parents inspect every ancestor through filesystem root", async (t) => {
  const seen = [];
  const expected = [];
  for (let current = virtualRoot; ; current = path.dirname(current)) {
    expected.push(current);
    if (path.dirname(current) === current) break;
  }
  await withFilesystem(
    t,
    {
      lstat: async (file) => {
        seen.push(file);
        return metadata({ kind: "directory" });
      },
      realpath: async (file) => file,
    },
    () => assertProtectedParents(virtualRoot),
  );
  assert.deepEqual(seen, expected);
});

for (const [label, fields, redirect = false] of [
  ["non-root ancestor", { uid: 1001 }],
  ["group writable ancestor", { mode: 0o775 }],
  ["world writable sticky ancestor", { mode: 0o1777 }],
  ["symlink ancestor", { kind: "symlink" }],
  ["regular file ancestor", { kind: "file" }],
  ["noncanonical ancestor", {}, true],
]) {
  test(`protected parents reject ${label}`, async (t) => {
    const unsafe = path.dirname(virtualRoot);
    await withFilesystem(
      t,
      {
        lstat: async (file) => metadata({ kind: "directory", ...(file === unsafe ? fields : {}) }),
        realpath: async (file) =>
          file === unsafe && redirect ? path.join(file, "elsewhere") : file,
      },
      () => assert.rejects(assertProtectedParents(virtualRoot), parentError),
    );
  });
}

function dependencyTree() {
  const base = path.join(virtualRoot, "node_modules");
  const nodes = new Map();
  const opened = [];
  const add = (relative, fields = {}) => {
    const file = path.join(base, relative);
    nodes.set(file, { kind: "directory", ...fields });
    return file;
  };
  add("");
  add("enigma.js");
  add("@playwright");
  add("@playwright/test");
  const manifest = (name, version) =>
    add(`${name}/package.json`, {
      kind: "file",
      contents: JSON.stringify({ name, version }),
    });
  const enigma = manifest("enigma.js", "2.15.0");
  const playwright = manifest("@playwright/test", "1.62.1");
  const ancestors = new Set();
  for (let current = path.dirname(base); ; current = path.dirname(current)) {
    ancestors.add(current);
    if (path.dirname(current) === current) break;
  }
  const node = (file) => {
    if (ancestors.has(file)) return { kind: "directory" };
    const value = nodes.get(file);
    if (!value) throw Object.assign(new Error("Synthetic path missing"), { code: "ENOENT" });
    return value;
  };
  const stat = (file) => {
    const value = node(file);
    return metadata({ size: Buffer.byteLength(value.contents ?? ""), ...value });
  };
  const resolve = (file, depth = 0) => {
    assert.ok(depth < 20, "Synthetic symlink loop");
    if (nodes.has(file) || ancestors.has(file)) {
      const value = node(file);
      return value.kind === "symlink"
        ? resolve(path.resolve(path.dirname(file), value.target), depth + 1)
        : file;
    }
    for (const [parent, value] of nodes) {
      if (value.kind === "symlink" && file.startsWith(parent + path.sep)) {
        return resolve(
          path.join(path.resolve(path.dirname(parent), value.target), path.relative(parent, file)),
          depth + 1,
        );
      }
    }
    return node(file);
  };
  return {
    base,
    nodes,
    add,
    enigma,
    playwright,
    opened,
    operations: {
      lstat: async (file) => stat(file),
      realpath: async (file) => resolve(file),
      readlink: async (file) => {
        assert.equal(node(file).kind, "symlink");
        return node(file).target;
      },
      readdir: async (file) => {
        assert.equal(node(file).kind, "directory");
        return [...nodes.keys()]
          .filter((value) => value !== file && path.dirname(value) === file)
          .map((value) => path.basename(value));
      },
      open: async (file, flags) => {
        assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        assert.equal(
          path.basename(file),
          "package.json",
          "Dependency code must never be opened or imported",
        );
        opened.push(file);
        const data = Buffer.from(node(file).contents);
        let position = 0;
        return {
          stat: async () => stat(file),
          read: async (buffer, offset, length) => {
            const bytesRead = Math.min(length, data.length - position);
            data.copy(buffer, offset, position, position + bytesRead);
            position += bytesRead;
            return { bytesRead, buffer };
          },
          close: async () => {},
        };
      },
    },
  };
}

test("dependency tree accepts reviewed pins and reads manifests without executing code", async (t) => {
  const tree = dependencyTree();
  tree.add("enigma.js/index.js", {
    kind: "file",
    contents: 'throw new Error("must never execute");',
  });
  await withFilesystem(t, tree.operations, () => assertQlikDependencies(virtualRoot));
  assert.deepEqual(tree.opened, [tree.enigma, tree.playwright]);
});

for (const [label, mutate, error] of [
  ["foreign owner", (tree) => tree.add("foreign", { uid: 1001 }), /Dependency owner rejected/u],
  [
    "group writable directory",
    (tree) => tree.add("writable", { mode: 0o775 }),
    /Writable dependency rejected/u,
  ],
  [
    "world writable file",
    (tree) => tree.add("writable", { kind: "file", mode: 0o602 }),
    /Writable dependency rejected/u,
  ],
  [
    "hardlinked file",
    (tree) => tree.add("shared", { kind: "file", nlink: 2 }),
    /Shared dependency rejected/u,
  ],
  ["FIFO", (tree) => tree.add("fifo", { kind: "fifo" }), /Shared dependency rejected/u],
  [
    "foreign enigma name",
    (tree) => {
      tree.nodes.get(tree.enigma).contents = '{"name":"other","version":"2.15.0"}';
    },
    /Qlik dependency version rejected/u,
  ],
  [
    "unreviewed enigma version",
    (tree) => {
      tree.nodes.get(tree.enigma).contents = '{"name":"enigma.js","version":"2.16.0"}';
    },
    /Qlik dependency version rejected/u,
  ],
  [
    "missing enigma version",
    (tree) => {
      tree.nodes.get(tree.enigma).contents = '{"name":"enigma.js"}';
    },
    /Qlik dependency version rejected/u,
  ],
  [
    "foreign playwright name",
    (tree) => {
      tree.nodes.get(tree.playwright).contents = '{"name":"playwright","version":"1.62.1"}';
    },
    /Qlik dependency version rejected/u,
  ],
  [
    "unreviewed playwright version",
    (tree) => {
      tree.nodes.get(tree.playwright).contents = '{"name":"@playwright/test","version":"0.0.0"}';
    },
    /Qlik dependency version rejected/u,
  ],
  [
    "missing playwright version",
    (tree) => {
      tree.nodes.get(tree.playwright).contents = '{"name":"@playwright/test"}';
    },
    /Qlik dependency version rejected/u,
  ],
  [
    "malformed manifest",
    (tree) => {
      tree.nodes.get(tree.enigma).contents = "{";
    },
    SyntaxError,
  ],
  [
    "missing manifest",
    (tree) => {
      tree.nodes.delete(tree.enigma);
    },
    { code: "ENOENT" },
  ],
]) {
  test(`dependency tree rejects ${label}`, async (t) => {
    const tree = dependencyTree();
    mutate(tree);
    await withFilesystem(t, tree.operations, () =>
      assert.rejects(assertQlikDependencies(virtualRoot), error),
    );
  });
}

test("dependency tree accepts contained pnpm directory and file symlinks", async (t) => {
  const tree = dependencyTree();
  tree.add(".pnpm");
  tree.add(".pnpm/enigma.js@2.15.0");
  const store = ".pnpm/enigma.js@2.15.0/node_modules";
  tree.add(store);
  tree.add(`${store}/enigma.js`);
  const manifest = tree.add(`${store}/enigma.js/package.json`, tree.nodes.get(tree.enigma));
  tree.nodes.delete(tree.enigma);
  tree.add("enigma.js", { kind: "symlink", mode: 0o777, target: `${store}/enigma.js` });
  tree.add("manifest-alias", {
    kind: "symlink",
    mode: 0o777,
    target: `${store}/enigma.js/package.json`,
  });
  await withFilesystem(t, tree.operations, () => assertQlikDependencies(virtualRoot));
  assert.deepEqual(tree.opened, [manifest, tree.playwright]);
});

for (const [label, target] of [
  ["relative escape", "../../outside"],
  ["absolute escape", path.resolve(virtualRoot, "outside")],
  [
    "same-prefix sibling escape",
    `${path.basename(path.join(virtualRoot, "node_modules"))}-foreign/file`,
  ],
]) {
  test(`dependency tree rejects symlink ${label}`, async (t) => {
    const tree = dependencyTree();
    tree.add("alias", {
      kind: "symlink",
      target: label === "same-prefix sibling escape" ? `../${target}` : target,
    });
    await withFilesystem(t, tree.operations, () =>
      assert.rejects(assertQlikDependencies(virtualRoot), /External dependency rejected/u),
    );
  });
}

test("dependency tree rejects a contained link whose realpath escapes", async (t) => {
  const tree = dependencyTree();
  const alias = tree.add("alias", { kind: "symlink", target: "enigma.js" });
  const original = tree.operations.realpath;
  tree.operations.realpath = async (file) =>
    file === alias ? path.join(virtualRoot, "outside") : original(file);
  await withFilesystem(t, tree.operations, () =>
    assert.rejects(assertQlikDependencies(virtualRoot), /External dependency rejected/u),
  );
});

test("dependency tree rejects dangling symlink", async (t) => {
  const tree = dependencyTree();
  tree.add("alias", { kind: "symlink", target: "missing" });
  await withFilesystem(t, tree.operations, () =>
    assert.rejects(assertQlikDependencies(virtualRoot), { code: "ENOENT" }),
  );
});

test("dependency tree rejects manifest resolution escaping after traversal", async (t) => {
  const tree = dependencyTree();
  const original = tree.operations.realpath;
  tree.operations.realpath = async (file) =>
    file === tree.enigma ? path.join(virtualRoot, "package.json") : original(file);
  await withFilesystem(t, tree.operations, () =>
    assert.rejects(assertQlikDependencies(virtualRoot), /Dependency manifest escaped release/u),
  );
  assert.deepEqual(tree.opened, []);
});

for (const total of [200000, 200001]) {
  test(`dependency traversal enforces the inclusive 200000-entry limit: ${total}`, async (t) => {
    const tree = dependencyTree();
    const bulk = tree.add("bulk");
    const directories = 400;
    const leaves = total - 7 - directories;
    const originalLstat = tree.operations.lstat;
    const originalReaddir = tree.operations.readdir;
    tree.operations.lstat = async (file) => {
      if (file.startsWith(bulk + path.sep))
        return metadata({ kind: path.dirname(file) === bulk ? "directory" : "file" });
      return originalLstat(file);
    };
    tree.operations.readdir = async (file) => {
      if (file === bulk) return Array.from({ length: directories }, (_, i) => String(i));
      if (path.dirname(file) === bulk) {
        const count =
          Math.floor(leaves / directories) +
          (Number(path.basename(file)) < leaves % directories ? 1 : 0);
        return Array.from({ length: count }, (_, i) => String(i));
      }
      return originalReaddir(file);
    };
    await withFilesystem(t, tree.operations, async () => {
      if (total === 200000) await assertQlikDependencies(virtualRoot);
      else
        await assert.rejects(
          assertQlikDependencies(virtualRoot),
          /Dependency tree limit exceeded/u,
        );
    });
  });
}

test("dependency tree rejects excessive single-directory fanout with a controlled limit error", async (t) => {
  const tree = dependencyTree();
  tree.operations.readdir = async () => Array.from({ length: 200001 }, (_, i) => String(i));
  await withFilesystem(t, tree.operations, () =>
    assert.rejects(assertQlikDependencies(virtualRoot), /Dependency tree limit exceeded/u),
  );
});

async function temporaryDirectory(t) {
  const directory = await filesystem.mkdtemp(path.join(os.tmpdir(), "qlik-release-inputs-"));
  await filesystem.chmod(directory, 0o700);
  t.after(() => filesystem.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("Linux physical read honors owner, exact mode and byte limits", linuxOnly, async (t) => {
  const file = path.join(await temporaryDirectory(t), "input.txt");
  const uid = process.getuid();
  await filesystem.writeFile(file, "abc", { mode: 0o600 });
  assert.equal(await readProtectedText(file, { uid, mode: 0o600, maximum: 3 }), "abc");
  await assert.rejects(readProtectedText(file, { uid: uid + 1 }), protectedError);
  await assert.rejects(readProtectedText(file, { uid, maximum: 2 }), protectedError);
  await filesystem.chmod(file, 0o640);
  await assert.rejects(readProtectedText(file, { uid, mode: 0o600 }), protectedError);
  assert.equal(await readProtectedText(file, { uid, mode: 0o640 }), "abc");
  for (const mode of [0o620, 0o602]) {
    await filesystem.chmod(file, mode);
    await assert.rejects(readProtectedText(file, { uid }), protectedError);
  }
});

test(
  "Linux physical read rejects symlinks, hardlinks, directories and missing paths",
  linuxOnly,
  async (t) => {
    const directory = await temporaryDirectory(t);
    const file = path.join(directory, "input.txt");
    const alias = path.join(directory, "alias.txt");
    const uid = process.getuid();
    await filesystem.writeFile(file, "abc", { mode: 0o600 });
    await filesystem.symlink(file, alias);
    await assert.rejects(readProtectedText(alias, { uid }), protectedError);
    await filesystem.unlink(alias);
    await filesystem.link(file, alias);
    await assert.rejects(readProtectedText(file, { uid }), protectedError);
    await filesystem.unlink(alias);
    assert.equal(await readProtectedText(file, { uid }), "abc");
    await assert.rejects(readProtectedText(directory, { uid }), protectedError);
    await assert.rejects(readProtectedText(alias, { uid }), { code: "ENOENT" });
  },
);
