'use client';
import React, { useState, useRef, useCallback } from 'react';
import {
  ActionIcon, Badge, Box, Button, Center, Group,
  Loader, Stack, Text, TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import Lightbox, { type ImageData } from '@/components/Lightbox';

interface QueryResult {
  id: string;
  score: number;
  payload: {
    thumbnail_filepath?: { string_value: string };
    filepath?: { string_value: string };
  };
}

interface QueryResponse {
  content: {
    results: QueryResult[];
  };
  next: {
    point_query: number[][];
    offset: number;
    limit: number;
  } | null;
}

function mapResult(result: QueryResult): ImageData {
  return {
    id: result.id,
    filepath: result.payload?.filepath?.string_value ?? '',
    thumbnail_filepath: result.payload?.thumbnail_filepath?.string_value ?? '',
    format: '',
    status: '',
    createdAt: new Date(0),
    uploadedAt: new Date(0),
    metaData: {},
  };
}

export default function SearchPage() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;

  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<ImageData[]>([]);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [nextBody, setNextBody] = useState<{ point_query: number[][]; offset: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<ImageData | null>(null);
  const [imageIndex, setImageIndex] = useState<Map<string, ImageData>>(new Map());
  const imageIndexRef = useRef<Map<string, ImageData>>(new Map());

  const addToIndex = useCallback((images: ImageData[]) => {
    setImageIndex(prev => {
      const next = new Map(prev);
      images.forEach(img => next.set(img.id, img));
      imageIndexRef.current = next;
      return next;
    });
  }, []);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setResultCount(null);
    setNextBody(null);
    try {
      const res = await fetch('/gms/media/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text_query: query.trim(), limit: 20, offset: 0 }),
      });
      const data: QueryResponse = await res.json();
      const mapped = (data.content?.results ?? []).map(mapResult);
      setResults(mapped);
      setResultCount(mapped.length);
      setNextBody(data.next ?? null);
      addToIndex(mapped);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextBody) return;
    setLoadingMore(true);
    try {
      const res = await fetch('/gms/media/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextBody),
      });
      const data: QueryResponse = await res.json();
      const mapped = (data.content?.results ?? []).map(mapResult);
      setResults(prev => [...prev, ...mapped]);
      setResultCount(prev => (prev ?? 0) + mapped.length);
      setNextBody(data.next ?? null);
      addToIndex(mapped);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      runSearch(inputValue);
    }
  }

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
            placeholder="Search by description, scene, objects…"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            leftSection={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            }
          />
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => runSearch(inputValue)}
            aria-label="Search"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </ActionIcon>
          {resultCount !== null && (
            <Badge variant="default" color="gray" radius="sm" size="md">
              {resultCount} result{resultCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </Group>
      </Box>

      {/* Results grid */}
      <Box p={isMobile ? 12 : 24}>
        {loading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : !hasSearched ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3} color="var(--mantine-color-dimmed)">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <Text size="sm" c="dimmed">Enter a search term and press Enter</Text>
            </Stack>
          </Center>
        ) : results.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3} color="var(--mantine-color-dimmed)">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <Text size="sm" c="dimmed">No results found</Text>
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
            {results.map(image => (
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

        {nextBody && !loading && (
          <Center mt={32}>
            <Button
              variant="default"
              onClick={loadMore}
              loading={loadingMore}
            >
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
