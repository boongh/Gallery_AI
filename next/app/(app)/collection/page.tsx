'use client';
import { useEffect, useState } from 'react';
import {
  ActionIcon, Box, Button, Center, Group, Loader,
  Modal, Stack, Text, Textarea, TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { useNavContext, useProfileContext } from '@/app/(app)/layout';

interface Collection {
  uuid: string;
  name: string;
  description: string;
  thumbnail_url: string | null;
  created_at: string;
}

function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function CollectionPage() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const router = useRouter();
  const { openNav } = useNavContext();
  const { openProfile } = useProfileContext();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

  async function loadCollections(url: string, append = false) {
    try {
      const res = await fetch(url).then(r => r.json());
      const items: Collection[] = res.content ?? [];
      setCollections(prev => append ? [...prev, ...items] : items);
      setNextUrl(res.next ?? null);
    } catch (err) {
      console.error('Error fetching collections:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollections('/gms/collection?offset=0&limit=100');
  }, []);

  async function handleCreate() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/gms/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), description: createDescription.trim() }),
      });
      if (res.status === 201) {
        setCreateOpen(false);
        setCreateName('');
        setCreateDescription('');
        setLoading(true);
        await loadCollections('/gms/collection?offset=0&limit=100');
      }
    } catch (err) {
      console.error('Error creating collection:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/gms/collection/${deleteTarget.uuid}`, { method: 'DELETE' });
    if (res.status === 204) {
      setCollections(prev => prev.filter(c => c.uuid !== deleteTarget.uuid));
      setDeleteTarget(null);
    }
  }

  return (
    <Box style={{ background: 'var(--gb-bg)', minHeight: '100vh' }}>
      <Box
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--gb-header-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--gb-border-mid)',
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
          <Text fw={600} size="lg" style={{ flex: 1 }}>Collections</Text>
          {isMobile ? (
            <ActionIcon variant="default" size="lg" onClick={() => setCreateOpen(true)} aria-label="New collection">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </ActionIcon>
          ) : (
            <Button
              variant="default"
              onClick={() => setCreateOpen(true)}
              leftSection={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              }
            >
              New Collection
            </Button>
          )}
          <ActionIcon variant="subtle" size="lg" onClick={openProfile} aria-label="Open profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </ActionIcon>
        </Group>
      </Box>

      <Box p={isMobile ? 12 : 24}>
        {loading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : collections.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3} color="var(--mantine-color-dimmed)">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
              <Text size="sm" c="dimmed">No collections yet</Text>
            </Stack>
          </Center>
        ) : (
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {collections.map(col => (
              <Box
                key={col.uuid}
                style={{
                  background: 'var(--gb-card-bg)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--gb-shadow)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
                onClick={() => router.push(`/collection/${col.uuid}/contents`)}
              >
                <Box style={{ aspectRatio: '1', overflow: 'hidden', position: 'relative' }}>
                  {col.thumbnail_url ? (
                    <img
                      src={col.thumbnail_url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Box style={{
                      width: '100%', height: '100%',
                      background: 'var(--gb-card-bg-raised)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 28, fontWeight: 700, color: 'var(--gb-text-tertiary)' }}>
                        {getInitials(col.name)}
                      </Text>
                    </Box>
                  )}
                </Box>
                <Box style={{ padding: 12 }}>
                  <Text fw={600} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {col.name}
                  </Text>
                  {col.description && (
                    <Text size="xs" c="dimmed" style={{
                      marginTop: 4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {col.description}
                    </Text>
                  )}
                </Box>
                <Box style={{
                  padding: '8px 12px',
                  borderTop: '1px solid var(--gb-card-bg-raised)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    aria-label="Delete collection"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(col); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </ActionIcon>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {nextUrl && !loading && collections.length > 0 && (
          <Center mt={32}>
            <Button variant="default" onClick={() => nextUrl && loadCollections(nextUrl, true)}>
              Load more
            </Button>
          </Center>
        )}
      </Box>

      <Modal
        opened={createOpen}
        onClose={() => { setCreateOpen(false); setCreateName(''); setCreateDescription(''); }}
        title="New Collection"
        centered
        size="sm"
        styles={{
          content: { background: 'var(--gb-modal-bg)' },
          header: { background: 'var(--gb-modal-bg)' },
        }}
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Collection name"
            required
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={createDescription}
            onChange={e => setCreateDescription(e.target.value)}
            rows={3}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => { setCreateOpen(false); setCreateName(''); setCreateDescription(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={!createName.trim()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <DeleteConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        count={1}
      />
    </Box>
  );
}
