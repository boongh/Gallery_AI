import express from "express";
import next from "next";
import multer from "multer";
import { imageuploadhandlerasync } from "./components/imageupload.ts";
import path from "node:path";
import { gallerydbsql } from "./components/pg.ts";

const PORT = 3000;
const nextapp = next({ dev: true });
const handler = nextapp.getRequestHandler();

const upload = multer()

nextapp.prepare().then(() => {
  const server = express();

  server.get("/api/home", (req, res) => {
    res.json({ message: "Hello world" });
  });
  
  server.post("/api/upload", upload.array("images"), imageuploadhandlerasync);

  server.get("/api/images", async (req, res) => {
    let { offset, limit } = req.query;
    if(offset == undefined || (typeof offset) != 'number') offset = (0).toString();
    if(limit == undefined || (typeof limit) != 'number') limit = (100).toString();

    const sqlresult = await gallerydbsql`
    SELECT * FROM galleryindex.images
    ORDER BY uploaded_at DESC
    OFFSET ${parseInt(offset.toString())}
    LIMIT ${parseInt(limit.toString())}
    `;
    
    res.send(sqlresult);
  })

  server.get("/images/:type/:uuid", (req, res) => {
    const { type, uuid } = req.params;
    res.sendFile(path.resolve(`${process.env.APP_DATA}/images/${type}/${uuid}`));
  });

  server.all(/.*/, (req, res) => {
    return handler(req, res);
  });

  server.listen(PORT, () => {
    console.log("Server started on port: ", PORT);
  });
});