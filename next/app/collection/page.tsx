'use client'
import { useDisclosure } from '@mantine/hooks';
import { Modal, Button } from '@mantine/core';


import React, { useEffect } from "react";
export default function CollectionPage(){
  const [collections, setCollections] = React.useState([])

  useEffect(() => {
    fetch("/gms/collection?want=uuid-description-name&offset=0&limit=10", {
      method : "GET"
    }).then(async (response) => {
      return await response.arrayBuffer()
    }).then((arrbuff) => {
      const decoder = new TextDecoder()
      return JSON.parse(decoder.decode(arrbuff))
    }).then((coljson) => {
      console.log("json received : ", coljson);
      setCollections(coljson)
    })
  }, [])


  return<>
    <div className="grid grid-cols-4 gap-4 w-full">
      {collections.length > 0 && collections.map((collectionentry) => {
        return <div className="h-24" key={collectionentry['uuid']}>
          {collectionentry['uuid']}\n
          {collectionentry['name']}
        </div>
      })}
    </div>
    <div>
    </div>
  </>
}