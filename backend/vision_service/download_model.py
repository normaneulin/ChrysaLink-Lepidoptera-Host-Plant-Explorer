#!/usr/bin/env python3
"""
Download the model files from Hugging Face and copy them into `iNatAPI/naturalia`.

Run from this folder:
  python download_model.py

Requires: `huggingface_hub` installed in the active environment and optionally
the env var HUGGINGFACE_TOKEN set if the model requires authentication.
"""
import os
import shutil
from pathlib import Path
from huggingface_hub import hf_hub_download


REPO = "joshvm/inaturalist_sgd_4k"
FILES = ["inat_sgd_6k.pth", "MetaFG_2_384_inat.yaml", "inat_sgd_names.txt"]


def main():
    script_path = Path(__file__).resolve()
    # Place downloaded files into the vendored naturalia folder inside this service
    script_dir = script_path.parent
    target_dir = script_dir / "naturalia"
    target_dir.mkdir(parents=True, exist_ok=True)

    token = os.environ.get("HUGGINGFACE_TOKEN")
    if not token:
        print("HUGGINGFACE_TOKEN not set in environment. If the repo is private, set it and re-run.")
        token = None  # Pass None instead of empty string to avoid Bearer auth issues

    for fname in FILES:
        print(f"Downloading {fname} from {REPO} ...")
        try:
            cached_path = hf_hub_download(repo_id=REPO, filename=fname, token=token)
        except Exception as e:
            print(f"Failed to download {fname}: {e}")
            return 1

        dest = target_dir / fname
        try:
            shutil.copy(cached_path, dest)
            print(f"Copied to {dest}")
        except Exception as e:
            print(f"Failed to copy to {dest}: {e}")
            return 1

    print("All files downloaded and copied to:", target_dir)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
