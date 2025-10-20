/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const dφ = (lat2 - lat1) * Math.PI / 180;
  const dλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if a point is within the Yamanote Line boundary
 * This is a simplified rectangular boundary for demonstration
 * In production, you would use actual Yamanote Line coordinates
 */
export function isWithinYamanoteLine(lat: number, lng: number): boolean {
  // Simplified rectangular boundary around Yamanote Line
  const minLat = 35.65; // Southern boundary
  const maxLat = 35.75; // Northern boundary
  const minLng = 139.65; // Western boundary
  const maxLng = 139.8; // Eastern boundary

  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/**
 * Get the center point of Yamanote Line for map initialization
 */
export function getYamanoteCenter(): { lat: number; lng: number } {
  return {
    lat: 35.7,
    lng: 139.725
  };
}

/**
 * Get the bounds for Yamanote Line map view
 */
export function getYamanoteBounds(): [[number, number], [number, number]] {
  return [
    [139.65, 35.65], // Southwest corner
    [139.8, 35.75]   // Northeast corner
  ];
}
