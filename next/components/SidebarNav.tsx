'use client';
import Link from 'next/link';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Box } from '@mantine/core';
import { useRouter } from 'next/navigation';
import React from 'react';

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
        color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
        fontSize: 14, fontWeight: 500,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.color = '#fff';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
      }}
    >
      <span style={{ opacity: 0.7 }}>{icon}</span>
      {children}
    </Link>
  );
}

function NavPanelContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const router = useRouter();

  async function handleLogout() {
    // Clear the auth_token cookie by calling a dedicated endpoint if one
    // exists, or by simply navigating to /login. For now we rely on the
    // browser's cookie expiry; a proper logout endpoint can be added later.
    // If the backend gains a DELETE /gms/auth/session endpoint, call it here.
    router.push('/login');
    onLinkClick?.();
  }

  return (
    <>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>
          Gallery AI
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8e8', lineHeight: 1.2 }}>
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

      {/* Bottom: log out link */}
      <div style={{ padding: '12px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%',
            padding: '9px 12px', borderRadius: 8,
            color: 'rgba(255,255,255,0.5)', background: 'transparent',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
          }}
        >
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
    </>
  );
}

export default function SidebarNav() {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;
  const [open, { open: openNav, close: closeNav }] = useDisclosure(false);

  if (isMobile) {
    return (
      <>
        {/* Hamburger button — fixed top-left, always visible on mobile */}
        <ActionIcon
          variant="subtle"
          size="lg"
          style={{ position: 'fixed', top: 12, left: 12, zIndex: 220 }}
          onClick={openNav}
          aria-label="Open navigation"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </ActionIcon>

        {/* Backdrop — dims main content to the right */}
        {open && (
          <Box
            onClick={closeNav}
            style={{
              position: 'fixed', inset: 0, zIndex: 240,
              background: 'rgba(0,0,0,0.5)',
            }}
          />
        )}

        {/* Nav overlay panel — slides in from left */}
        <Box
          style={{
            position: 'fixed', top: 0, left: 0,
            height: '100vh', width: 200,
            zIndex: 250,
            transform: open ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            background: 'rgba(20,20,20,0.98)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
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
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0',
      }}
    >
      <NavPanelContent />
    </Box>
  );
}
