import { v4 as uuidv4 } from "uuid";
import { gallerydbsql } from "./pg.ts";

import fs from "fs";
import path from "path";
import amqp from "amqplib/callback_api.js";

async function imageuploadhandlerasync(req, res){
  const files = req.files;
  
  for (const file of files) {
    const id = uuidv4(); // corresponds to uuid
    const format = file.mimetype; // matches "format" column
    const filepath = path.join("images", "originals", id).toString(); // matches "filepath"
    const thumbnail_filepath = null; // matches "thumbnail_filepath"
    const status = "pending indexing"; // matches "status"
    const created_at = new Date();
    const uploaded_at = new Date();
    const metadata = {}; // JSON object

    // Save file to disk
    const savepath = path.resolve(path.join(process.env.APP_DATA, filepath));
    console.log("Saving file to ", savepath);

    fs.mkdirSync(path.dirname(savepath), { recursive: true });
    fs.writeFileSync(savepath, file.buffer);

    // Insert into database
    const result = await gallerydbsql`
      INSERT INTO galleryindex.images (uuid, format, filepath, thumbnail_filepath, status, created_at, uploaded_at, metadata)
      VALUES (${id}, ${format}, ${filepath}, ${thumbnail_filepath}, ${status}, ${created_at}, ${uploaded_at}, ${gallerydbsql.json(metadata)})`;
    
    console.log("Connecting to queue...");

    amqp.connect("amqp://localhost", (error, connect) => {
      if (error) {
        throw error;
      }
      connect.createChannel((error, channel) => {
        const queue = "image_processing_queue";
        const msg = JSON.stringify({
          uuid: id,
          fileurlpath: filepath,
          savepath: savepath,
          format: format
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