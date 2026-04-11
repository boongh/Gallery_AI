'use client';
import React from 'react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Box } from '@mantine/core';
import { useUser } from '@/app/(app)/layout';

function PersonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function AvatarPlaceholder({ username }: { username: string | null }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : '?';
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {username ? (
        <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
          {initials}
        </span>
      ) : (
        <PersonIcon size={28} />
      )}
    </div>
  );
}

function formatMemberSince(createdAt: string | null): string {
  if (!createdAt) return '—';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return '—';
  return 'Member since ' + date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function ProfilePanelContent() {
  const { userUUID, username, createdAt, loading } = useUser();

  return (
    <>
      {/* Header */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          Gallery AI
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8e8', lineHeight: 1.2 }}>
          Profile
        </div>
      </div>

      {/* Profile content */}
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AvatarPlaceholder username={loading ? null : username} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Username */}
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8e8' }}>
            {loading ? '—' : (username ?? '—')}
          </div>

          {/* Member since */}
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {loading ? '—' : formatMemberSince(createdAt)}
          </div>

          {/* UUID */}
          <div style={{
            marginTop: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}>
            {loading ? '—' : (userUUID ?? '—')}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ProfileSidebar() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const [open, { open: openPanel, close: closePanel }] = useDisclosure(false);

  const panelWidth = isMobile ? '85vw' : '240px';

  return (
    <>
      {/* Profile icon button — fixed top-right */}
      <ActionIcon
        variant="subtle"
        size="lg"
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 220 }}
        onClick={openPanel}
        aria-label="Open profile"
      >
        <PersonIcon size={18} />
      </ActionIcon>

      {/* Backdrop — visible on mobile and desktop when open */}
      {open && (
        <Box
          onClick={closePanel}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 240,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}

      {/* Profile panel — slides in from the right */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: panelWidth,
          zIndex: 250,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          background: 'rgba(20,20,20,0.98)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
        }}
      >
        <ProfilePanelContent />
      </Box>
    </>
  );
}
