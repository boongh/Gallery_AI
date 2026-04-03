from transformers import CLIPProcessor, CLIPModel
from PIL import Image
from utils.u_rabbitmq import connect_to_rabbitmq;
from utils.u_waitfor import wait_for;
import torch
import json;

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
model.eval()

def embed_image(image_path: str) -> list[float]:
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    print("Processing image for embedding...")
    with torch.no_grad():
        print("1")
        vector = model.get_image_features(**inputs)
        print(vector)
        print(vector.norm(dim=-1, keepdim=True))
        vector = vector / vector.norm(dim=-1, keepdim=True)  # normalize
        print("3")

    return vector.squeeze().tolist()

def embed_image_callback(ch, method, properties, body):
    try:
        jsonbody = json.loads(body);
        print("Got req for ", jsonbody)
        
        urlpath = jsonbody['fileurlpath'];
        savepath = jsonbody['savepath'];
        
        #Database variables set up
        uuid = jsonbody['uuid'];
        
        # Generate thumbnail
        vector = embed_image(savepath)
        print(vector)
        print("Generated vector for ", savepath)
    except:
        print("exception occured in vector callback")

def main():

    print("Trying to connect to RabbitMQ...", flush=True);
    connection = wait_for(connect_to_rabbitmq, "RabbitMQ", timeout=20);
    print("RabbitMQ connected successfully", flush=True)
    
    channel = connection.channel();

    channel.queue_declare(queue='vector_generation_queue', durable=True);      
    channel.basic_consume(queue='vector_generation_queue',
                        auto_ack=True,
                        on_message_callback=embed_image_callback)


    channel.start_consuming()

if __name__ == '__main__':
    try:
        #for dev purpose
        #won't be .env in prod
        from dotenv import load_dotenv
        load_dotenv()
        
        print("Worker started")
        main()
    except KeyboardInterrupt:
        print("Interrupted")
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)