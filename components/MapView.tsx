'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getYamanoteCenter, getYamanoteBounds } from '@/lib/geo';
import { haversine } from '@/lib/geo';
import { 
  RESCUE_RADIUS_M 
} from '@/lib/constants';
import { setGamePins, type PinPoint, updatePinCleared, updateGame } from '@/lib/game';
import { preloadSounds } from '@/lib/sounds';
import { createBaseMapStyle } from '@/lib/mapStyle';

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
  pins?: PinPoint[]; // yellow pins from database
  currentUserRole?: 'oni' | 'runner';
  currentUserId?: string;
  gameStatus?: 'pending' | 'countdown' | 'running' | 'ended';
  isOwner?: boolean;
  countdownStartAt?: Date | null;
  countdownDurationSec?: number | null;
  onStartGame?: () => void;
  onCountdownEnd?: () => void;
  gameStartAt?: Date | null;
  captureRadiusM?: number;
  gameId?: string;
  runnerSeeKillerRadiusM?: number;
  killerDetectRunnerRadiusM?: number;
  pinTargetCount?: number;
  gameDurationSec?: number | null;
  pinEditingMode?: boolean;
  onPinDragStart?: (pinId: string) => void;
  onPinDragEnd?: (pinId: string, lat: number, lng: number) => void;
  killerSeeGeneratorRadiusM?: number;
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
const GENERATOR_PIN_STYLE = {
  fill: '#f59e0b',
  border: '#d97706',
  icon: '⚡️',
};
const GENERATOR_PIN_STYLE_CLEARED = {
  fill: '#9ca3af',
  border: '#6b7280',
  icon: '⚡️',
};

export default function MapView({
  onLocationUpdate,
  players = [],
  pins = [],
  currentUserRole,
  currentUserId,
  gameStatus,
  isOwner = false,
  countdownStartAt,
  countdownDurationSec = 900,
  onStartGame,
  onCountdownEnd,
  gameStartAt,
  captureRadiusM = 100,
  gameId,
  runnerSeeKillerRadiusM = 3000,
  killerDetectRunnerRadiusM = 500,
  pinTargetCount = 10,
  gameDurationSec,
  pinEditingMode = false,
  onPinDragStart,
  onPinDragEnd,
  killerSeeGeneratorRadiusM = 3000,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const currentLocationMarker = useRef<maplibregl.Marker | null>(null);
  const currentRadiusCircleRef = useRef<maplibregl.Popup | null>(null);
  const captureRadiusCircle = useRef<{ id: string; center: [number, number]; radius: number } | null>(null);
  const randomPinsRef = useRef<maplibregl.Marker[]>([]);
  const randomPinsPlacedRef = useRef<boolean>(false);
  const prevGameStatusRef = useRef<typeof gameStatus>(gameStatus);
  const kodouSoundRef = useRef<HTMLAudioElement | null>(null);
  const editingMarkersRef = useRef<Record<string, maplibregl.Marker>>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [countdownTimeLeft, setCountdownTimeLeft] = useState<number | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [localCountdownStartAt, setLocalCountdownStartAt] = useState<Date | null>(null);
  const [gameTimeRemaining, setGameTimeRemaining] = useState<number | null>(null);
  const [nearbyPin, setNearbyPin] = useState<PinPoint | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const getPinColor = (role: 'oni' | 'runner') => ROLE_COLORS[role];
  const clearEditingMarkers = () => {
    Object.values(editingMarkersRef.current).forEach((marker) => marker.remove());
    editingMarkersRef.current = {};
  };

  useEffect(() => {
    preloadSounds(['kodou_sound', 'start_sound']);
    if (typeof window === 'undefined') return;
    const audio = new Audio('/sounds/kodou_sound.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    kodouSoundRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      kodouSoundRef.current = null;
    };
  }, []);

  const isOniWithinDetectionRadius = useMemo(() => {
    if (currentUserRole !== 'runner' || !currentLocation) return false;
    if (!killerDetectRunnerRadiusM || killerDetectRunnerRadiusM <= 0) return false;
    return players.some((player) => {
      if (player.role !== 'oni') return false;
      if (player.state === 'eliminated') return false;
      const distance = haversine(
        currentLocation.lat,
        currentLocation.lng,
        player.lat,
        player.lng
      );
      return distance <= killerDetectRunnerRadiusM;
    });
  }, [players, currentLocation, currentUserRole, killerDetectRunnerRadiusM]);

  useEffect(() => {
    const audio = kodouSoundRef.current;
    if (!audio) return;
    if (gameStatus === 'running' && isOniWithinDetectionRadius) {
      if (audio.paused) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors; user interaction may be required
        });
      }
    } else if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [isOniWithinDetectionRadius, gameStatus]);

  // derive current user's state from players list to avoid extra props and keep Firestore-driven
  const currentState: 'active' | 'downed' | 'eliminated' | undefined =
    (players || []).find(p => p.uid === currentUserId)?.state;

  const getCurrentUserDisplayColor = (): string => {
    if (currentUserRole === 'oni') return ROLE_COLORS.oni;
    // runner
    if (currentState && currentState !== 'active') return '#9ca3af'; // gray-400 when captured
    return ROLE_COLORS.runner;
  };

  // Create pin icon as canvas for map symbol layer (teardrop-style pin)
  const createPinCanvas = (
    role: 'oni' | 'runner',
    size: number = 40,
    overrides?: { fill?: string; border?: string; icon?: string }
  ): HTMLCanvasElement => {
    const scale = 2; // retina
    const marginX = 8 * scale;
    const marginTop = 6 * scale;
    const marginBottom = 4 * scale;
    const pointerH = 22 * scale; // pointer height
    const w = size * scale + marginX * 2;
    const h = size * scale + pointerH + marginTop + marginBottom;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const base = ROLE_PIN_STYLES[role];
    const style = {
      fill: overrides?.fill ?? base.fill,
      border: overrides?.border ?? base.border,
      label: base.label,
      icon: overrides?.icon ?? base.icon,
    } as typeof base;

    // Coordinates
    const cx = w / 2;
    const headR = (size / 2) * scale; // head radius
    const tipY = h - marginBottom; // a bit above bottom to avoid clipping
    const headCY = tipY - pointerH - headR;

    // Teardrop path (rounded head + tapered pointer)
    ctx.save();
    ctx.shadowColor = `${style.fill}80`;
    ctx.shadowBlur = 12 * scale;
    ctx.shadowOffsetY = 4 * scale;
    ctx.beginPath();
    // top arc
    ctx.arc(cx, headCY, headR, Math.PI, 0);
    // right bezier to bottom tip
    ctx.quadraticCurveTo(cx + headR, headCY + headR * 0.85, cx, headCY + headR + pointerH);
    // left bezier back to top
    ctx.quadraticCurveTo(cx - headR, headCY + headR * 0.85, cx - headR, headCY);
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = style.border;
    ctx.stroke();
    ctx.restore();

    // Emoji role icon
    ctx.font = `${24 * scale}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(style.icon, cx, headCY);

    return canvas;
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
    
    const circleCoords = createCirclePolygon(lat, lng, captureRadiusM, 64);
    
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
      const color = getCurrentUserDisplayColor();
      try {
        map.current.setPaintProperty('current-radius-circle-fill', 'fill-color', color);
        map.current.setPaintProperty('current-radius-circle-stroke', 'line-color', color);
      } catch {}
    } else {
      // Add new source and layers
      const color = currentUserRole ? getCurrentUserDisplayColor() : '#22c55e';
      
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

  // Update capture radius circle around current user
  const updateCaptureRadiusCircle = (lat: number, lng: number) => {
    if (!map.current || !isMapLoaded) return;

    // Remove existing circle
    if (captureRadiusCircle.current) {
      map.current.removeLayer('capture-radius-circle-fill');
      map.current.removeLayer('capture-radius-circle-stroke');
      map.current.removeSource('capture-radius-circle');
    }

    // Create circle polygon
    const circlePolygon = createCirclePolygon(lat, lng, captureRadiusM, 64);
    
    // Add new source and layers
    const color = currentUserRole === 'oni' ? '#dc2626' : (currentState && currentState !== 'active' ? '#9ca3af' : '#22c55e');
    
    map.current.addSource('capture-radius-circle', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circlePolygon]
        }
      }
    });

    map.current.addLayer({
      id: 'capture-radius-circle-fill',
      type: 'fill',
      source: 'capture-radius-circle',
      paint: {
        'fill-color': color,
        'fill-opacity': 0.1
      }
    });

    map.current.addLayer({
      id: 'capture-radius-circle-stroke',
      type: 'line',
      source: 'capture-radius-circle',
      paint: {
        'line-color': color,
        'line-opacity': 0.6,
        'line-width': 2
      }
    });

    captureRadiusCircle.current = {
      id: 'capture-radius-circle',
      center: [lng, lat],
      radius: captureRadiusM
    };
  };

  const clearRandomPins = () => {
    if (randomPinsRef.current.length > 0) {
      randomPinsRef.current.forEach(marker => marker.remove());
      randomPinsRef.current = [];
    }
  };

  const placeRandomYellowPins = (count: number = pinTargetCount) => {
    const bounds = getYamanoteBounds();
    const [minLng, minLat] = bounds[0];
    const [maxLng, maxLat] = bounds[1];

    clearRandomPins();
    const generated: Array<{ lat: number; lng: number }> = [];
    const effectiveCount = Math.max(1, Math.min(20, count));
    for (let i = 0; i < effectiveCount; i++) {
      const lng = minLng + Math.random() * (maxLng - minLng);
      const lat = minLat + Math.random() * (maxLat - minLat);
      generated.push({ lat, lng });
    }

    randomPinsPlacedRef.current = true;

    // Persist to database only from the owner client to avoid duplicates
    if (isOwner && gameId) {
      try {
        void setGamePins(gameId, generated.map(p => ({ lat: p.lat, lng: p.lng, type: 'yellow' })));
      } catch (e) {
        console.error('Failed to save pins:', e);
      }
    }
  };

  // Render yellow pins via GeoJSON
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    const sourceId = 'game-pins';

    if (pinEditingMode) {
      if (map.current.getLayer('game-pins-layer')) {
        map.current.removeLayer('game-pins-layer');
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      return;
    }

    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'game-pins-layer',
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image': [
            'case',
            ['boolean', ['get', 'cleared'], false],
            'pin-generator-cleared',
            'pin-generator'
          ],
          'icon-size': 0.75,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom'
        },
      });
    }

    const filteredPins = (() => {
      if (gameStatus !== 'running') return [] as typeof pins;
      if (currentLocation) {
        if (currentUserRole === 'runner' && typeof runnerSeeKillerRadiusM === 'number') {
          return pins.filter((p) => haversine(currentLocation.lat, currentLocation.lng, p.lat, p.lng) <= runnerSeeKillerRadiusM);
        }
        if (currentUserRole === 'oni' && typeof killerSeeGeneratorRadiusM === 'number') {
          return pins.filter((p) => haversine(currentLocation.lat, currentLocation.lng, p.lat, p.lng) <= killerSeeGeneratorRadiusM);
        }
      }
      return pins;
    })();

    const featureCollection = {
      type: 'FeatureCollection',
      features: filteredPins.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, cleared: !!p.cleared },
      })),
    } as const;

    const src = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      (src as any).setData(featureCollection as any);
    }
  }, [pins, isMapLoaded, pinEditingMode, currentUserRole, currentLocation, runnerSeeKillerRadiusM, killerSeeGeneratorRadiusM]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) {
      clearEditingMarkers();
      return;
    }
    if (!pinEditingMode) {
      clearEditingMarkers();
      return;
    }

    const markers = editingMarkersRef.current;
    const nextIds = new Set(pins.map((p) => p.id));

    // Remove markers no longer present
    Object.keys(markers).forEach((pinId) => {
      if (!nextIds.has(pinId)) {
        markers[pinId].remove();
        delete markers[pinId];
      }
    });

    pins.forEach((pin, index) => {
      let marker = markers[pin.id];

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'relative flex h-9 w-9 items-center justify-center';
        const circle = document.createElement('div');
        circle.className =
          'h-6 w-6 rounded-full border border-[#d97706] bg-[#f59e0b] shadow-[0_4px_12px_rgba(245,158,11,0.4)]';
        const label = document.createElement('span');
        label.className =
          'absolute -bottom-3 text-[10px] font-semibold uppercase tracking-wider text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]';
        label.setAttribute('data-pin-label', 'true');
        label.textContent = `#${index + 1}`;
        el.appendChild(circle);
        el.appendChild(label);

        marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map.current!);

        marker.on('dragstart', () => {
          onPinDragStart?.(pin.id);
        });

        marker.on('dragend', () => {
          const { lat, lng } = marker!.getLngLat();
          void onPinDragEnd?.(pin.id, lat, lng);
        });

        markers[pin.id] = marker;
      } else {
        marker.setLngLat([pin.lng, pin.lat]);
        const label = marker.getElement().querySelector('[data-pin-label]');
        if (label) {
          label.textContent = `#${index + 1}`;
        }
      }
    });
  }, [pinEditingMode, pins, isMapLoaded, onPinDragEnd, onPinDragStart]);

  // Detect nearby uncleared pin for runner within capture radius
  useEffect(() => {
    if (!currentLocation || !pins || pins.length === 0) {
      setNearbyPin(null);
      return;
    }
    if (currentUserRole !== 'runner') {
      setNearbyPin(null);
      return;
    }
    if (typeof captureRadiusM !== 'number') {
      setNearbyPin(null);
      return;
    }

    let found: PinPoint | null = null;
    for (const p of pins) {
      if (p.cleared) continue;
      const d = haversine(currentLocation.lat, currentLocation.lng, p.lat, p.lng);
      if (d <= captureRadiusM) {
        found = p;
        break;
      }
    }
    setNearbyPin(found);
  }, [currentLocation, pins, currentUserRole, captureRadiusM]);

  const handleClearNearbyPin = async () => {
    if (!gameId || !nearbyPin) return;
    setIsClearing(true);
    try {
      await updatePinCleared(gameId, nearbyPin.id, true);
      // If all pins are cleared, end the game (runners win)
      try {
        const allCleared = (pins || []).every((p) => (p.id === nearbyPin.id ? true : !!p.cleared));
        if ((pins || []).length > 0 && allCleared) {
          await updateGame(gameId, { status: 'ended' });
        }
      } catch (e) {
        // non-fatal
      }
    } catch (e) {
      console.error('Failed to clear pin:', e);
    } finally {
      setIsClearing(false);
    }
  };


  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const center = getYamanoteCenter();
    const bounds = getYamanoteBounds();

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: createBaseMapStyle(),
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
             if (!pinEditingMode) {
               setTimeout(() => {
                 console.log('Map loaded, requesting current location...');
                 getCurrentLocation();
               }, 1000); // 1秒後に位置取得を実行
             }
           });

    return () => {
      if (map.current) {
        if (currentLocationMarker.current) {
          currentLocationMarker.current.remove();
        }
        clearEditingMarkers();
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Player rendering via GeoJSON Source + Layer
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Ensure source and layer exist
    if (!map.current.getSource('players')) {
      map.current.addSource('players', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Add custom pin images
      (async () => {
        try {
          if (!map.current) return;
          if (!map.current.hasImage('pin-oni')) {
            const c1 = createPinCanvas('oni');
            const b1 = await createImageBitmap(c1);
            map.current.addImage('pin-oni', b1, { pixelRatio: 2 });
          }
          if (!map.current.hasImage('pin-runner')) {
            const c2 = createPinCanvas('runner');
            const b2 = await createImageBitmap(c2);
            map.current.addImage('pin-runner', b2, { pixelRatio: 2 });
          }
          if (!map.current.hasImage('pin-runner-captured')) {
            const c3 = createPinCanvas('runner', 40, { fill: '#9ca3af', border: '#6b7280' }); // gray variants
            const b3 = await createImageBitmap(c3);
            map.current.addImage('pin-runner-captured', b3, { pixelRatio: 2 });
          }
          if (!map.current.hasImage('pin-generator')) {
            const cg = createPinCanvas('runner', 40, { fill: GENERATOR_PIN_STYLE.fill, border: GENERATOR_PIN_STYLE.border, icon: GENERATOR_PIN_STYLE.icon });
            const bg = await createImageBitmap(cg);
            map.current.addImage('pin-generator', bg, { pixelRatio: 2 });
          }
          if (!map.current.hasImage('pin-generator-cleared')) {
            const cg2 = createPinCanvas('runner', 40, { fill: GENERATOR_PIN_STYLE_CLEARED.fill, border: GENERATOR_PIN_STYLE_CLEARED.border, icon: GENERATOR_PIN_STYLE_CLEARED.icon });
            const bg2 = await createImageBitmap(cg2);
            map.current.addImage('pin-generator-cleared', bg2, { pixelRatio: 2 });
          }
        } catch (e) {
          // noop; addImage may throw if image already added in rare cases
        }
      })();

      // Icon pins overlay using custom images (no circle background)
      map.current.addLayer({
        id: 'players-icons',
        type: 'symbol',
        source: 'players',
        layout: {
          'icon-image': ['get', 'iconImage'],
          'icon-size': 0.75,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom'
        }
      });

      // Popup on click
      map.current.on('click', 'players-icons', (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const coords = feature.geometry.type === 'Point' ? (feature.geometry as any).coordinates : null;
        if (!coords) return;
        const props: any = feature.properties || {};
        new maplibregl.Popup()
          .setLngLat(coords)
          .setHTML(`
            <div class="p-3">
              <div class="flex items-center space-x-3">
                <div>
                  <h3 class="font-semibold text-gray-800">${props.nickname || ''}</h3>
                  <p class="text-sm text-gray-600">${props.role === 'oni' ? '鬼' : '逃走者'}</p>
                </div>
              </div>
            </div>
          `)
          .addTo(map.current!);
      });
    }

    const currentUserLocation = currentLocation;
    const visiblePlayers = players.filter((player) => {
      if (player.uid === currentUserId) return false;
      if (!currentUserLocation) return false;

      const distance = haversine(
        currentUserLocation.lat,
        currentUserLocation.lng,
        player.lat,
        player.lng
      );

      if (currentUserRole === 'oni') {
        if (player.role === 'runner' && player.state !== 'eliminated') {
          return distance <= killerDetectRunnerRadiusM;
        }
        if (player.role === 'oni') {
          return true;
        }
      } else if (currentUserRole === 'runner') {
        if (player.role === 'runner') return true;
        if (player.role === 'oni') return distance <= runnerSeeKillerRadiusM;
      }
      return false;
    });

    const featureCollection = {
      type: 'FeatureCollection',
      features: visiblePlayers.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          uid: p.uid,
          nickname: p.nickname,
          role: p.role,
          state: p.state || 'active',
          iconImage: p.role === 'oni' ? 'pin-oni' : (p.state && p.state !== 'active' ? 'pin-runner-captured' : 'pin-runner'),
        },
      })),
    } as const;

    const src = map.current.getSource('players') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      (src as any).setData(featureCollection as any);
    }
  }, [players, isMapLoaded, currentUserId, currentUserRole, currentLocation, runnerSeeKillerRadiusM, killerDetectRunnerRadiusM]);

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
            
            // Update capture radius circle
            updateCaptureRadiusCircle(latitude, longitude);
            
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

    let watchId: number | null = null;
    let running = false;

    const start = () => {
      if (running) return;
      running = true;
      console.log('Starting location tracking...');
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log('Location update:', { latitude, longitude, accuracy });

          const withinBounds = isWithinYamanoteBounds(latitude, longitude);
          setCurrentLocation({ lat: latitude, lng: longitude });
          setIsOutOfBounds(!withinBounds);

          updateCaptureRadiusCircle(latitude, longitude);

          if (map.current && currentLocationMarker.current) {
            currentLocationMarker.current.setLngLat([longitude, latitude]);
          }

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
          maximumAge: 1000,
          timeout: 10000,
        }
      );
    };

    const stop = () => {
      if (!running) return;
      running = false;
      console.log('Stopping location tracking...');
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    start();
    return () => stop();
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
    const duration = countdownDurationSec ?? 900;
    setLocalCountdownStartAt(new Date());
    setIsCountdownActive(true);
    // A new countdown is starting; reset random pins state
    randomPinsPlacedRef.current = false;
    clearRandomPins();
    setCountdownTimeLeft(duration);
    
    // Call the parent's onStartGame handler
    if (onStartGame) {
      onStartGame();
    }
  };

  // Countdown effect - prioritize local countdown, fallback to Firestore countdown
  useEffect(() => {
    // If the game has ended, force-stop any countdown logic
    if (gameStatus === 'ended') {
      setIsCountdownActive(false);
      setCountdownTimeLeft(null);
      setLocalCountdownStartAt(null);
      return;
    }
    const activeStartAt = localCountdownStartAt || countdownStartAt;
    const duration = countdownDurationSec ?? 900;
    
    if (!activeStartAt || duration === null) {
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
    const durationMs = duration * 1000;

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
        // Notify parent component to update database
        if (onCountdownEnd) {
          onCountdownEnd();
        }
      }
    };

    // Initial update
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [localCountdownStartAt, countdownStartAt, countdownDurationSec, gameStatus, pinTargetCount]);

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

  useEffect(() => {
    const previous = prevGameStatusRef.current;
    if (gameStatus === 'ended' && previous !== 'ended') {
      placeRandomYellowPins(pinTargetCount);
    }
    prevGameStatusRef.current = gameStatus;
  }, [gameStatus, pinTargetCount]);

  // Calculate remaining time until game ends
  useEffect(() => {
    if (!gameStartAt || gameStatus !== 'running') {
      setGameTimeRemaining(null);
      return;
    }

    const updateElapsedTime = () => {
      const now = Date.now();
      const startTime = gameStartAt.getTime();
      const durationSec = gameDurationSec ?? 7200;
      const elapsed = Math.floor((now - startTime) / 1000); // elapsed time in seconds
      const remaining = Math.max(0, durationSec - elapsed);
      setGameTimeRemaining(remaining);
    };

    // Initial update
    updateElapsedTime();

    // Update every second
    const interval = setInterval(updateElapsedTime, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [gameStartAt, gameStatus, gameDurationSec]);

  // Stop and clear countdown when game status becomes ended
  useEffect(() => {
    if (gameStatus === 'ended') {
      setIsCountdownActive(false);
      setCountdownTimeLeft(null);
      setLocalCountdownStartAt(null);
    }
  }, [gameStatus]);

  // Update capture radius circle when captureRadiusM changes
  useEffect(() => {
    if (currentLocation && isMapLoaded) {
      updateCaptureRadiusCircle(currentLocation.lat, currentLocation.lng);
    }
  }, [captureRadiusM, currentLocation, isMapLoaded, currentUserRole, players, currentUserId]);

  // Update current radius circle color on state/role changes
  useEffect(() => {
    if (currentLocation && isMapLoaded) {
      updateRadiusCircle(currentLocation.lat, currentLocation.lng);
    }
  }, [currentUserRole, players, currentUserId, isMapLoaded]);

  // Format duration as hh:mm:ss or mm:ss
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {!pinEditingMode && (
        <div className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-[rgba(3,22,27,0.9)] border border-cyber-green/40 px-3 py-2 shadow-[0_10px_24px_rgba(3,22,27,0.45)]">
          <span className="text-xl">
            {currentUserRole === 'oni' ? '👹' : '🏃'}
          </span>
          <span className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
            {currentUserRole === 'oni' ? '鬼' : '逃走者'}
          </span>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
            <p className="text-gray-600">地図を読み込み中...</p>
          </div>
        </div>
      )}
      
      {/* Owner Start Game Button - Show when game is pending or ended; if ended, ignore countdown flags */}
      {!pinEditingMode && isOwner && 
       (gameStatus === 'pending' || gameStatus === 'ended') &&
       (gameStatus === 'ended' || (!isCountdownActive && countdownTimeLeft === null)) && (
        <button
          onClick={handleStartGameClick}
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full shadow-lg text-lg transition-colors"
        >
          ゲーム開始
        </button>
      )}

      {/* Countdown Display - Oni: full-screen overlay */}
      {!pinEditingMode && isCountdownActive && countdownTimeLeft !== null && gameStatus !== 'ended' && currentUserRole === 'oni' && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center">
            <div className="text-white text-8xl font-bold mb-4 animate-pulse">
              {formatDuration(countdownTimeLeft)}
            </div>
            <div className="text-white text-xl">鬼のスタートまで</div>
          </div>
        </div>
      )}

      {/* Countdown Display - Runner: bottom-right, no gray-out */}
      {!pinEditingMode && isCountdownActive && countdownTimeLeft !== null && gameStatus !== 'ended' && currentUserRole === 'runner' && (
        <div className="absolute bottom-20 right-4 z-50">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg px-4 py-3 border border-gray-200 flex items-center space-x-3">
            <span className="text-sm text-gray-600">鬼が出発するまで</span>
            <span className="font-mono text-2xl font-bold text-gray-900">{formatDuration(countdownTimeLeft)}</span>
          </div>
        </div>
      )}

      {/* Gray overlay for oni during countdown */}
      {/* Clear Pin Button for Runner when within capture radius */}
      {!pinEditingMode && gameStatus !== 'ended' && currentUserRole === 'runner' && nearbyPin && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={handleClearNearbyPin}
            disabled={isClearing}
            className={`bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg text-lg ${isClearing ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isClearing ? '解除中…' : '解除する'}
          </button>
        </div>
      )}
      {!pinEditingMode && isCountdownActive && currentUserRole === 'oni' && gameStatus !== 'ended' && (
        <div className="absolute inset-0 bg-gray-500 bg-opacity-50 z-40 pointer-events-none" />
      )}

      {/* Current Location Button */}
      {!pinEditingMode && (
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
      )}

      {/* Out of bounds overlay */}
      {!pinEditingMode && isOutOfBounds && (
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
      {!pinEditingMode && !currentLocation && (
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
