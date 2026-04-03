import pika;
import os;

def connect_to_rabbitmq():
    return pika.BlockingConnection(pika.ConnectionParameters(os.getenv("RABBITMQ_HOST", "localhost")));