from PIL.ExifTags import TAGS
from PIL import Image
from psycopg import sql;
from utils.u_rabbitmq import connect_to_rabbitmq;
from utils.u_waitfor import wait_for;
from utils.u_postgres import connect_to_postgres;
import json;
import traceback
import os;
import sys
from qdrant_client import QdrantClient, models
from psycopg.types.json import Jsonb
from datetime import datetime


qdrant_url = f"http://{os.getenv('QDRANTHOST')}:{os.getenv('QDRANTPORT')}"
qdrant_client = QdrantClient(url=qdrant_url)

def metadata_callback(ch, method, properties, body):
    try:
        jsonbody = json.loads(body);

        savepath = jsonbody['original_filepath'];

        #Database variables set up
        uuid = jsonbody['uuid'];
        print("Got metadata req for ", uuid)
    
        metadata = getmetadata(savepath)
        
        succ = update_postgress_metadata(uuid, metadata)
        if not succ:
            raise Exception("Postgres metadata fail")
        
        succ = update_qdrant_metadata(uuid, metadata)
        if not succ:
            raise Exception("Qdrant metadata fail")
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print("exception occured in vector callback:", e)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def update_postgress_metadata(uuid, metadata) -> bool:
    try:
        schema = "galleryindex"
        table = "images"
        conn = wait_for(connect_to_postgres, "PostgreSQL")
        
        # Update database entry
        cur = conn.cursor()
        c = metadata.get('DateTimeOriginal')
        created_at = datetime.strptime(c, "%Y:%m:%d %H:%M:%S") if c is not None else None
        
        query = sql.SQL("""
            UPDATE {schema}.{table}
            SET metadata = %s, created_at = %s
            WHERE uuid = %s;
        """).format(
            schema=sql.Identifier(schema),
            table=sql.Identifier(table)
        )

        cur.execute(query, (Jsonb(metadata), created_at, uuid))

        conn.commit()
        conn.close()
        return True
    except:
        print("Exception occured while updating database metadata for uuid ", uuid, ": ", sys.exc_info()[0], flush=True)
        print(traceback.format_exc(), flush=True)
        return False
    
def update_qdrant_metadata(uuid, metadata) -> bool:

    if not qdrant_client.collection_exists(os.getenv('QDRANTCOLLECTION')):
        print(f"Qdrant collection '{os.getenv('QDRANTCOLLECTION')}' does not exist. An error might have occured. Please restart the worker.")
        
    else:
        try:
            c = metadata.get('DateTimeOriginal')
            created_at = datetime.strptime(c, "%Y:%m:%d %H:%M:%S") if c is not None else None
            qdrant_client.set_payload(
                collection_name=os.getenv('QDRANTCOLLECTION'),
                points=[uuid],
                payload={
                    "created_at": created_at,
                    "metadata": metadata,
                    }
            )
            print("Generated metadata for ", uuid)
        except:
            return False

    return True

def getmetadata(savepath) -> dict:
    pil_img = Image.open(savepath)
    exif_info = pil_img._getexif()
    if exif_info is None:
        return None
    exif = {}
    for k, v in exif_info.items():
        tag = TAGS.get(k, k)
        if isinstance(v, (str, int, float, bool)):
            exif[tag] = v
        elif isinstance(v, bytes):
            continue
        else:
            exif[tag] = str(v)
    return exif
    
def main():

    print("Trying to connect to RabbitMQ...", flush=True);
    connection = wait_for(connect_to_rabbitmq, "RabbitMQ", timeout=20);
    print("RabbitMQ connected successfully", flush=True)
    

    if not qdrant_client.collection_exists(os.getenv('QDRANTCOLLECTION')):
        qdrant_client.create_collection(
            collection_name=os.getenv('QDRANTCOLLECTION'),
            vectors_config=models.VectorParams(size=512, distance=models.Distance.DOT),
        )
        print("Created Qdrant collection '", os.getenv('QDRANTCOLLECTION'), "'")
    else:
        print("Qdrant collection '", os.getenv('QDRANTCOLLECTION'), "' already exists with following parameters")
        print(qdrant_client.get_collection(os.getenv('QDRANTCOLLECTION')).config)

    channel = connection.channel();

    channel.queue_declare(queue='metadata_generation_queue', durable=True);      
    channel.basic_consume(queue='metadata_generation_queue',
                        auto_ack=False,
                        on_message_callback=metadata_callback)


    channel.start_consuming()

if __name__ == '__main__':
    try:
        #for dev purpose
        #won't be .env in prod
        from dotenv import load_dotenv
        load_dotenv()
        
        print("Metadata worker started")
        main()
    except KeyboardInterrupt:
        print("Interrupted")
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)