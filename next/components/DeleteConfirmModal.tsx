'use client';
import { useEffect, useState } from 'react';
import { Box, Button, Group, Modal, Text } from '@mantine/core';

interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  count: number;
}

export default function DeleteConfirmModal({ opened, onClose, onConfirm, count }: DeleteConfirmModalProps) {
  const isBulk = count > 1;
  const [countdown, setCountdown] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!opened || !isBulk) { setCountdown(0); return; }
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [opened, isBulk]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      centered
      size="sm"
      radius="md"
      styles={{
        content: { background: 'var(--gb-modal-bg)' },
        body: { padding: '28px 24px 24px' },
      }}
    >
      <Box style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <Box style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(250,82,82,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-red-5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </Box>
      </Box>

      <Text ta="center" fw={600} size="lg" mb={8}>
        {isBulk ? `Delete ${count} images?` : 'Delete image?'}
      </Text>

      <Text ta="center" size="sm" c="dimmed" mb={isBulk ? 6 : 24}>
        This action cannot be undone.
      </Text>
      {isBulk && (
        <Text ta="center" size="sm" c="dimmed" mb={24}>
          {count} images will be permanently removed.
        </Text>
      )}

      <Group grow gap="sm">
        <Button variant="default" onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button
          variant="filled"
          color="red"
          disabled={countdown > 0}
          loading={confirming}
          onClick={handleConfirm}
        >
          {countdown > 0 ? `Delete (${countdown})` : 'Delete'}
        </Button>
      </Group>
    </Modal>
  );
}
