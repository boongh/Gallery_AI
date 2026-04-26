'use client';
import { useEffect, useState } from 'react';

const cache = new Map<string, string>();

type Props = {
  uuid: string;
  mediaType: 'thumbnails' | 'previews' | 'originals';
} & React.ImgHTMLAttributes<HTMLImageElement>;

export default function PresignedImage({ uuid, mediaType, style, className, alt = '', ...rest }: Props) {
  const cacheKey = `${mediaType}:${uuid}`;
  const [url, setUrl] = useState<string | null>(cache.get(cacheKey) ?? null);

  useEffect(() => {
    if (cache.has(cacheKey)) {
      setUrl(cache.get(cacheKey)!);
      return;
    }
    const controller = new AbortController();
    fetch(`/gms/media/${mediaType}/${uuid}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then(presignedUrl => {
        cache.set(cacheKey, presignedUrl);
        setUrl(presignedUrl);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [cacheKey]);

  if (!url) {
    return (
      <div
        className={className}
        style={{ ...(style as React.CSSProperties), background: 'var(--gb-card-bg)' }}
      />
    );
  }

  return <img src={url} alt={alt} style={style} className={className} {...rest} />;
}
