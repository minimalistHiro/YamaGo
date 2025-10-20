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
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// Types
export interface Game {
  id: string;
  status: 'pending' | 'running' | 'ended';
  startAt: Timestamp | null;
  captureRadiusM: number;
  startDelaySec: number;
  ownerUid: string;
  createdAt: Timestamp;
}

export interface Player {
  uid: string;
  nickname: string;
  role: 'oni' | 'runner';
  active: boolean;
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

// Game management functions
export async function createGame(ownerUid: string, gameData: Partial<Game> = {}): Promise<string> {
  try {
    console.log('Creating game for owner:', ownerUid);
    console.log('DB object:', db);
    console.log('DB type:', typeof db);
    console.log('DB constructor:', db?.constructor?.name);
    
    if (!db) {
      console.error('Firestore database is not initialized - db is null/undefined');
      throw new Error('Firestore database is not initialized');
    }
    
    if (typeof db !== 'object') {
      console.error('Firestore database is not an object:', typeof db);
      throw new Error('Firestore database is not properly initialized');
    }
    
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
  const gameDoc = await getDoc(doc(db, 'games', gameId));
  if (!gameDoc.exists()) return null;
  
  return { id: gameDoc.id, ...gameDoc.data() } as Game;
}

export async function updateGame(gameId: string, updates: Partial<Game>): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), updates);
}

export async function updateGameOwner(gameId: string, newOwnerUid: string): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), {
    ownerUid: newOwnerUid
  });
}

// Player management functions
export async function joinGame(gameId: string, uid: string, nickname: string, role: 'oni' | 'runner' = 'runner', avatarUrl?: string): Promise<void> {
  try {
    console.log('Joining game:', { gameId, uid, nickname, role, avatarUrl });
    console.log('DB object:', db);
    
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
    // Check if this is the first player joining the game
    const existingPlayers = await getPlayers(gameId);
    const isFirstPlayer = existingPlayers.length === 0;
    
    // If this is the first player, make them the owner and set role to 'oni'
    if (isFirstPlayer) {
      console.log('First player joining - making them owner and oni');
      role = 'oni';
      
      // Update game owner
      await updateGameOwner(gameId, uid);
    }
    
    const playerRef = doc(db, 'games', gameId, 'players', uid);
    const player: Player = {
      uid,
      nickname,
      role,
      active: true,
      avatarUrl,
      stats: {
        captures: 0,
        capturedTimes: 0
      }
    };
    
    console.log('Setting player document:', player);
    await setDoc(playerRef, player);
    console.log('Player document set successfully');
  } catch (error) {
    console.error('Error joining game:', error);
    throw new Error(`Failed to join game: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getPlayer(gameId: string, uid: string): Promise<Player | null> {
  const playerDoc = await getDoc(doc(db, 'games', gameId, 'players', uid));
  if (!playerDoc.exists()) return null;
  
  return playerDoc.data() as Player;
}

export async function updatePlayer(gameId: string, uid: string, updates: Partial<Player>): Promise<void> {
  await updateDoc(doc(db, 'games', gameId, 'players', uid), updates);
}

export async function getPlayers(gameId: string): Promise<Player[]> {
  try {
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
  const locationRef = doc(db, 'games', gameId, 'locations', uid);
  await setDoc(locationRef, {
    ...location,
    at: serverTimestamp()
  });
}

export async function getLocation(gameId: string, uid: string): Promise<Location | null> {
  const locationDoc = await getDoc(doc(db, 'games', gameId, 'locations', uid));
  if (!locationDoc.exists()) return null;
  
  return locationDoc.data() as Location;
}

// Capture management functions
export async function recordCapture(gameId: string, attackerUid: string, victimUid: string): Promise<string> {
  const captureRef = await addDoc(collection(db, 'games', gameId, 'captures'), {
    attackerUid,
    victimUid,
    at: serverTimestamp()
  });
  
  return captureRef.id;
}

// Real-time subscriptions
export function subscribeToGame(gameId: string, callback: (game: Game | null) => void): () => void {
  return onSnapshot(doc(db, 'games', gameId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Game);
    } else {
      callback(null);
    }
  });
}

export function subscribeToPlayers(gameId: string, callback: (players: Player[]) => void): () => void {
  const playersRef = collection(db, 'games', gameId, 'players');
  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => doc.data() as Player);
    callback(players);
  });
}

export function subscribeToLocations(gameId: string, callback: (locations: { [uid: string]: Location }) => void): () => void {
  const locationsRef = collection(db, 'games', gameId, 'locations');
  return onSnapshot(locationsRef, (snapshot) => {
    const locations: { [uid: string]: Location } = {};
    snapshot.docs.forEach(doc => {
      locations[doc.id] = doc.data() as Location;
    });
    callback(locations);
  });
}

export async function deletePlayer(gameId: string, uid: string): Promise<void> {
  try {
    console.log('Deleting player:', { gameId, uid });
    
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
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
