'use client';

import { useEffect } from 'react';
import { useBackgroundLocation } from '../lib/hooks/useBackgroundLocation';

interface BackgroundLocationProviderProps {
  userId: string;
  role: 'oni' | 'runner' | null;
  gameId: string;
  gameStatus: string;
}

export default function BackgroundLocationProvider({ 
  userId, 
  role, 
  gameId, 
  gameStatus 
}: BackgroundLocationProviderProps) {
  const { isInitialized, error, isCapacitor } = useBackgroundLocation({
    userId,
    role,
    enabled: gameStatus === 'running' && !!role
  });

  useEffect(() => {
    if (error) {
      console.error('[BG Location Provider] Error:', error);
    }
  }, [error]);

  // This component doesn't render anything, it just manages background location
  return null;
}
