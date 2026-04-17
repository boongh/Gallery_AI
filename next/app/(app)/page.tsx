'use client';
import { useEffect, useState, useCallback, useRef, type ReactElement } from "react";
import {
  ActionIcon, Box, Button, Center, Collapse, FileInput, Group,
  Loader, Stack, Text, TextInput,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import Lightbox, { type ImageData } from '@/components/Lightbox';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { useUser, useNavContext, useProfileContext } from './layout';

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

export default function Home() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const { userUUID } = useUser();
  const { openNav } = useNavContext();
  const { openProfile } = useProfileContext();

  const [images, setImages] = useState<ImageData[]>([]);
  const [lightboxImage, setLightboxImage] = useState<ImageData | null>(null);
  const [imageIndex, setImageIndex] = useState<Map<string, ImageData>>(new Map());
  const imageIndexRef = useRef<Map<string, ImageData>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ImageData[] | null>(null);
  const [searchNextBody, setSearchNextBody] = useState<object | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [nextUrl, setNextUrl] = useState<string | null>(
    '/gms/media?offset=0&limit=100&want=uuid-original_url-thumbnail_url-preview_url-created_at-uploaded_at'
  );
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const uploading = uploadProgress !== null;
  const [uploadOpen, { toggle: toggleUpload, close: closeUpload }] = useDisclosure(false);
  const [uploadFiles, setUploadFiles] = useState<File[] | undefined>(undefined);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const parseImages = (raw: any[]): ImageData[] =>
    raw.map(img => ({
      id: img.uuid,
      format: img.format,
      original_url: img.original_url,
      thumbnail_url: img.thumbnail_url,
      preview_url: img.preview_url ?? '',
      status: img.status,
      uploadedAt: new Date(img.uploaded_at),
      createdAt: new Date(img.created_at),
      metaData: img.metadata || {},
    }));

  const parseSearchResults = (raw: any[]): ImageData[] =>
    raw.map(r => ({
      id: r.id,
      original_url: r.original_url ?? '',
      thumbnail_url: r.thumbnail_url ?? '',
      preview_url: r.preview_url ?? '',
      status: r.status ?? '',
      format: '',
      uploadedAt: r.created_at ? new Date(r.created_at) : new Date(0),
      createdAt: r.created_at ? new Date(r.created_at) : new Date(0),
      metaData: {},
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
    loadImages('/gms/media?offset=0&limit=100&want=uuid-original_url-thumbnail_url-preview_url-created_at-uploaded_at');
  }, [loadImages]);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchNextBody(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch('/gms/media/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text_query: searchQuery, limit: 40 }),
      }).then(r => r.json());
      const results = parseSearchResults(res.content ?? []);
      setSearchResults(results);
      setSearchNextBody(res.next ?? null);
      setImageIndex(prev => {
        const next = new Map(prev);
        results.forEach(img => next.set(img.id, img));
        imageIndexRef.current = next;
        return next;
      });
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSearchLoadMore() {
    if (!searchNextBody) return;
    setSearchLoading(true);
    try {
      const res = await fetch('/gms/media/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchNextBody),
      }).then(r => r.json());
      const more = parseSearchResults(res.content ?? []);
      setSearchResults(prev => [...(prev ?? []), ...more]);
      setSearchNextBody(res.next ?? null);
      setImageIndex(prev => {
        const next = new Map(prev);
        more.forEach(img => next.set(img.id, img));
        imageIndexRef.current = next;
        return next;
      });
    } catch (err) {
      console.error('Search load more error:', err);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearchClear() {
    setSearchQuery('');
    setSearchResults(null);
    setSearchNextBody(null);
  }

  async function handleUpload() {
    if (!uploadFiles?.length) return;
    const total = uploadFiles.length;
    setUploadProgress({ current: 0, total });
    const uploadStart = performance.now();
    console.log(`[Upload] Starting upload of ${total} file(s)`);
    try {
      for (let i = 0; i < total; i++) {
        setUploadProgress({ current: i + 1, total });
        const fileStart = performance.now();
        const formData = new FormData();
        formData.append('files', uploadFiles[i]);
        const uploadUrl = userUUID ? `/gms/media/${userUUID}` : '/gms/media/me';
        await fetch(uploadUrl, { method: 'POST', body: formData });
        console.log(`[Upload] File ${i + 1}/${total} (${uploadFiles[i].name}) — ${(performance.now() - fileStart).toFixed(0)}ms`);
      }
      console.log(`[Upload] All done — total ${(performance.now() - uploadStart).toFixed(0)}ms`);
      closeUpload();
      setUploadFiles(undefined);
      setLoading(true);
      await loadImages('/gms/media?offset=0&limit=100&want=uuid-original_url-thumbnail_url-preview_url-created_at-uploaded_at');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploadProgress(null);
    }
  }

  function toggleSelectMode() {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }

  function toggleImageSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const isSearchActive = searchResults !== null;
  const displayedImages = isSearchActive ? searchResults : images;
  const thumbSrc = (img: ImageData) => img.thumbnail_url || img.original_url;

  const allSelected = displayedImages.length > 0 && displayedImages.every(img => selectedIds.has(img.id));

  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedImages.map(img => img.id)));
    }
  }

  async function handleBulkDownload() {
    for (const id of selectedIds) {
      const img = imageIndexRef.current.get(id);
      if (!img) continue;
      try {
        const res = await fetch(img.original_url, { credentials: 'include' });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), {
          href: url,
          download: img.format ? `${img.id}.${img.format}` : img.id,
        });
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(`Download failed for ${id}:`, err);
      }
    }
  }

  async function doBulkDelete() {
    const ids = [...selectedIds];
    const res = await fetch('/gms/media/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_id: ids }),
    });
    if (res.status === 204) {
      setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
      setImageIndex(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        imageIndexRef.current = next;
        return next;
      });
      if (isSearchActive) {
        setSearchResults(prev => prev ? prev.filter(img => !selectedIds.has(img.id)) : null);
      }
      setSelectedIds(new Set());
      setSelectMode(false);
      setDeleteModalOpen(false);
    }
  }

  function handleLightboxDelete(id: string) {
    setImages(prev => prev.filter(img => img.id !== id));
    setImageIndex(prev => {
      const next = new Map(prev);
      next.delete(id);
      imageIndexRef.current = next;
      return next;
    });
    if (isSearchActive) {
      setSearchResults(prev => prev ? prev.filter(img => img.id !== id) : null);
    }
  }

  return (
    <Box style={{ background: '#0d0d0d', minHeight: '100vh' }}>

      {/* Top bar */}
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
          <TextInput
            flex={1}
            maw={600}
            placeholder="Search images…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            rightSection={
              isSearchActive ? (
                <ActionIcon variant="subtle" size="sm" onClick={handleSearchClear} aria-label="Clear search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </ActionIcon>
              ) : null
            }
            leftSection={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            }
          />
          <ActionIcon variant="default" size="lg" onClick={handleSearch} loading={searchLoading} aria-label="Search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </ActionIcon>
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
          {isMobile ? (
            <ActionIcon
              variant={selectMode ? 'filled' : 'default'}
              size="lg"
              onClick={toggleSelectMode}
              aria-label="Toggle selection mode"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="m14 17 2 2 4-4"/>
              </svg>
            </ActionIcon>
          ) : (
            <Button
              variant={selectMode ? 'filled' : 'default'}
              onClick={toggleSelectMode}
              leftSection={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <path d="m14 17 2 2 4-4"/>
                </svg>
              }
            >
              Select
            </Button>
          )}
          <ActionIcon variant="subtle" size="lg" onClick={openProfile} aria-label="Open profile" ml="auto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </ActionIcon>
        </Group>
      </Box>

      {/* Selection action bar */}
      {selectMode && (
        <Box
          style={{
            background: 'rgba(20,20,20,0.92)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '8px 24px',
          }}
        >
          <Group gap="xs">
            <Text size="sm" c="dimmed" style={{ minWidth: 80 }}>
              {selectedIds.size} selected
            </Text>
            <Button size="sm" variant="subtle" onClick={handleSelectAll}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
            <Box style={{ flex: 1 }} />
            <Button size="sm" variant="default" disabled>
              Share
            </Button>
            <Button size="sm" variant="default" disabled>
              Move to Collection
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={selectedIds.size === 0}
              onClick={handleBulkDownload}
            >
              Download
            </Button>
            <Button
              size="sm"
              variant="light"
              color="red"
              disabled={selectedIds.size === 0}
              onClick={() => setDeleteModalOpen(true)}
            >
              Delete
            </Button>
          </Group>
        </Box>
      )}

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
              styles={{ input: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
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
        {loading && !isSearchActive ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : searchLoading && displayedImages.length === 0 ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : displayedImages.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3} color="var(--mantine-color-dimmed)">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <Text size="sm" c="dimmed">
                {isSearchActive ? 'No results for that search' : 'No images yet'}
              </Text>
            </Stack>
          </Center>
        ) : isSearchActive ? (
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px, 20vw, 180px), 1fr))', gap: isMobile ? 6 : 8 }}>
            {displayedImages.map(image => {
              const isSelected = selectedIds.has(image.id);
              return (
                <Box
                  key={image.id}
                  onClick={() => { if (selectMode) { toggleImageSelection(image.id); } else { setLightboxImage(image); } }}
                  style={{
                    aspectRatio: '1', overflow: 'hidden', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--mantine-color-dark-6)', position: 'relative',
                    transition: selectMode ? 'none' : 'transform 0.15s, box-shadow 0.15s',
                    outline: isSelected ? '2px solid var(--mantine-color-blue-5)' : 'none',
                    outlineOffset: '-2px',
                  }}
                  onMouseEnter={e => { if (selectMode) return; (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'; }}
                  onMouseLeave={e => { if (selectMode) return; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  <img src={thumbSrc(image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { const el = e.currentTarget; if (el.src.includes('/thumbnails/')) { el.src = image.preview_url || image.original_url; } else if (el.src.includes('/previews/')) { el.src = image.original_url; } }}
                  />
                  {isSelected && (
                    <Box style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 6 }}>
                      <Box style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--mantine-color-blue-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </Box>
                    </Box>
                  )}
                  {selectMode && !isSelected && (
                    <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 6 }}>
                      <Box style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (() => {
          const groups = groupImagesByDate(images);
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
                  {groupImages.map(image => {
                    const isSelected = selectedIds.has(image.id);
                    return (
                      <Box
                        key={image.id}
                        onClick={() => { if (selectMode) { toggleImageSelection(image.id); } else { setLightboxImage(image); } }}
                        style={{
                          aspectRatio: '1', overflow: 'hidden', borderRadius: 8, cursor: 'pointer',
                          background: 'var(--mantine-color-dark-6)', position: 'relative',
                          transition: selectMode ? 'none' : 'transform 0.15s, box-shadow 0.15s',
                          outline: isSelected ? '2px solid var(--mantine-color-blue-5)' : 'none',
                          outlineOffset: '-2px',
                        }}
                        onMouseEnter={e => { if (selectMode) return; (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'; }}
                        onMouseLeave={e => { if (selectMode) return; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      >
                        <img src={thumbSrc(image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { const el = e.currentTarget; if (el.src.includes('/thumbnails/')) { el.src = image.preview_url || image.original_url; } else if (el.src.includes('/previews/')) { el.src = image.original_url; } }}
                        />
                        {isSelected && (
                          <Box style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 6 }}>
                            <Box style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--mantine-color-blue-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </Box>
                          </Box>
                        )}
                        {selectMode && !isSelected && (
                          <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 6 }}>
                            <Box style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }} />
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          }
          return <>{sections}</>;
        })()}

        {!isSearchActive && nextUrl && !loading && images.length > 0 && (
          <Center mt={32}>
            <Button variant="default" onClick={() => nextUrl && loadImages(nextUrl, true)}>
              Load more
            </Button>
          </Center>
        )}

        {isSearchActive && searchNextBody && (
          <Center mt={32}>
            <Button variant="default" loading={searchLoading} onClick={handleSearchLoadMore}>
              Load more
            </Button>
          </Center>
        )}
      </Box>

      <Lightbox
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
        initialImageIndex={imageIndex}
        onDelete={handleLightboxDelete}
      />
      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={doBulkDelete}
        count={selectedIds.size}
      />
    </Box>
  );
}
