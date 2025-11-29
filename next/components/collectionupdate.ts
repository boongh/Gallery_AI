import { gallerydbsql } from "./pg.ts";

async function putImageInCollection(req, res){
  try{
    const body : { 
      'image_uuid' : string,
      'collection_uuid' : string[],
     }[] = JSON.parse(req.body);

     body.forEach(async (element) => {
      element.collection_uuid.forEach(async (coluuid) => {
        try{
          const result = await gallerydbsql`
            INSERT INTO collections.collection_images (collection_uuid, image_uuid, added_at)
            VALUES (${coluuid}, ${element.image_uuid}, ${new Date()})
          `;
          console.log(`Inserted ${element.image_uuid} into ${coluuid}`);
        } catch (err){
          console.error(`Fail to insert ${element.image_uuid} into ${coluuid}: `, err);
        }
      })
     });
     res.status(200)
  } catch (err){
    res.status(400).send(err);
  }
}

async function deleteImageFromCollection(req, res){
  try{
    const body : { 
      'collection_uuid' : string,
      'image_uuid' : string[],
     }[] = JSON.parse(req.body);

     body.forEach(async (element) => {
      element.collection_uuid.forEach(async (coluuid) => {
        try{
          const result = await gallerydbsql`
            INSERT INTO collections.collection_images (collection_uuid, image_uuid, added_at)
            VALUES (${coluuid}, ${element.image_uuid}, ${new Date()})
          `;
          console.log(`Inserted ${element.image_uuid} into ${coluuid}`);
        } catch (err){
          console.error(`Fail to insert ${element.image_uuid} into ${coluuid}: `, err);
        }
      })
     });
     res.status(200)
  } catch (err){
    res.status(400).send(err);
  }
}

async function getImageFromCollection(req, res){
  try{
    const body : { 
      'image_uuid' : string,
      'collection_uuid' : string[],
     }[] = JSON.parse(req.body);

     body.forEach(async (element) => {
      element.collection_uuid.forEach(async (coluuid) => {
        try{
          const result = await gallerydbsql`
            INSERT INTO collections.collection_images (collection_uuid, image_uuid, added_at)
            VALUES (${coluuid}, ${element.image_uuid}, ${new Date()})
          `;
          console.log(`Inserted ${element.image_uuid} into ${coluuid}`);
        } catch (err){
          console.error(`Fail to insert ${element.image_uuid} into ${coluuid}: `, err);
        }
      })
     });
     res.status(200)
  } catch (err){
    res.status(400).send(err);
  }
}

export { putImageInCollection, deleteImageFromCollection, getImageFromCollection }