import { gallerydbsql } from "./pg.ts";

async function imagequery(
  {offset,
  limit,
  collection
}
: {offset?: number,
  limit?: number,
  collection?: string
}) {

  try{
    if(offset == undefined || (typeof offset) != 'number') offset = 0;
    if(limit == undefined || (typeof limit) != 'number') limit = 100;
    if(collection == undefined || (typeof collection) != 'string') collection = "";

    if(collection == ""){
      const sqlresult = await gallerydbsql`
        SELECT * FROM galleryindex.images
        ORDER BY uploaded_at DESC
        OFFSET ${parseInt(offset.toString())}
        LIMIT ${parseInt(limit.toString())}
      `;
      return sqlresult;

    } else {
      const sqlresult = await gallerydbsql`
        SELECT * FROM galleryindex.images
        INNER JOIN collections.images_collections ON galleryindex.images.uuid = collections.images_collections.image_uuid
        WHERE collections.collection_images.collection_uuid = ${collection}
        ORDER BY uploaded_at DESC
        OFFSET ${parseInt(offset.toString())}
        LIMIT ${parseInt(limit.toString())}
      `;
      return sqlresult;
    }
    
  } catch(error){
    console.error("Error querying images: ", error);
    return null;
  }
}


export { imagequery };