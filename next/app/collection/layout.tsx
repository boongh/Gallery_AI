'use client'
import { Button } from "@mantine/core"
import { CreateNewCollectionPrompt } from "@/components/collectionupdate";
import { modals } from "@mantine/modals";

export default function CollectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const openModal = () => {
    modals.open({title:"Create new collection", 
      // size:"auto",
      overlayProps:{
        backgroundOpacity:0.55,
        blur: 5
      },
      children:(
      <CreateNewCollectionPrompt/>
    )})
  }

  return (
    <div className="flex flex-col w-vw h-dvh grow">
      {/* Navigation bar */}
      <div className=" text-4xl">
        <Button onClick={openModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-folder-plus" viewBox="0 0 16 16">
            <path d="m.5 3 .04.87a2 2 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9v-1H2.826a1 1 0 0 1-.995-.91l-.637-7A1 1 0 0 1 2.19 4h11.62a1 1 0 0 1 .996 1.09L14.54 8h1.005l.256-2.819A2 2 0 0 0 13.81 3H9.828a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 6.172 1H2.5a2 2 0 0 0-2 2m5.672-1a1 1 0 0 1 .707.293L7.586 3H2.19q-.362.002-.683.12L1.5 2.98a1 1 0 0 1 1-.98z"/>
            <path d="M13.5 9a.5.5 0 0 1 .5.5V11h1.5a.5.5 0 1 1 0 1H14v1.5a.5.5 0 1 1-1 0V12h-1.5a.5.5 0 0 1 0-1H13V9.5a.5.5 0 0 1 .5-.5"/>
          </svg>
        </Button>
      </div>
      <div className="grow h-full w-full">

        {children}
      </div>
    </div> 
  );
}
