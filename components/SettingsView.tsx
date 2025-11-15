'use client';

import { useState, useEffect } from 'react';
import { signOut, deleteUser } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { getFirebaseServices } from '@/lib/firebase/client';
import { deletePlayer, deleteGame, getGame, Game, updateGame, getPlayers } from '@/lib/game';
import RoleAssignmentView from './RoleAssignmentView';
import GameSettingsView from './GameSettingsView';
import PlayerProfileEditView from './PlayerProfileEditView';

interface SettingsViewProps {
  gameId: string;
  currentUser: {
    uid: string;
    nickname: string;
    role: 'oni' | 'runner';
    avatarUrl?: string;
  };
  onGameExit: () => void;
  onPinEditModeChange?: (isEditing: boolean) => void;
}

export default function SettingsView({ gameId, currentUser, onGameExit, onPinEditModeChange }: SettingsViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExitProcessing, setIsExitProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uidCopied, setUidCopied] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [showGameSettings, setShowGameSettings] = useState(false);
  const [showBecomeOwnerConfirm, setShowBecomeOwnerConfirm] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [userProfile, setUserProfile] = useState(currentUser);

  useEffect(() => {
    setUserProfile(currentUser);
  }, [currentUser.uid, currentUser.nickname, currentUser.role, currentUser.avatarUrl]);

  useEffect(() => {
    loadGameInfo();
  }, [gameId]);

  const loadGameInfo = async () => {
    try {
      const gameData = await getGame(gameId);
      setGame(gameData);
      if (gameData) {
        setIsOwner(gameData.ownerUid === currentUser.uid);
      }
    } catch (error) {
      console.error('Error loading game info:', error);
    }
  };

  const handleExitGame = async () => {
    setShowExitConfirm(true);
  };

  const confirmExitGame = async (deleteGameData: boolean = false) => {
    if (deleteGameData && isOwner) {
      try {
        const players = await getPlayers(gameId);
        const hasOtherPlayers = players.some((player) => player.uid !== currentUser.uid);
        if (hasOtherPlayers) {
          alert('他のユーザーがいる為退出できません。他のユーザーに退出してもらうか、「役職振り分け」画面で他のユーザーを削除して下さい');
          return;
        }
      } catch (error) {
        console.error('Failed to verify players before exit:', error);
        alert('プレイヤー情報の確認に失敗しました。時間を置いてから再度お試しください。');
        return;
      }
    }

    if (isOwner && game?.status === 'running') {
      alert('ゲーム進行中は退出できません。先にゲームを終了してから再度お試しください。');
      setShowExitConfirm(true);
      return;
    }

    setShowExitConfirm(false);
    setIsLoading(true);
    setIsExitProcessing(true);
    try {
      console.log('Starting game exit process...');
      
      // Delete avatar from storage if exists
      if (userProfile.avatarUrl) {
        console.log('Deleting avatar from storage...');
        await deleteAvatarFromStorage(userProfile.avatarUrl);
      }

      if (deleteGameData && isOwner) {
        console.log('Owner selected to delete game. Removing game data...');
        await deleteGame(gameId);
        console.log('Game data deleted successfully');
      } else {
        // Delete player data from database
        console.log('Deleting player data...');
        await deletePlayer(gameId, userProfile.uid);
        console.log('Player data deleted successfully');

        if (isOwner) {
          console.log('Clearing owner assignment from game record...');
          await updateGame(gameId, { ownerUid: '' });
        }
      }
      
      // Delete user account
      console.log('Deleting user account...');
      const { auth } = getFirebaseServices();
      const user = auth.currentUser;
      if (user) {
        await deleteUser(user);
        console.log('User account deleted successfully');
      }
      
      // Call onGameExit callback if provided
      if (onGameExit) {
        onGameExit();
      }
      
      // Redirect to home
      console.log('Redirecting to home...');
      // Use window.location.href to ensure complete redirect to top page
      window.location.href = '/';
    } catch (error) {
      console.error('Exit game error:', error);
      alert('ゲームからの退出に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
      setIsExitProcessing(false);
    }
  };

  const cancelExitGame = () => {
    setShowExitConfirm(false);
  };

  const deleteAvatarFromStorage = async (avatarUrl: string) => {
    try {
      // Get Firebase services (client-side only)
      const { storage } = getFirebaseServices();
      
      // Extract the file path from the avatar URL
      // Firebase Storage URLs typically look like:
      // https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?alt=media&token=...
      const url = new URL(avatarUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+)/);
      
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        const fileRef = ref(storage, filePath);
        
        console.log('Deleting avatar from storage:', filePath);
        await deleteObject(fileRef);
        console.log('Avatar deleted from storage successfully');
      } else {
        console.warn('Could not extract file path from avatar URL:', avatarUrl);
      }
    } catch (error) {
      console.error('Error deleting avatar from storage:', error);
      // Don't throw error - avatar deletion failure shouldn't prevent account deletion
    }
  };

  const handleCopyGameId = async () => {
    try {
      await navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy game ID:', error);
    }
  };

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(userProfile.uid);
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy UID:', error);
    }
  };

  const handleRoleAssignment = () => {
    setShowRoleAssignment(true);
  };

  const handleBackFromRoleAssignment = () => {
    setShowRoleAssignment(false);
  };

  const handleGameSettings = () => {
    setShowGameSettings(true);
  };

  const handleBackFromGameSettings = () => {
    setShowGameSettings(false);
    onPinEditModeChange?.(false);
  };

  const handleRequestBecomeOwner = () => {
    setShowBecomeOwnerConfirm(true);
  };

  const cancelBecomeOwner = () => {
    setShowBecomeOwnerConfirm(false);
  };

  const handleEndGame = async () => {
    if (!isOwner) return;
    const ok = confirm('ゲームを終了しますか？\nこの操作は取り消せません。');
    if (!ok) return;
    try {
      setIsLoading(true);
      await updateGame(gameId, { status: 'ended' });
      alert('ゲームを終了しました');
      await loadGameInfo();
    } catch (error) {
      console.error('Failed to end game:', error);
      alert('ゲームの終了に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // (Theme selector removed)

  const handleBecomeOwner = async () => {
    try {
      setIsLoading(true);
      await updateGame(gameId, { ownerUid: currentUser.uid });
      alert('オーナーになりました');
      await loadGameInfo();
    } catch (error) {
      console.error('Failed to become owner:', error);
      alert('オーナー変更に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmBecomeOwner = async () => {
    setShowBecomeOwnerConfirm(false);
    await handleBecomeOwner();
  };

  // Show role assignment view if requested
  if (showRoleAssignment) {
    return <RoleAssignmentView gameId={gameId} onBack={handleBackFromRoleAssignment} currentUserId={userProfile.uid} />;
  }

  // Show game settings view if requested
  if (showGameSettings) {
    return (
      <GameSettingsView
        gameId={gameId}
        onBack={handleBackFromGameSettings}
        onPinEditModeChange={onPinEditModeChange}
      />
    );
  }

  if (showProfileEditor) {
    return (
      <PlayerProfileEditView
        gameId={gameId}
        user={userProfile}
        onBack={() => setShowProfileEditor(false)}
        onProfileUpdated={(profile) => {
          setUserProfile((prev) => ({
            ...prev,
            ...profile
          }));
          setShowProfileEditor(false);
        }}
      />
    );
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header - 固定表示 */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-800">設定</h2>
      </div>

      {/* 設定コンテンツ部分 - スクロール可能 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6 pb-20">
        {/* Player Info */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-md font-medium text-gray-800 mb-3">プレイヤー情報</h3>
          
          {/* Avatar */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <img
                    src="/icons/default-avatar.svg"
                    alt="デフォルトアイコン"
                    className="w-10 h-10 opacity-80"
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-800 truncate">{userProfile.nickname}</h4>
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-8 4h10M5 13h10m-6 4h6" />
                  </svg>
                  編集
                </button>
              </div>
              {isOwner && (
                <p className="text-xs text-blue-600 font-semibold mt-1">オーナー</p>
              )}
              <p className={`text-sm ${userProfile.role === 'oni' ? 'text-red-600' : 'text-green-600'}`}>
                {userProfile.role === 'oni' ? '鬼' : '逃走者'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">ニックネーム:</span>
              <span className="font-medium">{userProfile.nickname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">役職:</span>
              <span className={`font-medium ${userProfile.role === 'oni' ? 'text-red-600' : 'text-green-600'}`}>
                {userProfile.role === 'oni' ? '鬼' : '逃走者'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ゲームID:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{gameId}</span>
                <button
                  onClick={handleCopyGameId}
                  className={`p-1 rounded-full transition-colors ${
                    copied 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                  title="ゲームIDをコピー"
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ユーザーID:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{userProfile.uid}</span>
                <button
                  onClick={handleCopyUid}
                  className={`p-1 rounded-full transition-colors ${
                    uidCopied 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                  title="ユーザーIDをコピー"
                >
                  {uidCopied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Game Settings */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-md font-medium text-gray-800 mb-3">ゲーム設定</h3>
          <div className="space-y-3">
            {/* Role Assignment - Only show for owner */}
            {isOwner && (
              <div 
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={handleRoleAssignment}
              >
                <span className="text-gray-600">役職振り分け</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
            
            {/* Game Settings - Only show for owner */}
            {isOwner && (
              <div 
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={handleGameSettings}
              >
                <span className="text-gray-600">ゲーム設定</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">位置情報の共有</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  name="location-sharing"
                  id="location-sharing"
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                  defaultChecked
                />
                <label
                  htmlFor="location-sharing"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">通知</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  name="notifications"
                  id="notifications"
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                  defaultChecked
                />
                <label
                  htmlFor="notifications"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
            </div>

          </div>
        </div>

        {/* Game Actions */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-md font-medium text-gray-800 mb-3">ゲーム操作</h3>
          {isOwner && (
            <div className="mb-3">
              <button
                onClick={handleEndGame}
                disabled={
                  isLoading ||
                  !(
                    game?.status === 'running' ||
                    game?.status === 'countdown'
                  )
                }
                className="w-full bg-gray-800 hover:bg-black disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-full transition-colors"
              >
                {isLoading ? '処理中...' : 'ゲームを終了'}
              </button>
              {!(game?.status === 'running' || game?.status === 'countdown') && (
                <p className="mt-2 text-xs text-gray-500">
                  カウントダウン開始後に終了できます。
                </p>
              )}
            </div>
          )}
          {!isOwner && (
            <div className="mb-3">
              <button
                onClick={handleRequestBecomeOwner}
                disabled={isLoading}
                className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-full transition-colors"
              >
                {isLoading ? '処理中...' : '自分をオーナーにする'}
              </button>
            </div>
          )}
          <button
            onClick={handleExitGame}
            disabled={isLoading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-full transition-colors"
          >
            {isLoading ? '処理中...' : 'ゲームから退出'}
          </button>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-md font-medium text-gray-800 mb-3">アプリ情報</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>バージョン:</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>開発者:</span>
              <span>Yamago Team</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showBecomeOwnerConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                オーナー権限を取得しますか？
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                現在のオーナーからオーナー権限を引き継ぎます。<br />
                この操作はすぐに反映されます。
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={cancelBecomeOwner}
                  disabled={isLoading}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-full transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmBecomeOwner}
                  disabled={isLoading}
                  className="flex-1 bg-gray-800 hover:bg-black disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-full transition-colors"
                >
                  {isLoading ? '処理中...' : 'オーナーになる'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isExitProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-4 bg-white/90 px-8 py-6 rounded-2xl shadow-2xl border border-red-200">
            <div className="h-10 w-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold tracking-[0.3em] text-red-600 uppercase">退出処理中...</p>
            <p className="text-xs text-gray-600 text-center leading-relaxed">
              データを削除しています。ブラウザを閉じずにお待ちください。
            </p>
          </div>
        </div>
      )}
      
      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            
            <div className="text-center">
              {isOwner ? (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    退出方法を選択してください
                  </h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    オーナーが退出する場合、ゲームを削除するか残すかを選べます。<br />
                    いずれの場合も、ご自身のアカウントとプレイヤーデータは削除されます。
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => confirmExitGame(true)}
                      disabled={isLoading}
                      className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-full transition-colors"
                    >
                      {isLoading ? '処理中...' : 'ゲームを削除して退出'}
                    </button>
                    <button
                      onClick={() => confirmExitGame(false)}
                      disabled={isLoading}
                      className="w-full bg-gray-800 hover:bg-black disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-full transition-colors"
                    >
                      {isLoading ? '処理中...' : 'ゲームを残して退出'}
                    </button>
                    <button
                      onClick={cancelExitGame}
                      disabled={isLoading}
                      className="w-full bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-full transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    ゲームから退出しますか？
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    アカウントとプレイヤーデータが完全に削除されます。<br />
                    この操作は取り消すことができません。
                  </p>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={cancelExitGame}
                      disabled={isLoading}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-full transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => confirmExitGame()}
                      disabled={isLoading}
                      className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-full transition-colors"
                    >
                      {isLoading ? '処理中...' : '退出する'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom toggle styles */}
      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #ef4444;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #ef4444;
        }
      `}</style>
    </div>
  );
}
