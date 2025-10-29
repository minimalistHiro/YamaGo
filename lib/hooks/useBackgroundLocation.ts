'use client';

import { useEffect, useState } from 'react';
import { initBackgroundLocation, stopBackgroundLocation } from '../native/bg-location';

interface UseBackgroundLocationProps {
  userId: string;
  role: 'oni' | 'runner' | null;
  enabled: boolean;
}

export function useBackgroundLocation({ userId, role, enabled }: UseBackgroundLocationProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId || !role || typeof window === 'undefined') {
      return;
    }

    // Check if we're running in a Capacitor environment
    const isCapacitor = (window as any).Capacitor;
    if (!isCapacitor) {
      console.log('[BG Location] Not running in Capacitor environment, skipping background location');
      return;
    }

    const initializeLocation = async () => {
      try {
        console.log('[BG Location] Initializing background location for user:', userId, 'role:', role);
        const id = await initBackgroundLocation(userId, role);
        if (id) {
          setWatchId(id);
          setIsInitialized(true);
          setError(null);
          console.log('[BG Location] Background location initialized successfully');
        }
      } catch (err) {
        console.error('[BG Location] Failed to initialize background location:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize background location');
      }
    };

    initializeLocation();

    // Cleanup function
    return () => {
      if (watchId) {
        stopBackgroundLocation(watchId).catch(console.error);
        setWatchId(null);
        setIsInitialized(false);
      }
    };
  }, [userId, role, enabled]);

  return {
    isInitialized,
    error,
    isCapacitor: typeof window !== 'undefined' && !!(window as any).Capacitor
  };
}
