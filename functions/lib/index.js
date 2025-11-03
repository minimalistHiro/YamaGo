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
exports.endGameWhenAllRunnersCaptured = exports.getGameStats = exports.becomeOwner = exports.ingestLocation = exports.setOwnerOnFirstPlayerJoin = exports.onGameStart = exports.onLocationWrite = exports.onCaptureRequest = exports.rescue = exports.uploadAvatarHttp = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
admin.initializeApp();
const db = admin.firestore();
exports.uploadAvatarHttp = functions
    .region('us-central1')
    .https.onRequest(async (req, res) => {
    var _a;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'method-not-allowed' });
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthenticated' });
        return;
    }
    let decodedToken;
    try {
        const idToken = authHeader.replace('Bearer ', '').trim();
        decodedToken = await admin.auth().verifyIdToken(idToken);
    }
    catch (error) {
        console.error('Failed to verify ID token:', error);
        res.status(401).json({ error: 'unauthenticated' });
        return;
    }
    const { file: base64Payload, contentType, fileName } = req.body || {};
    if (typeof base64Payload !== 'string' || base64Payload.length === 0) {
        res.status(400).json({ error: 'invalid-argument', message: 'Avatar payload is missing.' });
        return;
    }
    if (typeof contentType !== 'string' || !contentType.startsWith('image/')) {
        res.status(400).json({ error: 'invalid-argument', message: 'Invalid avatar content type.' });
        return;
    }
    const buffer = Buffer.from(base64Payload, 'base64');
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
        res.status(400).json({ error: 'invalid-argument', message: 'Avatar size must be 5MB or less.' });
        return;
    }
    const bucket = admin.storage().bucket();
    const extensionFromName = typeof fileName === 'string' && fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const extensionFromType = (_a = contentType.split('/').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    const extension = (extensionFromName || extensionFromType || 'png').replace(/[^a-z0-9]/g, '');
    const destinationPath = `avatars/${decodedToken.uid}_${Date.now()}.${extension}`;
    const downloadToken = (0, crypto_1.randomUUID)();
    try {
        await bucket.file(destinationPath).save(buffer, {
            resumable: false,
            metadata: {
                contentType,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                    uploadedBy: decodedToken.uid,
                },
            },
        });
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media&token=${downloadToken}`;
        res.status(200).json({
            downloadUrl,
            path: destinationPath,
        });
    }
    catch (error) {
        console.error('Failed to upload avatar to storage:', error);
        res.status(500).json({ error: 'internal', message: 'Failed to upload avatar.' });
    }
});
// DbD Mode Constants
const DEFAULT_CAPTURE_RADIUS_M = 50;
const RUNNER_SEE_KILLER_RADIUS_M = 200;
const KILLER_DETECT_RUNNER_RADIUS_M = 500;
const RESCUE_RADIUS_M = 50;
const MAX_DOWNS = 3;
const REVEAL_DURATION_SEC = 120;
const RESCUE_COOLDOWN_SEC = 30;
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
// Extended north to include Kawaguchi City (川口市)
function isWithinYamanoteLine(lat, lng) {
    const minLat = 35.65;
    const maxLat = 35.85; // Extended to Kawaguchi
    const minLng = 139.65;
    const maxLng = 139.8;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
// TEST FLAG: allow captures even outside the boundary during testing
const IGNORE_BOUNDARY_FOR_TEST = true;
// Helper: Enqueue an alert
async function enqueueAlert(gameId, toUid, type, distanceM, meta) {
    try {
        await db.collection('games').doc(gameId).collection('alerts').add({
            toUid,
            type,
            distanceM,
            at: admin.firestore.FieldValue.serverTimestamp(),
            meta: meta || {}
        });
    }
    catch (error) {
        console.error(`Failed to enqueue alert for ${toUid}:`, error);
    }
}
// Helper: Record a game event
async function recordEvent(gameId, type, actorUid, targetUid, data) {
    try {
        await db.collection('games').doc(gameId).collection('events').add({
            type,
            gameId,
            actorUid,
            targetUid,
            at: admin.firestore.FieldValue.serverTimestamp(),
            data: data || {}
        });
    }
    catch (error) {
        console.error(`Failed to record event ${type}:`, error);
    }
}
// Helper: Handle capture logic (transactional & idempotent)
async function capture(gameId, attackerUid, victimUid) {
    const now = admin.firestore.Timestamp.now();
    const revealUntil = admin.firestore.Timestamp.fromMillis(now.toMillis() + REVEAL_DURATION_SEC * 1000);
    const cooldownUntil = admin.firestore.Timestamp.fromMillis(now.toMillis() + RESCUE_COOLDOWN_SEC * 1000);
    const victimRef = db.collection('games').doc(gameId).collection('players').doc(victimUid);
    const attackerRef = db.collection('games').doc(gameId).collection('players').doc(attackerUid);
    let result = { updated: false };
    await db.runTransaction(async (tx) => {
        const vSnap = await tx.get(victimRef);
        if (!vSnap.exists) {
            result = { updated: false };
            return;
        }
        const vData = vSnap.data();
        // Already captured/eliminated → idempotent success (no-op)
        if (!vData || vData.state === 'downed' || vData.state === 'eliminated') {
            result = { updated: false };
            return;
        }
        const newDowns = (vData.downs || 0) + 1;
        const newState = newDowns >= MAX_DOWNS ? 'eliminated' : 'downed';
        tx.update(victimRef, {
            downs: newDowns,
            state: newState,
            lastDownAt: now,
            lastRevealUntil: revealUntil,
            cooldownUntil: cooldownUntil,
            'stats.capturedTimes': admin.firestore.FieldValue.increment(1)
        });
        tx.update(attackerRef, {
            'stats.captures': admin.firestore.FieldValue.increment(1)
        });
        result = { updated: true, newDowns, newState };
    });
    if (result.updated) {
        await recordEvent(gameId, 'capture', attackerUid, victimUid, {
            downs: result.newDowns,
            state: result.newState
        });
        console.log(`Capture! ${attackerUid} captured ${victimUid} (downs: ${result.newDowns}/${MAX_DOWNS})`);
        if (result.newState === 'eliminated') {
            await recordEvent(gameId, 'elimination', attackerUid, victimUid);
        }
    }
    return result;
}
// Callable: Rescue function
exports.rescue = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { gameId, victimUid } = data;
    const rescuerUid = context.auth.uid;
    if (!gameId || !victimUid) {
        throw new functions.https.HttpsError('invalid-argument', 'gameId and victimUid are required');
    }
    try {
        // Get rescuer location
        const rescuerLocationDoc = await db.collection('games').doc(gameId).collection('locations').doc(rescuerUid).get();
        if (!rescuerLocationDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Rescuer location not found');
        }
        const rescuerLocation = rescuerLocationDoc.data();
        if (!rescuerLocation) {
            throw new functions.https.HttpsError('not-found', 'Rescuer location data not found');
        }
        // Get victim location
        const victimLocationDoc = await db.collection('games').doc(gameId).collection('locations').doc(victimUid).get();
        if (!victimLocationDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Victim location not found');
        }
        const victimLocation = victimLocationDoc.data();
        if (!victimLocation) {
            throw new functions.https.HttpsError('not-found', 'Victim location data not found');
        }
        // Check distance
        const distance = haversine(rescuerLocation.lat, rescuerLocation.lng, victimLocation.lat, victimLocation.lng);
        if (distance > RESCUE_RADIUS_M) {
            throw new functions.https.HttpsError('failed-precondition', `Victim is ${Math.round(distance)}m away (need ${RESCUE_RADIUS_M}m)`);
        }
        // Get victim data
        const victimRef = db.collection('games').doc(gameId).collection('players').doc(victimUid);
        const victimDoc = await victimRef.get();
        if (!victimDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Victim not found');
        }
        const victimData = victimDoc.data();
        if (!victimData) {
            throw new functions.https.HttpsError('not-found', 'Victim data not found');
        }
        if (victimData.state !== 'downed') {
            throw new functions.https.HttpsError('failed-precondition', 'Victim is not in downed state');
        }
        // Perform rescue
        const now = admin.firestore.Timestamp.now();
        await victimRef.update({
            state: 'active',
            lastRescuedAt: now
        });
        // Record event
        await recordEvent(gameId, 'rescue', rescuerUid, victimUid);
        console.log(`Rescue! ${rescuerUid} rescued ${victimUid}`);
        return { success: true, distance };
    }
    catch (error) {
        console.error('Rescue error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to perform rescue');
    }
});
// attemptCapture: removed in Plan A (auto-capture via onLocationWrite only)
// Event-driven alternative: capture request documents
exports.onCaptureRequest = functions
    .region('us-central1')
    .firestore
    .document('games/{gameId}/captureRequests/{requestId}')
    .onCreate(async (snap, context) => {
    const gameId = context.params.gameId;
    const data = snap.data();
    const attackerUid = String(data.attackerUid || '');
    const victimUid = String(data.victimUid || '');
    if (!attackerUid || !victimUid)
        return;
    try {
        const gameDoc = await db.collection('games').doc(gameId).get();
        if (!gameDoc.exists)
            return;
        const gameData = gameDoc.data();
        if (!gameData || gameData.status !== 'running')
            return;
        const captureRadiusM = typeof gameData.captureRadiusM === 'number' ? gameData.captureRadiusM : DEFAULT_CAPTURE_RADIUS_M;
        const [attackerDoc, victimDoc, attackerLocDoc, victimLocDoc] = await Promise.all([
            db.collection('games').doc(gameId).collection('players').doc(attackerUid).get(),
            db.collection('games').doc(gameId).collection('players').doc(victimUid).get(),
            db.collection('games').doc(gameId).collection('locations').doc(attackerUid).get(),
            db.collection('games').doc(gameId).collection('locations').doc(victimUid).get(),
        ]);
        if (!attackerDoc.exists || !victimDoc.exists)
            return;
        const attacker = attackerDoc.data();
        const victim = victimDoc.data();
        if (!(attacker === null || attacker === void 0 ? void 0 : attacker.active) || !(victim === null || victim === void 0 ? void 0 : victim.active))
            return;
        if (attacker.role !== 'oni' || victim.role !== 'runner')
            return;
        if (victim.state === 'downed' || victim.state === 'eliminated')
            return;
        if (!attackerLocDoc.exists || !victimLocDoc.exists)
            return;
        const attackerLoc = attackerLocDoc.data();
        const victimLoc = victimLocDoc.data();
        if (!attackerLoc || !victimLoc)
            return;
        if (!IGNORE_BOUNDARY_FOR_TEST) {
            if (!isWithinYamanoteLine(attackerLoc.lat, attackerLoc.lng) || !isWithinYamanoteLine(victimLoc.lat, victimLoc.lng)) {
                return;
            }
        }
        const now = admin.firestore.Timestamp.now();
        const inCooldown = victim.cooldownUntil && victim.cooldownUntil.toMillis() > now.toMillis();
        if (inCooldown)
            return;
        const distance = haversine(attackerLoc.lat, attackerLoc.lng, victimLoc.lat, victimLoc.lng);
        if (distance > captureRadiusM)
            return;
        await capture(gameId, attackerUid, victimUid);
    }
    finally {
        // Clean up request doc regardless of outcome
        await snap.ref.delete().catch(() => { });
    }
});
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
    // Boundary handling: in test mode, do not early-return outside boundary
    if (!isWithinYamanoteLine(lat, lng)) {
        console.log(`Player ${uid} is outside Yamanote Line boundary`);
        if (!IGNORE_BOUNDARY_FOR_TEST) {
            const playerRef = db.collection('games').doc(gameId).collection('players').doc(uid);
            const playerDoc = await playerRef.get();
            if (playerDoc.exists) {
                const playerData = playerDoc.data();
                if (playerData && playerData.role === 'runner') {
                    await playerRef.update({
                        role: 'oni',
                        'stats.captures': admin.firestore.FieldValue.increment(0)
                    });
                    console.log(`Player ${uid} converted to oni for leaving boundary`);
                }
            }
            return;
        }
    }
    // Get game data
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();
    if (!gameDoc.exists)
        return;
    const gameData = gameDoc.data();
    if (!gameData || gameData.status !== 'running')
        return;
    const captureRadiusM = typeof gameData.captureRadiusM === 'number' ? gameData.captureRadiusM : DEFAULT_CAPTURE_RADIUS_M;
    // Get player data
    const playerRef = db.collection('games').doc(gameId).collection('players').doc(uid);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists)
        return;
    const playerData = playerDoc.data();
    if (!playerData || !playerData.active)
        return;
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
        if (!otherPlayerData || !otherPlayerData.active)
            continue;
        // Calculate distance
        const distance = haversine(lat, lng, otherLocationData.lat, otherLocationData.lng);
        // Check if in cooldown
        const now = admin.firestore.Timestamp.now();
        const inCooldown = otherPlayerData.cooldownUntil && otherPlayerData.cooldownUntil.toMillis() > now.toMillis();
        // DbD Logic Branches
        // 1. CAPTURE: Oni catches runner within captureRadiusM (if not in cooldown)
        if (playerData.role === 'oni' && otherPlayerData.role === 'runner' &&
            otherPlayerData.state !== 'eliminated' && otherPlayerData.state !== 'downed' && !inCooldown) {
            if (distance <= captureRadiusM) {
                await capture(gameId, uid, locationDoc.id);
            }
        }
        // 1b. CAPTURE (symmetric): Runner moves within Oni's radius -> capture by Oni
        if (playerData.role === 'runner' && otherPlayerData.role === 'oni' && playerData.state === 'active') {
            const now2 = admin.firestore.Timestamp.now();
            const runnerInCooldown = playerData.cooldownUntil && playerData.cooldownUntil.toMillis() > now2.toMillis();
            if (!runnerInCooldown && distance <= captureRadiusM) {
                await capture(gameId, locationDoc.id, uid);
            }
        }
        // 2. KILLER → RUNNER detection (500m radius)
        if (playerData.role === 'oni' && otherPlayerData.role === 'runner' &&
            otherPlayerData.state === 'active') {
            if (distance <= KILLER_DETECT_RUNNER_RADIUS_M) {
                // Killer can see runners within 500m (handled by frontend map visualization)
                // No alert needed - map will show them
            }
        }
        // 3. RUNNER → KILLER detection (500m alert, 200m precise)
        if (playerData.role === 'runner' && otherPlayerData.role === 'oni') {
            if (distance <= KILLER_DETECT_RUNNER_RADIUS_M) {
                // Runner within 500m - send alert
                await enqueueAlert(gameId, uid, 'runner-near', distance);
            }
            // If within 200m, frontend will show precise position
        }
        // 4. MUTUAL VISIBILITY during reveal period
        const nowTS = admin.firestore.Timestamp.now();
        const isRevealed = otherPlayerData.lastRevealUntil &&
            otherPlayerData.lastRevealUntil.toMillis() > nowTS.toMillis();
        if (isRevealed && playerData.state === 'active') {
            // During reveal, both parties see each other (handled by frontend)
            // No additional logic needed
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
        // Record game start event
        await recordEvent(gameId, 'game-start');
        // Initialize all players to active state with no downs
        const playersSnapshot = await db.collection('games').doc(gameId).collection('players').get();
        const batch = db.batch();
        for (const playerDoc of playersSnapshot.docs) {
            batch.update(playerDoc.ref, {
                state: 'active',
                downs: 0,
                lastDownAt: null,
                lastRescuedAt: null,
                lastRevealUntil: null,
                cooldownUntil: null
            });
        }
        await batch.commit();
    }
});
// When the first active player joins a game, make them the owner if the game
// currently has no active players (or no players at all). This mirrors the
// client-side behavior but runs with admin privileges so it isn't blocked by
// security rules.
exports.setOwnerOnFirstPlayerJoin = functions.firestore
    .document('games/{gameId}/players/{playerId}')
    .onCreate(async (snapshot, context) => {
    var _a;
    const gameId = context.params.gameId;
    const playerId = context.params.playerId;
    const playerData = snapshot.data();
    if (!playerData) {
        console.warn(`[owner-update] Player data missing for ${gameId}/${playerId}`);
        return;
    }
    // Only consider players who are joining as active participants.
    if (playerData.active === false) {
        console.log(`[owner-update] Player ${playerId} joined inactive; skipping owner update.`);
        return;
    }
    try {
        const playersRef = db.collection('games').doc(gameId).collection('players');
        const playersSnapshot = await playersRef.get();
        // Determine if there are any other active players besides the one that just joined.
        const otherActivePlayers = playersSnapshot.docs.filter(doc => {
            if (doc.id === playerId) {
                return false;
            }
            const data = doc.data();
            return data && data.active !== false;
        });
        if (otherActivePlayers.length > 0) {
            console.log(`[owner-update] Game ${gameId} already has other active players; skipping owner update.`);
            return;
        }
        const gameRef = db.collection('games').doc(gameId);
        const gameDoc = await gameRef.get();
        if (!gameDoc.exists) {
            console.warn(`[owner-update] Game ${gameId} not found while assigning owner.`);
            return;
        }
        const currentOwnerUid = (_a = gameDoc.data()) === null || _a === void 0 ? void 0 : _a.ownerUid;
        if (currentOwnerUid === playerId) {
            console.log(`[owner-update] Player ${playerId} is already the owner of game ${gameId}.`);
            return;
        }
        await gameRef.update({ ownerUid: playerId });
        console.log(`[owner-update] Game ${gameId} owner set to ${playerId}.`);
    }
    catch (error) {
        console.error(`[owner-update] Failed to set owner for game ${gameId}:`, error);
    }
});
// HTTP function to ingest location data from background geolocation
exports.ingestLocation = functions
    .region('us-central1')
    .https.onRequest(async (req, res) => {
    var _a;
    try {
        if (req.method !== 'POST') {
            res.status(405).send('method not allowed');
            return;
        }
        const { userId, role, latitude, longitude, accuracy, speed, timestamp, source } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        if (!userId || typeof latitude === 'undefined' || typeof longitude === 'undefined') {
            res.status(400).send('bad request');
            return;
        }
        const now = Number(timestamp !== null && timestamp !== void 0 ? timestamp : Date.now());
        const payload = {
            userId: String(userId),
            role: role !== null && role !== void 0 ? role : null,
            lat: Number(latitude),
            lng: Number(longitude),
            accuracy: Number(accuracy !== null && accuracy !== void 0 ? accuracy : 0),
            speed: Number(speed !== null && speed !== void 0 ? speed : 0),
            ts: now,
            source: source !== null && source !== void 0 ? source : 'native'
        };
        const latestRef = db.collection('users').doc(String(userId))
            .collection('runtime').doc('latestLocation');
        const histRef = db.collection('locationLogs').doc();
        await db.runTransaction(async (tx) => {
            tx.set(latestRef, payload, { merge: true });
            tx.set(histRef, payload);
        });
        res.status(200).send('ok');
    }
    catch (e) {
        console.error(e);
        res.status(500).send('error');
    }
});
// Callable function: Set the caller as the game owner
exports.becomeOwner = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    var _a, _b;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    const gameId = (data && data.gameId);
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    if (!gameId || typeof gameId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'gameId is required');
    }
    try {
        const gameRef = db.collection('games').doc(gameId);
        const playerRef = gameRef.collection('players').doc(uid);
        // Ensure the caller is part of the game
        const playerDoc = await playerRef.get();
        if (!playerDoc.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'User is not a player in this game');
        }
        const gameDoc = await gameRef.get();
        if (!gameDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Game not found');
        }
        const currentOwnerUid = (_b = gameDoc.data()) === null || _b === void 0 ? void 0 : _b.ownerUid;
        if (currentOwnerUid === uid) {
            return { ok: true, message: 'Already owner' };
        }
        await gameRef.update({ ownerUid: uid });
        await recordEvent(gameId, 'game-start', uid, undefined, { action: 'become-owner' });
        return { ok: true };
    }
    catch (error) {
        console.error(`[becomeOwner] Failed for game ${gameId}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to set owner');
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
        // Get events count
        const eventsSnapshot = await db.collection('games').doc(gameId).collection('events').get();
        const events = eventsSnapshot.docs.map(doc => doc.data());
        res.json({
            game: gameData,
            players: players.length,
            oniCount: players.filter(p => p.role === 'oni' && p.active).length,
            runnerCount: players.filter(p => p.role === 'runner' && p.active).length,
            captures: captures.length,
            events: events.length,
            activePlayers: players.filter(p => p.state === 'active').length,
            downedPlayers: players.filter(p => p.state === 'downed').length,
            eliminatedPlayers: players.filter(p => p.state === 'eliminated').length
        });
    }
    catch (error) {
        console.error('Error getting game stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// End game when all active runners are captured (downed or eliminated)
exports.endGameWhenAllRunnersCaptured = functions.firestore
    .document('games/{gameId}/players/{playerId}')
    .onWrite(async (change, context) => {
    const gameId = context.params.gameId;
    try {
        const gameRef = db.collection('games').doc(gameId);
        const gameDoc = await gameRef.get();
        if (!gameDoc.exists)
            return;
        const gameData = gameDoc.data();
        if (!gameData || gameData.status !== 'running')
            return;
        const playersSnapshot = await gameRef.collection('players').get();
        const players = playersSnapshot.docs.map((d) => d.data());
        const runners = players.filter((p) => p && p.role === 'runner' && p.active !== false);
        if (runners.length === 0)
            return; // no runners -> don't end automatically
        const capturedRunners = runners.filter((p) => p.state && p.state !== 'active');
        if (capturedRunners.length === runners.length) {
            // All runners are captured
            await gameRef.update({ status: 'ended' });
            await recordEvent(gameId, 'game-end', undefined, undefined, { winner: 'oni' });
            console.log(`[endGame] Game ${gameId} ended because all runners were captured`);
        }
    }
    catch (error) {
        console.error(`[endGame] Failed to evaluate end condition for game ${gameId}:`, error);
    }
});
