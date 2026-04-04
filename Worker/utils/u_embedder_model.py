from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch


model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
model.eval()


def embed_image(image_path: str) -> list[float]:
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    # print("Processing image for embedding...")
    with torch.no_grad():
        # print("1")
        output = model.get_image_features(**inputs, return_dict=True)

        if hasattr(output, 'pooler_output'):
            print("Output has pooler_output")
            vector = output.pooler_output
        else:
            print("Output does not have pooler_output, using last_hidden_state")
            vector = output
        # print(vector)
        # print(vector.norm(dim=-1, keepdim=True))
        vector = vector / vector.norm(dim=-1, keepdim=True)  # normalize
        # print("3")

    return vector.squeeze().tolist()

def embed_text(text: str) -> list[float]:
        
    inputs = processor(text=text, return_tensors="pt")
    with torch.no_grad():
        # print("1")
        output = model.get_text_features(**inputs, return_dict=True)
        if hasattr(output, 'pooler_output'):
            print("Output has pooler_output")
            vector = output.pooler_output
        else:
            print("Output does not have pooler_output, using last_hidden_state")
            vector = output
        # print(vector)
        # print(vector.norm(dim=-1, keepdim=True))
        vector = vector / vector.norm(dim=-1, keepdim=True)  # normalize
        # print("3")

    return vector.squeeze().tolist()