import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { userInfo } from "node:os";
import { constants } from "node:fs";
import test from "node:test";
import { createCredentialVault } from "./credential-vault.mjs";

test(
  "dedicated Linux vault publishes through a real directory descriptor without reading the private key",
  {
    skip: process.platform !== "linux" || userInfo().username !== "descomplica-qlik",
  },
  async (t) => {
    const home = "/var/lib/descomplica-qlik";
    await assert.rejects(access("/etc/descomplica-qlik/private.pem", constants.R_OK), {
      code: "EACCES",
    });
    const directory = await mkdtemp(`${home}/.vault-qa-`);
    t.after(() => rm(directory, { recursive: true }));
    const vault = createCredentialVault({
      paths: {
        home,
        directory,
        keyDirectory: "/etc/descomplica-qlik",
        publicKey: "/etc/descomplica-qlik/vault-public.pem",
      },
    });
    assert.deepEqual(await vault.credentialStatus(), { saved: false });
    const synthetic = {
      username: "synthetic-qa@example.test",
      password: "synthetic-only-qa-credential",
    };
    assert.deepEqual(await vault.saveCredentials(synthetic), { saved: true });
    assert.deepEqual(await vault.credentialStatus(), { saved: true });
    const file = `${directory}/qlik.enc.json`;
    const info = await stat(file);
    assert.equal(info.mode & 0o777, 0o600);
    assert.equal(info.uid, process.getuid());
    assert.equal(info.nlink, 1);
    const encrypted = await readFile(file, "utf8");
    assert.ok(!encrypted.includes(synthetic.username));
    assert.ok(!encrypted.includes(synthetic.password));
    await assert.rejects(vault.saveCredentials(synthetic), { code: "credential_exists" });
  },
);
