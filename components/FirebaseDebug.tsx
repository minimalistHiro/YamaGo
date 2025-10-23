'use client';

import { useEffect, useState } from 'react';

export default function FirebaseDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const info = {
      environment: process.env.NODE_ENV,
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
        `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 10)}...` : 'NOT SET',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'NOT SET',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'NOT SET',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'NOT SET',
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'NOT SET',
    };
    setDebugInfo(info);
  }, []);

  if (process.env.NODE_ENV === 'development') {
    return null; // Don't show in development
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs max-w-sm">
      <h3 className="font-bold mb-2">Firebase Debug Info</h3>
      <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
    </div>
  );
}
