import { v4 as uuidv4 } from "uuid";
import { gallerydbsql } from "./pg.ts";
import fs from "fs";
import path from "path";

async function imageuploadhandlerasync(req, res){
  const files = req.files;
  
  for (const file of files) {
    const id = uuidv4(); // corresponds to uuid
    const format = file.mimetype; // matches "format" column
    const filepath = `/images/originals/${id}`; // matches "filepath"
    const thumbnail_filepath = filepath; // matches "thumbnail_filepath"
    const status = "pending indexing"; // matches "status"
    const created_at = new Date();
    const uploaded_at = new Date();
    const metadata = {}; // JSON object

    // Save file to disk
    const savepath = path.join(process.env.APP_DATA, filepath);
    console.log("Saving file to ", savepath);

    fs.mkdirSync(path.dirname(savepath), { recursive: true });
    fs.writeFileSync(savepath, file.buffer);

    // Insert into database
    const result = await gallerydbsql`
      INSERT INTO galleryindex.images (uuid, format, filepath, thumbnail_filepath, status, created_at, uploaded_at, metadata)
      VALUES (${id}, ${format}, ${filepath}, ${thumbnail_filepath}, ${status}, ${created_at}, ${uploaded_at}, ${gallerydbsql.json(metadata)})`;

    console.log("Inserted image with UUID: ", id);
  }


  res.json({ message: "Upload endpoint hit" });
}

export { imageuploadhandlerasync };