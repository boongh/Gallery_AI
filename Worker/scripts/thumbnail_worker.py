import pika;
import os;
import sys;
import json;
import psycopg;
from psycopg import sql;
import time;
import PIL;
import pika.exceptions;
import os.path as osp;
from utils.u_rabbitmq import connect_to_rabbitmq;
from utils.u_postgres import connect_to_postgres;
from utils.u_waitfor import wait_for;
import traceback

def main():
    
    print("Worker process started, waiting for RabbitMQ...");
    def generate_thumbnail(image_path, thumbnail_path):

        print("Importing pillow:")
        print("2")

        print("Pillow version: ", PIL.__version__)
        print(image_path, thumbnail_path)
        print(osp.join(os.getenv("APP_DATA")))
        print(osp.join(os.getenv("APP_DATA"), image_path))

        try:
            from PIL import Image, ImageOps

            image = Image.open(image_path)

            print("4")
            image.thumbnail((512, 512))
            image = ImageOps.exif_transpose(image)  # Correct orientation based on EXIF data
            image.save(thumbnail_path)

        except Exception as e:
            print(f"Exception: {e}", flush=True)
            print(traceback.format_exc(), flush=True)

        
    def update_database_thumbnail(uuid, thumbnail_urlpath):
        schema = "galleryindex"
        table = "images"
        conn = wait_for(connect_to_postgres, "PostgreSQL")
        
        # Update database entry
        cur = conn.cursor()

        query = sql.SQL("""
            UPDATE {schema}.{table}
            SET thumbnail_filepath = %s
            WHERE uuid = %s;
        """).format(
            schema=sql.Identifier(schema),
            table=sql.Identifier(table)
        )

        cur.execute(query, (thumbnail_urlpath, uuid))

        conn.commit()
        conn.close()
        
    def workercallback(ch, method, properties, body):
        try:
            jsonbody = json.loads(body);
            print("Got req for ", jsonbody)
            
            urlpath = jsonbody['fileurlpath'];
            savepath = jsonbody['savepath'];
            
            #Database variables set up
            uuid = jsonbody['uuid'];
            
            # Generate thumbnail
            categorypath = "media";
            
            thumbnail_urlpath = osp.join(categorypath, "thumbnails", uuid + ".avif")
            thumbnail_path = osp.join(os.getenv("APP_DATA"), thumbnail_urlpath)
            
            os.makedirs(osp.dirname(thumbnail_path), exist_ok=True);
            
            print("1")
            print("Generating thumbnail for ", urlpath)
            generate_thumbnail(osp.join(os.getenv("APP_DATA"), urlpath), thumbnail_path)

            print(f"At {time.time_ns()}")
            print(f"Generated thumbnail for {savepath} at {osp.join(thumbnail_path, uuid + ".jpg")}");
            
            update_database_thumbnail(uuid, thumbnail_urlpath);
            print(f"Updated database entry for {uuid} with thumbnail path {thumbnail_urlpath}");
        
        except:
            print("exception occured in worker callback")
        
        
    connection = wait_for(connect_to_rabbitmq, "RabbitMQ", timeout=20);
    print("RabbitMQ connected successfully", flush=True)
    
    channel = connection.channel()

    channel.queue_declare(queue='thumbnail_generation_queue', durable=True);      
    channel.basic_consume(queue='thumbnail_generation_queue',
                        auto_ack=True,
                        on_message_callback=workercallback)

    print('Waiting for messages. To exit press CTRL+C');
    channel.start_consuming();


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