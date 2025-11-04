'use client';

import { useState, useEffect } from 'react';
import { Player, getPlayers, updatePlayer, deletePlayer } from '@/lib/game';

interface RoleAssignmentViewProps {
  gameId: string;
  onBack: () => void;
  currentUserId?: string;
}

export default function RoleAssignmentView({ gameId, onBack, currentUserId }: RoleAssignmentViewProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  useEffect(() => {
    loadPlayers();
  }, [gameId]);

  const loadPlayers = async () => {
    try {
      setIsLoading(true);
      const playersData = await getPlayers(gameId);
      setPlayers(playersData);
    } catch (err) {
      console.error('Error loading players:', err);
      setError('プレイヤー情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (playerUid: string, newRole: 'oni' | 'runner') => {
    try {
      setIsSaving(true);
      await updatePlayer(gameId, playerUid, { role: newRole });
      
      // Update local state
      setPlayers(prev => prev.map(player => 
        player.uid === playerUid ? { ...player, role: newRole } : player
      ));
    } catch (err) {
      console.error('Error updating role:', err);
      setError('役職の変更に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleCounts = () => {
    const oniCount = players.filter(p => p.role === 'oni').length;
    const runnerCount = players.filter(p => p.role === 'runner').length;
    return { oniCount, runnerCount };
  };
  const handleDeletePlayer = async (playerUid: string) => {
    const ok = confirm('このプレイヤーを削除しますか？\n位置情報も含めて削除されます。');
    if (!ok) return;
    try {
      setDeletingUid(playerUid);
      await deletePlayer(gameId, playerUid);
      setPlayers(prev => prev.filter(p => p.uid !== playerUid));
    } catch (err) {
      console.error('Error deleting player:', err);
      setError('プレイヤーの削除に失敗しました');
    } finally {
      setDeletingUid(null);
    }
  };

  const { oniCount, runnerCount } = getRoleCounts();

  const handleRandomizeRoles = async () => {
    if (players.length === 0) return;
    setError('');
    const confirmAssign = confirm('現在の人数を維持したまま役職をランダムに振り分けます。よろしいですか？');
    if (!confirmAssign) return;

    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const roleByUid: Record<string, 'oni' | 'runner'> = {};
    shuffled.forEach((player, index) => {
      roleByUid[player.uid] = index < oniCount ? 'oni' : 'runner';
    });

    const updates = players
      .filter(player => roleByUid[player.uid] && roleByUid[player.uid] !== player.role)
      .map(player => ({ uid: player.uid, role: roleByUid[player.uid] }));

    try {
      setIsSaving(true);
      await Promise.all(
        updates.map(({ uid, role }) => updatePlayer(gameId, uid, { role }))
      );
      setPlayers(prev => prev.map(player => ({
        ...player,
        role: roleByUid[player.uid] ?? player.role,
      })));
    } catch (err) {
      console.error('Error randomizing roles:', err);
      setError('役職のランダム振り分けに失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">プレイヤー情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header - 固定表示 */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-800">役職振り分け</h2>
        </div>
      </div>

      {/* 設定コンテンツ部分 - スクロール可能 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
        {/* Role Summary */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-md font-medium text-gray-800 mb-3">役職割り当て状況</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{oniCount}</div>
              <div className="text-sm text-gray-600">鬼</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{runnerCount}</div>
              <div className="text-sm text-gray-600">逃走者</div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Role Assignment Lists */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <h3 className="text-md font-medium text-gray-800">役職振り分け</h3>
            <button
              onClick={handleRandomizeRoles}
              disabled={isSaving || players.length === 0}
              className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-full shadow-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '振り分け中...' : 'ランダムに振り分ける'}
            </button>
          </div>
          
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Oni List (Left) */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <h4 className="font-medium text-gray-800">鬼 ({oniCount}人)</h4>
              </div>
              
              <div className="space-y-2 min-h-[200px] border-2 border-dashed border-red-200 rounded-lg p-3">
                {players.filter(p => p.role === 'oni').map((player) => (
                  <div
                    key={player.uid}
                    className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => handleRoleChange(player.uid, 'runner')}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-red-300 flex-shrink-0">
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-red-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {player.nickname.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900 truncate">{player.nickname}</h5>
                        {currentUserId === player.uid && (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">自分</span>
                        )}
                      </div>
                      <p className="text-xs text-red-600">タップで逃走者に変更</p>
                    </div>

                    {currentUserId !== player.uid && (
                      <button
                        className="ml-2 p-2 rounded hover:bg-red-200 text-red-600"
                        title="プレイヤーを削除"
                        onClick={(e) => { e.stopPropagation(); handleDeletePlayer(player.uid); }}
                        disabled={deletingUid === player.uid}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a2 2 0 012-2h4a2 2 0 012 2m-8 0h8" />
                        </svg>
                      </button>
                    )}
                    
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))}
                
                {oniCount === 0 && (
                  <div className="flex items-center justify-center h-32 text-gray-400">
                    <div className="text-center">
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <p className="text-sm">鬼がいません</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Runner List (Right) */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <h4 className="font-medium text-gray-800">逃走者 ({runnerCount}人)</h4>
              </div>
              
              <div className="space-y-2 min-h-[200px] border-2 border-dashed border-green-200 rounded-lg p-3">
                {players.filter(p => p.role === 'runner').map((player) => (
                  <div
                    key={player.uid}
                    className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                    onClick={() => handleRoleChange(player.uid, 'oni')}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-green-300 flex-shrink-0">
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-green-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {player.nickname.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900 truncate">{player.nickname}</h5>
                        {currentUserId === player.uid && (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">自分</span>
                        )}
                      </div>
                      <p className="text-xs text-green-600">タップで鬼に変更</p>
                    </div>

                    {currentUserId !== player.uid && (
                      <button
                        className="ml-2 p-2 rounded hover:bg-green-200 text-green-700"
                        title="プレイヤーを削除"
                        onClick={(e) => { e.stopPropagation(); handleDeletePlayer(player.uid); }}
                        disabled={deletingUid === player.uid}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a2 2 0 012-2h4a2 2 0 012 2m-8 0h8" />
                        </svg>
                      </button>
                    )}
                    
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                ))}
                
                {runnerCount === 0 && (
                  <div className="flex items-center justify-center h-32 text-gray-400">
                    <div className="text-center">
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <p className="text-sm">逃走者がいません</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-blue-700 text-sm">
              <p className="font-medium mb-1">役職振り分けについて</p>
              <ul className="space-y-1 text-xs">
                <li>• 左側の鬼リスト、右側の逃走者リストに分けて表示されます</li>
                <li>• プレイヤーをタップすると反対の役職に変更されます</li>
                <li>• 鬼をタップ → 逃走者に変更、逃走者をタップ → 鬼に変更</li>
                <li>• 各リストの人数がリアルタイムで表示されます</li>
                <li>• ゲーム開始後も役職の変更が可能です</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
