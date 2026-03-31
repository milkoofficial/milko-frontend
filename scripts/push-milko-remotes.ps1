# Push monorepo changes to GitHub backend + frontend remotes (no git subtree knowledge required).
#
# Prerequisites:
#   - Run from repo root OR anywhere (script cd's to milko root).
#   - Commit your work on `main` first: git add -A && git commit -m "..."
#   - Remotes must exist: `backend` -> milko-backend repo, `frontend` -> milko-frontend repo.
#
# What it does:
#   1. git fetch both remotes
#   2. Split each subfolder into a temp branch, merge remote main (keeps any GitHub-only commits),
#      push to origin main, delete temp branch.
#
# If merge conflicts: fix them on the temp branch, complete the merge, push, then checkout main.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

function Invoke-Git {
    param([string[]]$GitArgs)
    Write-Host ("  git " + ($GitArgs -join ' ')) -ForegroundColor DarkGray
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git failed (exit $LASTEXITCODE): git $($GitArgs -join ' ')"
    }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
    Write-Warning "Current branch is '$branch' (expected main). Continue anyway? [y/N]"
    $r = Read-Host
    if ($r -notmatch '^[yY]') { exit 1 }
}

Write-Host "`n=== Fetch backend + frontend ===" -ForegroundColor Cyan
Invoke-Git @('fetch', 'backend', 'main')
Invoke-Git @('fetch', 'frontend', 'main')

# --- Backend ---
Write-Host "`n=== Push backend (prefix: milko-backend-main) ===" -ForegroundColor Cyan
Invoke-Git @('subtree', 'split', '--prefix=milko-backend-main', '-b', '_push_backend')
try {
    Invoke-Git @('checkout', '_push_backend')
    Invoke-Git @('merge', 'backend/main', '-m', 'merge remote backend/main')
    Invoke-Git @('push', 'backend', '_push_backend:main')
}
finally {
    Invoke-Git @('checkout', 'main')
    $has = git branch --list _push_backend
    if ($has) { Invoke-Git @('branch', '-D', '_push_backend') }
}

# --- Frontend ---
Write-Host "`n=== Push frontend (prefix: milko-frontend-main/milko-frontend-main) ===" -ForegroundColor Cyan
Invoke-Git @('subtree', 'split', '--prefix=milko-frontend-main/milko-frontend-main', '-b', '_push_frontend')
try {
    Invoke-Git @('checkout', '_push_frontend')
    Invoke-Git @('merge', 'frontend/main', '-m', 'merge remote frontend/main')
    Invoke-Git @('push', 'frontend', '_push_frontend:main')
}
finally {
    Invoke-Git @('checkout', 'main')
    $has = git branch --list _push_frontend
    if ($has) { Invoke-Git @('branch', '-D', '_push_frontend') }
}

Write-Host "`nDone. Backend + frontend main branches are updated on GitHub." -ForegroundColor Green
