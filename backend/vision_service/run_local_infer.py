#!/usr/bin/env python3
r"""
Run a one-off local inference using the cloned `iNatAPI/naturalia` model code.

Usage:
    python run_local_infer.py --image "C:/Users/LENOVO/Downloads/butterfly.jpg" --topk 5

If model files are missing, this script will attempt to download them from the
Hugging Face repo `joshvm/inaturalist_sgd_4k` using the `HUGGINGFACE_TOKEN`
environment variable (if set).
"""
import argparse
import os
import shutil
from pathlib import Path
import sys

try:
    from huggingface_hub import hf_hub_download
except Exception:
    hf_hub_download = None

# Enforce using the vendored `naturalia` directory inside this folder only.
# This script will create `backend/vision_service/naturalia` if missing and
# will download any missing support files into that folder (weights are
# intentionally large and will be downloaded only when needed).
THIS_DIR = Path(__file__).resolve().parent
# Use the vendored `naturalia` directory inside this folder
NATURALIA_DIR = THIS_DIR / 'naturalia'
if str(NATURALIA_DIR) not in sys.path:
    sys.path.insert(0, str(NATURALIA_DIR))

try:
    from inference import Inference
except Exception as e:
    print('Failed to import `inference` from vendored directory:', NATURALIA_DIR)
    print('sys.path contains:', '\n'.join(sys.path[:5]))
    print('Original error:', e)
    raise

REPO = 'joshvm/inaturalist_sgd_4k'
FILES = {
    'model': 'inat_sgd_6k.pth',
    'cfg': 'MetaFG_2_384_inat.yaml',
    'names': 'inat_sgd_names.txt',
}


def ensure_files(token=None):
    # Ensure the directory exists (create vendored path if chosen)
    NATURALIA_DIR.mkdir(parents=True, exist_ok=True)
    for key, fname in FILES.items():
        dest = NATURALIA_DIR / fname
        if dest.exists():
            print(f'{fname} already present at {dest}')
            continue
        if hf_hub_download is None:
            raise RuntimeError(f'{fname} missing and huggingface_hub not installed')
        print(f'Downloading {fname} from {REPO}...')
        path = hf_hub_download(repo_id=REPO, filename=fname, token=token)
        shutil.copy(path, dest)
        print(f'Copied to {dest}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', '-i', required=True, help='Local image path')
    ap.add_argument('--topk', '-k', type=int, default=5)
    ap.add_argument('--no-download', action='store_true', help="Don't attempt to download missing files")
    args = ap.parse_args()

    token = os.environ.get('HUGGINGFACE_TOKEN')
    if not args.no_download:
        try:
            ensure_files(token=token)
        except Exception as e:
            print('Failed to ensure model files into vendored folder:', e)
            print('You can set --no-download and provide local files manually in backend/vision_service/naturalia')
            return 2

    model_path = NATURALIA_DIR / FILES['model']
    cfg_path = NATURALIA_DIR / FILES['cfg']
    names_path = NATURALIA_DIR / FILES['names']

    if not model_path.exists():
        print('Model file missing in vendored folder:', model_path)
        print('Run without --no-download or place the model file into backend/vision_service/naturalia')
        return 3

    # Instantiate model (this may take time)
    print('Initializing Inference... (this may take a while)')
    inf = Inference(config_path=str(cfg_path), model_path=str(model_path), names_path=str(names_path))

    print('Running inference on', args.image)
    res = inf.infer(img_path=args.image, meta_data_path=str(NATURALIA_DIR / 'meta.txt'), topk=args.topk)

    print('\nPredictions:')
    # res may be dict or list; normalize for display
    if isinstance(res, dict):
        # dict: label->score (ordered descending in that implementation)
        for i, (lab, score) in enumerate(res.items(), start=1):
            print(f'{i}. {lab}: {score:.6f}')
    elif isinstance(res, list):
        # list of dicts or list of [label,score]
        first = res[0] if len(res) > 0 else None
        if isinstance(first, dict):
            # e.g., [ {label:score, ...} ]
            items = list(first.items())
            for i, (lab, score) in enumerate(items[: args.topk], start=1):
                print(f'{i}. {lab}: {score:.6f}')
        elif isinstance(first, (list, tuple)):
            for i, item in enumerate(first[: args.topk], start=1):
                print(f'{i}. {item[0]}: {float(item[1]):.6f}')
        else:
            print(res)
    else:
        print(res)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
