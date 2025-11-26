import pika;
import os;
import sys;
import json;
import psycopg;
from psycopg import sql;
import time;
import pika.exceptions;
import os.path as osp;

def wait_for(tryer, name, timeout=5):

    for i in range(timeout):
        try:
            return tryer();
        except Exception as e:
            print(f"{name} failed: {e}. Retrying in 5 seconds");
            time.sleep(5);
            
    raise RuntimeError(f"{name} is not available after {timeout * 5} seconds");

def connect_to_rabbitmq():
    return pika.BlockingConnection(pika.ConnectionParameters(os.getenv("RABBITMQ_HOST", "localhost")));

def connect_to_postgres():
    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=5432,
        dbname=os.getenv("POSTGRES_DB", "gallerydb"),
        user=os.getenv("POSTGRES_USER", "gallery"),
        password=os.getenv("POSTGRES_PASSWORD", "gallery")
    )
    
def main():
    
    def generate_thumbnail(image_path, thumbnail_path):
        from PIL import Image;
        
        image = Image.open(image_path);
        image.thumbnail((512, 512));
        image.save(thumbnail_path);
        
    def update_database_thumbnail(uuid, thumbnail_urlpath):
        schema = "galleryindex";
        table = "images";
        conn = wait_for(connect_to_postgres, "PostgreSQL");
        
        # Update database entry
        cur = conn.cursor();

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
        conn.close();
        
    def workercallback(ch, method, properties, body):
        jsonbody = json.loads(body);
        urlpath = jsonbody['fileurlpath'];
        savepath = jsonbody['savepath'];
        
        #Database variables set up
        uuid = jsonbody['uuid'];
        
        # Generate thumbnail
        dirurl = osp.dirname(osp.dirname(urlpath));
        
        
        thumbnail_path = osp.join(os.getenv("APP_DATA", osp.join("..", "data")), dirurl, "thumbnails");
        thumbnail_urlpath = f'{dirurl}/thumbnails/{uuid}.jpg';
        
        os.makedirs(thumbnail_path, exist_ok=True);
        
        generate_thumbnail(savepath, osp.join(thumbnail_path, uuid + ".jpg"));
        print(f"Generated thumbnail for {savepath} at {thumbnail_path}");
        
        update_database_thumbnail(uuid, thumbnail_urlpath);
        print(f"Updated database entry for {uuid} with thumbnail path {thumbnail_urlpath}");
        
        
    connection = wait_for(connect_to_rabbitmq, "RabbitMQ", timeout=20);
    print(" RabbitMQ connected successfully")
    
    channel = connection.channel();

    channel.queue_declare(queue='image_processing_queue', durable=True);      
    channel.basic_consume(queue='image_processing_queue',
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