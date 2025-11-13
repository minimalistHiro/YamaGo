'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase/client';
import { 
  getPlayer,
  startGameCountdown,
  startGame,
  updateGame,
  subscribeToEvents,
  updateLocation,
  updatePlayer
} from '@/lib/game';
import { MAX_DOWNS, REVEAL_DURATION_SEC, RESCUE_COOLDOWN_SEC, RESCUE_RADIUS_M } from '@/lib/constants';
import { haversine, isWithinYamanoteLine } from '@/lib/geo';
import MapView from '@/components/MapView';
import HUD from '@/components/HUD';
import BottomTabNavigation, { TabType } from '@/components/BottomTabNavigation';
import ChatView from '@/components/ChatView';
import SettingsView from '@/components/SettingsView';
import BackgroundLocationProvider from '@/components/BackgroundLocationProvider';
import { useGameStore } from '@/lib/store/gameStore';
import SafeArea from '@/components/SafeArea';
import type { Player, PinStatus } from '@/lib/game';
import { playSound, preloadSounds } from '@/lib/sounds';

type PinLike = { status?: PinStatus | string; cleared?: boolean };

const resolvePinStatus = (pin: PinLike): PinStatus => {
  if (pin.status === 'pending' || pin.status === 'clearing' || pin.status === 'cleared') {
    return pin.status;
  }
  return pin.cleared ? 'cleared' : 'pending';
};

const isPinCleared = (pin: PinLike): boolean => resolvePinStatus(pin) === 'cleared';

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
  const [showCapturedPopup, setShowCapturedPopup] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showGameEndPopup, setShowGameEndPopup] = useState(false);
  const [showGameSummaryPopup, setShowGameSummaryPopup] = useState(false);
  const [isRescuing, setIsRescuing] = useState(false);
  const [showRescuedPopup, setShowRescuedPopup] = useState(false);
  const [gameEndedAt, setGameEndedAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isEditingPins, setIsEditingPins] = useState(false);
  const allPinsCleared = pins.length > 0 && pins.every((p) => isPinCleared(p));
  const setIdentity = useGameStore((s) => s.setIdentity);
  const start = useGameStore((s) => s.start);
  const stop = useGameStore((s) => s.stop);
  const updateLocationThrottled = useGameStore((s) => s.updateLocationThrottled);
  const lastRescueInfoRef = useRef<{ initialized: boolean; state: Player['state'] | null; lastRescuedAt: number | null; lastDownAt: number | null }>({
    initialized: false,
    state: null,
    lastRescuedAt: null,
    lastDownAt: null,
  });

  // Derived list used in multiple places
  const players = Object.values(playersById);

  const gameDurationElapsedSec = useMemo(() => {
    if (!game?.startAt || !gameEndedAt) return null;
    const startDate = game.startAt.toDate();
    return Math.max(0, Math.floor((gameEndedAt.getTime() - startDate.getTime()) / 1000));
  }, [game?.startAt?.seconds, game?.startAt?.nanoseconds, gameEndedAt]);

  const formatDuration = (totalSeconds: number | null) => {
    if (totalSeconds === null || totalSeconds === undefined) return '---';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}時間${minutes}分${seconds}秒`;
    }
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    }
    return `${seconds}秒`;
  };

  useEffect(() => {
    preloadSounds(['start_sound']);
  }, []);
  
  // Fetch current player data when switching to map or settings tab
  useEffect(() => {
    const fetchCurrentPlayer = async () => {
      if (!user || !gameId) return;
      if (playersById[user.uid]) return;

      try {
        const playerData = await getPlayer(gameId, user.uid);
        if (playerData) {
          setCurrentPlayer(playerData);
        }
      } catch (error) {
        console.error('Error fetching current player:', error);
      }
    };

    if ((activeTab === 'map' || activeTab === 'settings') && !currentPlayer) {
      fetchCurrentPlayer();
    }
  }, [user, gameId, activeTab, playersById, currentPlayer]);

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

  useEffect(() => {
    if (!user?.uid) return;
    const livePlayer = playersById[user.uid];
    if (!livePlayer) return;

    setCurrentPlayer((prev) => {
      if (
        prev &&
        prev.uid === livePlayer.uid &&
        prev.role === livePlayer.role &&
        prev.nickname === livePlayer.nickname &&
        prev.avatarUrl === livePlayer.avatarUrl &&
        prev.state === livePlayer.state &&
        prev.active === livePlayer.active &&
        (prev.stats?.captures ?? 0) === (livePlayer.stats?.captures ?? 0) &&
        (prev.stats?.capturedTimes ?? 0) === (livePlayer.stats?.capturedTimes ?? 0)
      ) {
        return prev;
      }
      return livePlayer;
    });
  }, [playersById, user?.uid]);

  useEffect(() => {
    if (!currentPlayer || !user?.uid || currentPlayer.uid !== user.uid) return;

    const toMillis = (value: Player['lastRescuedAt'] | Player['lastDownAt']): number | null => {
      if (!value) return null;
      if (value instanceof Date) return value.getTime();
      if (typeof (value as any).toMillis === 'function') return (value as any).toMillis();
      if (typeof (value as any).toDate === 'function') {
        const date = (value as any).toDate();
        return date instanceof Date ? date.getTime() : null;
      }
      if (typeof (value as any).seconds === 'number') {
        const seconds = (value as any).seconds;
        const nanoseconds = typeof (value as any).nanoseconds === 'number' ? (value as any).nanoseconds : 0;
        return seconds * 1000 + Math.floor(nanoseconds / 1e6);
      }
      return null;
    };

    const normalizeState = (state: Player['state'] | undefined): Player['state'] | 'active' =>
      state ? state : 'active';

    const prev = lastRescueInfoRef.current;
    const currentState = normalizeState(currentPlayer.state);
    const currentRescuedAt = toMillis(currentPlayer.lastRescuedAt);
    const currentDownAt = toMillis(currentPlayer.lastDownAt);

    if (prev.initialized) {
      const prevState = normalizeState(prev.state || undefined);
      const wasDowned = prevState === 'downed' || prevState === 'eliminated';
      const nowActive = currentState === 'active';
      const hasNewRescue =
        currentRescuedAt !== null &&
        (prev.lastRescuedAt === null || currentRescuedAt > prev.lastRescuedAt);
      const justCaptured =
        (currentState === 'downed' || currentState === 'eliminated') &&
        currentDownAt !== null &&
        (prev.lastDownAt === null || currentDownAt > prev.lastDownAt);

      if (justCaptured) {
        setShowCapturedPopup(true);
      }

      if (wasDowned && nowActive && hasNewRescue) {
        setShowRescuedPopup(true);
      }
    }

    lastRescueInfoRef.current = {
      initialized: true,
      state: currentState,
      lastRescuedAt: currentRescuedAt,
      lastDownAt: currentDownAt,
    };
  }, [currentPlayer, user?.uid]);

  useEffect(() => {
    if (!currentPlayer || !user?.uid || currentPlayer.uid !== user.uid) return;
    if (currentPlayer.state && currentPlayer.state !== 'active') {
      setShowRescuedPopup(false);
    }
  }, [currentPlayer, user?.uid]);

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
  // Show popup when game ends (e.g., Cloud Function ended the game)
  useEffect(() => {
    if (game?.status === 'ended') {
      setShowGameEndPopup(true);
      setGameEndedAt((prev) => prev ?? new Date());
    } else {
      setShowGameEndPopup(false);
      setShowGameSummaryPopup(false);
      setGameEndedAt(null);
    }
  }, [game?.status]);

  // Track remaining time for HUD countdown
  useEffect(() => {
    if (!game || !game.startAt || game.status !== 'running') {
      setTimeRemaining(null);
      return;
    }

    const durationSec = game.gameDurationSec ?? 7200;
    const startDate = game.startAt.toDate();

    const updateRemaining = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startDate.getTime()) / 1000);
      const remaining = Math.max(0, durationSec - elapsed);
      setTimeRemaining(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [game?.startAt?.seconds, game?.startAt?.nanoseconds, game?.status, game?.gameDurationSec]);

  const handleLocationUpdate = useCallback(async (lat: number, lng: number, accuracy: number) => {
    if (!user || !gameId) return;

    if (!isWithinYamanoteLine(lat, lng)) {
      console.warn('Outside Yamanote Line boundary (test mode: still updating location)');
    }

    await updateLocationThrottled(lat, lng, accuracy);
  }, [user, gameId, updateLocationThrottled]);

  // Check for rescuable players (downed runners within rescue radius)
  useEffect(() => {
    if (!currentPlayer || !game || game.status !== 'running') return;
    if (currentPlayer.role !== 'runner') return;
    if (currentPlayer.state && currentPlayer.state !== 'active') return;
    if (!user) return;

    const currentLocation = locations[user.uid];
    if (!currentLocation) return;

    const rescueRadius =
      typeof game.captureRadiusM === 'number' && game.captureRadiusM > 0
        ? game.captureRadiusM
        : RESCUE_RADIUS_M;

    const rescueable = players.find(player => {
      if (player.uid === user.uid) return false;
      if (!player.active) return false;
      if (player.role !== 'runner') return false;
      if (player.state !== 'downed') return false;

      const otherLocation = locations[player.uid];
      if (!otherLocation) return false;

      const distance = haversine(
        currentLocation.lat, currentLocation.lng,
        otherLocation.lat, otherLocation.lng
      );

      return distance <= rescueRadius;
    });

    setRescuablePlayer(rescueable || null);
  }, [currentPlayer, game, players, locations, user]);

  const handleRescue = async () => {
    if (!rescuablePlayer || !user) return;

    setIsRescuing(true);
    try {
      const rescueTarget = rescuablePlayer;
      const updates: Partial<Player> = {
        state: 'active',
        lastRescuedAt: new Date(),
        cooldownUntil: new Date(Date.now() + RESCUE_COOLDOWN_SEC * 1000),
      };

      await updatePlayer(gameId, rescueTarget.uid, updates as any);
      console.log('Rescue successful');
      setRescuablePlayer(null);
    } catch (error) {
      console.error('Rescue failed:', error);
      alert('救助に失敗しました');
    } finally {
      setIsRescuing(false);
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
      // 新設計: クライアントから直接、逃走者のプレイヤー状態を更新する
      const currentDowns = capturableRunner.downs || 0;
      const newDowns = currentDowns + 1;
      const newState: 'downed' | 'eliminated' = newDowns >= MAX_DOWNS ? 'eliminated' : 'downed';

      const now = Date.now();
      const revealUntil = new Date(now + REVEAL_DURATION_SEC * 1000);
      const cooldownUntil = new Date(now + RESCUE_COOLDOWN_SEC * 1000);

      // victim 更新（直接 Firestore 書き込み）
      await updatePlayer(gameId, capturableRunner.uid, {
        downs: newDowns,
        state: newState,
        lastDownAt: new Date(),
        lastRevealUntil: revealUntil,
        cooldownUntil: cooldownUntil,
      } as any);

      // attacker の捕獲数もローカルで加算（任意）
      if (currentPlayer) {
        await updatePlayer(gameId, user.uid, {
          stats: {
            captures: (currentPlayer.stats?.captures || 0) + 1,
            capturedTimes: currentPlayer.stats?.capturedTimes || 0
          }
        } as any);
      }

      // UI 反映
      setCapturedTargetName(capturableRunner.nickname || '逃走者');
      setShowCapturePopup(true);
      setIsCapturing(false);

      // After updating the victim locally in Firestore, check if all runners are captured
      try {
        const allRunners = players.filter(p => p.role === 'runner' && p.active);
        if (allRunners.length > 0) {
          const capturedCount = allRunners.filter(p => {
            if (p.uid === capturableRunner.uid) {
              return true; // just captured above
            }
            return p.state && p.state !== 'active';
          }).length;
          if (capturedCount === allRunners.length) {
            await updateGame(gameId, { status: 'ended' });
          }
        }
      } catch (e) {
        // non-fatal
        console.warn('Failed to update game end status after capture:', e);
      }
    } catch (e) {
      console.error('Capture trigger failed:', e);
      setIsCapturing(false);
    }
  };

  const handleStartGame = async () => {
    if (!game || !user) return;

    void playSound('start_sound');
    
    try {
      // Start countdown; database status becomes 'countdown'
      await startGameCountdown(gameId, game.countdownDurationSec ?? 900); // use DB-configured countdown
      console.log('Countdown initiated');
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
    if (!game) return;
    
    try {
      // Move to running state and set startAt; countdown will be cleared
      await startGame(gameId);
      console.log('Countdown ended, game started');
    } catch (error) {
      console.error('Failed to clear countdown data:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeArea className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </SafeArea>
    );
  }

  if (error) {
    return (
      <SafeArea className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
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
      </SafeArea>
    );
  }

  if (!game || !currentPlayer) {
    return (
      <SafeArea className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
          <p className="text-gray-600">ゲームデータを読み込み中...</p>
        </div>
      </SafeArea>
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
  const generatorsClearedCount = pins.filter((p) => isPinCleared(p)).length;
  const capturedPlayersCount = players.filter(p => p.role === 'runner' && (p.stats?.capturedTimes ?? 0) > 0).length;
  const formattedGameDuration = formatDuration(
    gameDurationElapsedSec ?? (typeof game.gameDurationSec === 'number' ? game.gameDurationSec : null)
  );
  const personalCaptures = game.status === 'running' ? (currentPlayer.stats.captures ?? 0) : 0;
  const personalCapturedTimes = game.status === 'running' ? (currentPlayer.stats.capturedTimes ?? 0) : 0;

  const handleGameExit = () => {
    router.push('/join');
  };

  // Keep MapView mounted to persist camera and location between tab switches

  return (
    <SafeArea className="min-h-screen p-0">
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
          {!isEditingPins && (
            <MapView
              onLocationUpdate={handleLocationUpdate}
              players={mapPlayers}
              pins={pins}
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
              runnerSeeKillerRadiusM={game.runnerSeeKillerRadiusM ?? 500}
              runnerSeeRunnerRadiusM={game.runnerSeeRunnerRadiusM ?? 1000}
              runnerSeeGeneratorRadiusM={game.runnerSeeGeneratorRadiusM ?? 3000}
              killerSeeGeneratorRadiusM={game.killerSeeGeneratorRadiusM ?? 3000}
              killerDetectRunnerRadiusM={game.killerDetectRunnerRadiusM || 500}
              pinTargetCount={game.pinCount ?? 10}
              gameDurationSec={game.gameDurationSec ?? undefined}
            />
          )}

          {/* Capture Popup for Oni */}
          {showCapturePopup && (
            <div className="absolute inset-0 flex items-center justify-center z-[120] bg-black/40">
              <div className="rounded-2xl bg-[rgba(3,22,27,0.95)] border border-cyber-green/50 px-8 py-6 shadow-[0_20px_48px_rgba(3,22,27,0.55)] text-center max-w-xs w-full mx-4">
                <div className="text-4xl mb-3">👹</div>
                <p className="text-lg font-semibold text-primary">
                  {capturedTargetName} を捕獲しました！
                </p>
                <p className="text-xs text-muted mt-2">逃走者の状況を確認しましょう。</p>
                <button
                  className="mt-5 w-full btn-primary font-semibold py-2 rounded-lg tracking-[0.2em]"
                  onClick={() => setShowCapturePopup(false)}
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* Captured Popup for runners */}
          {showCapturedPopup && currentPlayer.role === 'runner' && (
            <div className="absolute inset-0 flex items-center justify-center z-[120] bg-black/40">
              <div className="rounded-2xl bg-[rgba(3,22,27,0.95)] border border-cyber-pink/50 px-8 py-6 shadow-[0_20px_48px_rgba(3,22,27,0.55)] text-center max-w-xs w-full mx-4">
                <div className="text-4xl mb-3">🚨</div>
                <p className="text-lg font-semibold text-primary">捕獲されました…</p>
                <p className="text-xs text-muted mt-2">仲間に救助してもらうか、安全を確保しましょう。</p>
                <button
                  className="mt-5 w-full btn-primary font-semibold py-2 rounded-lg tracking-[0.2em]"
                  onClick={() => setShowCapturedPopup(false)}
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* Rescue Popup for rescued runner */}
          {showRescuedPopup && currentPlayer.role === 'runner' && (
            <div className="absolute inset-0 flex items-center justify-center z-[120] bg-black/40">
              <div className="rounded-2xl bg-[rgba(3,22,27,0.95)] border border-cyber-green/50 px-8 py-6 shadow-[0_20px_48px_rgba(3,22,27,0.55)] text-center max-w-xs w-full mx-4">
                <div className="text-4xl mb-3">🏃</div>
                <p className="text-lg font-semibold text-primary">救助されました！</p>
                <p className="text-xs text-muted mt-2">仲間に感謝して、安全な場所へ移動しましょう。</p>
                <button
                  className="mt-5 w-full btn-primary font-semibold py-2 rounded-lg tracking-[0.2em]"
                  onClick={() => setShowRescuedPopup(false)}
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* HUD Overlay */}
          <HUD
            gameStatus={game.status}
            timeRemaining={timeRemaining ?? undefined}
            playerCount={players.length}
            oniCount={oniCount}
            runnerCount={runnerCount}
            runnerCapturedCount={runnerCapturedCount}
            generatorsClearedCount={generatorsClearedCount}
            pinTargetCount={game.pinCount ?? 10}
            captures={personalCaptures}
            capturedTimes={personalCapturedTimes}
            currentUserRole={currentPlayer.role}
          />

          {showGameEndPopup && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[100]">
              <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 text-center">
                <h3 className="text-xl font-bold mb-2">ゲームが終了しました</h3>
                <p className="font-semibold mb-4 {allPinsCleared ? 'text-green-600' : 'text-red-600'}">
                  {allPinsCleared ? '逃走者の勝利！' : '鬼の勝利！'}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    className="bg-gray-800 hover:bg-black text-white font-medium py-2 px-4 rounded"
                    onClick={() => {
                      setShowGameEndPopup(false);
                      setShowGameSummaryPopup(true);
                    }}
                  >
                    次へ
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {showGameSummaryPopup && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[110]">
              <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
                <h3 className="text-xl font-bold mb-4 text-center">ゲーム内容</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>捕獲者数</span>
                    <span className="font-semibold text-gray-900">{capturedPlayersCount}人</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>発電機解除数</span>
                    <span className="font-semibold text-gray-900">{generatorsClearedCount}箇所</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ゲーム時間</span>
                    <span className="font-semibold text-gray-900">{formattedGameDuration}</span>
                  </div>
                </div>
                <div className="flex gap-2 justify-center mt-6">
                  <button
                    className="bg-gray-800 hover:bg-black text-white font-medium py-2 px-4 rounded"
                    onClick={() => setShowGameSummaryPopup(false)}
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rescue Button */}
          {rescuablePlayer && currentPlayer.role === 'runner' && game.status === 'running' && (
            <div className="absolute bottom-48 left-1/2 transform -translate-x-1/2 z-50">
              <button
                onClick={handleRescue}
                disabled={isRescuing}
                className={`bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg text-lg ${isRescuing ? 'opacity-70 cursor-not-allowed' : 'animate-pulse'}`}
              >
                {isRescuing
                  ? '🚑 救助中…'
                  : `🚑 救助する${rescuablePlayer.nickname ? `（${rescuablePlayer.nickname}）` : ''}`}
              </button>
            </div>
          )}

          {/* Capture Button for Oni */}
          {capturableRunner && currentPlayer.role === 'oni' && game.status === 'running' && (
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
            onPinEditModeChange={setIsEditingPins}
          />
        )}
      </div>

      {/* Status Bar (only show on map tab) */}
      {activeTab === 'map' && (
        <div className="bg-white border-t border-gray-200 p-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              {(() => {
                const myState = user?.uid ? (playersById[user.uid]?.state || currentPlayer.state) : currentPlayer.state;
                const dotColor = currentPlayer.role === 'oni' ? 'bg-red-500' : (myState && myState !== 'active' ? 'bg-gray-400' : 'bg-green-500');
                const roleLabel = currentPlayer.role === 'oni' ? '鬼' : (myState && myState !== 'active' ? '逃走者（捕獲済み）' : '逃走者');
                return (
                  <>
                    <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                    <span className="font-medium">{currentPlayer.nickname}</span>
                    <span className="text-gray-500">({roleLabel})</span>
                  </>
                );
              })()}
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
    </SafeArea>
  );
}
