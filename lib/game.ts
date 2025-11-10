import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  Firestore,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { getYamanoteBounds, getYamanoteCenter } from './geo';
import { getFirebaseServices } from './firebase/client';

// Types
export interface Game {
  id: string;
  status: 'pending' | 'countdown' | 'running' | 'ended';
  startAt: Timestamp | null;
  gameDurationSec?: number | null;
  captureRadiusM: number;
  runnerSeeKillerRadiusM?: number;
  runnerSeeRunnerRadiusM?: number;
  runnerSeeGeneratorRadiusM?: number;
  killerDetectRunnerRadiusM?: number;
  killerSeeGeneratorRadiusM?: number;
  pinCount?: number;
  startDelaySec: number;
  ownerUid: string;
  createdAt: Timestamp;
  countdownStartAt?: Timestamp | null;
  countdownDurationSec?: number | null;
}

export interface Player {
  uid: string;
  nickname: string;
  role: 'oni' | 'runner';
  active: boolean;
  state?: 'active' | 'downed' | 'eliminated';
  downs?: number;
  lastDownAt?: Date | null;
  lastRescuedAt?: Date | null;
  lastRevealUntil?: Date | null;
  cooldownUntil?: Date | null;
  avatarUrl?: string;
  stats: {
    captures: number;
    capturedTimes: number;
    generatorsCleared?: number;
  };
}

export interface Location {
  lat: number;
  lng: number;
  accM: number;
  at: Timestamp;
}

export interface Capture {
  id: string;
  attackerUid: string;
  victimUid: string;
  at: Timestamp;
}

export interface Alert {
  id: string;
  toUid: string;
  type: 'killer-near' | 'runner-near';
  distanceM: number;
  at: Timestamp;
  meta?: any;
}

export interface GameEvent {
  id: string;
  type: 'capture' | 'rescue' | 'elimination' | 'game-start' | 'game-end';
  gameId: string;
  actorUid?: string;
  targetUid?: string;
  at: Timestamp;
  data?: any;
}

// Map pins placed on the game map
export type PinStatus = 'pending' | 'clearing' | 'cleared';

export interface PinPoint {
  id: string;
  lat: number;
  lng: number;
  type?: 'yellow';
  status?: PinStatus;
  cleared?: boolean;
  createdAt: Timestamp;
}

// Game management functions
const getDb = (): Firestore => {
  try {
    const { db } = getFirebaseServices();
    return db;
  } catch (error) {
    console.error('Firestore service is unavailable:', error);
    throw new Error('Firestore database is not initialized');
  }
};

export async function createGame(ownerUid: string, gameData: Partial<Game> = {}): Promise<string> {
  try {
    console.log('Creating game for owner:', ownerUid);
    const db = getDb();
    console.log('DB object:', db);
    console.log('DB type:', typeof db);
    console.log('DB constructor:', db?.constructor?.name);

    console.log('Creating game document reference...');
    const gameRef = doc(collection(db, 'games'));
    console.log('Game reference created:', gameRef);
    
    const game: Omit<Game, 'id'> = {
      status: 'pending',
      startAt: null,
      captureRadiusM: 100,
      runnerSeeKillerRadiusM: 500,
      runnerSeeRunnerRadiusM: 1000,
      runnerSeeGeneratorRadiusM: 3000,
      killerDetectRunnerRadiusM: 500,
      killerSeeGeneratorRadiusM: 3000,
      pinCount: 10,
      startDelaySec: 1800, // 30 minutes
      gameDurationSec: 7200, // 2 hours
      countdownDurationSec: 900, // 15 minutes
      ownerUid,
      createdAt: serverTimestamp() as Timestamp,
      ...gameData
    };
    
    console.log('Setting game document:', game);
    await setDoc(gameRef, game);
    console.log('Game document set successfully, ID:', gameRef.id);

    const initialPinCount =
      typeof game.pinCount === 'number' && game.pinCount > 0 ? game.pinCount : 10;

    try {
      if (initialPinCount > 0) {
        console.log('Seeding initial generator pins:', initialPinCount);
        await reseedPinsWithRandomLocations(gameRef.id, initialPinCount);
        console.log('Initial generator pins seeded successfully');
      }
    } catch (pinError) {
      console.error('Failed to seed initial generator pins:', pinError);
    }

    return gameRef.id;
  } catch (error) {
    console.error('Error creating game:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw new Error(`Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getGame(gameId: string): Promise<Game | null> {
  const db = getDb();
  const gameDoc = await getDoc(doc(db, 'games', gameId));
  if (!gameDoc.exists()) return null;
  
  return { id: gameDoc.id, ...gameDoc.data() } as Game;
}

export async function updateGame(gameId: string, updates: Partial<Game> | Record<string, any>): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, 'games', gameId), updates);
}

export async function updateGameOwner(gameId: string, newOwnerUid: string): Promise<void> {
  const db = getDb();
  // Prevent owner change if there is at least one player in the game
  const players = await getPlayers(gameId);
  if (players.length >= 1) {
    console.log('updateGameOwner skipped: players already exist for game', gameId, 'count:', players.length);
    return;
  }

  await updateDoc(doc(db, 'games', gameId), {
    ownerUid: newOwnerUid
  });
}

// Pins management
export async function clearPins(gameId: string): Promise<void> {
  const db = getDb();
  const pinsRef = collection(db, 'games', gameId, 'pins');
  const snapshot = await getDocs(pinsRef);
  const deletions: Promise<void>[] = [];
  snapshot.forEach((d) => {
    deletions.push(deleteDoc(doc(db, 'games', gameId, 'pins', d.id)));
  });
  await Promise.all(deletions);
}

export async function addPins(
  gameId: string,
  pins: Array<{ lat: number; lng: number; type?: 'yellow'; status?: PinStatus }>
): Promise<void> {
  const db = getDb();
  const pinsRef = collection(db, 'games', gameId, 'pins');
  const writes: Promise<any>[] = [];
  pins.forEach((p) => {
    writes.push(
      addDoc(pinsRef, {
        lat: p.lat,
        lng: p.lng,
        type: p.type || 'yellow',
        status: p.status ?? 'pending',
        cleared: (p.status ?? 'pending') === 'cleared',
        createdAt: serverTimestamp(),
      })
    );
  });
  await Promise.all(writes);
}

export async function updatePinStatus(
  gameId: string,
  pinId: string,
  status: PinStatus
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, 'games', gameId, 'pins', pinId), {
    status,
    cleared: status === 'cleared',
  });
}

export async function updatePinPosition(
  gameId: string,
  pinId: string,
  lat: number,
  lng: number
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, 'games', gameId, 'pins', pinId), {
    lat,
    lng,
  });
}

export async function resetRunnersAndGenerators(gameId: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  const playersSnapshot = await getDocs(collection(db, 'games', gameId, 'players'));
  playersSnapshot.forEach((playerDoc) => {
    batch.update(playerDoc.ref, {
      state: 'active',
      downs: 0,
      lastDownAt: null,
      lastRescuedAt: null,
      lastRevealUntil: null,
      cooldownUntil: null,
    });
  });

  const pinsSnapshot = await getDocs(collection(db, 'games', gameId, 'pins'));
  pinsSnapshot.forEach((pinDoc) => {
    batch.update(pinDoc.ref, {
      status: 'pending',
      cleared: false,
    });
  });

  if (!playersSnapshot.empty || !pinsSnapshot.empty) {
    await batch.commit();
  }
}

export async function setGamePins(
  gameId: string,
  pins: Array<{ lat: number; lng: number; type?: 'yellow'; status?: PinStatus }>
): Promise<void> {
  await clearPins(gameId);
  await addPins(gameId, pins);
}

const PIN_DUPLICATE_PRECISION = 6;

const formatPinKey = (lat: number, lng: number): string =>
  `${lat.toFixed(PIN_DUPLICATE_PRECISION)}:${lng.toFixed(PIN_DUPLICATE_PRECISION)}`;

function generateCandidatePoint(): { lat: number; lng: number } {
  const [sw, ne] = getYamanoteBounds();
  const minLng = sw[0];
  const minLat = sw[1];
  const maxLng = ne[0];
  const maxLat = ne[1];

  const lat = minLat + Math.random() * (maxLat - minLat);
  const lng = minLng + Math.random() * (maxLng - minLng);

  return { lat, lng };
}

export async function reconcilePinsWithTargetCount(gameId: string, targetCount: number): Promise<void> {
  const db = getDb();

  if (targetCount <= 0) {
    await clearPins(gameId);
    return;
  }

  const pinsRef = collection(db, 'games', gameId, 'pins');
  const snapshot = await getDocs(pinsRef);

  const sortedDocs = snapshot.docs
    .slice()
    .sort((a, b) => {
      const aData = a.data();
      const bData = b.data();
      const aCreated = (aData.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
      const bCreated = (bData.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (aCreated === bCreated) {
        return a.id.localeCompare(b.id);
      }
      return aCreated - bCreated;
    });

  let keptDocs = sortedDocs;
  if (sortedDocs.length > targetCount) {
    keptDocs = sortedDocs.slice(0, targetCount);
    const toDelete = sortedDocs.slice(targetCount);
    if (toDelete.length > 0) {
      const batch = writeBatch(db);
      toDelete.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
  }

  const existingKeys = new Set<string>();
  keptDocs.forEach((docSnap) => {
    const data = docSnap.data();
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      existingKeys.add(formatPinKey(data.lat, data.lng));
    }
  });

  const missingCount = targetCount - keptDocs.length;
  if (missingCount <= 0) {
    return;
  }

  for (let i = 0; i < missingCount; i += 1) {
    let candidate = generateCandidatePoint();
    let attempts = 0;

    while (existingKeys.has(formatPinKey(candidate.lat, candidate.lng)) && attempts < 50) {
      candidate = generateCandidatePoint();
      attempts += 1;
    }

    if (attempts >= 50) {
      const center = getYamanoteCenter();
      candidate = center;
    }

    existingKeys.add(formatPinKey(candidate.lat, candidate.lng));

    await addDoc(pinsRef, {
      lat: candidate.lat,
      lng: candidate.lng,
      type: 'yellow',
      status: 'pending',
      cleared: false,
      createdAt: serverTimestamp(),
    });
  }
}

export async function reseedPinsWithRandomLocations(gameId: string, targetCount: number): Promise<void> {
  if (targetCount <= 0) {
    await clearPins(gameId);
    return;
  }

  const uniqueKeys = new Set<string>();
  const pins: Array<{ lat: number; lng: number; type: 'yellow'; status: PinStatus }> = [];
  let attempts = 0;

  const maxAttempts = targetCount * 200;

  while (pins.length < targetCount && attempts < maxAttempts) {
    const candidate = generateCandidatePoint();
    const key = formatPinKey(candidate.lat, candidate.lng);
    if (uniqueKeys.has(key)) {
      attempts += 1;
      continue;
    }
    uniqueKeys.add(key);
    pins.push({
      lat: candidate.lat,
      lng: candidate.lng,
      type: 'yellow',
      status: 'pending',
    });
  }

  while (pins.length < targetCount) {
    const center = getYamanoteCenter();
    const key = formatPinKey(center.lat, center.lng + pins.length * 0.0001);
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      pins.push({
        lat: center.lat,
        lng: center.lng + pins.length * 0.0001,
        type: 'yellow',
        status: 'pending',
      });
    } else {
      break;
    }
  }

  await setGamePins(gameId, pins);
}

// Subscribe to pins
export function subscribeToPins(gameId: string, callback: (pins: PinPoint[]) => void): () => void {
  const db = getDb();
  const pinsRef = collection(db, 'games', gameId, 'pins');
  return onSnapshot(pinsRef, (snapshot) => {
    const pins: PinPoint[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(() => {
        const raw = d.data() as any;
        let status: PinStatus | undefined = raw.status;
        if (!status) {
          if (typeof raw.cleared === 'boolean') {
            status = raw.cleared ? 'cleared' : 'pending';
          } else {
            status = 'pending';
          }
        }
        return {
          ...raw,
          status,
          cleared: raw.cleared ?? (status === 'cleared'),
        };
      })(),
    }));
    callback(pins);
  });
}

export async function startGameCountdown(gameId: string, countdownDurationSec: number = 900): Promise<void> {
  const db = getDb();
  const countdownStartAt = serverTimestamp() as Timestamp;
  
  await updateDoc(doc(db, 'games', gameId), {
    countdownStartAt,
    countdownDurationSec,
    status: 'countdown' // Mark countdown status until countdown ends
  });
}

export async function startGame(gameId: string, keepCountdown: boolean = false): Promise<void> {
  const db = getDb();
  const startAt = serverTimestamp() as Timestamp;
  
  const updates: any = {
    status: 'running',
    startAt
  };
  
  // Only clear countdown if explicitly requested (after countdown ends)
  if (!keepCountdown) {
    updates.countdownStartAt = null;
  }
  
  await updateDoc(doc(db, 'games', gameId), updates);
}

// Player management functions
export async function joinGame(
  gameId: string,
  uid: string,
  nickname: string,
  role: 'oni' | 'runner' = 'runner',
  avatarUrl?: string
): Promise<void> {
  try {
    console.log('=== JOIN GAME DEBUG ===');
    console.log('Joining game:', { gameId, uid, nickname, role, avatarUrl });
    console.log('Environment check:', {
      isClient: typeof window !== 'undefined',
      nodeEnv: process.env.NODE_ENV,
      firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      usingFallback: !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
    
    console.log('Getting Firebase database...');
    const db = getDb();
    console.log('DB object:', db);
    console.log('DB project ID:', db.app.options.projectId);
    console.log('=== END JOIN GAME DEBUG ===');

    const gameRef = doc(db, 'games', gameId);
    console.log('Game reference path:', gameRef.path);
    const gameSnapshot = await getDoc(gameRef);
    console.log('Game snapshot exists:', gameSnapshot.exists());
    console.log('Game snapshot data:', gameSnapshot.data());

    if (!gameSnapshot.exists()) {
      console.error('Game not found - checking if it exists in different project or collection');
      // Try to list games to see what's available
      try {
        const gamesRef = collection(db, 'games');
        const gamesSnapshot = await getDocs(gamesRef);
        console.log('Available games:', gamesSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
      } catch (listError) {
        console.error('Error listing games:', listError);
      }
      throw new Error('Game not found');
    }

    const gameData = gameSnapshot.data() as Game;

    // Check if this is the first player joining the game
    const existingPlayers = await getPlayers(gameId);
    const existingPlayerRef = doc(db, 'games', gameId, 'players', uid);
    const existingPlayerSnapshot = await getDoc(existingPlayerRef);
    const existingPlayerData = existingPlayerSnapshot.exists()
      ? (existingPlayerSnapshot.data() as Player)
      : null;

    // Count total players in the game (including inactive ones)
    const totalPlayerCount = existingPlayers.length;
    // Consider this player already exists in the count if they're rejoining
    const isNewPlayer = !existingPlayerSnapshot.exists();
    const isFirstPlayer = totalPlayerCount === 0 && isNewPlayer;

    console.log('Player count check:', { 
      totalPlayers: totalPlayerCount,
      isNewPlayer,
      isFirstPlayer,
      uid
    });

    // If this is the first player joining the game (no players exist), make them the owner
    if (isFirstPlayer) {
      console.log('First player joining - assigning oni role and updating ownerUid');
      role = 'oni';

      // Check current game owner to determine if we should update
      const currentGameData = gameSnapshot.data() as Game;
      const currentOwnerUid = currentGameData?.ownerUid;
      
      console.log('Current owner check:', { 
        currentOwnerUid, 
        shouldUpdate: !currentOwnerUid || currentOwnerUid === 'Q07YEGZTOSfvSfENHTs5yZwrf1e2' 
      });

      // Update the game document's ownerUid field only if needed
      if (!currentOwnerUid || currentOwnerUid === 'Q07YEGZTOSfvSfENHTs5yZwrf1e2') {
        try {
          await updateDoc(gameRef, { ownerUid: uid });
          console.log('Successfully updated ownerUid to:', uid);
        } catch (error) {
          console.warn('Could not update game ownerUid, but continuing with player creation:', error);
          // Continue even if we can't update the owner
          // This allows players to join games where they cannot become the owner due to security rules
        }
      } else {
        console.log('Current owner is valid, not updating:', currentOwnerUid);
      }
    } else if (existingPlayerData) {
      // Preserve existing role if the player is rejoining
      role = existingPlayerData.role;
    }

    const playerRef = existingPlayerRef;

    const player: Player = existingPlayerData
      ? {
          ...existingPlayerData,
          uid,
          nickname,
          role,
          active: true,
          state: existingPlayerData.state || 'active',
          downs: existingPlayerData.downs || 0,
          stats: {
            captures: existingPlayerData.stats?.captures ?? 0,
            capturedTimes: existingPlayerData.stats?.capturedTimes ?? 0,
            generatorsCleared: existingPlayerData.stats?.generatorsCleared ?? 0
          },
          ...(avatarUrl ? { avatarUrl } : {})
        }
      : {
          uid,
          nickname,
          role,
          active: true,
          state: 'active',
          downs: 0,
          ...(avatarUrl ? { avatarUrl } : {}),
          stats: {
            captures: 0,
            capturedTimes: 0,
            generatorsCleared: 0
          }
        };

    console.log('Setting player document:', player);
    await setDoc(playerRef, player, { merge: true });
    console.log('Player document set successfully');
  } catch (error) {
    console.error('Error joining game:', error);
    throw new Error(`Failed to join game: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPlayer(gameId: string, uid: string): Promise<Player | null> {
  const db = getDb();
  const playerDoc = await getDoc(doc(db, 'games', gameId, 'players', uid));
  if (!playerDoc.exists()) return null;
  
  return playerDoc.data() as Player;
}

export async function updatePlayer(gameId: string, uid: string, updates: Partial<Player>): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, 'games', gameId, 'players', uid), updates);
}

export async function getPlayers(gameId: string): Promise<Player[]> {
  try {
    const db = getDb();
    const playersRef = collection(db, 'games', gameId, 'players');
    const playersSnapshot = await getDocs(playersRef);
    
    const players: Player[] = [];
    playersSnapshot.forEach((doc) => {
      players.push(doc.data() as Player);
    });
    
    return players;
  } catch (error) {
    console.error('Error getting players:', error);
    return [];
  }
}

// Location management functions
export async function updateLocation(gameId: string, uid: string, location: Omit<Location, 'at'>): Promise<void> {
  const db = getDb();
  const locationRef = doc(db, 'games', gameId, 'locations', uid);
  await setDoc(locationRef, {
    ...location,
    at: serverTimestamp()
  });
}

export async function getLocation(gameId: string, uid: string): Promise<Location | null> {
  const db = getDb();
  const locationDoc = await getDoc(doc(db, 'games', gameId, 'locations', uid));
  if (!locationDoc.exists()) return null;
  
  return locationDoc.data() as Location;
}

// Capture management functions
export async function recordCapture(gameId: string, attackerUid: string, victimUid: string): Promise<string> {
  const db = getDb();
  const captureRef = await addDoc(collection(db, 'games', gameId, 'captures'), {
    attackerUid,
    victimUid,
    at: serverTimestamp()
  });
  
  return captureRef.id;
}

// Real-time subscriptions
export function subscribeToGame(gameId: string, callback: (game: Game | null) => void): () => void {
  const db = getDb();
  return onSnapshot(doc(db, 'games', gameId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Game);
    } else {
      callback(null);
    }
  });
}

export function subscribeToPlayers(gameId: string, callback: (players: Player[]) => void): () => void {
  const db = getDb();
  const playersRef = collection(db, 'games', gameId, 'players');
  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => doc.data() as Player);
    callback(players);
  });
}

export function subscribeToLocations(gameId: string, callback: (locations: { [uid: string]: Location }) => void): () => void {
  const db = getDb();
  const locationsRef = collection(db, 'games', gameId, 'locations');
  return onSnapshot(locationsRef, (snapshot) => {
    const locations: { [uid: string]: Location } = {};
    snapshot.docs.forEach(doc => {
      locations[doc.id] = doc.data() as Location;
    });
    callback(locations);
  });
}

export function subscribeToAlerts(gameId: string, uid: string, callback: (alerts: Alert[]) => void): () => void {
  const db = getDb();
  const alertsRef = collection(db, 'games', gameId, 'alerts');
  return onSnapshot(
    query(alertsRef, where('toUid', '==', uid)),
    (snapshot) => {
      const alerts = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Alert))
        .sort((a, b) => {
          const atA = (a.at as Timestamp | Date | undefined) ?? null;
          const atB = (b.at as Timestamp | Date | undefined) ?? null;
          const timeA = atA instanceof Timestamp ? atA.toMillis() : atA instanceof Date ? atA.getTime() : 0;
          const timeB = atB instanceof Timestamp ? atB.toMillis() : atB instanceof Date ? atB.getTime() : 0;
          return timeB - timeA;
        });
      callback(alerts);
    }
  );
}

export function subscribeToEvents(gameId: string, callback: (events: GameEvent[]) => void): () => void {
  const db = getDb();
  const eventsRef = collection(db, 'games', gameId, 'events');
  return onSnapshot(
    query(eventsRef, orderBy('at', 'desc')),
    (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GameEvent));
      callback(events);
    }
  );
}

export async function deletePlayer(gameId: string, uid: string): Promise<void> {
  try {
    console.log('Deleting player:', { gameId, uid });
    const db = getDb();

    // Delete player document
    const playerRef = doc(db, 'games', gameId, 'players', uid);
    await deleteDoc(playerRef);
    console.log('Player document deleted successfully');
    
    // Delete player location
    const locationRef = doc(db, 'games', gameId, 'locations', uid);
    await deleteDoc(locationRef);
    console.log('Player location deleted successfully');
    
  } catch (error) {
    console.error('Error deleting player:', error);
    throw new Error(`Failed to delete player: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteGame(gameId: string): Promise<void> {
  try {
    console.log('Deleting game:', gameId);
    const db = getDb();
    const gameRef = doc(db, 'games', gameId);
    const subcollections = ['players', 'locations', 'captures', 'alerts', 'events', 'pins'];
    const batchSizeLimit = 400;

    const deleteSubcollection = async (collectionName: string) => {
      const subcollectionRef = collection(db, 'games', gameId, collectionName);
      const snapshot = await getDocs(subcollectionRef);
      if (snapshot.empty) {
        return;
      }

      let batch = writeBatch(db);
      let operations = 0;

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        operations += 1;

        if (operations >= batchSizeLimit) {
          await batch.commit();
          batch = writeBatch(db);
          operations = 0;
        }
      }

      if (operations > 0) {
        await batch.commit();
      }
    };

    for (const collectionName of subcollections) {
      await deleteSubcollection(collectionName);
    }

    await deleteDoc(gameRef);
    console.log('Game deleted successfully:', gameId);
  } catch (error) {
    console.error('Error deleting game:', error);
    throw new Error(`Failed to delete game: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
