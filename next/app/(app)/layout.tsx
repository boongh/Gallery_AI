'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import SidebarNav from '@/components/SidebarNav';
import ProfileSidebar from '@/components/ProfileSidebar';

// ---------------------------------------------------------------------------
// User context — holds the UUID, username, and created_at fetched from
// GET /gms/auth/me once on mount.
// The upload URL is built as POST /gms/media/${collectionId}, where
// collectionId equals the user's UUID (each user gets one default collection
// created at sign-up time).  When /gms/auth/me is called and returns the UUID
// it is stored here so any child page can access it without re-fetching.
// ---------------------------------------------------------------------------

interface UserContextValue {
  userUUID: string | null;
  username: string | null;
  createdAt: string | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  userUUID: null,
  username: null,
  createdAt: null,
  loading: true,
});

export function useUser() {
  return useContext(UserContext);
}

function UserProvider({ children }: { children: React.ReactNode }) {
  const [userUUID, setUserUUID] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/gms/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('not authenticated');
        return res.json() as Promise<{ uuid: string; username: string; created_at: string }>;
      })
      .then(data => {
        setUserUUID(data.uuid);
        setUsername(data.username);
        setCreatedAt(data.created_at);
      })
      .catch(() => {
        // Not logged in — middleware will redirect to /login on protected
        // backend calls; let the user stay on the page and the upload will
        // simply fail with a 401 until they log in.
        setUserUUID(null);
        setUsername(null);
        setCreatedAt(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ userUUID, username, createdAt, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', background: '#0d0d0d' }}>
        <SidebarNav />
        <div style={{ flex: 1, minWidth: 0, overflowX: 'clip' }}>
          {children}
        </div>
      </div>
      <ProfileSidebar />
    </UserProvider>
  );
}
