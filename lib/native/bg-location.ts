import { updateLocation } from '../game';

export async function initBackgroundLocation(userId: string, role: 'oni'|'runner', gameId: string) {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    // Request permissions
    const permissions = await Geolocation.requestPermissions();
    if (permissions.location !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    // Start watching position
    const watchId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 5000
    }, (position, err) => {
      if (err) {
        console.error('Location error:', err);
        return;
      }

      if (position) {
        console.log('[BG] location', position.coords.latitude, position.coords.longitude);
        // Write directly to game locations to trigger onLocationWrite
        updateLocation(gameId, userId, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accM: position.coords.accuracy || 0
        }).catch((e) => {
          console.error('[BG] Failed to update game location:', e);
        });
      }
    });

    console.log('[BG] Background location started with watch ID:', watchId);
    return watchId;
  } catch (error) {
    console.error('[BG] Failed to initialize background location:', error);
  }
}

// HTTP ingest endpoint is no longer used for capture flow (Plan A)

export async function stopBackgroundLocation(watchId?: string) {
  if (watchId) {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.clearWatch({ id: watchId });
    console.log('[BG] Background location stopped');
  }
}

export async function getCurrentLocation() {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 5000
    });
    return position;
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
}
