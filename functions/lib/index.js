"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameStats = exports.onGameStart = exports.onLocationWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
// Helper function to calculate distance between two points
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const dφ = (lat2 - lat1) * Math.PI / 180;
    const dλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// Check if point is within Yamanote Line boundary
function isWithinYamanoteLine(lat, lng) {
    const minLat = 35.65;
    const maxLat = 35.75;
    const minLng = 139.65;
    const maxLng = 139.8;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
// Triggered when a location is updated
exports.onLocationWrite = functions.firestore
    .document('games/{gameId}/locations/{uid}')
    .onWrite(async (change, context) => {
    const gameId = context.params.gameId;
    const uid = context.params.uid;
    if (!change.after.exists) {
        return; // Document was deleted
    }
    const locationData = change.after.data();
    if (!locationData)
        return;
    const { lat, lng } = locationData;
    // Check if player is within Yamanote Line boundary
    if (!isWithinYamanoteLine(lat, lng)) {
        console.log(`Player ${uid} is outside Yamanote Line boundary`);
        // Get player data
        const playerRef = db.collection('games').doc(gameId).collection('players').doc(uid);
        const playerDoc = await playerRef.get();
        if (playerDoc.exists) {
            const playerData = playerDoc.data();
            if (playerData && playerData.role === 'runner') {
                // Convert runner to oni
                await playerRef.update({
                    role: 'oni',
                    'stats.captures': admin.firestore.FieldValue.increment(0)
                });
                console.log(`Player ${uid} converted to oni for leaving boundary`);
            }
        }
        return;
    }
    // Get game data
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();
    if (!gameDoc.exists)
        return;
    const gameData = gameDoc.data();
    if (!gameData || gameData.status !== 'running')
        return;
    // Get player data
    const playerRef = db.collection('games').doc(gameId).collection('players').doc(uid);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists)
        return;
    const playerData = playerDoc.data();
    if (!playerData || !playerData.active)
        return;
    // If player is oni, check for captures
    if (playerData.role === 'oni') {
        const captureRadius = gameData.captureRadiusM || 50;
        // Get all other players' locations
        const locationsSnapshot = await db.collection('games').doc(gameId).collection('locations').get();
        for (const locationDoc of locationsSnapshot.docs) {
            if (locationDoc.id === uid)
                continue; // Skip self
            const otherLocationData = locationDoc.data();
            if (!otherLocationData)
                continue;
            // Get other player data
            const otherPlayerRef = db.collection('games').doc(gameId).collection('players').doc(locationDoc.id);
            const otherPlayerDoc = await otherPlayerRef.get();
            if (!otherPlayerDoc.exists)
                continue;
            const otherPlayerData = otherPlayerDoc.data();
            if (!otherPlayerData || !otherPlayerData.active || otherPlayerData.role !== 'runner')
                continue;
            // Calculate distance
            const distance = haversine(lat, lng, otherLocationData.lat, otherLocationData.lng);
            if (distance <= captureRadius) {
                // Record capture
                await db.collection('games').doc(gameId).collection('captures').add({
                    attackerUid: uid,
                    victimUid: locationDoc.id,
                    at: admin.firestore.FieldValue.serverTimestamp()
                });
                // Update stats
                await playerRef.update({
                    'stats.captures': admin.firestore.FieldValue.increment(1)
                });
                await otherPlayerRef.update({
                    'stats.capturedTimes': admin.firestore.FieldValue.increment(1)
                });
                console.log(`Capture! ${uid} captured ${locationDoc.id} at distance ${distance}m`);
            }
        }
    }
});
// Triggered when game status changes to running
exports.onGameStart = functions.firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== 'running' && after.status === 'running') {
        const gameId = context.params.gameId;
        const startDelaySec = after.startDelaySec || 1800; // 30 minutes default
        console.log(`Game ${gameId} started, oni will be enabled in ${startDelaySec} seconds`);
        // Schedule oni activation
        setTimeout(async () => {
            try {
                // Get all players
                const playersSnapshot = await db.collection('games').doc(gameId).collection('players').get();
                for (const playerDoc of playersSnapshot.docs) {
                    const playerData = playerDoc.data();
                    if (playerData && playerData.active && playerData.role === 'oni') {
                        // Activate oni (in a real implementation, you might want to add an 'active' field)
                        console.log(`Activating oni: ${playerDoc.id}`);
                    }
                }
            }
            catch (error) {
                console.error('Error activating oni:', error);
            }
        }, startDelaySec * 1000);
    }
});
// HTTP function to get game stats
exports.getGameStats = functions.https.onRequest(async (req, res) => {
    const gameId = req.query.gameId;
    if (!gameId) {
        res.status(400).json({ error: 'gameId is required' });
        return;
    }
    try {
        const gameDoc = await db.collection('games').doc(gameId).get();
        if (!gameDoc.exists) {
            res.status(404).json({ error: 'Game not found' });
            return;
        }
        const gameData = gameDoc.data();
        // Get players count
        const playersSnapshot = await db.collection('games').doc(gameId).collection('players').get();
        const players = playersSnapshot.docs.map(doc => doc.data());
        // Get captures count
        const capturesSnapshot = await db.collection('games').doc(gameId).collection('captures').get();
        const captures = capturesSnapshot.docs.map(doc => doc.data());
        res.json({
            game: gameData,
            players: players.length,
            oniCount: players.filter(p => p.role === 'oni' && p.active).length,
            runnerCount: players.filter(p => p.role === 'runner' && p.active).length,
            captures: captures.length
        });
    }
    catch (error) {
        console.error('Error getting game stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
