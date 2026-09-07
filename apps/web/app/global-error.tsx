'use client';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/** Root error boundary (catches errors in the root layout itself). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#f4f5f9', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', border: '1px solid #e6e9f2', borderRadius: 12, padding: 32, maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#171a2e' }}>Something went wrong</div>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>The application failed to start. A reload usually resolves this.</p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => window.location.reload()} style={{ background: '#003366', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Reload</button>
              <button onClick={reset} style={{ background: '#fff', color: '#344054', border: '1px solid #d0d5e2', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Try again</button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
