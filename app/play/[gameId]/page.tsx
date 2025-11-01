'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '@/lib/firebase/client';
import { 
  getPlayer,
  startGameCountdown,
  startGame,
  updateGame,
  subscribeToEvents
} from '@/lib/game';
import { haversine, isWithinYamanoteLine } from '@/lib/geo';
import MapView from '@/components/MapView';
import HUD from '@/components/HUD';
import BottomTabNavigation, { TabType } from '@/components/BottomTabNavigation';
import ChatView from '@/components/ChatView';
import SettingsView from '@/components/SettingsView';
import BackgroundLocationProvider from '@/components/BackgroundLocationProvider';
import { useGameStore } from '@/lib/store/gameStore';
import type { Player } from '@/lib/game';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const game = useGameStore((s) => s.game);
  const playersById = useGameStore((s) => s.playersById);
  const locations = useGameStore((s) => s.locationsById);
  const pins = useGameStore((s) => s.pins);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [rescuablePlayer, setRescuablePlayer] = useState<Player | null>(null);
  const [capturableRunner, setCapturableRunner] = useState<Player | null>(null);
  const [showCapturePopup, setShowCapturePopup] = useState(false);
  const [capturedTargetName, setCapturedTargetName] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const setIdentity = useGameStore((s) => s.setIdentity);
  const start = useGameStore((s) => s.start);
  const stop = useGameStore((s) => s.stop);
  const updateLocationThrottled = useGameStore((s) => s.updateLocationThrottled);

  // Derived list used in multiple places
  const players = Object.values(playersById);
  
  // Fetch current player data when switching to map or settings tab
  useEffect(() => {
    const fetchCurrentPlayer = async () => {
      if (!user || !gameId) return;
      
      try {
        const playerData = await getPlayer(gameId, user.uid);
        if (playerData) {
          setCurrentPlayer(playerData);
        }
      } catch (error) {
        console.error('Error fetching current player:', error);
      }
    };
    
    // Fetch when switching to map or settings tabs
    if (activeTab === 'map' || activeTab === 'settings') {
      fetchCurrentPlayer();
    }
  }, [user, gameId, activeTab]);

  useEffect(() => {
    // Get Firebase services (client-side only)
    const { auth } = getFirebaseServices();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        router.push('/join');
        return;
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Prevent navigating back to login with iOS left-swipe/back gesture while on play page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const lock = () => {
      try {
        window.history.pushState(null, '', window.location.href);
      } catch {}
    };
    lock();
    const onPopState = () => {
      lock();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    if (!user || !gameId) return;
    setIdentity({ gameId, uid: user.uid });
    start();
    // current player bootstrap
    (async () => {
      const playerData = await getPlayer(gameId, user.uid);
      setCurrentPlayer(playerData);
    })();
    return () => {
      stop();
    };
  }, [user, gameId, setIdentity, start, stop]);

  // Show popup when this user (oni) captures a runner
  useEffect(() => {
    if (!user || !gameId) return;
    const unsubscribe = subscribeToEvents(gameId, (events) => {
      const latestCapture = events.find(ev => ev.type === 'capture' && ev.actorUid === user.uid);
      if (latestCapture) {
        const target = playersById[latestCapture.targetUid || ''];
        setCapturedTargetName(target?.nickname || '逃走者');
        setShowCapturePopup(true);
      }
    });
    return () => unsubscribe();
  }, [user, gameId, playersById]);

  // Alerts are handled centrally in the store; UI surfacing can be added later

  const handleLocationUpdate = async (lat: number, lng: number, accuracy: number) => {
    if (!user || !gameId) return;

    // Test mode: allow updates even outside the Yamanote Line boundary
    if (!isWithinYamanoteLine(lat, lng)) {
      console.warn('Outside Yamanote Line boundary (test mode: still updating location)');
    }

    await updateLocationThrottled(lat, lng, accuracy);
  };

  // Check for rescuable players (downed runners within rescue radius)
  useEffect(() => {
    if (!currentPlayer || !game || game.status !== 'running') return;
    if (currentPlayer.role !== 'runner') return;
    if (!user) return;

    const currentLocation = locations[user.uid];
    if (!currentLocation) return;

    const rescueable = players.find(player => {
      if (player.uid === user.uid) return false;
      if (player.state !== 'downed') return false;
      
      const otherLocation = locations[player.uid];
      if (!otherLocation) return false;

      const distance = haversine(
        currentLocation.lat, currentLocation.lng,
        otherLocation.lat, otherLocation.lng
      );

      return distance <= 50; // RESCUE_RADIUS_M
    });

    setRescuablePlayer(rescueable || null);
  }, [currentPlayer, game, players, locations, user]);

  const handleRescue = async () => {
    if (!rescuablePlayer || !user) return;

    try {
      const { functions } = getFirebaseServices();
      const rescueFunction = httpsCallable(functions, 'rescue');
      
      await rescueFunction({ gameId, victimUid: rescuablePlayer.uid });
      console.log('Rescue successful');
    } catch (error) {
      console.error('Rescue failed:', error);
      alert('救助に失敗しました');
    }
  };

  // Detect capturable runner (for Oni) using local locations and capture radius
  useEffect(() => {
    if (!currentPlayer || !game || game.status !== 'running') return;
    if (currentPlayer.role !== 'oni') return;
    if (!user) return;

    const currentLocation = locations[user.uid];
    if (!currentLocation) return;

    const target = players.find(p => {
      if (p.uid === user.uid) return false;
      if (p.role !== 'runner') return false;
      if (p.state && p.state !== 'active') return false;
      const other = locations[p.uid];
      if (!other) return false;
      const d = haversine(currentLocation.lat, currentLocation.lng, other.lat, other.lng);
      // Strictly use DB-configured radius; if undefined, treat as not capturable
      if (typeof game.captureRadiusM !== 'number') return false;
      return d <= game.captureRadiusM;
    }) || null;

    setCapturableRunner(target);
  }, [currentPlayer, game, players, locations, user]);

  const handleCapture = async () => {
    if (!capturableRunner || !user) return;
    setIsCapturing(true);
    try {
      // Plan A: 捕獲は onLocationWrite のサーバー判定に一本化。
      // ボタン押下時は直近の現在地を取得して Firestore の locations を更新し、
      // サーバー側の距離判定を直ちに走らせるトリガにするのみ。
      if (typeof window !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              try {
                await updateLocationThrottled(latitude, longitude, accuracy || 0);
              } finally {
                resolve();
              }
            },
            () => resolve(),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
          );
        });
      }
      // UI 的には少し待ってから自動捕獲イベントのポップアップを待つ
      setTimeout(() => setIsCapturing(false), 600);
    } catch (e) {
      console.error('Capture trigger failed:', e);
      setIsCapturing(false);
    }
  };

  const handleStartGame = async () => {
    if (!game || !user) return;
    
    try {
      // Start countdown and update game status to 'running' simultaneously
      // Keep countdown information so it continues to display
      await startGameCountdown(gameId, game.countdownDurationSec ?? 900); // use DB-configured countdown
      await startGame(gameId, true); // Update database to mark game as started, but keep countdown
      console.log('Game started and countdown initiated');
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('ゲーム開始に失敗しました');
    }
  };

  const handleGameStart = async () => {
    if (!game) return;
    
    try {
      await startGame(gameId);
      console.log('Game started');
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('ゲーム開始に失敗しました');
    }
  };

  const handleCountdownEnd = async () => {
    // Countdown has ended, clear countdown information from database
    // Game status is already 'running', just clean up countdown data
    if (!game) return;
    
    try {
      await updateGame(gameId, {
        countdownStartAt: null
      });
      console.log('Countdown ended, countdownStartAt cleared (duration retained)');
    } catch (error) {
      console.error('Failed to clear countdown data:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/join')}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!game || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
          <p className="text-gray-600">ゲームデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  // Prepare player data for map
  const mapPlayers = players
    .filter(player => player.active && locations[player.uid])
    .map(player => ({
      uid: player.uid,
      nickname: player.nickname,
      role: player.role,
      lat: locations[player.uid].lat,
      lng: locations[player.uid].lng,
      avatarUrl: player.avatarUrl,
      state: player.state,
      lastRevealUntil: player.lastRevealUntil
    }));

  const oniCount = players.filter(p => p.role === 'oni' && p.active).length;
  const runnerCount = players.filter(p => p.role === 'runner' && p.active).length;
  const runnerCapturedCount = players.filter(p => p.role === 'runner' && p.active && p.state && p.state !== 'active').length;
  const generatorsClearedCount = pins.filter(p => p.cleared).length;

  const handleGameExit = () => {
    router.push('/join');
  };

  // Keep MapView mounted to persist camera and location between tab switches

  return (
    <div className="h-screen flex flex-col">
      {/* Background Location Provider */}
      <BackgroundLocationProvider
        userId={user?.uid || ''}
        role={currentPlayer?.role || null}
        gameId={gameId}
        gameStatus={game?.status || 'waiting'}
      />
      
      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Map tab - always mounted, toggle visibility */}
        <div className={activeTab === 'map' ? 'flex-1 relative h-full' : 'hidden'}>
            <MapView
            onLocationUpdate={handleLocationUpdate}
            players={mapPlayers}
              pins={pins.map(p => ({ lat: p.lat, lng: p.lng }))}
            currentUserRole={currentPlayer.role}
            currentUserId={user?.uid}
            gameStatus={game.status}
            isOwner={game.ownerUid === user?.uid}
            countdownStartAt={game.countdownStartAt ? game.countdownStartAt.toDate() : null}
            countdownDurationSec={game.countdownDurationSec}
            onStartGame={handleStartGame}
            onCountdownEnd={handleCountdownEnd}
            gameStartAt={game.startAt ? game.startAt.toDate() : null}
            captureRadiusM={game.captureRadiusM}
            gameId={gameId}
            runnerSeeKillerRadiusM={game.runnerSeeKillerRadiusM || 200}
            killerDetectRunnerRadiusM={game.killerDetectRunnerRadiusM || 500}
          />

          {/* Capture Popup for Oni */}
          {showCapturePopup && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
              <div className="bg-black/80 text-white px-4 py-3 rounded shadow-lg flex items-center space-x-4">
                <div>
                  <span className="font-semibold">{capturedTargetName}</span> を捕獲しました
                </div>
                <button
                  className="bg-white text-black px-3 py-1 rounded font-semibold hover:bg-gray-200"
                  onClick={() => setShowCapturePopup(false)}
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* HUD Overlay */}
          <HUD
            gameStatus={game.status}
            playerCount={players.length}
            oniCount={oniCount}
            runnerCount={runnerCount}
            runnerCapturedCount={runnerCapturedCount}
            generatorsClearedCount={generatorsClearedCount}
            captures={currentPlayer.stats.captures}
            capturedTimes={currentPlayer.stats.capturedTimes}
          />

          {/* Rescue Button */}
          {rescuablePlayer && (
            <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-50">
              <button
                onClick={handleRescue}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg text-lg animate-pulse"
              >
                🚑 救助する
              </button>
            </div>
          )}

          {/* Capture Button for Oni */}
          {capturableRunner && currentPlayer.role === 'oni' && (
            <div className="absolute bottom-48 left-1/2 transform -translate-x-1/2 z-50">
              <button
                onClick={handleCapture}
                disabled={isCapturing}
                className={`bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg text-lg ${isCapturing ? 'opacity-70 cursor-not-allowed' : 'animate-pulse'}`}
              >
                {isCapturing ? '👹 捕獲中…' : '👹 捕獲する'}
              </button>
            </div>
          )}
        </div>

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <ChatView
            gameId={gameId}
            currentUser={{
              uid: user?.uid || '',
              nickname: currentPlayer.nickname
            }}
          />
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <SettingsView
            gameId={gameId}
            currentUser={{
              uid: user?.uid || '',
              nickname: currentPlayer.nickname,
              role: currentPlayer.role,
              avatarUrl: currentPlayer.avatarUrl
            }}
            onGameExit={handleGameExit}
          />
        )}
      </div>

      {/* Status Bar (only show on map tab) */}
      {activeTab === 'map' && (
        <div className="bg-white border-t border-gray-200 p-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${currentPlayer.role === 'oni' ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className="font-medium">{currentPlayer.nickname}</span>
              <span className="text-gray-500">({currentPlayer.role === 'oni' ? '鬼' : '逃走者'})</span>
            </div>
            
            <div className="text-gray-500">
              精度: {user && locations[user.uid] ? `${Math.round(locations[user.uid].accM)}m` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Navigation */}
      <BottomTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
