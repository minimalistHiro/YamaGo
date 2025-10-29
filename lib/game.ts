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
  Firestore
} from 'firebase/firestore';
import { getFirebaseServices } from './firebase/client';

// Types
export interface Game {
  id: string;
  status: 'pending' | 'running' | 'ended';
  startAt: Timestamp | null;
  captureRadiusM: number;
  startDelaySec: number;
  ownerUid: string;
  createdAt: Timestamp;
  countdownStartAt?: Timestamp | null;
  countdownDurationSec?: number;
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
      captureRadiusM: 50,
      startDelaySec: 1800, // 30 minutes
      ownerUid,
      createdAt: serverTimestamp() as Timestamp,
      ...gameData
    };
    
    console.log('Setting game document:', game);
    await setDoc(gameRef, game);
    console.log('Game document set successfully, ID:', gameRef.id);
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

export async function updateGame(gameId: string, updates: Partial<Game>): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, 'games', gameId), updates);
}

export async function updateGameOwner(gameId: string, newOwnerUid: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, 'games', gameId), {
    ownerUid: newOwnerUid
  });
}

export async function startGameCountdown(gameId: string, countdownDurationSec: number = 20): Promise<void> {
  const db = getDb();
  const countdownStartAt = serverTimestamp() as Timestamp;
  
  await updateDoc(doc(db, 'games', gameId), {
    countdownStartAt,
    countdownDurationSec,
    status: 'pending' // Keep as pending until countdown ends
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
    updates.countdownDurationSec = null;
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
            capturedTimes: existingPlayerData.stats?.capturedTimes ?? 0
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
            capturedTimes: 0
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
    query(alertsRef, where('toUid', '==', uid), orderBy('at', 'desc')),
    (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Alert));
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
