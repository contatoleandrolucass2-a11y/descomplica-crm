import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import test from "node:test";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const browser = read("descomplica-qlik-browser.service");
const vnc = read("descomplica-qlik-vnc.service");
const consoleUnit = read("descomplica-qlik-console.service");
const installer = read("install-session.sh");

test("browser delegates to the reviewed non-root launcher without a CDP TCP endpoint", () => {
  assert.match(browser, /^User=descomplica-qlik$/m);
  assert.match(browser, /--server-num=98 --auth-file=\/run\/descomplica-qlik\/Xauthority/);
  assert.match(
    browser,
    /ExecStart=\/usr\/bin\/xvfb-run .* \/usr\/local\/bin\/node ops\/qlik\/launch-browser.mjs$/m,
  );
  assert.doesNotMatch(browser + installer, /9223|remote-debugging-port|remote-debugging-address/);
  assert.match(browser, /-nolisten tcp/);
  assert.match(browser, /^RuntimeDirectoryMode=0700$/m);
  assert.match(browser, /^RuntimeDirectoryPreserve=yes$/m);
  assert.match(browser, /^UMask=0077$/m);
  assert.ok(
    browser.includes(
      "Environment=HOME=/var/lib/descomplica-qlik\n" +
        "LoadCredentialEncrypted=qlik-login:/etc/descomplica-qlik/qlik-login.cred\n" +
        "SetCredential=qlik-login:{}\n",
    ),
  );
  assert.match(browser, /^Restart=always$/m);
  assert.match(browser, /^WantedBy=multi-user.target$/m);
  assert.doesNotMatch(
    browser,
    /--no-sandbox|--disable-setuid-sandbox|--auto-servernum|-ac\b|User=root/,
  );
});

test("VNC and console cannot create IP sockets or transfer clipboard", () => {
  assert.match(vnc, /-unixsock \/run\/descomplica-qlik\/vnc.sock -rfbport 0 -rfbportv6 0/);
  assert.match(vnc, /-auth \/run\/descomplica-qlik\/Xauthority/);
  assert.match(vnc, /-nosel -noprimary -nosetprimary -noclipboard -nosetclipboard/);
  assert.match(vnc, /^PartOf=descomplica-qlik-console.service$/m);
  for (const [unit, socket] of [
    [vnc, "vnc.sock"],
    [consoleUnit, "console.sock"],
  ]) {
    assert.ok(unit.includes(`ExecStartPre=/usr/bin/test ! -e /run/descomplica-qlik/${socket}`));
    assert.ok(unit.includes(`ExecStartPre=/usr/bin/test ! -L /run/descomplica-qlik/${socket}`));
    assert.doesNotMatch(unit, /Exec(?:StartPre|StopPost)=.*\brm\b/);
  }
  for (const unit of [vnc, consoleUnit]) {
    assert.match(unit, /^RestrictAddressFamilies=AF_UNIX$/m);
    assert.match(unit, /^User=descomplica-qlik$/m);
    assert.match(unit, /^UMask=0077$/m);
    assert.match(unit, /^BindsTo=descomplica-qlik-browser.service$/m);
    assert.match(unit, /^NoNewPrivileges=true$/m);
  }
  assert.match(consoleUnit, /ExecStart=\/usr\/local\/bin\/node ops\/qlik\/console-gateway.mjs/);
});

test("installer permits only three reviewed units without enabling a service or collector", () => {
  const units = readdirSync(new URL(".", import.meta.url))
    .filter((file) => file.endsWith(".service"))
    .sort();
  const allowlist = installer
    .match(/readonly units=\(\s*([^)]+)\)/)?.[1]
    .trim()
    .split(/\s+/)
    .sort();
  assert.deepEqual(allowlist, units);
  assert.equal(units.length, 3);
  assert.match(installer, /ops\/qlik\/vps\/install-session.sh ops\/qlik\/console-gateway.mjs/);
  assert.match(installer, /ops\/qlik\/launch-browser.mjs/);
  assert.match(installer, /git -C "\$release" show "\$1:\$relative"/);
  assert.match(installer, /--untracked-files=all/);
  assert.ok(installer.indexOf("systemd-analyze verify") < installer.indexOf("\nuseradd "));
  assert.doesNotMatch(
    installer,
    /systemctl (?:enable|start|restart)|apt-get|production\.env|salesforce|collector|rsync/,
  );
  for (const unit of [vnc, consoleUnit]) {
    assert.doesNotMatch(unit, /\[Install\]|WantedBy=|ListenStream=|0\.0\.0\.0/);
  }
});

test("integrity allowlist covers every metadata module before dependency checks or user creation", () => {
  const loop = installer.match(
    /for relative in ops\/qlik\/vps\/install-session\.sh[^\n]+; do\n([\s\S]*?)\ndone/,
  );
  assert.ok(loop);
  const files = loop[0].split("; do")[0].split(/\s+/);
  for (const name of [
    "browser-login",
    "login-credential",
    "prepare-login-credential",
    "login-attempt",
    "browser-preflight",
    "collection-loop",
    "metadata-artifact",
    "qix-metadata",
  ]) {
    assert.ok(files.includes(`ops/qlik/${name}.mjs`), name);
  }
  for (const name of ["private-json-store", "production-release-lock"]) {
    assert.ok(files.includes(`scripts/release/${name}.mjs`), name);
  }
  assert.match(installer, /for relative in ''[^\n]+ scripts scripts\/release; do/);
  for (const guard of [
    '! -L "$file"',
    '$(stat -c %u "$file") == 0',
    "(( (8#$mode & 0022) == 0 ))",
    'cmp -- "$file" <(git -C "$release" show "$1:$relative")',
  ])
    assert.ok(loop[1].includes(guard), guard);
  assert.ok(loop.index < installer.indexOf("<<'DEPENDENCY_METADATA'"));
  assert.ok(loop.index < installer.indexOf("\nuseradd "));
});

test("preflight refuses conflicting identity, profile, units and X display", () => {
  for (const required of [
    "$EUID == 0 && $(uname -s) == Linux",
    '$(realpath -e "$release") == "$release"',
    '$(git -C "$release" rev-parse HEAD) == "$1"',
    "(( (8#$mode & 0022) == 0 ))",
    "getent passwd descomplica-qlik",
    "getent group descomplica-qlik",
    "/var/lib/descomplica-qlik /run/descomplica-qlik",
    "/tmp/.X98-lock /tmp/.X11-unix/X98",
    "ss -H -lx",
    "--shell /usr/sbin/nologin",
    "-m 0700 /var/lib/descomplica-qlik /var/lib/descomplica-qlik/chrome",
    "await import('ws')",
    "import.meta.resolve('@novnc/novnc')",
  ])
    assert.ok(installer.includes(required), required);
});

test("root only inspects dependency files; imports require the dedicated user before unit installation", () => {
  const probe = installer.indexOf('(cd "$release" && runuser -u descomplica-qlik');
  assert.ok(probe > installer.indexOf("\nuseradd "));
  assert.ok(probe < installer.indexOf("install -o root -g root -m 0644"));
  assert.doesNotMatch(installer.slice(0, probe), /await import\(|require\(|import\.meta\.resolve/);
  assert.match(installer, /unset NODE_OPTIONS NODE_PATH/);
  assert.match(installer, /runuser -u descomplica-qlik -- \/usr\/bin\/env -i/);
  assert.match(installer, /find -L "\$release\/node_modules"/);
  assert.match(installer, /! -uid 0 -o -perm \/0022/);
  assert.match(installer, /-type f -links \+1/);
  const metadata = installer
    .split("<<'DEPENDENCY_METADATA'\n")[1]
    ?.split("\nDEPENDENCY_METADATA")[0];
  assert.ok(metadata);
  assert.deepEqual(
    [...metadata.matchAll(/from '([^']+)'/g)].map((match) => match[1]),
    ["node:fs", "node:path", "node:module"],
  );
  assert.match(metadata, /!within\(target\) \|\| !within\(realpathSync\(current\)\)/);
  assert.match(metadata, /info.uid !== 0/);
  assert.match(metadata, /info.nlink !== 1/);
  for (const name of [
    "ws",
    "enigma.js",
    "@novnc/novnc",
    "@playwright/test",
    "playwright",
    "playwright-core",
  ]) {
    assert.ok(metadata.includes(`'${name}'`));
  }
});

test("root metadata validation pins enigma without evaluating package code", () => {
  const metadata = installer
    .split("<<'DEPENDENCY_METADATA'\n")[1]
    ?.split("\nDEPENDENCY_METADATA")[0];
  assert.ok(metadata);
  assert.ok(metadata.includes("['enigma.js', path.join(root, 'enigma.js/package.json')]"));
  assert.ok(metadata.includes("if (!within(realpathSync(manifest))) throw new Error();"));
  assert.ok(metadata.includes("JSON.parse(readFileSync(manifest, 'utf8'))"));
  const guards = metadata
    .split("\n")
    .filter(
      (line) =>
        line.trimStart().startsWith("if (metadata.name !== name") ||
        line.trimStart().startsWith("if (name === 'enigma.js'"),
    )
    .join("\n");
  assert.equal(guards.split("\n").length, 2);
  for (const [name, version, allowed] of [
    ["enigma.js", "2.15.0", true],
    ["enigma.js", "2.14.0", false],
    ["enigma.js", "2.15.1", false],
    ["enigma.js", "^2.15.0", false],
    ["enigma.js", null, false],
    ["enigma.js", "", false],
    ["wrong-package", "2.15.0", false],
  ]) {
    const check = () => runInNewContext(guards, { name: "enigma.js", metadata: { name, version } });
    if (allowed) assert.doesNotThrow(check);
    else assert.throws(check);
  }
});

test("metadata script probe runs only as the dedicated user, before units, without starting collection", () => {
  const probe = installer.split("\n").find((line) => line.startsWith('(cd "$release" && runuser'));
  assert.ok(probe);
  const guard = "if (process.getuid() === 0) throw new Error('Non-root dependency probe required')";
  const load =
    "const { getBrowserMetadataScript } = await import('./ops/qlik/browser-preflight.mjs')";
  assert.ok(probe.includes(load));
  assert.ok(probe.indexOf(guard) < probe.indexOf(load));
  for (const name of [
    "browser-login",
    "login-credential",
    "prepare-login-credential",
    "login-attempt",
  ])
    assert.ok(probe.includes(`'${name}'`), name);
  assert.ok(probe.indexOf(load) < probe.indexOf("await getBrowserMetadataScript()"));
  assert.ok(installer.indexOf(probe) > installer.indexOf("\nuseradd "));
  assert.ok(installer.indexOf(probe) < installer.indexOf("install -o root -g root -m 0644"));
  assert.doesNotMatch(
    probe,
    /collectBrowserMetadata|renewBrowserLogin\(|readLoginCredential\(|prepareLoginCredential\(|loginAttemptStore\(|\.evaluate\(|\.launch|eval\(|new Function/,
  );
});

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
test("release traversal adds only the named execute ACL after user creation without widening the mask", () => {
  assert.match(installer, /for command in .* getfacl setfacl /);
  const grant = 'setfacl --no-mask --modify=user:descomplica-qlik:--x -- "$releases_parent"';
  assert.ok(installer.includes(grant));
  assert.ok(installer.indexOf(grant) > installer.indexOf("\nuseradd "));
  assert.ok(installer.indexOf(grant) < installer.indexOf('(cd "$release" && runuser'));
  assert.match(installer, /getfacl --omit-header --absolute-names --no-effective/);
  assert.match(installer, /test -x "\$releases_parent"/);
  assert.match(installer, /test -r "\$releases_parent"/);
  assert.doesNotMatch(installer, /setfacl (?:-b|--remove-all)|--groups? root|usermod|--resume/);
  assert.match(installer, /Dedicated user already exists; inspect before updating/);
});

test(
  "root-owned 0750 with an r-x ACL mask passes the existing mode guard; writable modes fail",
  {
    skip: !existsSync(bash) && "Bash unavailable",
  },
  () => {
    const guard = installer.match(/\(\( \(8#\$mode & 0022\) == 0 \)\)/)?.[0];
    assert.ok(guard);
    for (const [mode, allowed] of [
      ["750", true],
      ["770", false],
      ["752", false],
    ]) {
      const result = spawnSync(bash, ["-c", `mode=${mode}; ${guard}`], {
        encoding: "utf8",
        timeout: 5000,
      });
      assert.equal(result.status, allowed ? 0 : 1, result.stderr);
    }
    assert.match(installer, /\$\(stat -c %u "\$directory"\) == 0/);
  },
);

test(
  "installer parses and refuses invalid invocation before creating any resources",
  {
    skip: !existsSync(bash) && "Bash unavailable",
  },
  () => {
    const syntax = spawnSync(bash, ["-n"], { input: installer, encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
    const reject = spawnSync(bash, ["-s", "--", "invalid-release"], {
      input: installer,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(reject.status, 1, reject.stderr);
    assert.match(reject.stderr, /Root on Linux is required|Usage: root install-session.sh/);
    assert.equal(reject.stdout, "");
  },
);
