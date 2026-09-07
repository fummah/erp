'use client';
import { useEffect } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/**
 * Route-level error boundary. Recoverable failures (stale chunks after a new
 * deploy, transient fetch errors) get a clean retry UI instead of a broken page.
 * Stale-chunk states auto-heal: up to two reloads per deploy (tracked via the
 * build marker in sessionStorage) clear the old client bundle references.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const msg = String(error?.message || '') + ' ' + String((error as any)?.digest || '');
    const stale = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch|missing required error components|server response.*missing/i.test(msg)
      || (error?.digest && !sessionStorage.getItem('nex-last-digest') ? false : /missing/i.test(msg));
    const key = 'nex-error-reloads';
    const marker = 'nex-build-marker';
    if (stale) {
      // Heal stale-chunk states caused by redeploys: reload (max 2 per build marker).
      const seenMarker = sessionStorage.getItem(marker);
      const attempts = Number(sessionStorage.getItem(key) || 0);
      if (attempts < 2) {
        sessionStorage.setItem(key, String(attempts + 1));
        sessionStorage.setItem(marker, seenMarker || String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  function retryWithReload() {
    sessionStorage.removeItem('nex-error-reloads');
    window.location.reload();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="nex-card border rounded-xl p-8 max-w-md text-center">
        <div className="text-[16px] font-bold text-[#171a2e]">This page couldn't load</div>
        <p className="text-[13px] text-[#64748b] mt-2">The page failed to render — this usually happens after an app update. Reloading fixes it; your data is not affected.</p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <Button type="primary" icon={<ReloadOutlined />} onClick={retryWithReload}>Reload</Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
