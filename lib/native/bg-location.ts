import { Geolocation } from '@capacitor/geolocation';

export async function initBackgroundLocation(userId: string, role: 'oni'|'runner') {
  try {
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
        
        // Send location to Cloud Function
        sendLocationToServer({
          userId,
          role,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          speed: position.coords.speed || 0,
          timestamp: position.timestamp,
          source: 'native'
        });
      }
    });

    console.log('[BG] Background location started with watch ID:', watchId);
    return watchId;
  } catch (error) {
    console.error('[BG] Failed to initialize background location:', error);
  }
}

async function sendLocationToServer(data: any) {
  try {
    const response = await fetch('https://asia-northeast1-yamago-2ae8d.cloudfunctions.net/ingestLocation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error('[BG] Failed to send location:', response.status);
    }
  } catch (error) {
    console.error('[BG] Error sending location:', error);
  }
}

export async function stopBackgroundLocation(watchId?: string) {
  if (watchId) {
    await Geolocation.clearWatch({ id: watchId });
    console.log('[BG] Background location stopped');
  }
}

export async function getCurrentLocation() {
  try {
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
