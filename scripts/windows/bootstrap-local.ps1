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

Push-Location $TargetPath
try {
  $OriginUrl = (& git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or $OriginUrl -ne $RepositoryUrl) {
    throw "O remote origin não corresponde ao repositório Descomplica CRM. Encontrado: $OriginUrl"
  }

  $DirtyState = & git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível verificar o estado Git local."
  }

  if ($DirtyState) {
    $BackupLabel = "codex-auto-backup-before-bootstrap-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
    Invoke-Native git stash push --include-untracked --message $BackupLabel
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
  $AvailableModels = @($Catalog.models | ForEach-Object { $_.slug })

  if ($AvailableModels -contains "gpt-6-astra") {
    $SelectedModel = "gpt-6-astra"
    $ReasoningEffort = "low"
  }
  elseif ($AvailableModels -contains "gpt-5.6-sol") {
    $SelectedModel = "gpt-5.6-sol"
    $ReasoningEffort = "medium"
    Write-Warning "GPT-6 Astra ainda não está liberada nesta conta. GPT-5.6 Sol foi mantida como fallback funcional."
  }
  else {
    throw "Nem GPT-6 Astra nem GPT-5.6 Sol aparecem no catálogo desta conta."
  }

  $CodexDirectory = Join-Path $TargetPath ".codex"
  New-Item -ItemType Directory -Force -Path $CodexDirectory | Out-Null
  $ConfigPath = Join-Path $CodexDirectory "config.toml"
  $ConfigText = @"
# Gerado por scripts/windows/bootstrap-local.ps1.
model = "$SelectedModel"
model_reasoning_effort = "$ReasoningEffort"
"@
  [System.IO.File]::WriteAllText($ConfigPath, $ConfigText, [System.Text.UTF8Encoding]::new($false))

  $NodeReady = $false
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeVersion = (& node --version).TrimStart("v")
    $NodeReady = $NodeVersion.StartsWith("24.19.")
  }

  if (-not $NodeReady -and (Get-Command nvm -ErrorAction SilentlyContinue)) {
    Invoke-Native nvm install $RequiredNode
    Invoke-Native nvm use $RequiredNode
    $NodeVersion = (& node --version).TrimStart("v")
    $NodeReady = $NodeVersion.StartsWith("24.19.")
  }

  if (-not $NodeReady) {
    throw "Instale o Node 24.19.x (ou o NVM para Windows) e execute novamente."
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
  Write-Host "Modelo selecionado: $SelectedModel ($ReasoningEffort)"
  if ($BackupLabel) {
    Write-Host "Alterações locais anteriores foram preservadas no stash: $BackupLabel"
  }
}
finally {
  Pop-Location
}
