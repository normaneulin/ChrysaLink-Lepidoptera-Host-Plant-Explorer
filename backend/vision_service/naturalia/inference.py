from transformers import AutoTokenizer, AutoModel
import torch
from PIL import Image
from config import get_inference_config
from models import build_model
from torch.autograd import Variable
from torchvision.transforms import transforms
import numpy as np
import argparse
from pycocotools.coco import COCO
import requests
import os
from tqdm.auto import tqdm

try:
    from apex import amp
except ImportError:
    amp = None

IMAGENET_DEFAULT_MEAN = (0.485, 0.456, 0.406)
IMAGENET_DEFAULT_STD = (0.229, 0.224, 0.225)


class Namespace:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def model_config(config_path):
    args = Namespace(cfg=config_path)
    config = get_inference_config(args)
    return config


def read_class_names(file_path):
    file = open(file_path, 'r')
    lines = file.readlines()
    class_list = []

    for l in lines:
        line = l.strip()
        # class_list.append(line[0])
        class_list.append(line)

    classes = tuple(class_list)
    return classes


def read_class_names_coco(file_path):
    dataset = COCO(file_path)
    classes =  [dataset.cats[k]['name'] for k in sorted(dataset.cats.keys())]

    with open("names.txt", 'w') as fp:
        for c in classes:
            fp.write(f"{c}\n")

    return classes

class GenerateEmbedding:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
        self.model = AutoModel.from_pretrained("bert-base-uncased")

    def generate(self, text_file):
        text_list = []
        with open(text_file, 'r') as f_text:
            for line in f_text:
                line = line.encode(encoding='UTF-8', errors='strict')
                line = line.replace(b'\xef\xbf\xbd\xef\xbf\xbd', b' ')
                line = line.decode('UTF-8', 'strict')
                text_list.append(line)
            # data = f_text.read()
        select_index = np.random.randint(len(text_list))
        inputs = self.tokenizer(text_list[select_index], return_tensors="pt", padding="max_length",
                                truncation=True, max_length=32)
        outputs = self.model(**inputs)
        embedding_mean = outputs[1].mean(dim=0).reshape(1, -1).detach().numpy()
        embedding_full = outputs[1].detach().numpy()
        embedding_words = outputs[0] # outputs[0].detach().numpy()
        return None, None, embedding_words


class Inference:
    def __init__(self, config_path, model_path, names_path):

        self.config_path = config_path
        self.model_path = model_path
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.classes = read_class_names(names_path)

        self.config = model_config(self.config_path)

        self.model = build_model(self.config)
        # PyTorch 2.6+ defaults weights_only=True; allow loading full checkpoint from trusted source
        self.checkpoint = torch.load(self.model_path, map_location='cpu', weights_only=False)

        if 'model' in self.checkpoint:
            self.model.load_state_dict(self.checkpoint['model'], strict=False)
        else:
            self.model.load_state_dict(self.checkpoint, strict=False)
            
        self.model.eval()
        self.model.to(self.device)
        self.topk = 10
        self.embedding_gen = GenerateEmbedding()

        self.transform_img = transforms.Compose([
            transforms.Resize((self.config.DATA.IMG_SIZE, self.config.DATA.IMG_SIZE), interpolation=Image.BILINEAR),
            transforms.ToTensor(), # transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
            transforms.Normalize(IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD)
        ])

    def infer(self, img_path, meta_data_path, topk=None):

        if isinstance(img_path, str):
            if img_path.startswith("http"):
                img = Image.open(requests.get(img_path, stream=True).raw).convert('RGB')
            else:
                img = Image.open(img_path).convert('RGB')
        else:
            img = img_path
        
        """
        _, _, meta = self.embedding_gen(meta_data_path)
        meta = meta.to(self.device)
        """
        meta = None

        img = self.transform_img(img)
        img.unsqueeze_(0)
        img = img.to(self.device)
        img = Variable(img).to(self.device)
        out = self.model(img, meta)

        f = torch.nn.Softmax(dim=1)
        y_pred = f(out)
        # Convert to a list so we can slice reliably
        indices = torch.argsort(y_pred, dim=1, descending=True).squeeze().tolist()

        if topk is not None:
            predict = [{self.classes[idx]: y_pred.squeeze()[idx].cpu().item() for idx in indices[:topk]}]
            return predict
        else:
            return {self.classes[idx]: y_pred.squeeze()[idx].cpu().item() for idx in indices}


def parse_option():
    parser = argparse.ArgumentParser('MetaFG Inference script', add_help=False)
    parser.add_argument('--cfg', type=str, metavar="FILE", help='path to config file', default="configs/MetaFG_2_224.yaml")
    # easy config modification
    parser.add_argument('--model-path', type=str, help="path to model data", default="ckpt_epoch_12.pth")
    parser.add_argument('--img-path', type=str, help='path to image')
    parser.add_argument('--img-folder', type=str, help='path to image')
    parser.add_argument('--meta-path', default="meta.txt", type=str, help='path to meta data')
    parser.add_argument('--names-path', default="names_mf2.txt", type=str, help='path to meta data')
    args = parser.parse_args()
    return args


if __name__ == '__main__':
    args = parse_option()
    model = Inference(config_path=args.cfg,
                       model_path=args.model_path,
                       names_path=args.names_path)
    
    from glob import glob
    glob_imgs = glob(os.path.join(args.img_folder, "*.jpg"))
    out_dir = f"results_{os.path.splitext(os.path.basename(args.model_path))[0]}"
    os.makedirs(out_dir, exist_ok=True)

    for img in tqdm(glob_imgs):
        try:
            res = model.infer(img_path=img, meta_data_path=args.meta_path)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(e)
            continue
        
        out = {}
        out['preds'] = res

        """
        # Out is a list of (class, score). Return true/false if the top1 class is correct
        out['top1_correct'] = '_'.join(res[0][1].split(' ')).lower() in os.path.basename(img).lower()

        out['top5_correct'] = False
        print(os.path.basename(img).lower())
        for i in range(5):
            out['top5_correct'] |= '_'.join(res[i][1].split(' ')).lower() in os.path.basename(img).lower()
            print('_'.join(res[i][1].split(' ')).lower())
            
        out['top10_correct'] = False
        for i in range(10):
            out['top10_correct'] |= '_'.join(res[i][1].split(' ')).lower() in os.path.basename(img).lower()
        """

        # output json with inference results, use image basename 
        # as filename
        import json
        with open(os.path.join(out_dir, os.path.splitext(os.path.basename(img))[0]+".json"), 'w') as fp:
            json.dump(out, fp, indent=1)

# Usage: python inference.py --cfg 'path/to/cfg' --model_path 'path/to/model' --img-path 'path/to/img' --meta-path 'path/to/meta'