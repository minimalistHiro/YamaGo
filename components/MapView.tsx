'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getYamanoteCenter, getYamanoteBounds } from '@/lib/geo';
import { haversine } from '@/lib/geo';
import { 
  RUNNER_SEE_KILLER_RADIUS_M, 
  KILLER_DETECT_RUNNER_RADIUS_M,
  RESCUE_RADIUS_M 
} from '@/lib/constants';

interface MapViewProps {
  onLocationUpdate?: (lat: number, lng: number, accuracy: number) => void;
  players?: Array<{
    uid: string;
    nickname: string;
    role: 'oni' | 'runner';
    lat: number;
    lng: number;
    avatarUrl?: string;
    state?: 'active' | 'downed' | 'eliminated';
    lastRevealUntil?: Date | null;
  }>;
  currentUserRole?: 'oni' | 'runner';
  currentUserId?: string;
  gameStatus?: 'pending' | 'running' | 'ended';
  isOwner?: boolean;
  countdownStartAt?: Date | null;
  countdownDurationSec?: number;
  onStartGame?: () => void;
  gameStartAt?: Date | null;
}

const ROLE_COLORS: Record<'oni' | 'runner', string> = {
  oni: '#dc2626', // 鮮やかな赤色（鬼）
  runner: '#22c55e', // 鮮やかな緑色（逃走者）
};

const ROLE_PIN_STYLES: Record<'oni' | 'runner', { fill: string; border: string; label: string; icon: string }> = {
  oni: {
    fill: ROLE_COLORS.oni,
    border: '#991b1b', // より濃い赤のボーダー
    label: '👹', // 鬼の絵文字
    icon: '👹',
  },
  runner: {
    fill: ROLE_COLORS.runner,
    border: '#15803d', // より濃い緑のボーダー
    label: '🏃', // 走る人の絵文字
    icon: '🏃',
  },
};

export default function MapView({
  onLocationUpdate,
  players = [],
  currentUserRole,
  currentUserId,
  gameStatus,
  isOwner = false,
  countdownStartAt,
  countdownDurationSec = 20,
  onStartGame,
  gameStartAt
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const currentLocationMarker = useRef<maplibregl.Marker | null>(null);
  const currentRadiusCircleRef = useRef<maplibregl.Popup | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [countdownTimeLeft, setCountdownTimeLeft] = useState<number | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [localCountdownStartAt, setLocalCountdownStartAt] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const getPinColor = (role: 'oni' | 'runner') => ROLE_COLORS[role];
  const createPlayerMarkerElement = (player: NonNullable<MapViewProps['players']>[number]) => {
    const style = ROLE_PIN_STYLES[player.role];
    const markerElement = document.createElement('div');
    markerElement.className = 'player-marker';
    markerElement.style.width = '40px';
    markerElement.style.height = '50px';
    markerElement.style.position = 'relative';
    markerElement.style.display = 'flex';
    markerElement.style.alignItems = 'center';
    markerElement.style.justifyContent = 'center';
    markerElement.style.pointerEvents = 'auto';
    markerElement.style.cursor = 'pointer';
    markerElement.style.transition = 'transform 0.15s ease';
    markerElement.style.transformOrigin = 'bottom center';
    markerElement.title = `${player.nickname} - ${player.role === 'oni' ? '鬼' : '逃走者'}`;

    const pinHead = document.createElement('div');
    pinHead.style.width = '36px';
    pinHead.style.height = '36px';
    pinHead.style.borderRadius = '50%';
    pinHead.style.background = style.fill;
    pinHead.style.border = `4px solid ${style.border}`;
    pinHead.style.boxShadow = `0 4px 16px ${style.fill}80, 0 2px 8px rgba(0,0,0,0.3)`;
    pinHead.style.display = 'flex';
    pinHead.style.alignItems = 'center';
    pinHead.style.justifyContent = 'center';
    pinHead.style.color = '#fff';
    pinHead.style.fontSize = '18px';
    pinHead.style.fontWeight = 'bold';
    pinHead.style.position = 'relative';
    pinHead.style.overflow = 'hidden';
    pinHead.style.transition = 'all 0.2s ease';

    // 役割アイコンを表示
    const roleIcon = document.createElement('span');
    roleIcon.textContent = style.icon;
    roleIcon.style.fontSize = '20px';
    roleIcon.style.lineHeight = '1';
    roleIcon.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
    pinHead.appendChild(roleIcon);

    // アバター画像がある場合は上に表示（小さく）
    if (player.avatarUrl) {
      const avatarOverlay = document.createElement('img');
      avatarOverlay.src = player.avatarUrl;
      avatarOverlay.alt = player.nickname;
      avatarOverlay.style.position = 'absolute';
      avatarOverlay.style.bottom = '2px';
      avatarOverlay.style.right = '2px';
      avatarOverlay.style.width = '16px';
      avatarOverlay.style.height = '16px';
      avatarOverlay.style.borderRadius = '50%';
      avatarOverlay.style.border = '2px solid white';
      avatarOverlay.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
      avatarOverlay.style.objectFit = 'cover';
      pinHead.appendChild(avatarOverlay);
    }

    const roleBadge = document.createElement('div');
    roleBadge.textContent = player.role === 'oni' ? '鬼' : '逃';
    roleBadge.style.position = 'absolute';
    roleBadge.style.bottom = '-14px';
    roleBadge.style.left = '50%';
    roleBadge.style.transform = 'translateX(-50%)';
    roleBadge.style.background = style.border;
    roleBadge.style.color = '#fff';
    roleBadge.style.fontSize = '9px';
    roleBadge.style.fontWeight = 'bold';
    roleBadge.style.padding = '2px 6px';
    roleBadge.style.borderRadius = '8px';
    roleBadge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
    roleBadge.style.whiteSpace = 'nowrap';

    const pinPointer = document.createElement('div');
    pinPointer.style.position = 'absolute';
    pinPointer.style.bottom = '0';
    pinPointer.style.left = '50%';
    pinPointer.style.transform = 'translateX(-50%)';
    pinPointer.style.width = '0';
    pinPointer.style.height = '0';
    pinPointer.style.borderLeft = '10px solid transparent';
    pinPointer.style.borderRight = '10px solid transparent';
    pinPointer.style.borderTop = `16px solid ${style.fill}`;
    pinPointer.style.filter = 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))';

    if (player.state === 'downed') {
      pinHead.style.boxShadow = '0 0 0 4px rgba(250,204,21,0.8), 0 4px 16px rgba(0,0,0,0.5)';
      pinHead.style.animation = 'pulse 2s infinite';
    } else if (player.state === 'eliminated') {
      markerElement.style.opacity = '0.4';
      pinHead.style.filter = 'grayscale(100%)';
    }

    markerElement.appendChild(pinHead);
    markerElement.appendChild(roleBadge);
    markerElement.appendChild(pinPointer);

    markerElement.addEventListener('mouseenter', () => {
      markerElement.style.transform = 'translateY(-6px) scale(1.1)';
      pinHead.style.boxShadow = `0 6px 20px ${style.fill}a0, 0 2px 8px rgba(0,0,0,0.4)`;
    });
    markerElement.addEventListener('mouseleave', () => {
      markerElement.style.transform = 'translateY(0) scale(1)';
      pinHead.style.boxShadow = `0 4px 16px ${style.fill}80, 0 2px 8px rgba(0,0,0,0.3)`;
    });

    return markerElement;
  };

  // Create a circle polygon for 50m radius
  const createCirclePolygon = (lat: number, lng: number, radiusMeters: number, segments: number = 64) => {
    const R = 6371e3; // Earth's radius in meters
    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;
    
    const d = radiusMeters / R;
    const coordinates: Array<[number, number]> = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + 
                     Math.cos(lat1) * Math.sin(d) * Math.cos(angle));
      const lng2 = lng1 + Math.atan2(Math.sin(angle) * Math.sin(d) * Math.cos(lat1),
                      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
      
      coordinates.push([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }
    
    return coordinates;
  };

  // Update radius circle
  const updateRadiusCircle = (lat: number, lng: number) => {
    if (!map.current || !isMapLoaded) return;
    
    const circleCoords = createCirclePolygon(lat, lng, 50, 64);
    
    const source = map.current.getSource('current-radius-circle');
    if (source) {
      // Update existing source
      (source as any).setData({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords]
        },
        properties: {}
      });
    } else {
      // Add new source and layers
      const color = currentUserRole ? getPinColor(currentUserRole) : '#22c55e';
      
      map.current.addSource('current-radius-circle', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [circleCoords]
          },
          properties: {}
        }
      });

      map.current.addLayer({
        id: 'current-radius-circle-fill',
        type: 'fill',
        source: 'current-radius-circle',
        paint: {
          'fill-color': color,
          'fill-opacity': 0.15
        }
      });

      map.current.addLayer({
        id: 'current-radius-circle-stroke',
        type: 'line',
        source: 'current-radius-circle',
        paint: {
          'line-color': color,
          'line-opacity': 0.4,
          'line-width': 2
        }
      });
    }
  };

  // Check if current location is within Yamanote bounds
  const isWithinYamanoteBounds = (lat: number, lng: number): boolean => {
    const bounds = getYamanoteBounds();
    return lat >= bounds[0][1] && lat <= bounds[1][1] && 
           lng >= bounds[0][0] && lng <= bounds[1][0];
  };


  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const center = getYamanoteCenter();
    const bounds = getYamanoteBounds();

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      center: [center.lng, center.lat],
      zoom: 13,
      maxBounds: bounds
    });

           map.current.on('load', () => {
             setIsMapLoaded(true);
             
             // Add boundary layer
             map.current?.addSource('yamanote-boundary', {
               type: 'geojson',
               data: {
                 type: 'Feature',
                 geometry: {
                   type: 'Polygon',
                   coordinates: [[
                     [bounds[0][0], bounds[0][1]],
                     [bounds[1][0], bounds[0][1]],
                     [bounds[1][0], bounds[1][1]],
                     [bounds[0][0], bounds[1][1]],
                     [bounds[0][0], bounds[0][1]]
                   ]]
                 },
                 properties: {}
               }
             });

             map.current?.addLayer({
               id: 'yamanote-boundary-fill',
               type: 'fill',
               source: 'yamanote-boundary',
               paint: {
                 'fill-color': '#3b82f6',
                 'fill-opacity': 0.1
               }
             });

             map.current?.addLayer({
               id: 'yamanote-boundary-line',
               type: 'line',
               source: 'yamanote-boundary',
               paint: {
                 'line-color': '#3b82f6',
                 'line-width': 2
               }
             });

                        // Auto-get current location when map loads
             setTimeout(() => {
               console.log('Map loaded, requesting current location...');
               getCurrentLocation();
             }, 1000); // 1秒後に位置取得を実行
           });

    return () => {
      if (map.current) {
        if (currentLocationMarker.current) {
          currentLocationMarker.current.remove();
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update player markers
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.player-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Get current user's location for distance calculations
    const currentUserLocation = currentLocation;

    // Filter and display players based on DbD visibility rules
    const visiblePlayers = players.filter(player => {
      // Don't show self
      if (player.uid === currentUserId) return false;

      // If no current location, don't show any remote players
      if (!currentUserLocation) return false;

      // Calculate distance
      const distance = haversine(
        currentUserLocation.lat, currentUserLocation.lng,
        player.lat, player.lng
      );

      // DbD Visibility Rules
      if (currentUserRole === 'oni') {
        // Killer can see all runners within detection radius
        if (player.role === 'runner' && player.state !== 'eliminated') {
          return distance <= KILLER_DETECT_RUNNER_RADIUS_M;
        }
        // Killer can see other killers
        if (player.role === 'oni') {
          return true;
        }
      } else if (currentUserRole === 'runner') {
        // Runner can see other runners at all times
        if (player.role === 'runner') {
          return true;
        }
        // Runner can see killers only within specific radius (200m precise, 500m alert)
        if (player.role === 'oni') {
          return distance <= RUNNER_SEE_KILLER_RADIUS_M;
        }
      }

      return false;
    });

    // Add new markers
    visiblePlayers.forEach(player => {
      const markerElement = createPlayerMarkerElement(player);
      markerElement.addEventListener('click', () => {
        new maplibregl.Popup()
          .setLngLat([player.lng, player.lat])
          .setHTML(`
            <div class="p-3">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                  ${player.avatarUrl ? 
                    `<img src="${player.avatarUrl}" alt="${player.nickname}" class="w-full h-full object-cover" />` :
                    `<div class="w-full h-full ${player.role === 'oni' ? 'bg-red-500' : 'bg-green-500'} flex items-center justify-center">
                      <span class="text-white font-bold text-lg">${player.nickname.charAt(0).toUpperCase()}</span>
                  </div>`
                }
                </div>
                <div>
                  <h3 class="font-semibold text-gray-800">${player.nickname}</h3>
                  <p class="text-sm text-gray-600">${player.role === 'oni' ? '鬼' : '逃走者'}</p>
                </div>
              </div>
            </div>
          `)
          .addTo(map.current!);
      });

      new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([player.lng, player.lat])
        .addTo(map.current!);
    });
  }, [players, isMapLoaded, currentUserId, currentUserRole, currentLocation]);

  // Get current location function with improved error handling and retry mechanism
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('このブラウザは位置情報をサポートしていません');
      return;
    }

    setIsLocating(true);
    console.log('Getting current location...');
    
    // Check if location services are available
    const checkLocationService = () => {
      return new Promise((resolve, reject) => {
        // Try to get a quick position to check if location services are working
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              reject(new Error('PERMISSION_DENIED'));
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              reject(new Error('POSITION_UNAVAILABLE'));
            } else {
              reject(new Error('SERVICE_UNAVAILABLE'));
            }
          },
          {
            enableHighAccuracy: false,
            maximumAge: 300000, // 5 minutes
            timeout: 3000 // 3 seconds
          }
        );
      });
    };

    const tryGetLocation = async (attempt = 1) => {
      console.log(`Location attempt ${attempt}/3`);
      
      try {
        // First check if location services are available
        if (attempt === 1) {
          try {
            await checkLocationService();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('Location service check failed:', errorMessage);
            if (errorMessage === 'PERMISSION_DENIED') {
              throw new Error('PERMISSION_DENIED');
            } else if (errorMessage === 'POSITION_UNAVAILABLE') {
              throw new Error('POSITION_UNAVAILABLE');
            }
            // For other errors, continue with the main location request
          }
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log('Location obtained:', { latitude, longitude, accuracy });
            
            // Check if location is within Yamanote bounds
            const withinBounds = isWithinYamanoteBounds(latitude, longitude);
            console.log('Location within bounds:', withinBounds);
            
            setCurrentLocation({ lat: latitude, lng: longitude, accuracy });
            setIsOutOfBounds(!withinBounds);
            
            // Center map on current location
            if (map.current) {
              map.current.flyTo({
                center: [longitude, latitude],
                zoom: 16,
                duration: 1000
              });

              // Add or update current location marker
              if (currentLocationMarker.current) {
                currentLocationMarker.current.remove();
              }

              const currentLocationEl = document.createElement('div');
              currentLocationEl.className = 'current-location-marker';
              currentLocationEl.style.width = '28px';
              currentLocationEl.style.height = '28px';
              currentLocationEl.style.borderRadius = '50%';
              // Set color based on role - 赤色（鬼）または緑色（逃走者）
              const pinColor = currentUserRole ? getPinColor(currentUserRole) : ROLE_COLORS.runner;
              currentLocationEl.style.backgroundColor = pinColor;
              currentLocationEl.style.border = `5px solid ${pinColor === ROLE_COLORS.oni ? '#991b1b' : '#15803d'}`;
              currentLocationEl.style.boxShadow = `0 4px 16px ${pinColor}80, 0 2px 8px rgba(0,0,0,0.3)`;
              currentLocationEl.style.cursor = 'pointer';
              currentLocationEl.style.position = 'relative';
              
              // Add pulsing animation
              currentLocationEl.style.animation = 'pulse 2s infinite';
              
              // Add inner dot
              const innerDot = document.createElement('div');
              innerDot.style.width = '8px';
              innerDot.style.height = '8px';
              innerDot.style.borderRadius = '50%';
              innerDot.style.backgroundColor = 'white';
              innerDot.style.position = 'absolute';
              innerDot.style.top = '50%';
              innerDot.style.left = '50%';
              innerDot.style.transform = 'translate(-50%, -50%)';
              currentLocationEl.appendChild(innerDot);

              currentLocationMarker.current = new maplibregl.Marker(currentLocationEl)
                .setLngLat([longitude, latitude])
                .addTo(map.current);
                
              console.log('Current location marker added successfully!');

              // Update radius circle
              updateRadiusCircle(latitude, longitude);

              // Add popup to current location marker
              currentLocationEl.addEventListener('click', () => {
                new maplibregl.Popup()
                  .setLngLat([longitude, latitude])
                  .setHTML(`
                    <div class="p-2">
                      <h3 class="font-semibold text-blue-600">現在地</h3>
                      <p class="text-sm text-gray-600">緯度: ${latitude.toFixed(6)}</p>
                      <p class="text-sm text-gray-600">経度: ${longitude.toFixed(6)}</p>
                      <p class="text-sm text-gray-600">精度: ${accuracy.toFixed(0)}m</p>
                    </div>
                  `)
                  .addTo(map.current!);
              });
            }

            // Update location if callback provided
            if (onLocationUpdate) {
              onLocationUpdate(latitude, longitude, accuracy);
            }
            
            setIsLocating(false);
          },
          (error) => {
            console.error(`Location attempt ${attempt} failed:`, error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            if (attempt < 3) {
              // Retry with different settings and exponential backoff
              const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
              console.log(`Retrying in ${retryDelay}ms...`);
              
              setTimeout(() => {
                tryGetLocation(attempt + 1);
              }, retryDelay);
            } else {
              setIsLocating(false);
              
              let errorMessage = '位置情報の取得に失敗しました';
              let showSettingsButton = false;
              
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = '位置情報の使用が拒否されました。ブラウザの設定で位置情報を許可してください。';
                  showSettingsButton = true;
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = '位置情報が利用できません。GPSが有効になっているか確認してください。';
                  break;
                case error.TIMEOUT:
                  errorMessage = '位置情報の取得がタイムアウトしました。ネットワーク接続を確認してもう一度お試しください。';
                  break;
                default:
                  errorMessage = '位置情報の取得中にエラーが発生しました。しばらく時間をおいてからもう一度お試しください。';
              }
              
              // Show user-friendly error dialog
              const userConfirmed = confirm(`${errorMessage}\n\n設定を開きますか？`);
              if (userConfirmed && showSettingsButton) {
                // Try to open browser settings (this may not work in all browsers)
                console.log('User requested to open settings');
              }
            }
          },
          // Different options for each attempt
          attempt === 1 ? {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000 // 15 seconds for first attempt
          } : attempt === 2 ? {
            enableHighAccuracy: true,
            maximumAge: 30000, // 30 seconds
            timeout: 10000 // 10 seconds for second attempt
          } : {
            enableHighAccuracy: false,
            maximumAge: 300000, // 5 minutes
            timeout: 8000 // 8 seconds for final attempt
          }
        );
      } catch (error) {
        console.error('Location service check error:', error);
        if (attempt < 3) {
          setTimeout(() => {
            tryGetLocation(attempt + 1);
          }, 1000 * attempt);
        } else {
          setIsLocating(false);
          alert('位置情報サービスが利用できません。設定を確認してください。');
        }
      }
    };
    
    tryGetLocation();
  };

  // Location tracking for game
  useEffect(() => {
    if (!onLocationUpdate) return;

    console.log('Starting location tracking...');
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log('Location update:', { latitude, longitude, accuracy });
        
        // Check if location is within Yamanote bounds
        const withinBounds = isWithinYamanoteBounds(latitude, longitude);
        
        setCurrentLocation({ lat: latitude, lng: longitude });
        setIsOutOfBounds(!withinBounds);
        
        // Update current location marker during game
        if (map.current && currentLocationMarker.current) {
          currentLocationMarker.current.setLngLat([longitude, latitude]);
        }
        
        // Update radius circle during tracking
        updateRadiusCircle(latitude, longitude);
        
        onLocationUpdate(latitude, longitude, accuracy);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = '位置情報の取得に失敗しました';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '位置情報の使用が拒否されました';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置情報が利用できません';
            break;
          case error.TIMEOUT:
            errorMessage = '位置情報の取得がタイムアウトしました';
            break;
        }
        console.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000, // より頻繁に更新
        timeout: 10000
      }
    );

    return () => {
      console.log('Stopping location tracking...');
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onLocationUpdate]);

  // Handle tab visibility change - recheck location when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Tab became visible, rechecking location...');
        // Re-get current location when tab becomes visible
        getCurrentLocation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle local countdown start
  const handleStartGameClick = () => {
    // Start local countdown immediately
    setLocalCountdownStartAt(new Date());
    setIsCountdownActive(true);
    setCountdownTimeLeft(countdownDurationSec);
    
    // Call the parent's onStartGame handler
    if (onStartGame) {
      onStartGame();
    }
  };

  // Countdown effect - prioritize local countdown, fallback to Firestore countdown
  useEffect(() => {
    const activeStartAt = localCountdownStartAt || countdownStartAt;
    
    if (!activeStartAt || !countdownDurationSec) {
      // Only disable if Firestore also doesn't have countdown
      if (!countdownStartAt) {
        setIsCountdownActive(false);
        setCountdownTimeLeft(null);
        setLocalCountdownStartAt(null);
      }
      return;
    }

    setIsCountdownActive(true);
    const startTime = activeStartAt.getTime();
    const durationMs = countdownDurationSec * 1000;

    const updateCountdown = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);

      setCountdownTimeLeft(remainingSeconds);

      if (remaining <= 0) {
        setIsCountdownActive(false);
        setCountdownTimeLeft(null);
        setLocalCountdownStartAt(null);
        // Game should start automatically when countdown reaches 0
        // This will be handled by the parent component
      }
    };

    // Initial update
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [localCountdownStartAt, countdownStartAt, countdownDurationSec]);

  // Clear local countdown when Firestore countdown is confirmed
  useEffect(() => {
    if (countdownStartAt && !localCountdownStartAt) {
      // Firestore countdown is active, ensure local state is synced
      return;
    }
    
    // If Firestore countdown matches local (within 1 second), use Firestore
    if (countdownStartAt && localCountdownStartAt) {
      const timeDiff = Math.abs(countdownStartAt.getTime() - localCountdownStartAt.getTime());
      if (timeDiff < 1000) {
        // They're in sync, prefer Firestore
        setLocalCountdownStartAt(null);
      }
    }
  }, [countdownStartAt, localCountdownStartAt]);

  // Calculate elapsed time since game start
  useEffect(() => {
    if (!gameStartAt || gameStatus !== 'running') {
      setElapsedTime(0);
      return;
    }

    const updateElapsedTime = () => {
      const now = Date.now();
      const startTime = gameStartAt.getTime();
      const elapsed = Math.floor((now - startTime) / 1000); // elapsed time in seconds
      setElapsedTime(elapsed);
    };

    // Initial update
    updateElapsedTime();

    // Update every second
    const interval = setInterval(updateElapsedTime, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [gameStartAt, gameStatus]);

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
            <p className="text-gray-600">地図を読み込み中...</p>
          </div>
        </div>
      )}
      
      {gameStatus === 'running' && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${currentUserRole === 'oni' ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <span className="text-sm font-medium">
              {currentUserRole === 'oni' ? '鬼' : '逃走者'}
            </span>
          </div>
          {/* Elapsed time display */}
          {gameStartAt && (
            <div className="flex items-center space-x-2 pt-1 border-t border-gray-200">
              <span className="text-xs text-gray-500">経過時間</span>
              <span className="text-lg font-mono font-bold text-gray-800">
                {formatElapsedTime(elapsedTime)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Owner Start Game Button - Only show when game is pending, countdown is not active, and countdown has not started */}
      {isOwner && 
       gameStatus === 'pending' &&
       !isCountdownActive && 
       countdownTimeLeft === null && (
        <button
          onClick={handleStartGameClick}
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full shadow-lg text-lg transition-colors"
        >
          ゲーム開始
        </button>
      )}

      {/* Countdown Display */}
      {isCountdownActive && countdownTimeLeft !== null && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-white text-8xl font-bold mb-4 animate-pulse">
              {countdownTimeLeft}
            </div>
            <div className="text-white text-xl">
              {currentUserRole === 'oni' ? '鬼のスタートまで' : 'ゲーム開始まで'}
            </div>
          </div>
        </div>
      )}

      {/* Gray overlay for oni during countdown */}
      {isCountdownActive && currentUserRole === 'oni' && (
        <div className="absolute inset-0 bg-gray-500 bg-opacity-50 z-40 pointer-events-none" />
      )}

      {/* Current Location Button */}
      <button
        onClick={getCurrentLocation}
        disabled={isLocating}
        className="absolute bottom-20 right-4 bg-white hover:bg-gray-50 disabled:bg-gray-200 text-gray-700 rounded-full shadow-lg p-3 transition-colors"
        title="現在地を表示"
      >
        {isLocating ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>

      {/* Out of bounds overlay */}
      {isOutOfBounds && (
        <>
          {/* Gray overlay */}
          <div className="absolute inset-0 bg-gray-500 bg-opacity-50 z-10 pointer-events-none" />
          
          {/* Warning message */}
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg text-center max-w-sm mx-4">
              <div className="flex items-center justify-center mb-2">
                <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-bold">マップ外にいます</h3>
              </div>
              <p className="text-sm">
                山手線エリア内に移動してください
              </p>
            </div>
          </div>
        </>
      )}


      {/* Debug Info */}
      {!currentLocation && (
        <div className="absolute top-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg p-2 max-w-xs">
          <div className="text-xs text-yellow-800">
            <div className="font-medium">位置情報デバッグ</div>
            <div>Geolocation API: {navigator.geolocation ? '✓' : '✗'}</div>
            <div>Permissions API: {'permissions' in navigator ? '✓' : '✗'}</div>
            <div>Map Loaded: {isMapLoaded ? '✓' : '✗'}</div>
            <div>Location Status: {isLocating ? '取得中...' : '未取得'}</div>
            <div>Out of Bounds: {isOutOfBounds ? 'Yes' : 'No'}</div>
            <div className="text-xs text-gray-600 mt-1">
              改善されたリトライ機能付き
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
