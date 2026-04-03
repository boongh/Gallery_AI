import { v4 as uuidv4 } from "uuid";
import { gallerydbsql } from "./pg.ts";

import fs from "fs";
import path from "path";
import amqp from "amqplib/callback_api.js";

import sharp from "sharp";

async function imageuploadhandlerasync(req : any, res : any){
  const decoder = new TextDecoder("utf-8");
  const files = req.files;
  
  for (const file of files) {
    
    const image = sharp(file.buffer);
    const imgmetadata = await image.metadata();
    const exif = decoder.decode(imgmetadata.exif);
    console.log("EXIF data: ", exif);

    const id = uuidv4(); // corresponds to uuid
    const format = file.mimetype; // matches "format" column
    const originalfileurl = `images/originals/${id}.${imgmetadata.format}`; // matches "filepath"
    const thumbnail_filepath = null; // matches "thumbnail_filepath"
    const status = "pending indexing"; // matches "status"
    const created_at = new Date();
    const uploaded_at = new Date();
    const metadata = imgmetadata; // JSON object

    // Save file to disk
    if(process.env.APP_DATA === undefined){
      console.error("APP_DATA environment variable is not set.");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    const savepath = path.resolve(path.join(process.env.APP_DATA, path.join("images", "originals", `${id}.${metadata.format}`)));
    console.log("Saving file to ", savepath);

    fs.mkdirSync(path.dirname(savepath), { recursive: true });
    fs.writeFileSync(savepath, file.buffer);

    // Insert into database
    const result = await gallerydbsql`
      INSERT INTO galleryindex.images (uuid, format, filepath, thumbnail_filepath, status, created_at, uploaded_at, metadata)
      VALUES (${id}, ${format}, ${originalfileurl}, ${thumbnail_filepath}, ${status}, ${created_at}, ${uploaded_at}, ${gallerydbsql.json(metadata as any)})`;
    
    console.log("Connecting to queue...");
    amqp.connect(`amqp://${process.env.RABBITMQ_HOST}`, (error, connect) => {
      if (error) {
        console.log("Connection to RabbitMQ failed:", error);
        throw error;
      }

      connect.createChannel((error, channel) => {
        if (error) {
          console.log("Creating channel failed:", error);
          throw error;
        }
        const queue = "image_processing_queue";
        const msg = JSON.stringify({
          uuid: id,
          fileurlpath: originalfileurl,
          savepath: savepath
        })

        channel.assertQueue(queue, {
          durable: true
        })

        channel.sendToQueue(queue, Buffer.from(msg));
        console.log("Enqueued msg ", msg)
      })

    })
    
    console.log("Inserted image with UUID: ", id);
  }

  res.json({ message: "Upload endpoint hit" });
}

export { imageuploadhandlerasync };