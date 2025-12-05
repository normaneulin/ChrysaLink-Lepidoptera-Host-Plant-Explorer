<#
Vendor (copy) the `iNatAPI/naturalia` folder into `backend/vision_service/naturalia`.

Usage:
  Open PowerShell at the repo root and run:
    .\backend\vision_service\vendor_naturalia.ps1

This script copies all files (recursively) except `.git` and `__pycache__`.
#>

Set-StrictMode -Version Latest
# Compute paths relative to the script file so the script works from any CWD
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = Resolve-Path (Join-Path $scriptDir "..\..")
$src = Join-Path $root "iNatAPI\naturalia"
$dst = Join-Path $scriptDir "naturalia"

if (-not (Test-Path $src)) {
    if (Test-Path $dst) {
        Write-Host "No top-level iNatAPI/naturalia found; vendored copy already present at $dst"
        exit 0
    }
    Write-Error "Source not found: $src. Nothing to vendor."
    exit 1
}

Write-Host "Copying $src -> $dst"
if (Test-Path $dst) {
    Write-Host "Removing existing destination $dst"
    Remove-Item -Recurse -Force $dst
}

# Copy recursively
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Get-ChildItem -Path $src -Recurse -Force | Where-Object {
    # Exclude .git, __pycache__ and common model weight files to avoid committing large binaries
    -not (
        ($_.FullName -like "*\\.git*") -or
        ($_.FullName -like "*__pycache__*") -or
        ($_.Extension -in @('.pth', '.pt', '.safetensors'))
    )
} | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\')
    $target = Join-Path $dst $rel
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $target -Force | Out-Null
    } else {
        Copy-Item -Path $_.FullName -Destination $target -Force
    }
}

Write-Host "Vendor copy complete"
