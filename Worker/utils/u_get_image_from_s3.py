import os
import boto3
from io import BytesIO
from PIL import Image


def _s3_client():
    return boto3.client("s3", endpoint_url=os.getenv('S3_ENDPOINT'), aws_access_key_id=os.getenv('S3_ACCESS_KEY'), aws_secret_access_key=os.getenv('S3_SECRET_KEY'))


def get_bytes_from_s3(bucket_name: str, object_key: str) -> bytes:
    response = _s3_client().get_object(Bucket=bucket_name, Key=object_key)
    return response["Body"].read()


def get_image_from_s3(bucket_name: str, object_key: str) -> Image.Image:
    return Image.open(BytesIO(get_bytes_from_s3(bucket_name, object_key)))
