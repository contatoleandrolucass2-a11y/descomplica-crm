import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`./vps/${file}`, import.meta.url), "utf8");

test("remote browser is non-root, supervised, persistent and sandboxed", async () => {
  const unit = await read("descomplica-salesforce-browser.service");
  assert.match(unit, /^User=descomplica-salesforce$/m);
  assert.match(unit, /launch-dedicated-chrome\.mjs --supervised/);
  assert.match(unit, /--auth-file=\/run\/descomplica-salesforce\/Xauthority/);
  assert.match(unit, /-nolisten tcp/);
  assert.match(unit, /^Restart=always$/m);
  assert.match(unit, /^KillMode=control-group$/m);
  assert.match(unit, /^RuntimeDirectoryMode=0700$/m);
  assert.match(unit, /SALESFORCE_CHROME_PROFILE=\/var\/lib\/descomplica-salesforce\/chrome/);
  assert.doesNotMatch(unit, /--no-sandbox|--disable-setuid-sandbox|-ac\b|User=root/);
});

test("console binds only loopback, requires VNC authentication and is not enabled at boot", async () => {
  const vnc = await read("descomplica-salesforce-vnc.service");
  const web = await read("descomplica-salesforce-web.service");
  const target = await read("descomplica-salesforce-console.target");
  assert.match(
    vnc,
    /-localhost -rfbport 5909 -rfbauth \/var\/lib\/descomplica-salesforce\/vnc.passwd/,
  );
  assert.match(vnc, /-auth \/run\/descomplica-salesforce\/Xauthority/);
  assert.match(vnc, /-noclipboard -nosetclipboard/);
  assert.match(web, /127\.0\.0\.1:6080 127\.0\.0\.1:5909/);
  for (const unit of [vnc, web, target]) {
    assert.doesNotMatch(unit, /WantedBy=|0\.0\.0\.0|\[::\]|-nopw|password=/);
  }
  for (const unit of [vnc, web]) {
    assert.match(unit, /^PartOf=descomplica-salesforce-console.target$/m);
    assert.match(unit, /^NoNewPrivileges=true$/m);
  }
});

test("monitor is session-only and installer leaves everything stopped", async () => {
  const monitor = await read("descomplica-salesforce-monitor.service");
  const installer = await read("install-session.sh");
  assert.match(
    monitor,
    /ExecStart=\/usr\/local\/bin\/node ops\/salesforce\/connection-monitor.mjs/,
  );
  assert.doesNotMatch(monitor, /export-candidate|run-every-30-minutes|publish-candidate/);
  assert.match(installer, /SALESFORCE_STATUS_ENABLED=false/);
  assert.match(installer, /SALESFORCE_N8N_PUBLISH_ENABLED=false/);
  assert.doesNotMatch(installer, /systemctl (?:enable|start|restart)|production\.env|docker /);
  assert.match(installer, /Existing installation found/);
  assert.match(installer, /Release SHA mismatch/);
  assert.match(installer, /--untracked-files=no/);
  assert.match(installer, /readonly node=\/usr\/local\/bin\/node/);
  assert.match(installer, /readonly units=\(/);
  assert.match(installer, /git -C "\$release" show "\$1:ops\/salesforce\/vps\/\$unit"/);
  assert.match(installer, /Unexpected unit in release/);
  assert.doesNotMatch(installer, /for unit in "\$source_dir"\/\*/);
  assert.match(installer, /randomBytes\(48\)/);
  assert.match(installer, /\['-f'\], \{input:password/);
  assert.doesNotMatch(installer, /console\.log\(password|--password|--no-sandbox/);
});

test("prerequisites verify the official signing key without global upgrades", async () => {
  const installer = await read("install-prerequisites.sh");
  assert.match(installer, /EB4C1BFD4F042F6DDDCCEC917721F63BD38B4796/);
  assert.match(installer, /"\$primary_fingerprints" == EB4C1BFD4F042F6DDDCCEC917721F63BD38B4796/);
  assert.match(installer, /Unexpected primary signing key; repository unchanged/);
  assert.match(installer, /signed-by=\$key/);
  assert.match(installer, /NEEDRESTART_MODE=l/);
  assert.doesNotMatch(
    installer,
    /apt-get (?:upgrade|dist-upgrade)|trusted=yes|--allow-unauthenticated/,
  );
});

test("session allowlist excludes the separately installed collector and gateway remains opt-in", async () => {
  const installer = await read("install-session.sh");
  const entries = await readdir(new URL("./vps/", import.meta.url));
  const collector = "descomplica-salesforce-collector.service";
  const expected = entries
    .filter((file) => /\.(service|target)$/.test(file) && file !== collector)
    .sort();
  const match = installer.match(/readonly units=\(\s*([^)]+)\)/);
  assert.ok(match, "Explicit unit allowlist required");
  const units = match[1].trim().split(/\s+/).sort();
  assert.deepEqual(units, expected);
  assert.equal(units.length, 6);
  assert.ok(!units.includes(collector));
  assert.match(installer, /! -name 'descomplica-salesforce-collector\.service'/);
  assert.equal(new Set(units).size, units.length);
  assert.ok(units.includes("descomplica-salesforce-gateway.service"));
  assert.match(installer, /\[--with-console-gateway\]/);
  assert.match(installer, /^install_gateway=false$/m);
  assert.match(installer, /\[\[ \$2 == --with-console-gateway \]\] \|\| fail/);
  assert.match(
    installer,
    /if \[\[ \$unit == descomplica-salesforce-gateway\.service && \$install_gateway != true \]\]; then\s+continue/,
  );
  assert.match(installer, /if \[\[ \$install_gateway == true \]\]; then\s+ports\+=\(6081\)/);
  assert.match(installer, /node_modules\/ws\/wrapper\.mjs/);
  assert.match(
    installer,
    /if \[\[ \$install_gateway == true \]\]; then\s+printf '%s\\n' 'SALESFORCE_CONSOLE_ORIGIN=https:\/\/crm\.descomplicapro\.com\.br' > \/etc\/descomplica-salesforce\/gateway\.env\s+chmod 0600 \/etc\/descomplica-salesforce\/gateway\.env/,
  );
  assert.match(installer, /cmp -- "\$source_dir\/\$unit"/);
  assert.match(installer, /\[\[ -f "\$source_dir\/\$unit" && ! -L "\$source_dir\/\$unit" \]\]/);
  assert.doesNotMatch(installer, /systemctl (?:enable|start|restart)/);
});
