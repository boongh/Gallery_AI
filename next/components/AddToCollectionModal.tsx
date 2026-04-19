'use client';
import { useEffect, useState } from 'react';
import {
  Box, Button, Center, Group, Loader, Modal,
  Stack, Text, Textarea, TextInput,
} from '@mantine/core';

interface Collection {
  uuid: string;
  name: string;
  description: string;
  thumbnail_url: string | null;
}

interface AddToCollectionModalProps {
  opened: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
}

function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function AddToCollectionModal({ opened, onClose, selectedIds }: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!opened) {
      setShowCreateForm(false);
      setCreateName('');
      setCreateDescription('');
      setError(null);
      return;
    }
    setLoadingCollections(true);
    fetch('/gms/collection?offset=0&limit=100')
      .then(r => r.json())
      .then(data => setCollections(data.content ?? []))
      .catch(err => console.error('Error fetching collections:', err))
      .finally(() => setLoadingCollections(false));
  }, [opened]);

  async function addToCollection(collectionId: string) {
    setAddingTo(collectionId);
    setError(null);
    try {
      const res = await fetch(`/gms/collection/${collectionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_uuids: [...selectedIds] }),
      });
      if (res.status === 201) {
        onClose();
      } else {
        setError('Failed to add images to collection.');
      }
    } catch (err) {
      setError('Failed to add images to collection.');
    } finally {
      setAddingTo(null);
    }
  }

  async function handleCreateAndAdd() {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const createRes = await fetch('/gms/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), description: createDescription.trim() }),
      });
      if (createRes.status !== 201) {
        setError('Failed to create collection.');
        return;
      }
      const newId = await createRes.text();
      const addRes = await fetch(`/gms/collection/${newId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_uuids: [...selectedIds] }),
      });
      if (addRes.status === 201) {
        onClose();
      } else {
        setError('Collection created but failed to add images.');
      }
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add to Collection"
      withCloseButton
      centered
      size="md"
      styles={{
        content: { background: 'var(--mantine-color-dark-7)' },
        header: { background: 'var(--mantine-color-dark-7)' },
      }}
    >
      {loadingCollections ? (
        <Center py={40}>
          <Loader />
        </Center>
      ) : (
        <Stack gap={0}>
          <Box style={{ maxHeight: 360, overflowY: 'auto' }}>
            {collections.length === 0 && !showCreateForm ? (
              <Text size="sm" c="dimmed" ta="center" py="md">No collections yet</Text>
            ) : (
              collections.map(col => (
                <Box
                  key={col.uuid}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 10, borderRadius: 8, cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--mantine-color-dark-5)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={() => addingTo === null && addToCollection(col.uuid)}
                >
                  <Box style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                    {col.thumbnail_url ? (
                      <img
                        src={col.thumbnail_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <Box style={{
                        width: '100%', height: '100%',
                        background: 'var(--mantine-color-dark-4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                          {getInitials(col.name)}
                        </Text>
                      </Box>
                    )}
                  </Box>
                  <Text fw={500} style={{ flex: 1 }}>{col.name}</Text>
                  {addingTo === col.uuid && <Loader size="xs" />}
                </Box>
              ))
            )}
          </Box>

          {error && (
            <Text size="xs" c="red" mt={8}>{error}</Text>
          )}

          {showCreateForm ? (
            <Box mt={12} style={{ borderTop: '1px solid var(--mantine-color-dark-4)', paddingTop: 12 }}>
              <Stack gap="sm">
                <TextInput
                  label="Collection name"
                  placeholder="Name"
                  required
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                />
                <Textarea
                  label="Description"
                  placeholder="Optional"
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  rows={2}
                />
                <Group justify="flex-end">
                  <Button variant="subtle" size="sm" onClick={() => { setShowCreateForm(false); setCreateName(''); setCreateDescription(''); }}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={creating} disabled={!createName.trim()} onClick={handleCreateAndAdd}>
                    Create & Add
                  </Button>
                </Group>
              </Stack>
            </Box>
          ) : (
            <Button
              variant="subtle"
              fullWidth
              mt={8}
              onClick={() => setShowCreateForm(true)}
            >
              + Create new collection &amp; add
            </Button>
          )}
        </Stack>
      )}
    </Modal>
  );
}
