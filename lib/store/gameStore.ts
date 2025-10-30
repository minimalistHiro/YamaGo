'use client';

import { create } from 'zustand';
import isEqual from 'fast-deep-equal';
import { haversine } from '@/lib/geo';
import {
  Game,
  Player,
  Location,
  Alert,
  subscribeToGame,
  subscribeToPlayers,
  subscribeToLocations,
  subscribeToAlerts,
  updateLocation,
} from '@/lib/game';

type Unsubscribe = () => void;

interface Subscriptions {
  game?: Unsubscribe;
  players?: Unsubscribe;
  locations?: Unsubscribe;
  alerts?: Unsubscribe;
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
      isReady: false,
    });
  },

  start: () => {
    const { gameId, currentUid, isSubscribing, _subs } = get();
    if (!gameId || !currentUid) return;
    if (isSubscribing) return;

    const newSubs: Subscriptions = { ..._subs };

    // Game
    newSubs.game = subscribeToGame(gameId, (game) => {
      set((s) => (s.game === game ? s : { ...s, game }));
    });

    // Players
    newSubs.players = subscribeToPlayers(gameId, (players) => {
      const byId: Record<string, Player> = {};
      players.forEach((p) => (byId[p.uid] = p));
      set((s) => (isEqual(s.playersById, byId) ? s : { ...s, playersById: byId }));
    });

    // Locations
    newSubs.locations = subscribeToLocations(gameId, (locations) => {
      set((s) => (isEqual(s.locationsById, locations) ? s : { ...s, locationsById: locations }));
    });

    // Alerts (per-user)
    newSubs.alerts = subscribeToAlerts(gameId, currentUid, (alerts) => {
      set((s) => (isEqual(s.alerts, alerts) ? s : { ...s, alerts }));
    });

    set({ _subs: newSubs, isSubscribing: true, isReady: true });
  },

  stop: () => {
    const { _subs } = get();
    _subs.game?.();
    _subs.players?.();
    _subs.locations?.();
    _subs.alerts?.();
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


