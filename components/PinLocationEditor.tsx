'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getYamanoteBounds, getYamanoteCenter } from '@/lib/geo';
import { PinPoint, subscribeToPins, updatePinPosition } from '@/lib/game';
import { createBaseMapStyle } from '@/lib/mapStyle';

interface PinLocationEditorProps {
  gameId: string;
  onBack: () => void;
}

type MarkerMap = Record<string, maplibregl.Marker>;

export default function PinLocationEditor({ gameId, onBack }: PinLocationEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<MarkerMap>({});
  const [pins, setPins] = useState<PinPoint[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFitInitialBoundsRef = useRef(false);

  // Subscribe to pins for the game
  useEffect(() => {
    const unsub = subscribeToPins(gameId, (nextPins) => {
      setPins(nextPins);
    });
    return () => {
      unsub();
    };
  }, [gameId]);

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const center = getYamanoteCenter();
    const bounds = getYamanoteBounds();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createBaseMapStyle(),
      center: [center.lng, center.lat],
      zoom: 13,
      maxBounds: bounds,
    });

    mapRef.current = map;

    map.on('load', () => {
      setIsMapLoaded(true);
      map.resize();

      // Add boundary overlay for guidance
      map.addSource('yamanote-boundary', {
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
              [bounds[0][0], bounds[0][1]],
            ]],
          },
          properties: {},
        },
      });

      map.addLayer({
        id: 'yamanote-boundary-fill',
        type: 'fill',
        source: 'yamanote-boundary',
        paint: {
          'fill-color': '#22b59b',
          'fill-opacity': 0.08,
        },
      });

      map.addLayer({
        id: 'yamanote-boundary-line',
        type: 'line',
        source: 'yamanote-boundary',
        paint: {
          'line-color': '#22b59b',
          'line-width': 2,
        },
      });
    });

    return () => {
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fit map to pins when they are first loaded
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded || pins.length === 0) return;
    if (hasFitInitialBoundsRef.current) return;

    if (pins.length === 1) {
      const single = pins[0];
      mapRef.current.setCenter([single.lng, single.lat]);
      mapRef.current.setZoom(15);
    } else {
      const bounds = pins.reduce(
        (acc, pin) => acc.extend([pin.lng, pin.lat]),
        new maplibregl.LngLatBounds(
          [pins[0].lng, pins[0].lat],
          [pins[0].lng, pins[0].lat]
        )
      );
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 16, animate: false });
    }
    hasFitInitialBoundsRef.current = true;
  }, [pins, isMapLoaded]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const handleResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMapLoaded]);

  // Render draggable markers
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const markers = markersRef.current;
    const nextIds = new Set(pins.map((p) => p.id));

    // Remove markers for pins that no longer exist
    Object.keys(markers).forEach((pinId) => {
      if (!nextIds.has(pinId)) {
        markers[pinId].remove();
        delete markers[pinId];
      }
    });

    // Add or update markers
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
        label.textContent = `#${index + 1}`;
        el.appendChild(circle);
        el.appendChild(label);

        marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([pin.lng, pin.lat])
          .addTo(mapRef.current!);

        marker.on('dragstart', () => {
          setActivePinId(pin.id);
          setError(null);
        });

        marker.on('dragend', () => {
          const { lat, lng } = marker!.getLngLat();
          setActivePinId(pin.id);

          void updatePinPosition(gameId, pin.id, lat, lng).catch((e) => {
            console.error('Failed to update pin location', e);
            setError('発電所の場所を保存できませんでした。再度お試しください。');
          }).finally(() => {
            setActivePinId(null);
          });
        });

        markers[pin.id] = marker;
      } else {
        marker.setLngLat([pin.lng, pin.lat]);
      }
    });
  }, [pins, isMapLoaded, gameId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-app">
      <div className="bg-[rgba(3,22,27,0.96)] border-b border-cyber-green/35 p-5 flex-shrink-0 flex items-center justify-between shadow-[0_6px_24px_rgba(4,12,24,0.4)]">
        <button
          onClick={onBack}
          className="btn-surface inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs tracking-[0.2em]"
          aria-label="戻る"
        >
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <h2 className="text-lg font-semibold text-primary uppercase tracking-[0.35em]">
          発電所の場所を変更
        </h2>
      </div>

      <div className="relative flex-1 min-h-[360px]">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {pins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-cyber-green/40 bg-[rgba(3,22,27,0.88)] px-6 py-4 text-center shadow-[0_0_24px_rgba(34,181,155,0.25)]">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                発電所のピンがまだ配置されていません
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted tracking-[0.2em]">
                ゲーム設定で発電所の数を変更すると自動でピンが生成されます。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[rgba(3,22,27,0.92)] border-t border-cyber-green/30 p-5 flex-shrink-0 space-y-3">
        <p className="text-[11px] text-muted uppercase tracking-[0.3em]">
          ピンをドラッグ&ドロップして位置を調整できます。
        </p>
        <p className="text-[10px] text-muted tracking-[0.2em] leading-relaxed">
          位置の変更は自動的に保存されます。ゲーム開始前に参加者の集合場所や安全な位置に調整してください。
        </p>
        {activePinId && (
          <p className="text-[10px] text-cyber-green tracking-[0.3em] uppercase">
            位置を保存中...
          </p>
        )}
        {error && (
          <p className="text-[10px] text-cyber-pink tracking-[0.3em] uppercase">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
