'use client';
import React from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Box, useMantineColorScheme } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useUser, useProfileContext } from '@/app/(app)/layout';

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
        background: 'var(--gb-border-mid)',
        border: '1px solid var(--gb-border-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {username ? (
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--gb-text-secondary)' }}>
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
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--gb-border)' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'var(--gb-text-muted)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          Gallery AI
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gb-text-primary)', lineHeight: 1.2 }}>
          Profile
        </div>
      </div>

      {/* Profile content */}
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AvatarPlaceholder username={loading ? null : username} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Username */}
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gb-text-primary)' }}>
            {loading ? '—' : (username ?? '—')}
          </div>

          {/* Member since */}
          <div style={{ fontSize: 13, color: 'var(--gb-text-tertiary)' }}>
            {loading ? '—' : formatMemberSince(createdAt)}
          </div>

          {/* UUID */}
          <div style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--gb-text-dimmed)',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}>
            {loading ? '—' : (userUUID ?? '—')}
          </div>
        </div>
      </div>

      {/* Bottom actions — pinned to bottom */}
      <div style={{ padding: '12px 12px', borderTop: '1px solid var(--gb-border)', marginTop: 'auto' }}>
        {/* Dark mode toggle */}
        <button
          onClick={toggleColorScheme}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%',
            padding: '9px 12px', borderRadius: 8,
            color: 'var(--gb-text-tertiary)', background: 'transparent',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
            transition: 'background 0.15s, color 0.15s',
            marginBottom: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gb-hover-bg)'; e.currentTarget.style.color = 'var(--gb-text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gb-text-tertiary)'; }}
        >
          <span style={{ opacity: 0.6 }}>
            {colorScheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </span>
          {colorScheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <button onClick={handleLogout}
         style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%',
          padding: '9px 12px', borderRadius: 8,
          color: 'var(--gb-text-tertiary)', background: 'transparent',
          border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 500,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gb-hover-bg)'; e.currentTarget.style.color = 'var(--gb-text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gb-text-tertiary)'; }}>
          <span style={{ opacity: 0.6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          Log out
        </button>
      </div>
    </div>
  );
}

export default function ProfileSidebar() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const { isOpen: open, closeProfile } = useProfileContext();

  const panelWidth = isMobile ? '85vw' : '240px';

  return (
    <>
      {/* Backdrop — visible on mobile and desktop when open */}
      {open && (
        <Box
          onClick={closeProfile}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 55,
            background: 'var(--gb-backdrop)',
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
          zIndex: 60,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          background: 'var(--gb-panel-bg)',
          borderLeft: '1px solid var(--gb-border)',
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
