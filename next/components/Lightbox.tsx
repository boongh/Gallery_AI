'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Button, Center, CloseButton, Modal,
  ScrollArea, Select, SimpleGrid, Skeleton, Stack, Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

export interface ImageData {
  id: string;
  format: string;
  filepath: string;
  thumbnail_filepath: string;
  status: string;
  createdAt: Date;
  uploadedAt: Date;
  metaData: object;
}

interface LightboxProps {
  image: ImageData | null;
  onClose: () => void;
  initialImageIndex: Map<string, ImageData>;
}

function parseImages(raw: any[]): ImageData[] {
  return raw.map(img => ({
    id: img.uuid,
    format: img.format,
    filepath: img.filepath,
    thumbnail_filepath: img.thumbnail_filepath,
    status: img.status,
    uploadedAt: new Date(img.uploaded_at),
    createdAt: new Date(img.created_at),
    metaData: img.metadata || {},
  }));
}

export default function Lightbox({ image, onClose, initialImageIndex }: LightboxProps) {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;

  const [activeImage, setActiveImage] = useState<ImageData | null>(image);
  const [suggestions, setSuggestions] = useState<{ uuid: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [internalIndex, setInternalIndex] = useState<Map<string, ImageData>>(new Map(initialImageIndex));
  const internalIndexRef = useRef<Map<string, ImageData>>(new Map(initialImageIndex));

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [relatedFraction, setRelatedFraction] = useState(0.35);

  const dragRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Sync activeImage when parent's image prop changes
  useEffect(() => {
    setActiveImage(image);
    setSidebarOpen(false);
  }, [image]);

  // Merge new parent index entries into internal index (keeps internal extensions)
  useEffect(() => {
    setInternalIndex(prev => {
      const next = new Map(initialImageIndex);
      prev.forEach((v, k) => next.set(k, v));
      internalIndexRef.current = next;
      return next;
    });
  }, [initialImageIndex]);

  // Fetch suggestions when active image changes
  useEffect(() => {
    if (!activeImage) { setSuggestions([]); return; }
    let cancelled = false;
    setSuggestionsLoading(true);
    fetch(`/gms/media/suggestions?uuid=${activeImage.id}`)
      .then(r => r.json())
      .then(async (data: any[]) => {
        if (cancelled) return;
        const uuids: string[] = data.map((d: any) => d.id.PointIdOptions.Uuid);
        const missing = uuids.filter(u => !internalIndexRef.current.has(u));
        if (missing.length > 0) {
          const res = await fetch('/gms/media?want=uuid-filepath-thumbnail_filepath&offset=0&limit=10000').then(r => r.json());
          if (cancelled) return;
          const fetched = parseImages(res.content);
          const next = new Map(internalIndexRef.current);
          fetched.forEach(img => next.set(img.id, img));
          internalIndexRef.current = next;
          setInternalIndex(next);
        }
        if (!cancelled) setSuggestions(uuids.map(uuid => ({ uuid })));
      })
      .catch(err => console.error('Suggestions error:', err))
      .finally(() => { if (!cancelled) setSuggestionsLoading(false); });
    return () => { cancelled = true; };
  }, [activeImage?.id]);

  function onDragStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    dragRef.current = true;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !sidebarRef.current) return;
      const clientY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const { top, height } = sidebarRef.current.getBoundingClientRect();
      const raw = 1 - (clientY - top) / height;
      setRelatedFraction(Math.min(0.8, Math.max(0.15, raw)));
    };
    const onUp = () => {
      dragRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  // ── Shared sidebar sub-elements ─────────────────────────────────────────────

  const dragHandle = (
    <Box
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      style={{
        height: 8, flexShrink: 0, cursor: 'row-resize',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--mantine-color-dark-5)',
        userSelect: 'none',
      }}
    >
      <Box style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--mantine-color-dark-3)' }} />
    </Box>
  );

  async function handleDownload() {
    if (!activeImage) return;
    try {
      const res = await fetch(activeImage.filepath, { credentials: 'include' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: activeImage.format ? `${activeImage.id}.${activeImage.format}` : activeImage.id,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }

  const actionsContent = (
    <Stack gap="xs" p="md">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">Actions</Text>
      <Button variant="filled" color="blue" fullWidth justify="flex-start" onClick={handleDownload}>↓ Download</Button>
      <Button variant="default" fullWidth justify="flex-start">+ Add to Collection</Button>
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" mt="sm">Tags</Text>
      <Select placeholder="Select tags…" data={[]} />
      <Text size="xs" tt="uppercase" fw={600} c="dimmed" mt="sm">Metadata</Text>
      <Select placeholder="View metadata…" data={[]} />
    </Stack>
  );

  const suggestionContent = suggestionsLoading ? (
    <SimpleGrid cols={2} spacing={6} p="xs">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ aspectRatio: '1' }} radius="sm" />
      ))}
    </SimpleGrid>
  ) : suggestions.length === 0 ? (
    <Text size="xs" c="dimmed" ta="center" py="md" px="xs">No suggestions</Text>
  ) : (
    <SimpleGrid cols={2} spacing={6} p="xs">
      {suggestions.map(({ uuid }) => {
        const img = internalIndex.get(uuid);
        return (
          <Box
            key={uuid}
            onClick={() => { if (img) setActiveImage(img); }}
            style={{
              aspectRatio: '1', borderRadius: 6, overflow: 'hidden',
              background: 'var(--mantine-color-dark-6)',
              cursor: img ? 'pointer' : 'default',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (img) (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            {img && (
              <img
                src={img.thumbnail_filepath || img.filepath}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </Box>
        );
      })}
    </SimpleGrid>
  );

  // Render the sidebar panel content (called as a plain function, not a component)
  function renderSidebarContent() {
    return (
      <Box
        ref={sidebarRef}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      >
        {/* Actions — upper portion */}
        <Box style={{ flex: 1 - relatedFraction, minHeight: 0, overflow: 'hidden' }}>
          <ScrollArea h="100%">{actionsContent}</ScrollArea>
        </Box>

        {dragHandle}

        {/* Related — lower portion */}
        <Box style={{ flex: relatedFraction, minHeight: 0, overflow: 'hidden' }}>
          <ScrollArea h="100%">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" px="xs" pt="xs">Related</Text>
            {suggestionContent}
          </ScrollArea>
        </Box>
      </Box>
    );
  }

  if (!activeImage) return null;

  // ── Desktop layout ───────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <Modal
        opened={!!image}
        onClose={onClose}
        size="92vw"
        padding={0}
        withCloseButton={false}
        centered
        radius="md"
        styles={{
          content: {
            height: '90vh',
            overflow: 'hidden',
            background: 'var(--mantine-color-dark-7)',
          },
          body: {
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            padding: 0,
            overflow: 'hidden',
          },
        }}
      >
        {/* Image area */}
        <Center flex={1} p="md" style={{ overflow: 'hidden', position: 'relative' }}>
          <CloseButton
            size="md"
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}
            onClick={onClose}
          />
          <img
            src={activeImage.filepath}
            alt=""
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain', borderRadius: 8, display: 'block',
            }}
          />
        </Center>

        {/* Sidebar */}
        <Box
          w={280}
          style={{
            borderLeft: '1px solid var(--mantine-color-dark-4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderSidebarContent()}
        </Box>
      </Modal>
    );
  }

  // ── Mobile layout ────────────────────────────────────────────────────────────
  return (
    <Modal
      opened={!!image}
      onClose={onClose}
      fullScreen
      padding={0}
      withCloseButton={false}
      styles={{
        content: { background: '#000', overflow: 'hidden' },
        body: { height: '100%', padding: 0, position: 'relative', overflow: 'hidden' },
      }}
    >
      {/* Image fills the modal */}
      <Center style={{ position: 'absolute', inset: 0 }}>
        <img
          src={activeImage.filepath}
          alt=""
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain', display: 'block',
            opacity: sidebarOpen ? 0.3 : 1,
            transition: 'opacity 0.25s',
          }}
        />
      </Center>

      {/* Close button — moves left when sidebar is open */}
      <CloseButton
        size="md"
        style={{
          position: 'absolute', top: 10, zIndex: 310,
          right: sidebarOpen ? 'calc(min(280px, 85vw) + 10px)' : 10,
          transition: 'right 0.25s',
        }}
        onClick={onClose}
      />

      {/* Sidebar open tab — visible only when sidebar is closed */}
      {!sidebarOpen && (
        <Box
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'absolute', right: 0, top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 300,
            background: 'var(--mantine-color-dark-6)',
            borderRadius: '6px 0 0 6px',
            padding: '12px 6px',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: '1px solid var(--mantine-color-dark-4)',
            borderRight: 'none',
          }}
        >
          {[0, 1, 2].map(i => (
            <Box
              key={i}
              style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--mantine-color-dimmed)' }}
            />
          ))}
        </Box>
      )}

      {/* Backdrop — dims image when sidebar is open */}
      {sidebarOpen && (
        <Box
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 290, background: 'rgba(0,0,0,0.5)' }}
        />
      )}

      {/* Sidebar panel — slides in from right */}
      <Box
        style={{
          position: 'absolute', top: 0, right: 0, height: '100%',
          width: 'min(280px, 85vw)',
          background: 'var(--mantine-color-dark-7)',
          zIndex: 300,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {renderSidebarContent()}
      </Box>
    </Modal>
  );
}
