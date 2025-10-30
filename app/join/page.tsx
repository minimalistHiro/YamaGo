'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseServices } from '@/lib/firebase/client';
import { joinGame, createGame } from '@/lib/game';

// Note: For Vercel deployment, ensure the following environment variables are set in your Vercel project:
// - NEXT_PUBLIC_FIREBASE_API_KEY
// - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
// - NEXT_PUBLIC_FIREBASE_PROJECT_ID
// - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
// - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
// - NEXT_PUBLIC_FIREBASE_APP_ID
// - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

export default function JoinPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState('');
  const [gameId, setGameId] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ファイルサイズチェック (5MB以下)
      if (file.size > 5 * 1024 * 1024) {
        setError('画像ファイルは5MB以下にしてください');
        return;
      }

      // ファイル形式チェック
      if (!file.type.startsWith('image/')) {
        setError('画像ファイルを選択してください');
        return;
      }

      setSelectedImage(file);
      setError('');

      // プレビュー用のURL作成
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file: File, uid: string): Promise<string> => {
    try {
      console.log('Starting image upload...', { fileName: file.name, size: file.size });
      
      // Get Firebase services (client-side only)
      const { storage } = getFirebaseServices();
      
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `avatars/${uid}_${timestamp}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      console.log('Uploading to storage path:', fileName);
      await uploadBytes(storageRef, file);
      console.log('Upload completed, getting download URL...');
      
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error(`画像のアップロードに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !gameId.trim()) {
      setError('ニックネームとゲームIDを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get Firebase services (client-side only)
      const { auth, db } = getFirebaseServices();
      
      // Anonymous authentication
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;

      // Upload avatar image if selected
      let avatarUrl = '';
      if (selectedImage) {
        avatarUrl = await uploadImageToStorage(selectedImage, uid);
      }

      // Do not update ownerUid here; rely on server-side logic and joinGame

      // Join existing game
      await joinGame(gameId, uid, nickname.trim(), 'runner', avatarUrl);
      
      router.push(`/play/${gameId}`);
    } catch (err) {
      console.error('Join game error:', err);
      setError('ゲームに参加できませんでした。ゲームIDを確認してください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleCreateGame = async () => {
    // ニックネームが入力されていない場合はエラーを表示
    if (!nickname.trim()) {
      setError('ニックネームを入力してください');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      console.log('Starting game creation process...');
      
      // Get Firebase services (client-side only)
      const { auth } = getFirebaseServices();
      
      // Anonymous authentication
      console.log('Authenticating user...');
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;
      console.log('User authenticated:', uid);

      // Upload avatar image if selected
      let avatarUrl = '';
      if (selectedImage) {
        console.log('Uploading avatar image...');
        avatarUrl = await uploadImageToStorage(selectedImage, uid);
        console.log('Avatar uploaded:', avatarUrl);
      }

      // Create new game
      console.log('Creating new game...');
      const newGameId = await createGame(uid);
      console.log('Game created:', newGameId);
      
      // Join as owner (oni)
      console.log('Joining game as owner...');
      await joinGame(newGameId, uid, nickname.trim(), 'oni', avatarUrl);
      console.log('Joined game successfully');
      
      router.push(`/admin/${newGameId}`);
    } catch (err) {
      console.error('Create game error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`ゲームを作成できませんでした: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4">
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
          ゲームに参加
        </h1>

        <form onSubmit={handleJoinGame} className="space-y-4">
          {/* Avatar Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              アイコン画像（任意）
            </label>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  画像を選択
                </button>
                {selectedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="ml-2 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              5MB以下の画像ファイル（JPG、PNG、GIF）
            </p>
          </div>

          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
              ニックネーム
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="あなたのニックネーム"
              maxLength={20}
              required
            />
          </div>

          <div>
            <label htmlFor="gameId" className="block text-sm font-medium text-gray-700 mb-1">
              ゲームID
            </label>
            <input
              type="text"
              id="gameId"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="ゲームIDを入力"
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
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? '参加中...' : 'ゲームに参加'}
          </button>
        </form>


        <div className="mt-6 text-xs text-gray-500 text-center">
          <p>• 位置情報の使用に同意してください</p>
          <p>• 山手線内でのみプレイ可能です</p>
          <p>• ゲーム開始30分後に鬼が有効化されます</p>
        </div>
      </div>
    </div>
  );
}
