import express from "express";
import next from "next";
import multer from "multer";
import { imageuploadhandlerasync } from "./components/imageupload.ts";
import path from "node:path";
import { imagequery } from "./components/imagequery.ts";
import { putImageInCollection, deleteImageFromCollection, getImageFromCollection } from "./components/collectionupdate.ts";

const PORT = 3000;
const nextapp = next({ dev: true });
const handler = nextapp.getRequestHandler();

const upload = multer()

nextapp.prepare().then(() => {
  const server = express();

  server.get("/api/home", (req, res) => {
    res.json({ message: "Hello world" });
  });
  
  // server.get("/api/collections");
  // server.post("/api/collections")

  //!/TODO
  //!/Non of the get delete works
  server.get("/api/collections/images", getImageFromCollection)
  server.delete("/api/collections/images", deleteImageFromCollection);
  
  server.post("/api/collections/images", putImageInCollection);
  
  
  server.post("/api/images/upsert", upload.array("images"), imageuploadhandlerasync);
  server.get("/api/images", async (req, res) => {
    const { offset, limit, collection } = req.query;
    
    res.send(await imagequery({
      offset: parseInt(offset as string),
      limit: parseInt(limit as string),
      collection: collection as string,
      }));
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