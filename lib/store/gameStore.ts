'use client';

import { create } from 'zustand';
import isEqual from 'fast-deep-equal';
import { haversine } from '@/lib/geo';
import {
  Game,
  Player,
  Location,
  Alert,
  PinPoint,
  subscribeToGame,
  subscribeToPlayers,
  subscribeToLocations,
  subscribeToAlerts,
  subscribeToPins,
  updateLocation,
} from '@/lib/game';

type Unsubscribe = () => void;

interface Subscriptions {
  game?: Unsubscribe;
  players?: Unsubscribe;
  locations?: Unsubscribe;
  alerts?: Unsubscribe;
  pins?: Unsubscribe;
}

interface GameStoreState {
  // identity
  gameId: string | null;
  currentUid: string | null;

  // data
  game: Game | null;
  playersById: Record<string, Player>;
  locationsById: Record<string, Location>;
  alerts: Alert[];
  pins: PinPoint[];

  // status
  isReady: boolean;
  isSubscribing: boolean;

  // internals
  _subs: Subscriptions;
  _lastWriteAtMs: number | null;
  _lastWriteLatLng: { lat: number; lng: number } | null;

  // actions
  setIdentity: (params: { gameId: string; uid: string }) => void;
  start: () => void;
  stop: () => void;
  updateLocationThrottled: (lat: number, lng: number, accM: number) => Promise<void>;
}

// Tunables
const MIN_DISTANCE_M = 10; // write only if moved >= 10m
const MIN_INTERVAL_MS = 3000; // write at most once every 3s
const MAX_INTERVAL_MS = 15000; // ensure at least one write every 15s while moving

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameId: null,
  currentUid: null,

  game: null,
  playersById: {},
  locationsById: {},
  alerts: [],
  pins: [],

  isReady: false,
  isSubscribing: false,

  _subs: {},
  _lastWriteAtMs: null,
  _lastWriteLatLng: null,

  setIdentity: ({ gameId, uid }) => {
    const prev = get();
    if (prev.gameId === gameId && prev.currentUid === uid) return;
    // reset data when identity changes
    set({
      gameId,
      currentUid: uid,
      game: null,
      playersById: {},
      locationsById: {},
      alerts: [],
      pins: [],
      isReady: false,
    });
  },

  start: () => {
    const { gameId, currentUid, isSubscribing, _subs } = get();
    if (!gameId || !currentUid) return;
    if (isSubscribing) return;

    const newSubs: Subscriptions = { ..._subs };

    // Game
    newSubs.game = subscribeToGame(gameId, (game, metadata) => {
      set((s) => {
        if (game) {
          return isEqual(s.game, game) ? s : { ...s, game };
        }
        if (metadata.fromCache) {
          return s;
        }
        if (s.game === null) {
          return s;
        }
        return { ...s, game: null };
      });
    });

    // Players
    newSubs.players = subscribeToPlayers(gameId, (players, metadata) => {
      const byId: Record<string, Player> = {};
      players.forEach((p) => (byId[p.uid] = p));
      set((s) => {
        if (metadata.fromCache && players.length === 0 && Object.keys(s.playersById).length > 0) {
          return s;
        }
        return isEqual(s.playersById, byId) ? s : { ...s, playersById: byId };
      });
    });

    // Locations
    newSubs.locations = subscribeToLocations(gameId, (locations, metadata) => {
      set((s) => {
        if (metadata.fromCache && Object.keys(locations).length === 0 && Object.keys(s.locationsById).length > 0) {
          return s;
        }
        return isEqual(s.locationsById, locations) ? s : { ...s, locationsById: locations };
      });
    });

    // Alerts (per-user)
    newSubs.alerts = subscribeToAlerts(gameId, currentUid, (alerts, metadata) => {
      set((s) => {
        if (metadata.fromCache && alerts.length === 0 && s.alerts.length > 0) {
          return s;
        }
        return isEqual(s.alerts, alerts) ? s : { ...s, alerts };
      });
    });

    // Pins
    newSubs.pins = subscribeToPins(gameId, (pins, metadata) => {
      set((s) => {
        if (metadata.fromCache && pins.length === 0 && s.pins.length > 0) {
          return s;
        }
        return isEqual(s.pins, pins) ? s : { ...s, pins };
      });
    });

    set({ _subs: newSubs, isSubscribing: true, isReady: true });
  },

  stop: () => {
    const { _subs } = get();
    _subs.game?.();
    _subs.players?.();
    _subs.locations?.();
    _subs.alerts?.();
    _subs.pins?.();
    set({ _subs: {}, isSubscribing: false });
  },

  updateLocationThrottled: async (lat, lng, accM) => {
    const { gameId, currentUid, _lastWriteAtMs, _lastWriteLatLng } = get();
    if (!gameId || !currentUid) return;

    const now = Date.now();
    if (_lastWriteAtMs) {
      const since = now - _lastWriteAtMs;
      if (since < MIN_INTERVAL_MS) return;
    }

    if (_lastWriteLatLng) {
      const moved = haversine(_lastWriteLatLng.lat, _lastWriteLatLng.lng, lat, lng);
      const timeSince = _lastWriteAtMs ? now - _lastWriteAtMs : Infinity;
      const allowByDistance = moved >= MIN_DISTANCE_M;
      const allowByMaxInterval = timeSince >= MAX_INTERVAL_MS;
      if (!allowByDistance && !allowByMaxInterval) return;
    }

    try {
      await updateLocation(gameId, currentUid, { lat, lng, accM });
      set({ _lastWriteAtMs: now, _lastWriteLatLng: { lat, lng } });
    } catch (e) {
      // swallow errors; writer is best-effort
      // console will already log from the callee if needed
    }
  },
}));

export type { Game, Player, Location, Alert };

