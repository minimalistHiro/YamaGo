'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase/client';
import { 
  subscribeToGame, 
  subscribeToPlayers, 
  subscribeToLocations, 
  updateGame,
  updatePlayer,
  Game,
  Player,
  Location
} from '@/lib/game';
import { getYamanoteCenter } from '@/lib/geo';
import MapView from '@/components/MapView';
import HUD from '@/components/HUD';

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [locations, setLocations] = useState<{ [uid: string]: Location }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOwner, setIsOwner] = useState(false);

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

  useEffect(() => {
    if (!user || !gameId) return;

    // Subscribe to game data
    const unsubscribeGame = subscribeToGame(gameId, (gameData) => {
      setGame(gameData);
      if (!gameData) {
        setError('ゲームが見つかりません');
        return;
      }
      
      // Check if user is owner
      setIsOwner(user ? gameData.ownerUid === user.uid : false);
    });

    // Subscribe to players
    const unsubscribePlayers = subscribeToPlayers(gameId, (playersData) => {
      setPlayers(playersData);
    });

    // Subscribe to locations
    const unsubscribeLocations = subscribeToLocations(gameId, (locationsData) => {
      setLocations(locationsData);
    });

    return () => {
      unsubscribeGame();
      unsubscribePlayers();
      unsubscribeLocations();
    };
  }, [user, gameId]);

  const handleStartGame = async () => {
    if (!game || !isOwner) return;

    try {
      await updateGame(gameId, {
        status: 'running',
        startAt: new Date() as any
      });
    } catch (err) {
      console.error('Start game error:', err);
      setError('ゲームを開始できませんでした');
    }
  };

  const handleEndGame = async () => {
    if (!game || !isOwner) return;

    try {
      await updateGame(gameId, {
        status: 'ended'
      });
    } catch (err) {
      console.error('End game error:', err);
      setError('ゲームを終了できませんでした');
    }
  };

  const handleChangeRole = async (playerUid: string, newRole: 'oni' | 'runner') => {
    if (!isOwner) return;

    try {
      await updatePlayer(gameId, playerUid, { role: newRole });
    } catch (err) {
      console.error('Change role error:', err);
      setError('役割を変更できませんでした');
    }
  };

  const handleKickPlayer = async (playerUid: string) => {
    if (!isOwner) return;

    try {
      await updatePlayer(gameId, playerUid, { active: false });
    } catch (err) {
      console.error('Kick player error:', err);
      setError('プレイヤーを削除できませんでした');
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

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
          <p className="text-gray-600">ゲームデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">アクセス拒否</h2>
          <p className="text-gray-600 mb-4">このページはゲーム作成者のみアクセス可能です</p>
          <button
            onClick={() => router.replace(`/play/${gameId}`)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded mr-2"
          >
            プレイページへ
          </button>
          <button
            onClick={() => router.push('/join')}
            className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded"
          >
            戻る
          </button>
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
      lng: locations[player.uid].lng
    }));

  const oniCount = players.filter(p => p.role === 'oni' && p.active).length;
  const runnerCount = players.filter(p => p.role === 'runner' && p.active).length;
  const runnerCapturedCount = players.filter(p => p.role === 'runner' && p.active && p.state && p.state !== 'active').length;

  return (
    <div className="h-screen flex flex-col">
      {/* Map View */}
      <div className="flex-1 relative">
        <MapView
          players={mapPlayers}
          currentUserRole="oni"
          gameStatus={game.status}
        />
        
        {/* HUD Overlay */}
        <HUD
          gameStatus={game.status}
          playerCount={players.length}
          oniCount={oniCount}
          runnerCount={runnerCount}
          runnerCapturedCount={runnerCapturedCount}
          generatorsClearedCount={0}
          onStartGame={game.status === 'pending' ? handleStartGame : undefined}
          onEndGame={game.status === 'running' ? handleEndGame : undefined}
        />
      </div>

      {/* Admin Panel */}
      <div className="bg-white border-t border-gray-200 p-4 max-h-64 overflow-y-auto">
        <h3 className="font-bold text-lg mb-3">管理者パネル</h3>
        
        <div className="space-y-3">
          {/* Game Info */}
          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold mb-2">ゲーム情報</h4>
            <div className="text-sm space-y-1">
              <p>ゲームID: <code className="bg-gray-200 px-1 rounded">{gameId}</code></p>
              <p>状態: <span className={`font-semibold ${game.status === 'running' ? 'text-green-600' : game.status === 'ended' ? 'text-red-600' : 'text-yellow-600'}`}>
                {game.status === 'pending' ? '待機中' : game.status === 'running' ? '実行中' : '終了'}
              </span></p>
              <p>捕獲半径: {game.captureRadiusM}m</p>
            </div>
          </div>

          {/* Players List */}
          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-semibold mb-2">プレイヤー一覧 ({players.length}人)</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {players.map(player => (
                <div key={player.uid} className="flex items-center justify-between bg-white p-2 rounded border">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${player.role === 'oni' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <span className="text-sm font-medium">{player.nickname}</span>
                    <span className="text-xs text-gray-500">({player.role === 'oni' ? '鬼' : '逃走者'})</span>
                  </div>
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleChangeRole(player.uid, player.role === 'oni' ? 'runner' : 'oni')}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                    >
                      {player.role === 'oni' ? '逃走者に' : '鬼に'}
                    </button>
                    <button
                      onClick={() => handleKickPlayer(player.uid)}
                      className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Controls */}
          <div className="flex space-x-2">
            <button
              onClick={() => router.replace(`/play/${gameId}`)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
            >
              プレイページへ
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join`)}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded"
            >
              招待リンクをコピー
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
