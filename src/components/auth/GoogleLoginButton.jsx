import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (loadGoogleScript._promise) return loadGoogleScript._promise;
  loadGoogleScript._promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loadGoogleScript._promise;
}

export default function GoogleLoginButton({ redirectTo = '/' }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript().then(() => {
      if (cancelled || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            await base44.auth.loginWithGoogleCredential(credential);
            window.location.href = redirectTo;
          } catch (err) {
            setError(err.message || 'Google sign-in failed');
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
      });
    });

    return () => { cancelled = true; };
  }, [redirectTo]);

  if (!CLIENT_ID) return null;

  return (
    <div>
      <div ref={buttonRef} className="flex justify-center" />
      {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}
