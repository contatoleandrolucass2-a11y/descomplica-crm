import { execFile } from "node:child_process";
import { lstat, chmod } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const WINDOWS_PRIVATE_FILE_ENV = "DESCOMPLICA_SALESFORCE_PRIVATE_FILE";

const WINDOWS_VALIDATE_ACL = String.raw`
$ErrorActionPreference = 'Stop'
$target = $env:DESCOMPLICA_SALESFORCE_PRIVATE_FILE
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$acl = Get-Acl -LiteralPath $target
$allowed = @($identity.User.Value, 'S-1-5-18', 'S-1-5-32-544')
$owner = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
if ($allowed -notcontains $owner) { exit 41 }
foreach ($rule in $acl.Access) {
  if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow) {
    $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
    if ($allowed -notcontains $sid) { exit 42 }
  }
}
`;

const WINDOWS_HARDEN_ACL = String.raw`
$ErrorActionPreference = 'Stop'
$target = $env:DESCOMPLICA_SALESFORCE_PRIVATE_FILE
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$acl = New-Object System.Security.AccessControl.FileSecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner($identity.User)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  $identity.User,
  [System.Security.AccessControl.FileSystemRights]::FullControl,
  [System.Security.AccessControl.AccessControlType]::Allow
)
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $target -AclObject $acl
`;

const WINDOWS_HARDEN_DIRECTORY_ACL = String.raw`
$ErrorActionPreference = 'Stop'
$target = $env:DESCOMPLICA_SALESFORCE_PRIVATE_FILE
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner($identity.User)
$inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  $identity.User,
  [System.Security.AccessControl.FileSystemRights]::FullControl,
  $inheritance,
  [System.Security.AccessControl.PropagationFlags]::None,
  [System.Security.AccessControl.AccessControlType]::Allow
)
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $target -AclObject $acl
`;

function windowsPowerShell(environment) {
  const windowsRoot =
    environment.SystemRoot ?? environment.SYSTEMROOT ?? environment.WINDIR ?? environment.windir;
  if (!windowsRoot || !path.win32.isAbsolute(windowsRoot)) {
    throw new Error("Windows system root is unavailable for private ACL validation");
  }
  return path.win32.join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

async function runWindowsAclScript(
  filePath,
  script,
  { environment = process.env, execFileFn = execFileAsync } = {},
) {
  const executable = windowsPowerShell(environment);
  try {
    await execFileFn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 4_096,
      env: {
        SystemRoot:
          environment.SystemRoot ??
          environment.SYSTEMROOT ??
          environment.WINDIR ??
          environment.windir,
        WINDIR:
          environment.WINDIR ??
          environment.windir ??
          environment.SystemRoot ??
          environment.SYSTEMROOT,
        [WINDOWS_PRIVATE_FILE_ENV]: filePath,
      },
    });
  } catch {
    throw new Error("Salesforce private file does not have an owner-only Windows ACL");
  }
}

export async function assertWindowsPrivateAcl(filePath, options = {}) {
  await runWindowsAclScript(filePath, WINDOWS_VALIDATE_ACL, options);
}

export async function hardenWindowsPrivateAcl(filePath, options = {}) {
  await runWindowsAclScript(filePath, WINDOWS_HARDEN_ACL, options);
}

export async function hardenWindowsPrivateDirectory(directoryPath, options = {}) {
  await runWindowsAclScript(directoryPath, WINDOWS_HARDEN_DIRECTORY_ACL, options);
}

export async function assertPrivateRegularFile(filePath, options = {}) {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Salesforce private file must be a regular file");
  }
  const platform = options.platform ?? process.platform;
  if (platform === "win32") {
    const validateWindowsAcl = options.validateWindowsAcl ?? assertWindowsPrivateAcl;
    await validateWindowsAcl(filePath, options);
  } else if ((metadata.mode & 0o077) !== 0) {
    throw new Error("Salesforce private file must not be accessible by group or others");
  }
  return metadata;
}

export async function hardenPrivateRegularFile(filePath, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform === "win32") {
    const hardenWindowsAcl = options.hardenWindowsAcl ?? hardenWindowsPrivateAcl;
    await hardenWindowsAcl(filePath, options);
  } else {
    await chmod(filePath, 0o600);
  }
  await assertPrivateRegularFile(filePath, options);
}
