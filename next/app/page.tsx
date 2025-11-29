'use client';
import Image from "next/image";
import React, { useEffect } from "react";

class ImageData {
  // ID and metadata
  id: string;
  format: string;
  filepath: string;
  thumbnail_filepath: string;
  status: string;
  createdAt: Date;
  uploadedAt: Date;
  metaData: object;

  constructor(
    id: string,
    format: string,
    filepath: string,
    thumbnail_filepath: string,
    status: string,
    uploadedAt: Date,
    createdAt: Date,
    metaData: object = {}
  ) {
    this.id = id;
    this.format = format;
    this.filepath = filepath;
    this.thumbnail_filepath = thumbnail_filepath;
    this.status = status;
    this.uploadedAt = uploadedAt;
    this.createdAt = createdAt;
    this.metaData = metaData;
  }
}

export default function Home() {
  const [images, setImages] = React.useState<ImageData[]>([]);
  const [selectedImages, setSelectedImages] = React.useState<FileList | null>(null);
  const [galleryRefreshes, setGalleryRefreshes] = React.useState<number>(0);

  function handleUpload() {
    if(selectedImages){
      const formData = new FormData();
      if (selectedImages) {
        for (let i = 0; i < selectedImages.length; i++) {
          formData.append('files', selectedImages[i]);
        }
      }

      fetch('/gms/upload/images', {
        method: 'POST',
        body: formData, 
      }).then(response => response.arrayBuffer()).then(data => {
        const decoder = new TextDecoder("utf-8");
        console.log("Upload response received");
        console.log(decoder.decode(data));
        setGalleryRefreshes(galleryRefreshes + 1);
      }).catch(error => {
        console.error("Error uploading files:", error);
      });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) {
      setSelectedImages(files);
    }
  }

  useEffect(() => {
    (async () => {

      try{
        const fetchImages = fetch('/api/images?offset=0&limit=10')
        .then(response => response.json())

        const imageData = await  fetchImages;
        const loadedImages: ImageData[] = [];
        for (const img of imageData) {
          loadedImages.push(new ImageData(
            img.uuid,
            img.format,
            img.filepath,
            img.thumbnail_filepath,
            img.status,
            new Date(img.uploaded_at),
            new Date(img.created_at),
            img.metadata
          ));
        }

        setImages(loadedImages);
      } catch (error) {
        console.error("Error fetching images:", error);
      }


    })();
    
  }, [galleryRefreshes]);
  

  return (
    <div className="flex flex-col items-center min-h-screen py-2">
      <h1 className="">Header 1</h1>
      <div className="p-16">
        <h2>Upload images</h2>
        <form>
          <input type="file" name="imageUpload" accept="image/*" multiple 
          onChange={handleFileChange}
          />
          <button type="button" className="ml-4 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={handleUpload}
          >
            Upload
          </button>
        </form>
      </div>
      <h2>View images</h2>
      <div className="w-max">
        <div className="grid grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="mb-4">
              <img src={(() => {
                if(image.thumbnail_filepath){
                  return image.thumbnail_filepath;
                } else {
                  return image.filepath;
                }
              })()} alt={image.filepath} width={350}/>
              <p className="text-sm text-gray-500">Uploaded on: {image.uploadedAt.toDateString()}</p>
              <p className="text-sm text-gray-500">Taken on: {image.createdAt.toDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
