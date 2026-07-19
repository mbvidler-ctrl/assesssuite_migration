import React, { useEffect, useState } from 'react';
import { createTenantFileAccessUrl } from '@/lib/fileIntegrations';

function requiresSecureAccess(fileUrl) {
  return typeof fileUrl === 'string' && (
    fileUrl.startsWith('/uploads/') || fileUrl.startsWith('/api/files/')
  );
}

export async function createSecureFileAccessUrl(fileUrl, orgId) {
  if (!requiresSecureAccess(fileUrl)) return fileUrl || '';
  if (!orgId) throw new Error('Practice context is required for this file.');

  const result = await createTenantFileAccessUrl({
    file_url: fileUrl,
    org_id: orgId,
  });
  if (!result?.file_url || typeof result.file_url !== 'string') {
    throw new Error('Secure file access is unavailable.');
  }
  return result.file_url;
}

export function useSecureFileUrl(fileUrl, orgId) {
  const [resolvedUrl, setResolvedUrl] = useState(() => requiresSecureAccess(fileUrl) ? '' : (fileUrl || ''));

  useEffect(() => {
    let cancelled = false;
    let refreshTimer;

    if (!requiresSecureAccess(fileUrl)) {
      setResolvedUrl(fileUrl || '');
      return () => {};
    }
    if (!orgId) {
      setResolvedUrl('');
      return () => {};
    }

    const resolve = async () => {
      try {
        const result = await createTenantFileAccessUrl({
          file_url: fileUrl,
          org_id: orgId,
        });
        if (cancelled || typeof result?.file_url !== 'string') return;
        setResolvedUrl(result.file_url);

        const expiry = Date.parse(result.expires_at || '');
        if (Number.isFinite(expiry)) {
          const refreshIn = Math.max(30_000, expiry - Date.now() - 15_000);
          refreshTimer = window.setTimeout(resolve, refreshIn);
        }
      } catch {
        if (!cancelled) setResolvedUrl('');
      }
    };

    setResolvedUrl('');
    resolve();
    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [fileUrl, orgId]);

  return resolvedUrl;
}

export function SecureFileImage({ src, orgId, alt = '', ...props }) {
  const resolvedUrl = useSecureFileUrl(src, orgId);
  if (!resolvedUrl) return null;
  return <img src={resolvedUrl} alt={alt} {...props} />;
}

export function SecureFileAudio({ src, orgId, type = 'audio/webm', ...props }) {
  const resolvedUrl = useSecureFileUrl(src, orgId);
  if (!resolvedUrl) return null;
  return (
    <audio {...props}>
      <source src={resolvedUrl} type={type} />
      Your browser does not support the audio element.
    </audio>
  );
}

export function SecureFileLink({ href, orgId, children, onClick = undefined, ...props }) {
  const resolvedUrl = useSecureFileUrl(href, orgId);
  return (
    <a
      href={resolvedUrl || undefined}
      aria-disabled={!resolvedUrl}
      onClick={(event) => {
        if (!resolvedUrl) event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
