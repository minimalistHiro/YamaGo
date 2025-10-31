'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously, User } from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase/client';
import { createGame, joinGame, getGame } from '@/lib/game';

// Note: For Vercel deployment, ensure the following environment variables are set in your Vercel project:
// - NEXT_PUBLIC_FIREBASE_API_KEY
// - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
// - NEXT_PUBLIC_FIREBASE_PROJECT_ID
// - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
// - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
// - NEXT_PUBLIC_FIREBASE_APP_ID
// - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

export default function CreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameCreated, setGameCreated] = useState(false);
  const [gameId, setGameId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('ニックネームを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('Starting game creation...');
      
      // Get Firebase services (client-side only)
      const { auth } = getFirebaseServices();
      console.log('Firebase auth object:', auth);
      
      // Anonymous authentication
      console.log('Authenticating user...');
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;
      console.log('User authenticated:', uid);

      // Create new game and save to Firebase
      console.log('Creating game in Firebase...');
      const gameId = await createGame(uid);
      console.log('Game created and saved to Firebase with ID:', gameId);
      
      // Verify game was saved by fetching it back
      console.log('Verifying game was saved...');
      const savedGame = await getGame(gameId);
      if (!savedGame) {
        throw new Error('Game was not saved to Firebase');
      }
      console.log('Game verification successful:', savedGame);
      
      // Join as owner (oni)
      console.log('Joining game as owner...');
      await joinGame(gameId, uid, nickname.trim(), 'oni');
      console.log('Joined game successfully');
      
      // Set game created state
      setGameId(gameId);
      setGameCreated(true);
    } catch (err) {
      console.error('Create game error:', err);
      setError(`ゲームを作成できませんでした: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = () => {
    router.replace(`/play/${gameId}`);
  };

  const handleCopyGameId = async () => {
    try {
      await navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy game ID:', err);
    }
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  if (gameCreated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          {/* Back to Home Button */}
          <div className="mb-4">
            <button
              onClick={handleBackToHome}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              戻る
            </button>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              ゲームを作成しました！
            </h1>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">ゲームID:</p>
              <div className="flex items-center space-x-2">
                <span className="font-mono bg-gray-100 px-3 py-2 rounded text-sm flex-1">{gameId}</span>
                <button
                  onClick={handleCopyGameId}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      コピー済み
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      コピー
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-800 mb-2">ゲーム情報</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• ゲームがFirebaseに正常に保存されました</p>
                <p>• あなたは鬼として参加しています</p>
                <p>• 他のプレイヤーにゲームIDを共有してください</p>
                <p>• ゲーム開始30分後に鬼が有効化されます</p>
              </div>
            </div>
            
            <button
              onClick={handleStartGame}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors mb-4"
            >
              ゲームを開始
            </button>
            
            <div className="text-xs text-gray-500">
              <p>• 位置情報の使用に同意してください</p>
              <p>• 山手線内でのみプレイ可能です</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Back to Home Button */}
        <div className="mb-4">
          <button
            onClick={handleBackToHome}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            戻る
          </button>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          ゲームを作成
        </h1>

        <form onSubmit={handleCreateGame} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
              ニックネーム
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="あなたのニックネーム"
              maxLength={20}
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? '作成中...' : 'ゲームを作成'}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500 text-center">
          <p>• ゲーム作成者は鬼になります</p>
          <p>• 位置情報の使用に同意してください</p>
          <p>• 山手線内でのみプレイ可能です</p>
          <p>• ゲーム開始30分後に鬼が有効化されます</p>
        </div>
      </div>
    </div>
  );
}
