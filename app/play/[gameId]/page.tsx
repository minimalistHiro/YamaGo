'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  subscribeToGame, 
  subscribeToPlayers, 
  subscribeToLocations, 
  updateLocation,
  getPlayer,
  Game,
  Player,
  Location
} from '@/lib/game';
import { haversine, isWithinYamanoteLine } from '@/lib/geo';
import MapView from '@/components/MapView';
import HUD from '@/components/HUD';
import BottomTabNavigation, { TabType } from '@/components/BottomTabNavigation';
import ChatView from '@/components/ChatView';
import SettingsView from '@/components/SettingsView';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [locations, setLocations] = useState<{ [uid: string]: Location }>({});
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('map');

  useEffect(() => {
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

  useEffect(() => {
    if (!user || !gameId) return;

    // Subscribe to game data
    const unsubscribeGame = subscribeToGame(gameId, (gameData) => {
      setGame(gameData);
      if (!gameData) {
        setError('ゲームが見つかりません');
        return;
      }
    });

    // Subscribe to players
    const unsubscribePlayers = subscribeToPlayers(gameId, (playersData) => {
      setPlayers(playersData);
    });

    // Subscribe to locations
    const unsubscribeLocations = subscribeToLocations(gameId, (locationsData) => {
      setLocations(locationsData);
    });

    // Get current player data
    const getCurrentPlayerData = async () => {
      const playerData = await getPlayer(gameId, user.uid);
      setCurrentPlayer(playerData);
    };
    getCurrentPlayerData();

    return () => {
      unsubscribeGame();
      unsubscribePlayers();
      unsubscribeLocations();
    };
  }, [user, gameId]);

  const handleLocationUpdate = async (lat: number, lng: number, accuracy: number) => {
    if (!user || !gameId) return;

    // Check if within Yamanote Line boundary
    if (!isWithinYamanoteLine(lat, lng)) {
      console.warn('Outside Yamanote Line boundary');
      return;
    }

    try {
      await updateLocation(gameId, user.uid, { lat, lng, accM: accuracy });
    } catch (err) {
      console.error('Location update error:', err);
    }
  };

  // Check for captures (simplified version - in production this would be in Cloud Functions)
  useEffect(() => {
    if (!currentPlayer || !game || game.status !== 'running') return;

    const checkCaptures = () => {
      if (currentPlayer.role === 'oni') {
        // Check if oni is within capture radius of any runner
        players.forEach(player => {
          if (player.role === 'runner' && player.active) {
            const oniLocation = locations[user.uid];
            const runnerLocation = locations[player.uid];
            
            if (oniLocation && runnerLocation) {
              const distance = haversine(
                oniLocation.lat, oniLocation.lng,
                runnerLocation.lat, runnerLocation.lng
              );
              
              if (distance <= game.captureRadiusM) {
                console.log(`Capture! ${player.nickname} is within ${distance}m`);
                // In production, this would trigger a Cloud Function
              }
            }
          }
        });
      }
    };

    const interval = setInterval(checkCaptures, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [currentPlayer, game, players, locations, user]);

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
      avatarUrl: player.avatarUrl
    }));

  const oniCount = players.filter(p => p.role === 'oni' && p.active).length;
  const runnerCount = players.filter(p => p.role === 'runner' && p.active).length;

  const handleGameExit = () => {
    router.push('/join');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'map':
        return (
          <div className="flex-1 relative h-full">
            <MapView
              onLocationUpdate={handleLocationUpdate}
              players={mapPlayers}
              currentUserRole={currentPlayer.role}
              gameStatus={game.status}
            />
            
            {/* HUD Overlay */}
            <HUD
              gameStatus={game.status}
              playerCount={players.length}
              oniCount={oniCount}
              runnerCount={runnerCount}
              captures={currentPlayer.stats.captures}
              capturedTimes={currentPlayer.stats.capturedTimes}
            />
          </div>
        );
      case 'chat':
        return (
          <ChatView
            gameId={gameId}
            currentUser={{
              uid: user.uid,
              nickname: currentPlayer.nickname
            }}
          />
        );
      case 'settings':
        return (
          <SettingsView
            gameId={gameId}
            currentUser={{
              uid: user.uid,
              nickname: currentPlayer.nickname,
              role: currentPlayer.role,
              avatarUrl: currentPlayer.avatarUrl
            }}
            onGameExit={handleGameExit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {renderActiveTab()}
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
              精度: {locations[user.uid] ? `${Math.round(locations[user.uid].accM)}m` : 'N/A'}
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
