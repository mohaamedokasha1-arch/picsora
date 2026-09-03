export default function RootNotFound() {
  return (
    <html lang="en">
      <body>
        <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '80px 20px' }}>
          <h1 style={{ fontSize: 40, margin: 0 }}>Page not found</h1>
          <p style={{ color: '#666' }}>The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <a href="/en" style={{ display: 'inline-block', marginTop: 24, padding: '12px 24px', background: '#4f46e5', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>
            Go to Pixora
          </a>
        </div>
      </body>
    </html>
  );
}
