'use client';
import Link from 'next/link';
import { useMediaQuery } from '@mantine/hooks';
import { Box } from '@mantine/core';
import React from 'react';
import { useNavContext } from '@/app/(app)/layout';

function NavLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 8,
        color: 'var(--gb-text-secondary)', textDecoration: 'none',
        fontSize: 14, fontWeight: 500,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--gb-hover-bg)';
        (e.currentTarget as HTMLElement).style.color = 'var(--gb-text-primary)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--gb-text-secondary)';
      }}
    >
      <span style={{ opacity: 0.7 }}>{icon}</span>
      {children}
    </Link>
  );
}

function NavPanelContent({ onLinkClick }: { onLinkClick?: () => void }) {
  return (
    <>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--gb-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--gb-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          Gallery AI
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gb-text-primary)', lineHeight: 1.2 }}>
          My Images
        </div>
      </div>
      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <NavLink
          href="/"
          onClick={onLinkClick}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          }
        >
          Gallery
        </NavLink>
        <NavLink
          href="/search"
          onClick={onLinkClick}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          }
        >
          Search
        </NavLink>
        <NavLink
          href="/collection"
          onClick={onLinkClick}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          }
        >
          Collections
        </NavLink>
      </nav>
    </>
  );
}

export default function SidebarNav() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const { isOpen: open, closeNav } = useNavContext();

  if (isMobile) {
    return (
      <>
        {/* Backdrop — dims main content when nav is open */}
        {open && (
          <Box
            onClick={closeNav}
            style={{
              position: 'fixed', inset: 0, zIndex: 55,
              background: 'var(--gb-backdrop)',
            }}
          />
        )}

        {/* Nav overlay panel — slides in from left */}
        <Box
          style={{
            position: 'fixed', top: 0, left: 0,
            height: '100vh', width: 200,
            zIndex: 60,
            transform: open ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            background: 'var(--gb-panel-bg)',
            borderRight: '1px solid var(--gb-border)',
            display: 'flex', flexDirection: 'column',
            padding: '24px 0',
          }}
        >
          <NavPanelContent onLinkClick={closeNav} />
        </Box>
      </>
    );
  }

  // Desktop — sticky sidebar in the flex layout
  return (
    <Box
      style={{
        width: 200, flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
        background: 'var(--gb-sidebar-bg)',
        borderRight: '1px solid var(--gb-border)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0',
      }}
    >
      <NavPanelContent />
    </Box>
  );
}
