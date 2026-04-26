from transformers import CLIPProcessor, CLIPModel
from PIL import Image
from psycopg import sql;
from utils.u_rabbitmq import connect_to_rabbitmq;
from utils.u_waitfor import wait_for;
from utils.u_embedder_model import embed_image;
from utils.u_get_image_from_s3 import get_image_from_s3;
from utils.u_postgres import connect_to_postgres;
import sys
import torch
import traceback
import json;
import os;

from qdrant_client import QdrantClient, models

qdrant_url = f"http://{os.getenv('QDRANTHOST')}:{os.getenv('QDRANTPORT')}"
print("Connecting to Qdrant at ", qdrant_url)
client = QdrantClient(url=qdrant_url)

def embed_image_callback(ch, method, properties, body):
    try:
        jsonbody = json.loads(body);
        print("Got req for ", jsonbody)

        original_key = jsonbody['original_url'];
        t_key = jsonbody['thumbnail_url'];
        p_key = jsonbody['preview_url'];
        
        embed_key = p_key or t_key

        #Database variables set up
        uuid = jsonbody['uuid'];

        # Use thumbnail for embedding (PIL can't decode RAW formats like CR3/NEF)
        vector = embed_image(get_image_from_s3(os.getenv('S3BUCKET'), embed_key))
        if vector is None:
            print("Failed to generate vector for ", original_key)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            return

        if not client.collection_exists(os.getenv('QDRANTCOLLECTION')):
            print(f"Qdrant collection '{os.getenv('QDRANTCOLLECTION')}' does not exist. An error might have occured. Please restart the worker.")
            
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        else:
            client.upsert(
                collection_name=os.getenv('QDRANTCOLLECTION'),
                points=[
                    models.PointStruct(
                        id=uuid,
                        vector=vector,
                        payload={
                            "owner_uuid": jsonbody['owner_uuid'],
                            "thumbnail_key": jsonbody['thumbnail_url'],
                            "preview_key": jsonbody['preview_url'],
                            "original_key": jsonbody['original_url'],   
                            }
                    )
                ]
            )

            update_postgress_embedder_id(uuid, os.getenv("MODEL_ID"))
            print("Generated vector for ", original_key)
            ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print("exception occured in vector callback:", e)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def update_postgress_embedder_id(uuid, embedder) -> bool:
    try:
        schema = "galleryindex"
        table = "images"
        conn = wait_for(connect_to_postgres, "PostgreSQL")
        
        # Update database entry
        cur = conn.cursor()
        
        query = sql.SQL("""
            UPDATE {schema}.{table}
            SET embedder_id= %s
            WHERE uuid = %s;
        """).format(
            schema=sql.Identifier(schema),
            table=sql.Identifier(table)
        )

        cur.execute(query, (embedder, uuid))

        conn.commit()
        conn.close()
        return True
    except:
        print("Exception occured while updating database metadata for uuid ", uuid, ": ", sys.exc_info()[0], flush=True)
        print(traceback.format_exc(), flush=True)
        return False

def main():

    print("Trying to connect to RabbitMQ...", flush=True);
    connection = wait_for(connect_to_rabbitmq, "RabbitMQ", timeout=20);
    print("RabbitMQ connected successfully", flush=True)
    

    if not client.collection_exists(os.getenv('QDRANTCOLLECTION')):
        client.create_collection(
            collection_name=os.getenv('QDRANTCOLLECTION'),
            vectors_config=models.VectorParams(size=512, distance=models.Distance.DOT),
        )
        print("Created Qdrant collection '", os.getenv('QDRANTCOLLECTION'), "'")
    else:
        print("Qdrant collection '", os.getenv('QDRANTCOLLECTION'), "' already exists with following parameters")
        print(client.get_collection(os.getenv('QDRANTCOLLECTION')).config)

    channel = connection.channel();

    channel.queue_declare(queue='vector_generation_queue', durable=True);      
    channel.basic_consume(queue='vector_generation_queue',
                        auto_ack=False,
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