'use client';
import { use, useEffect, useState } from 'react';
import { Box, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import PresignedImage from '@/components/PresignedImage';

interface CollectionInfo {
  uuid: string;
  name: string;
  description: string;
  thumbnail_uuid: string | null;
  created_at: string;
}

function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function CollectionInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch(`/gms/collection/${id}`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (data && data.length > 0) {
          setCollection(data[0]);
        }
      })
      .catch(err => console.error('Error fetching collection:', err))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    }
  }, [loading]);

  return (
    <Box style={{ background: 'var(--gb-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '32px 16px' }}>
      <Box style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}>
        <Button
          variant="subtle"
          size="sm"
          onClick={() => router.push('/collection')}
          leftSection={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          }
        >
          Back to Collections
        </Button>
      </Box>

      {loading ? (
        <Center h={300}>
          <Loader />
        </Center>
      ) : !collection ? (
        <Center h={300}>
          <Stack align="center" gap="xs">
            <Text size="sm" c="dimmed">Collection not found</Text>
            <Button variant="subtle" onClick={() => router.push('/collection')}>Go back</Button>
          </Stack>
        </Center>
      ) : (
        <Box
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--gb-card-bg)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 0 0 1px var(--gb-inset-border), 0 8px 32px rgba(0,0,0,0.6)',
            transform: visible ? 'translateX(0)' : 'translateX(48px)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
          }}
        >
          <Box style={{ padding: '24px 24px 0', backdropFilter: 'blur(2px)' }}>
            <Box style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '1', width: '100%' }}>
              {collection.thumbnail_uuid ? (
                <PresignedImage
                  uuid={collection.thumbnail_uuid}
                  mediaType="thumbnails"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box style={{
                  width: '100%', height: '100%',
                  background: 'var(--gb-card-bg-raised)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 48, fontWeight: 700, color: 'var(--gb-text-tertiary)' }}>
                    {getInitials(collection.name)}
                  </Text>
                </Box>
              )}
            </Box>
          </Box>

          <Box style={{ padding: '20px 24px 24px' }}>
            <Text fw={700} size="xl">{collection.name}</Text>
            {collection.description && (
              <Text size="sm" c="dimmed" mt={8}>{collection.description}</Text>
            )}
            {collection.created_at && (
              <Text size="xs" c="dimmed" mt={16}>
                Created {new Date(collection.created_at).toLocaleDateString('default', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            )}
            <Button
              variant="filled"
              fullWidth
              mt={24}
              onClick={() => router.push(`/collection/${id}/contents`)}
            >
              View Contents →
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
