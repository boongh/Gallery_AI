import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0d0d0d',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 96, fontWeight: 800, color: 'rgba(255,255,255,0.08)', lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Page not found</div>
      <Link href="/" style={{
        marginTop: 8,
        padding: '8px 20px', borderRadius: 8,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.7)',
        textDecoration: 'none', fontSize: 14, fontWeight: 500,
      }}>
        Go home
      </Link>
    </div>
  );
}
