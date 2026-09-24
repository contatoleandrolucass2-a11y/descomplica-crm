[CmdletBinding()]
param(
  [string]$TargetPath = "C:\Users\Leandro Lucas\Documents\ChatGPT\DESCOMPLICA-CRM"
)

$ErrorActionPreference = "Stop"
$RepositoryUrl = "https://github.com/contatoleandrolucass2-a11y/descomplica-crm.git"
$SyncBranch = "codex/local-bootstrap-gpt6-astra"
$RequiredNode = "24.19.0"
$RequiredPnpm = "11.20.0"
$BackupLabel = $null
$RepositoryBackupPath = $null

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar: $Command $($Arguments -join ' ')"
  }
}

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando obrigatório não encontrado: $Name"
  }
}

function Update-ProcessPath {
  $MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = @($MachinePath, $UserPath) -join ";"
}

function Install-OfficialNode {
  param([Parameter(Mandatory = $true)][string]$Version)

  $DetectedArchitecture = if ($env:PROCESSOR_ARCHITEW6432) {
    $env:PROCESSOR_ARCHITEW6432
  }
  else {
    $env:PROCESSOR_ARCHITECTURE
  }

  $NodeArchitecture = switch ($DetectedArchitecture.ToUpperInvariant()) {
    "AMD64" { "x64" }
    "ARM64" { "arm64" }
    default { throw "Arquitetura do Windows não suportada pelo instalador automático do Node: $DetectedArchitecture" }
  }

  $NodeInstallerName = "node-v$Version-$NodeArchitecture.msi"
  $NodeDownloadBase = "https://nodejs.org/dist/v$Version"
  $NodeInstallerPath = Join-Path $env:TEMP $NodeInstallerName
  $NodeChecksumsPath = Join-Path $env:TEMP "node-v$Version-SHASUMS256.txt"

  Write-Host "Baixando Node $Version ($NodeArchitecture) do site oficial..."
  Invoke-WebRequest -UseBasicParsing -Uri "$NodeDownloadBase/$NodeInstallerName" -OutFile $NodeInstallerPath
  Invoke-WebRequest -UseBasicParsing -Uri "$NodeDownloadBase/SHASUMS256.txt" -OutFile $NodeChecksumsPath

  $ChecksumLine = Get-Content -LiteralPath $NodeChecksumsPath |
    Where-Object { $_ -match "\s+$([Regex]::Escape($NodeInstallerName))$" } |
    Select-Object -First 1
  if (-not $ChecksumLine) {
    throw "O checksum oficial do instalador $NodeInstallerName não foi encontrado."
  }

  $ExpectedChecksum = ($ChecksumLine -split "\s+")[0].ToUpperInvariant()
  $ActualChecksum = (Get-FileHash -LiteralPath $NodeInstallerPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($ActualChecksum -ne $ExpectedChecksum) {
    throw "A verificação SHA-256 do instalador oficial do Node falhou."
  }

  Write-Host "Instalando Node $Version..."
  $InstallerArguments = "/i `"$NodeInstallerPath`" /qn /norestart"
  $InstallerProcess = Start-Process -FilePath "msiexec.exe" -ArgumentList $InstallerArguments -Wait -PassThru
  if ($InstallerProcess.ExitCode -notin @(0, 3010)) {
    throw "O instalador do Node terminou com o código $($InstallerProcess.ExitCode)."
  }

  Update-ProcessPath
}

Require-Command "git"
Require-Command "codex"

if (-not (Test-Path -LiteralPath $TargetPath)) {
  $TargetParent = Split-Path -Parent $TargetPath
  New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null
  Invoke-Native git clone --branch $SyncBranch --single-branch $RepositoryUrl $TargetPath
}

if (-not (Test-Path -LiteralPath (Join-Path $TargetPath ".git"))) {
  throw "A pasta existe, mas não é um repositório Git: $TargetPath"
}

$LocationPushed = $false
Push-Location $TargetPath
$LocationPushed = $true
try {
  $RemoteNames = @(& git remote)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível consultar os remotes do repositório local."
  }

  if ($RemoteNames -contains "origin") {
    $OriginOutput = & git remote get-url origin
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível consultar a URL do remote origin."
    }
    $OriginUrl = ($OriginOutput | Out-String).Trim()
  }
  else {
    Invoke-Native git remote add origin $RepositoryUrl
    $OriginUrl = $RepositoryUrl
  }

  if ($OriginUrl -ne $RepositoryUrl) {
    throw "O remote origin não corresponde ao repositório Descomplica CRM. Encontrado: $OriginUrl"
  }

  $BranchState = @(& git status --porcelain=v2 --branch)
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível verificar a referência HEAD local."
  }
  $HeadState = @($BranchState | Where-Object { $_ -like "# branch.oid *" })
  $RepositoryHasHead = $HeadState.Count -eq 1 -and $HeadState[0] -ne "# branch.oid (initial)"
  $DirtyState = & git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível verificar o estado Git local."
  }

  if ($DirtyState -and $RepositoryHasHead) {
    $BackupLabel = "codex-auto-backup-before-bootstrap-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
    Invoke-Native git stash push --include-untracked --message $BackupLabel
  }
  elseif ($DirtyState) {
    $RepositoryBackupPath = "$TargetPath-backup-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
    Pop-Location
    $LocationPushed = $false
    Move-Item -LiteralPath $TargetPath -Destination $RepositoryBackupPath
    Invoke-Native git clone --branch $SyncBranch --single-branch $RepositoryUrl $TargetPath
    Push-Location $TargetPath
    $LocationPushed = $true
  }

  Invoke-Native git fetch origin $SyncBranch

  & git show-ref --verify --quiet "refs/heads/$SyncBranch"
  if ($LASTEXITCODE -eq 0) {
    Invoke-Native git switch $SyncBranch
    Invoke-Native git merge --ff-only "origin/$SyncBranch"
  }
  else {
    Invoke-Native git switch --create $SyncBranch --track "origin/$SyncBranch"
  }

  $RawCatalog = (& codex debug models 2>$null | Out-String).Trim()
  if (-not $RawCatalog) {
    throw "O Codex não retornou o catálogo de modelos da conta autenticada."
  }

  $Catalog = $RawCatalog | ConvertFrom-Json
  $CatalogModels = @($Catalog.models)
  $AvailableModels = @($CatalogModels | ForEach-Object { $_.slug } | Where-Object { $_ })
  $AstraModel = $CatalogModels |
    Where-Object { $_.slug -and ($_.slug -eq "gpt-6-astra" -or $_.display_name -match "Astra") } |
    Select-Object -First 1

  $SelectedModel = $null
  $ReasoningEffort = $null

  if ($AstraModel) {
    $SelectedModel = $AstraModel.slug
    $ReasoningEffort = "low"
  }
  else {
    $FallbackOrder = @(
      "gpt-6-sol",
      "gpt-6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.5"
    )
    $SelectedModel = $FallbackOrder |
      Where-Object { $AvailableModels -contains $_ } |
      Select-Object -First 1
    if ($SelectedModel) {
      $ReasoningEffort = "medium"
      Write-Warning "Astra ainda não está liberada nesta conta. O melhor fallback disponível foi selecionado: $SelectedModel."
    }
    else {
      Write-Warning "Astra não está liberada e nenhum fallback conhecido apareceu. O Codex usará o modelo padrão disponível para esta conta."
      Write-Host "Modelos informados pelo cliente: $($AvailableModels -join ', ')"
    }
  }

  $CodexDirectory = Join-Path $TargetPath ".codex"
  New-Item -ItemType Directory -Force -Path $CodexDirectory | Out-Null
  $ConfigPath = Join-Path $CodexDirectory "config.toml"
  if ($SelectedModel) {
    $ConfigText = @"
# Gerado por scripts/windows/bootstrap-local.ps1.
model = "$SelectedModel"
model_reasoning_effort = "$ReasoningEffort"
"@
  }
  else {
    $ConfigText = @"
# Gerado por scripts/windows/bootstrap-local.ps1.
# O modelo não foi fixado porque a conta deve usar o padrão disponível.
"@
  }
  [System.IO.File]::WriteAllText($ConfigPath, $ConfigText, [System.Text.UTF8Encoding]::new($false))

  $NodeReady = $false
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeVersion = (& node --version).TrimStart("v")
    $NodeReady = $NodeVersion.StartsWith("24.19.")
  }

  if (-not $NodeReady -and (Get-Command nvm -ErrorAction SilentlyContinue)) {
    Invoke-Native nvm install $RequiredNode
    Invoke-Native nvm use $RequiredNode
    Update-ProcessPath
    $NodeVersion = (& node --version).TrimStart("v")
    $NodeReady = $NodeVersion.StartsWith("24.19.")
  }

  if (-not $NodeReady) {
    Install-OfficialNode $RequiredNode
    if (Get-Command node -ErrorAction SilentlyContinue) {
      $NodeVersion = (& node --version).TrimStart("v")
      $NodeReady = $NodeVersion.StartsWith("24.19.")
    }
  }

  if (-not $NodeReady) {
    throw "O Node 24.19.x foi instalado, mas ainda não está disponível no PATH. Reinicie o PowerShell e execute novamente."
  }

  Require-Command "corepack"
  Invoke-Native corepack enable
  Invoke-Native corepack prepare "pnpm@$RequiredPnpm" --activate
  Require-Command "pnpm"

  if (-not (Test-Path -LiteralPath (Join-Path $TargetPath ".env.local"))) {
    Copy-Item -LiteralPath (Join-Path $TargetPath ".env.example") -Destination (Join-Path $TargetPath ".env.local")
  }

  Invoke-Native pnpm install --frozen-lockfile
  Invoke-Native pnpm verify

  Write-Host "Projeto local configurado em: $TargetPath"
  if ($SelectedModel) {
    Write-Host "Modelo selecionado: $SelectedModel ($ReasoningEffort)"
  }
  else {
    Write-Host "Modelo selecionado: padrão disponível da conta"
  }
  if ($BackupLabel) {
    Write-Host "Alterações locais anteriores foram preservadas no stash: $BackupLabel"
  }
  if ($RepositoryBackupPath) {
    Write-Host "A pasta Git sem commit inicial foi preservada em: $RepositoryBackupPath"
  }
}
finally {
  if ($LocationPushed) {
    Pop-Location
  }
}
