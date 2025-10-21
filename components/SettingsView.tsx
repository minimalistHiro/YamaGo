'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, deleteUser } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { deletePlayer, getGame, Game } from '@/lib/game';
import RoleAssignmentView from './RoleAssignmentView';

interface SettingsViewProps {
  gameId: string;
  currentUser: {
    uid: string;
    nickname: string;
    role: 'oni' | 'runner';
    avatarUrl?: string;
  };
  onGameExit: () => void;
}

export default function SettingsView({ gameId, currentUser, onGameExit }: SettingsViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);

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

  const confirmExitGame = async () => {
    setShowExitConfirm(false);
    setIsLoading(true);
    try {
      console.log('Starting game exit process...');
      
      // Delete avatar from storage if exists
      if (currentUser.avatarUrl) {
        console.log('Deleting avatar from storage...');
        await deleteAvatarFromStorage(currentUser.avatarUrl);
      }
      
      // Delete player data from database
      console.log('Deleting player data...');
      await deletePlayer(gameId, currentUser.uid);
      console.log('Player data deleted successfully');
      
      // Delete user account
      console.log('Deleting user account...');
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
    }
  };

  const cancelExitGame = () => {
    setShowExitConfirm(false);
  };

  const deleteAvatarFromStorage = async (avatarUrl: string) => {
    try {
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

  const handleRoleAssignment = () => {
    setShowRoleAssignment(true);
  };

  const handleBackFromRoleAssignment = () => {
    setShowRoleAssignment(false);
  };

  // Show role assignment view if requested
  if (showRoleAssignment) {
    return <RoleAssignmentView gameId={gameId} onBack={handleBackFromRoleAssignment} />;
  }

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800">設定</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Player Info */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-md font-medium text-gray-800 mb-3">プレイヤー情報</h3>
          
          {/* Avatar */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full ${currentUser.role === 'oni' ? 'bg-red-500' : 'bg-green-500'} flex items-center justify-center`}>
                  <span className="text-white font-bold text-xl">
                    {currentUser.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-800">{currentUser.nickname}</h4>
              <p className={`text-sm ${currentUser.role === 'oni' ? 'text-red-600' : 'text-green-600'}`}>
                {currentUser.role === 'oni' ? '鬼' : '逃走者'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">ニックネーム:</span>
              <span className="font-medium">{currentUser.nickname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">役職:</span>
              <span className={`font-medium ${currentUser.role === 'oni' ? 'text-red-600' : 'text-green-600'}`}>
                {currentUser.role === 'oni' ? '鬼' : '逃走者'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ゲームID:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{gameId}</span>
                <button
                  onClick={handleCopyGameId}
                  className={`p-1 rounded transition-colors ${
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
          <button
            onClick={handleExitGame}
            disabled={isLoading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
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
                  className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmExitGame}
                  disabled={isLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? '処理中...' : '退出する'}
                </button>
              </div>
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
