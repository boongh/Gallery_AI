'use client';
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ActionIcon, Box, Button, Center, Collapse, FileInput, Group,
  Loader, Stack, Text, TextInput,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import Lightbox, { type ImageData } from '@/components/Lightbox';

export default function Home() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;

  const [images, setImages] = useState<ImageData[]>([]);
  const [lightboxImage, setLightboxImage] = useState<ImageData | null>(null);
  const [imageIndex, setImageIndex] = useState<Map<string, ImageData>>(new Map());
  const imageIndexRef = useRef<Map<string, ImageData>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [nextUrl, setNextUrl] = useState<string | null>(
    '/gms/media?offset=0&limit=100&want=uuid-filepath-thumbnail_filepath-created_at-uploaded_at'
  );
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const uploading = uploadProgress !== null;
  const [uploadOpen, { toggle: toggleUpload, close: closeUpload }] = useDisclosure(false);
  const [uploadFiles, setUploadFiles] = useState<File[] | undefined>(undefined);

  const parseImages = (raw: any[]): ImageData[] =>
    raw.map(img => ({
      id: img.uuid,
      format: img.format,
      filepath: img.filepath,
      thumbnail_filepath: img.thumbnail_filepath,
      status: img.status,
      uploadedAt: new Date(img.uploaded_at),
      createdAt: new Date(img.created_at),
      metaData: img.metadata || {},
    }));

  const loadImages = useCallback(async (url: string, append = false) => {
    try {
      const response = await fetch(url).then(r => r.json());
      const newImages = parseImages(response.content);
      setImages(prev => append ? [...prev, ...newImages] : newImages);
      setNextUrl(response.next ?? null);
      setImageIndex(prev => {
        const next = new Map(prev);
        newImages.forEach(img => next.set(img.id, img));
        imageIndexRef.current = next;
        return next;
      });
    } catch (err) {
      console.error('Error fetching images:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages('/gms/media?offset=0&limit=100&want=uuid-filepath-thumbnail_filepath-created_at-uploaded_at');
  }, [loadImages]);

  async function handleUpload() {
    if (!uploadFiles?.length) return;
    const total = uploadFiles.length;
    setUploadProgress({ current: 0, total });
    try {
      for (let i = 0; i < total; i++) {
        setUploadProgress({ current: i + 1, total });
        const formData = new FormData();
        formData.append('files', uploadFiles[i]);
        await fetch('/gms/media', { method: 'POST', body: formData });
      }
      closeUpload();
      setUploadFiles(undefined);
      setLoading(true);
      await loadImages('/gms/media?offset=0&limit=100&want=uuid-filepath-thumbnail_filepath-created_at-uploaded_at');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploadProgress(null);
    }
  }

  const filteredImages = images.filter(img =>
    searchQuery === '' ||
    img.filepath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const thumbSrc = (img: ImageData) => img.thumbnail_filepath || img.filepath;

  return (
    <Box style={{ background: '#0d0d0d', minHeight: '100vh' }}>

      {/* Top bar */}
      <Box
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(13,13,13,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? '12px 16px 12px 52px' : '12px 24px',
        }}
      >
        <Group>
          <TextInput
            flex={1}
            maw={600}
            placeholder="Search images…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftSection={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            }
          />
          {isMobile ? (
            <ActionIcon variant="default" size="lg" onClick={toggleUpload} aria-label="Upload">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </ActionIcon>
          ) : (
            <Button
              variant="default"
              onClick={toggleUpload}
              leftSection={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              }
            >
              Upload
            </Button>
          )}
        </Group>
      </Box>

      {/* Upload panel */}
      <Collapse in={uploadOpen}>
        <Box
          style={{
            margin: isMobile ? '0 8px' : '0 24px',
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
          }}
        >
          <Group>
            <FileInput
              flex={1}
              accept="image/*"
              multiple
              placeholder="Choose images…"
              value={uploadFiles}
              onChange={setUploadFiles}
            />
            <Button
              onClick={handleUpload}
              loading={uploading}
              disabled={!uploadFiles?.length}
            >
              {uploadProgress
                ? `Uploading ${uploadProgress.current} / ${uploadProgress.total}…`
                : 'Upload'}
            </Button>
          </Group>
        </Box>
      </Collapse>

      {/* Gallery grid */}
      <Box p={isMobile ? 12 : 24}>
        {loading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : filteredImages.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3} color="var(--mantine-color-dimmed)">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <Text size="sm" c="dimmed">
                {searchQuery ? 'No images match your search' : 'No images yet'}
              </Text>
            </Stack>
          </Center>
        ) : (
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px, 20vw, 180px), 1fr))',
              gap: isMobile ? 6 : 8,
            }}
          >
            {filteredImages.map(image => (
              <Box
                key={image.id}
                onClick={() => setLightboxImage(image)}
                style={{
                  aspectRatio: '1',
                  overflow: 'hidden',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: 'var(--mantine-color-dark-6)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <img
                  src={thumbSrc(image)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        )}

        {nextUrl && !loading && (
          <Center mt={32}>
            <Button variant="default" onClick={() => nextUrl && loadImages(nextUrl, true)}>
              Load more
            </Button>
          </Center>
        )}
      </Box>

      <Lightbox
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
        initialImageIndex={imageIndex}
      />
    </Box>
  );
}
