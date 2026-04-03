import os;
import psycopg;

def connect_to_postgres():
    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=5432,
        dbname=os.getenv("POSTGRES_DB", "gallerydb"),
        user=os.getenv("POSTGRES_USER", "gallery"),
        password=os.getenv("POSTGRES_PASSWORD", "gallery")
    )