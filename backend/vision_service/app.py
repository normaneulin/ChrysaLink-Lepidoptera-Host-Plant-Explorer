import os
import io
import base64
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from huggingface_hub import hf_hub_download
import logging

# Ensure the project path imports the cloned Space code
import sys
from pathlib import Path
THIS_DIR = Path(__file__).resolve().parent
ROOT = THIS_DIR.parent.parent
# Prefer a vendored copy under backend/vision_service/naturalia if present,
# otherwise fall back to the top-level cloned path at ../iNatAPI/naturalia
VENDORED = THIS_DIR / 'naturalia'
# Enforce vendored folder. Create it if missing; downloads will place files here.
NATURALIA_DIR = VENDORED
if str(NATURALIA_DIR) not in sys.path:
    sys.path.insert(0, str(NATURALIA_DIR))

from inference import Inference

app = FastAPI(title="iNat Vision Service")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("inat-vision-service")

# Config defaults (match Space)
HF_REPO = os.environ.get('HF_MODEL_REPO', 'joshvm/inaturalist_sgd_4k')
MODEL_FILE = os.environ.get('HF_MODEL_FILE', 'inat_sgd_6k.pth')
CFG_FILE = os.environ.get('HF_CONFIG_FILE', 'MetaFG_2_384_inat.yaml')
NAMES_FILE = os.environ.get('HF_NAMES_FILE', 'inat_sgd_names.txt')
HUGGINGFACE_TOKEN = os.environ.get('HUGGINGFACE_TOKEN')

# Lazy-loaded inference model (load on first request to avoid OOM on startup)
inference_model: Optional[Inference] = None
model_init_lock = asyncio.Lock()

class PredictRequest(BaseModel):
    imageUrl: Optional[str] = None
    imageBase64: Optional[str] = None
    top_k: Optional[int] = 10

# --- HEALTH CHECK ENDPOINT ---
@app.get("/health")
async def health_check():
    """Simple health endpoint used by load balancers and Render to verify service is up."""
    return {"status": "ok"}

async def ensure_model_loaded():
    """Lazy-load the model on first request to avoid OOM during startup."""
    global inference_model
    
    if inference_model is not None:
        return
    
    async with model_init_lock:
        # Double-check pattern: another coroutine may have loaded while we waited for the lock
        if inference_model is not None:
            return
        
        try:
            log.info('Lazy-loading model on first request...')
            token = HUGGINGFACE_TOKEN
            if not token:
                log.warning('HUGGINGFACE_TOKEN not set; hf_hub_download may fail for private models')

            # Ensure the vendored directory exists and download missing files if needed
            NATURALIA_DIR.mkdir(parents=True, exist_ok=True)
            import shutil

            def _fetch_to_vendor(filename):
                dest = NATURALIA_DIR / filename
                if dest.exists():
                    return str(dest)
                if hf_hub_download is None:
                    raise RuntimeError('huggingface_hub not available to download files')
                log.info(f'Downloading {filename}...')
                downloaded = hf_hub_download(repo_id=HF_REPO, filename=filename, token=token)
                shutil.copy(downloaded, dest)
                log.info(f'Downloaded {filename} to {dest}')
                return str(dest)

            model_path = _fetch_to_vendor(MODEL_FILE)
            cfg_path = _fetch_to_vendor(CFG_FILE)
            names_path = _fetch_to_vendor(NAMES_FILE)

            log.info(f'Model path: {model_path}, cfg: {cfg_path}, names: {names_path}')

            # Initialize the Inference class (this can be slow ~30-60s)
            loop = asyncio.get_event_loop()
            def init():
                return Inference(config_path=cfg_path, model_path=model_path, names_path=names_path)
            inference_model = await loop.run_in_executor(None, init)
            log.info('Inference model loaded and ready')
        except Exception as e:
            log.exception('Failed to initialize model: %s', e)
            inference_model = None
            raise

@app.post('/predict')
async def predict(req: PredictRequest):
    # Lazy-load model on first request
    await ensure_model_loaded()
    
    if inference_model is None:
        # If model failed to initialize, allow a MOCK_MODE to return deterministic sample predictions
        mock_mode = os.environ.get('MOCK_MODE', '').lower() in ('1', 'true', 'yes')
        if mock_mode:
            # Try to read local names file for realistic labels
            sample_labels = []
            try:
                with open(NATURALIA_DIR / 'names_mf2.txt', 'r', encoding='utf-8') as f:
                    sample_labels = [l.strip() for l in f.readlines() if l.strip()]
            except Exception:
                sample_labels = ['Danaus plexippus', 'Papilio machaon', 'Pieris rapae', 'Vanessa atalanta', 'Morpho peleides']

            k = req.top_k or 5
            out = []
            for i, lab in enumerate(sample_labels[:k]):
                out.append({'label': lab, 'score': float(1.0 / (i + 1))})
            return {'success': True, 'data': out}

        raise HTTPException(status_code=503, detail='Model not initialized')

    # Obtain PIL Image
    if not req.imageUrl and not req.imageBase64:
        raise HTTPException(status_code=400, detail='imageUrl or imageBase64 required')

    img = None
    try:
        if req.imageBase64:
            # Accept data URL or raw base64
            b = req.imageBase64
            if b.startswith('data:'):
                b = b.split(',', 1)[1]
            img_bytes = base64.b64decode(b)
            img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        else:
            # requests will be used inside inference if string given, but we want to pass PIL to avoid duplicate downloads
            from requests import get
            resp = get(req.imageUrl, stream=True, timeout=20)
            resp.raise_for_status()
            img = Image.open(resp.raw).convert('RGB')
    except Exception as e:
        log.exception('Failed to load image: %s', e)
        raise HTTPException(status_code=400, detail=f'Failed to load image: {e}')

    # Run inference in threadpool because PyTorch is blocking
    loop = asyncio.get_event_loop()
    def run_infer():
        try:
            # Inference.infer expects img_path or image object and meta_data_path
            res = inference_model.infer(img_path=img, meta_data_path=str(NATURALIA_DIR / 'meta.txt'), topk=req.top_k)
            return res
        except Exception as e:
            log.exception('Inference failed: %s', e)
            raise

    try:
        raw = await loop.run_in_executor(None, run_infer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Inference error: {e}')

    # Normalize output: support several shapes (dict, list-of-dict, list of [label,score])
    normalized = []
    try:
        if isinstance(raw, dict):
            # raw mapping label->score (ordered descending)
            for label, score in raw.items():
                normalized.append({'label': label, 'score': float(score)})
        elif isinstance(raw, list):
            # Sometimes returns [{label:score, ...}]
            first = raw[0] if len(raw) > 0 else None
            if isinstance(first, dict):
                # convert dict to list by items
                for label, score in first.items():
                    normalized.append({'label': label, 'score': float(score)})
            elif isinstance(first, list) and len(first) > 0 and isinstance(first[0], (list, tuple)):
                # list of [label,score]
                for item in first:
                    normalized.append({'label': str(item[0]), 'score': float(item[1])})
            else:
                # unknown list shape, attempt to coerce
                for item in raw:
                    if isinstance(item, dict) and 'label' in item:
                        normalized.append({'label': item.get('label'), 'score': float(item.get('score', 0))})
        else:
            # fallback
            normalized = [{'label': str(raw), 'score': 0}]
    except Exception as e:
        log.exception('Failed to normalize inference output: %s', e)
        normalized = [{'label': str(raw), 'score': 0}]

    return { 'success': True, 'data': normalized }