import pika;
import os;
import sys;
import json;
import psycopg;
from psycopg import sql;
    
def main():
    
    def generate_thumbnail(image_path, thumbnail_path):
        from PIL import Image;
        
        image = Image.open(image_path);
        image.thumbnail((512, 512));
        image.save(thumbnail_path);
        
        
    def workercallback(ch, method, properties, body):
        jsonbody = json.loads(body);
        urlpath = jsonbody['fileurlpath'];
        savepath = jsonbody['savepath'];
        
        #Database variables set up
        schema = "galleryindex";
        table = "images";
        uuid = jsonbody['uuid'];
        
        # Generate thumbnail
        dir = os.path.dirname(os.path.dirname(savepath));
        
        thumbnail_folder_path = os.path.join(dir, "thumbnails");
        thumbnail_path = os.path.join(thumbnail_folder_path, uuid + ".jpg");
        
        dirurl = os.path.dirname(os.path.dirname(urlpath));
        thumbnail_urlpath = os.path.join(dirurl, "thumbnails", uuid + ".jpg");
        
        print({
            'imgpath': urlpath,
            'savepath': savepath,
            'thumbpath': thumbnail_path,
            'thumbfolder': thumbnail_path
            });
        
        os.makedirs(os.path.dirname(thumbnail_folder_path), exist_ok=True);
        
        generate_thumbnail(savepath, thumbnail_path);
        
        try:
            conn = psycopg.connect(
                host="localhost",
                port=5432,
                dbname="gallerydb",
                user="gallery",
                password="gallery"
            )
            print(" Database connected successfully")
        except:
            print("Database not connected successfully")
            raise RuntimeError("Database connection failed")
        
        # Update database entry
        cur = conn.cursor();
        print({
            'table': table,
            'thumbnail_path': thumbnail_path,
            'uuid': uuid
        })

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
        
        
    connection = pika.BlockingConnection(pika.ConnectionParameters(os.getenv("RABBITMQ_HOST", "localhost")));
    channel = connection.channel();

    channel.queue_declare(queue='image_processing_queue', durable=True);      
    channel.basic_consume(queue='image_processing_queue',
                        auto_ack=True,
                        on_message_callback=workercallback)

    print(' [*] Waiting for messages. To exit press CTRL+C');
    channel.start_consuming();


if __name__ == '__main__':
    try:
        print("Worker started")
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)