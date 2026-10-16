import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildChromeArguments,
  prepareMetaAdsProfile,
  PROFILE_DIRECTORY,
} from "../launch-dedicated-chrome.mjs";
import { META_ADS_MANAGER_URL } from "../session-contract.mjs";

const read = (file) => readFile(new URL(`./${file}`, import.meta.url), "utf8");

test("browser starts exactly the approved account in a dedicated persistent sandboxed profile", () => {
  const args = buildChromeArguments();
  assert.ok(args.includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(args.includes("--remote-debugging-port=9224"));
  assert.ok(args.includes(`--user-data-dir=${PROFILE_DIRECTORY}`));
  assert.equal(args.at(-1), META_ADS_MANAGER_URL);
  assert.doesNotMatch(
    args.join(" "),
    /salesforce|--no-sandbox|--disable-setuid-sandbox|redirect_session_id/,
  );
});

test("profile marker refuses personal profiles, symlinks and permissive directories", async (t) => {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "meta-profile-test-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = path.join(directory, "chrome");
  assert.equal(await prepareMetaAdsProfile(profile), profile);
  assert.equal(await prepareMetaAdsProfile(profile), profile);
  const personal = path.join(directory, "personal");
  await mkdir(personal, { mode: 0o700 });
  await writeFile(path.join(personal, "History"), "synthetic");
  await assert.rejects(prepareMetaAdsProfile(personal), /unmarked/);
  const link = path.join(directory, "link");
  await symlink(profile, link);
  await assert.rejects(prepareMetaAdsProfile(link), /private directory/);
  await chmod(profile, 0o755);
  await assert.rejects(prepareMetaAdsProfile(profile), /private directory/);
  await chmod(directory, 0o755);
  await assert.rejects(prepareMetaAdsProfile(profile), /parent must be private/);
});

test("services isolate Meta user, display and ports without altering Salesforce", async () => {
  const browser = await read("descomplica-meta-ads-browser.service");
  const vnc = await read("descomplica-meta-ads-vnc.service");
  const monitor = await read("descomplica-meta-ads-monitor.service");
  for (const unit of [browser, vnc, monitor]) {
    assert.match(unit, /^User=descomplica-meta-ads$/m);
    assert.match(unit, /^LimitCORE=0$/m);
    assert.doesNotMatch(unit, /descomplica-salesforce|User=root|--no-sandbox|-nopw|0\.0\.0\.0/);
  }
  assert.match(browser, /--server-num=101/);
  assert.match(browser, /--auth-file=\/run\/descomplica-meta-ads\/Xauthority/);
  assert.match(browser, /-nolisten tcp/);
  assert.match(browser, /^KillMode=control-group$/m);
  assert.match(browser, /^RuntimeDirectoryMode=0700$/m);
  assert.match(
    vnc,
    /-localhost -rfbport 5911 -rfbauth \/var\/lib\/descomplica-meta-ads\/vnc.passwd/,
  );
  assert.match(vnc, /-noclipboard -nosetclipboard/);
  assert.match(monitor, /EnvironmentFile=\/etc\/descomplica-meta-ads\/monitor.env/);
  assert.match(monitor, /ops\/meta-ads\/connection-monitor.mjs/);
});

test("installer is first-only, validates fixed release and dependencies, never starts services", async () => {
  const installer = await read("install-session.sh");
  const entries = (await readdir(new URL("./", import.meta.url)))
    .filter((file) => /\.(?:service|target)$/.test(file))
    .sort();
  const match = installer.match(/readonly units=\(\s*([^)]+)\)/);
  assert.deepEqual(match[1].trim().split(/\s+/).sort(), entries);
  assert.equal(entries.length, 4);
  for (const required of [
    "Release SHA mismatch",
    "--untracked-files=all",
    "Existing installation found",
    "Display :101 is occupied",
    "for port in 9224 5911 6083",
    "META_ADS_STATUS_ENABLED=false",
    "randomBytes(48)",
    "mode:0o600, flag:'wx'",
    "getent passwd descomplica-meta-ads",
    "getent group descomplica-meta-ads",
  ])
    assert.ok(installer.includes(required), required);
  assert.match(installer, /cmp -s -- "\$file"/);
  assert.match(installer, /\['-f'\], \{input:password/);
  assert.doesNotMatch(
    installer,
    /systemctl (?:enable|start|restart)|production\.env|docker |apt-get|descomplica-salesforce|console\.log\(password|--password/,
  );
});

test("installer validates immutable code and dependencies before non-root import and unit installation", async () => {
  const installer = await read("install-session.sh");
  const account = installer.indexOf("useradd --system");
  const probe = installer.indexOf('(cd "$release" && runuser -u descomplica-meta-ads');
  const units = installer.indexOf('install -o root -g root -m 0644 "$staging/$unit"');
  assert.ok(account > 0 && probe > account && units > probe);
  assert.doesNotMatch(installer.slice(0, account), /await import\(/);
  assert.match(installer, /unset NODE_OPTIONS NODE_PATH/);
  assert.match(installer, /realpath -e "\$\{BASH_SOURCE\[0\]\}"/);
  for (const file of [
    "ops/meta-ads/console-gateway.mjs",
    "ops/meta-ads/connection-monitor.mjs",
    "ops/meta-ads/launch-dedicated-chrome.mjs",
    "ops/meta-ads/session-contract.mjs",
    "ops/salesforce/launch-dedicated-chrome.mjs",
    "ops/salesforce/browser-session.mjs",
    "ops/salesforce/private-file.mjs",
  ])
    assert.ok(installer.includes(file), file);
  assert.match(installer, /info\.uid !== 0/);
  assert.match(installer, /!within\(target\) \|\| !within\(realpathSync\(current\)\)/);
  assert.match(installer, /info\.nlink !== 1/);
  assert.match(installer, /setfacl --no-mask --modify=user:descomplica-meta-ads:--x/);
  assert.match(installer, /runuser -u descomplica-meta-ads -- \/usr\/bin\/test -x/);
  assert.match(installer, /runuser -u descomplica-meta-ads -- \/usr\/bin\/test -r/);
  assert.match(installer, /env -i PATH="\$PATH"/);
  assert.match(
    installer,
    /Dedicated user cannot load the approved release\. No units were installed/,
  );
});

test("Nginx example exposes only the authenticated WebSocket gateway", async () => {
  const config = await read("nginx-console.conf.example");
  assert.match(config, /location = \/meta-ads-console\/socket/);
  assert.match(config, /proxy_pass http:\/\/127.0.0.1:6083;/);
  assert.match(config, /proxy_set_header Origin \$http_origin;/);
  assert.match(config, /proxy_set_header Cookie \$http_cookie;/);
  assert.doesNotMatch(config, /9224|5911|listen|password/);
});
