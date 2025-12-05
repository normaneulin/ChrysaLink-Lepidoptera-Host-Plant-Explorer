<#
Run the vision service locally in a venv (Windows PowerShell helper).

Usage:
  - Open PowerShell and cd into this folder
  - `.
un-local.ps1` (will create `.venv`, install deps, and start uvicorn)

Notes:
  - This installs a minimal set of Python packages from `requirements.txt`.
  - You must install `torch` separately (see commented section below) or uncomment the torch install lines.
  - If you want to avoid downloading the heavy model during testing, set `MOCK_MODE=true` before running.
#>

param(
    [switch]$Reinstall
)

Set-StrictMode -Version Latest

if (-not (Test-Path .venv) -or $Reinstall) {
    python -m venv .venv
}

# Activate venv for this script
. .\.venv\Scripts\Activate.ps1

pip install --upgrade pip wheel setuptools

# Install CPU torch wheel manually if desired. Example (uncomment to use):
# pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision

# Install service deps (no torch)
pip install -r requirements.txt

# Set HF token in this shell if you have one (optional)
if (-not $env:HUGGINGFACE_TOKEN) {
    Write-Host "HUGGINGFACE_TOKEN not set in this shell. If model download fails, set it and re-run."
}

if (-not $env:MOCK_MODE) {
    Write-Host "MOCK_MODE not set; service will attempt to download and load the model." -ForegroundColor Yellow
} else {
    Write-Host "MOCK_MODE enabled; service will return mock predictions if the model isn't loaded." -ForegroundColor Green
}

uvicorn app:app --host 0.0.0.0 --port 8000
