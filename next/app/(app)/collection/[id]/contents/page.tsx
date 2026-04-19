'use client';
import { use, useEffect, useState, type ReactElement } from 'react';
import {
  ActionIcon, Box, Button, Center, Group, Loader, Stack, Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import Lightbox, { type ImageData } from '@/components/Lightbox';
import { useNavContext } from '@/app/(app)/layout';

type DayGroup = { year: number; month: number; day: number; images: ImageData[] };

function groupImagesByDate(images: ImageData[]): DayGroup[] {
  const map = new Map<string, ImageData[]>();
  for (const img of images) {
    const d = img.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(img);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, imgs]) => {
      const [year, month, day] = key.split('-').map(Number);
      return { year, month, day, images: imgs };
    });
}

export default function CollectionContentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const router = useRouter();
  const { openNav } = useNavContext();

  const [collectionName, setCollectionName] = useState<string>('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [imageIndex, setImageIndex] = useState<Map<string, ImageData>>(new Map());
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<ImageData | null>(null);

  function toAbsolute(url: string | undefined): string {
    if (!url) return '';
    return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`;
  }

  function parseContents(raw: any[]): ImageData[] {
    return raw.map(img => ({
      id: img.uuid,
      original_url: toAbsolute(img.original_url),
      thumbnail_url: toAbsolute(img.thumbnail_url),
      preview_url: toAbsolute(img.preview_url),
      format: '',
      status: '',
      createdAt: img.created_at ? new Date(img.created_at) : new Date(0),
      uploadedAt: new Date(0),
      metaData: {},
    }));
  }

  async function loadContents(url: string, append = false) {
    try {
      const res = await fetch(url).then(r => r.json());
      const newImages = parseContents(res.content ?? []);
      setImages(prev => append ? [...prev, ...newImages] : newImages);
      setNextUrl(res.next ?? null);
      setImageIndex(prev => {
        const next = new Map(prev);
        newImages.forEach(img => next.set(img.id, img));
        return next;
      });
    } catch (err) {
      console.error('Error fetching collection contents:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch(`/gms/collection/${id}`)
      .then(r => r.json())
      .then((data: any[]) => { if (data && data.length > 0) setCollectionName(data[0].name ?? ''); })
      .catch(err => console.error('Error fetching collection info:', err));

    loadContents(`/gms/collection/${id}/contents?want=uuid-original_url-thumbnail_url-preview_url-created_at&offset=0&limit=100`);
  }, [id]);

  const groups = groupImagesByDate(images);

  return (
    <Box style={{ background: '#0d0d0d', minHeight: '100vh' }}>
      <Box
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(13,13,13,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? '12px 16px' : '12px 24px',
        }}
      >
        <Group>
          {isMobile && (
            <ActionIcon variant="subtle" size="lg" onClick={openNav} aria-label="Open navigation">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </ActionIcon>
          )}
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => router.push('/collection')}
            aria-label="Back to collections"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </ActionIcon>
          <Text fw={600} size="lg" style={{ flex: 1 }}>
            {collectionName || 'Collection'}
          </Text>
        </Group>
      </Box>

      <Box p={isMobile ? 12 : 24}>
        {loading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : images.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3} color="var(--mantine-color-dimmed)">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <Text size="sm" c="dimmed">No images in this collection</Text>
            </Stack>
          </Center>
        ) : (() => {
          let lastYear: number | null = null;
          let lastMonth: number | null = null;
          const sections: ReactElement[] = [];
          for (const { year, month, day, images: groupImages } of groups) {
            const showYear = year !== lastYear;
            const showMonth = showYear || month !== lastMonth;
            lastYear = year;
            lastMonth = month;
            const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
            const dayLabel = new Date(year, month, day).toLocaleString('default', { weekday: 'long', day: 'numeric' });
            sections.push(
              <Box key={`${year}-${month}-${day}`}>
                {showYear && (
                  <Text style={{ fontSize: isMobile ? 24 : 30, fontWeight: 700, marginTop: sections.length === 0 ? 0 : 32 }}>
                    {year}
                  </Text>
                )}
                {showMonth && (
                  <Text style={{ fontSize: isMobile ? 16 : 20, fontWeight: 600, marginTop: showYear ? 4 : 24 }}>
                    {monthLabel}
                  </Text>
                )}
                <Text size="sm" c="dimmed" mb={8} mt={showMonth ? 4 : 16}>{dayLabel}</Text>
                <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px, 20vw, 180px), 1fr))', gap: isMobile ? 6 : 8, marginBottom: 8 }}>
                  {groupImages.map(image => (
                    <Box
                      key={image.id}
                      onClick={() => setLightboxImage(image)}
                      style={{
                        aspectRatio: '1', overflow: 'hidden', borderRadius: 8, cursor: 'pointer',
                        background: 'var(--mantine-color-dark-6)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <img
                        src={image.thumbnail_url || image.preview_url || image.original_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { const el = e.currentTarget; if (el.src.includes('/thumbnails/')) { el.src = image.preview_url || image.original_url; } else if (el.src.includes('/previews/')) { el.src = image.original_url; } }}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          }
          return <>{sections}</>;
        })()}

        {nextUrl && !loading && images.length > 0 && (
          <Center mt={32}>
            <Button variant="default" onClick={() => nextUrl && loadContents(nextUrl, true)}>
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
