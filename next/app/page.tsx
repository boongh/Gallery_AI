'use client';
import React, { useEffect, useState, useCallback, useRef } from "react";

interface ImageData {
  id: string;
  format: string;
  filepath: string;
  thumbnail_filepath: string;
  status: string;
  createdAt: Date;
  uploadedAt: Date;
  metaData: object;
}

export default function Home() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [lightboxImage, setLightboxImage] = useState<ImageData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextUrl, setNextUrl] = useState<string | null>(
    '/gms/media?offset=0&limit=100&want=uuid-filepath-thumbnail_filepath-created_at-uploaded_at'
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseImages = (raw: any[]): ImageData[] =>
    raw.map(img => ({
      id: img.uuid,
      format: img.format,
      filepath: img.filepath,
      thumbnail_filepath: img.thumbnail_filepath,
      status: img.status,
      uploadedAt: new Date(img.uploaded_at),
      createdAt: new Date(img.created_at),
      metaData: img.metadata || {},
    }));

  const loadImages = useCallback(async (url: string, append = false) => {
    try {
      const response = await fetch(url).then(r => r.json());
      const newImages = parseImages(response.content);
      setImages(prev => append ? [...prev, ...newImages] : newImages);
      setNextUrl(response.next ?? null);
    } catch (err) {
      console.error('Error fetching images:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages('/gms/media?offset=0&limit=100&want=uuid-filepath-thumbnail_filepath-created_at-uploaded_at');
  }, [loadImages]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  async function handleUpload(files: FileList) {
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      await fetch('/gms/media', { method: 'POST', body: formData });
      setUploadOpen(false);
      setLoading(true);
      await loadImages('/gms/media?offset=0&limit=100&want=uuid-filepath-thumbnail_filepath-created_at-uploaded_at');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  }

  const filteredImages = images.filter(img =>
    searchQuery === '' ||
    img.filepath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const thumbSrc = (img: ImageData) => img.thumbnail_filepath || img.filepath;

  return (
    <div className="min-h-screen" style={{ background: '#0d0d0d', color: '#e8e8e8' }}>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(13,13,13,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 600 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search images…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 14px 8px 38px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: '#e8e8e8', fontSize: 14,
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
          />
        </div>

        <button
          onClick={() => setUploadOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#e8e8e8', fontSize: 13, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.17)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload
        </button>
      </div>

      {/* Upload panel */}
      {uploadOpen && (
        <div style={{
          margin: '0 24px',
          padding: '16px 20px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}
          />
          <button
            onClick={() => {
              const files = fileInputRef.current?.files;
              if (files && files.length > 0) handleUpload(files);
            }}
            disabled={uploading}
            style={{
              padding: '7px 18px', borderRadius: 8,
              background: uploading ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.8)',
              border: 'none', color: '#fff', fontSize: 13,
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}

      {/* Gallery grid */}
      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Loading…
          </div>
        ) : filteredImages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 200, color: 'rgba(255,255,255,0.3)', gap: 8 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.3}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>{searchQuery ? 'No images match your search' : 'No images yet'}</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {filteredImages.map(image => (
              <div
                key={image.id}
                onClick={() => setLightboxImage(image)}
                style={{
                  aspectRatio: '1',
                  overflow: 'hidden',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src={thumbSrc(image)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            ))}
          </div>
        )}

        {nextUrl && !loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
            <button
              onClick={() => nextUrl && loadImages(nextUrl, true)}
              style={{
                padding: '10px 28px', borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)', fontSize: 13,
                cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <img
              src={lightboxImage.filepath}
              alt=""
              style={{
                maxWidth: '90vw', maxHeight: '90vh',
                objectFit: 'contain', borderRadius: 10,
                display: 'block',
              }}
            />
            <button
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute', top: -12, right: -12,
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.8)', fontSize: 16,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            >
              ×
            </button>
          </div>
          <div style={{
            position: 'absolute', bottom: 20,
            color: 'rgba(255,255,255,0.3)', fontSize: 12,
          }}>
            Click outside or press Esc to close
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        input::placeholder { color: rgba(255,255,255,0.35); }
      `}</style>
    </div>
  );
}
