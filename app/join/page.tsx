'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
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
  const isBusy = isLoading || isCreating;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBusy) return;
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

  const uploadAvatarToStorage = async (file: File, uid: string): Promise<string> => {
    try {
      const { storage } = getFirebaseServices();
      const extensionFromName = file.name?.split('.').pop()?.toLowerCase();
      const extensionFromType = file.type.split('/').pop();
      const safeExtension = (extensionFromName || extensionFromType || 'png').replace(/[^a-z0-9]/g, '');
      const fileRef = ref(storage, `avatars/${uid}_${Date.now()}.${safeExtension}`);

      await uploadBytes(fileRef, file, {
        contentType: file.type || 'application/octet-stream',
      });

      return await getDownloadURL(fileRef);
    } catch (error) {
      console.error('Avatar upload error:', error);
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
      const { auth } = getFirebaseServices();
      
      // Anonymous authentication
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;

      // Upload avatar image if selected
      let avatarUrl = '';
      if (selectedImage) {
        avatarUrl = await uploadAvatarToStorage(selectedImage, uid);
      }

      // Do not update ownerUid here; rely on server-side logic and joinGame

      // Join existing game
      await joinGame(gameId, uid, nickname.trim(), 'runner', avatarUrl);
      
      router.replace(`/play/${gameId}`);
    } catch (err) {
      console.error('Join game error:', err);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('画像のアップロード')) {
        setError(message);
      } else if (message.includes('storage') && message.includes('bucket')) {
        setError('画像のアップロードに失敗しました。ストレージ設定を確認してください。');
      } else {
        setError('ゲームに参加できませんでした。ゲームIDを確認してください。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    if (isBusy) return;
    router.push('/');
  };

  const handleCreateGame = async () => {
    if (isBusy) return;
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
        avatarUrl = await uploadAvatarToStorage(selectedImage, uid);
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
      
      router.replace(`/admin/${newGameId}`);
    } catch (err) {
      console.error('Create game error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`ゲームを作成できませんでした: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-40 blur-3xl pointer-events-none" aria-hidden>
        <div className="w-72 h-72 brand-gradient rounded-full absolute -top-24 -left-10 mix-blend-screen" />
        <div className="w-80 h-80 brand-gradient rounded-full absolute -bottom-16 -right-20 mix-blend-screen" />
      </div>
      <div className="max-w-2xl w-full cyber-card rounded-3xl border border-cyber-green/30 shadow-[0_0_50px_rgba(34,181,155,0.15)] p-8 relative">
        {isBusy && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl bg-[rgba(1,10,14,0.75)] backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" aria-hidden />
            <p className="mt-4 text-xs text-cyber-green tracking-[0.3em] uppercase">処理中...</p>
          </div>
        )}
        <div className="absolute inset-x-8 -top-1 h-1 bg-gradient-to-r from-cyber-green via-cyber-glow to-cyber-pink rounded-full shadow-[0_0_20px_rgba(95,251,241,0.55)]" />
        {/* Back to Home Button */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={handleBackToHome}
            className="btn-surface inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm tracking-[0.2em] disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            disabled={isBusy}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            戻る
          </button>
          <span className="text-xs text-muted uppercase tracking-[0.4em]">Join Network</span>
        </div>
        
        <h1 className="text-3xl font-semibold text-primary text-center mb-2 tracking-[0.4em] uppercase">
          ゲームに参加
        </h1>
        <p className="text-xs text-muted text-center mb-10 tracking-[0.3em] uppercase">
          Yamago Multiplayer Portal
        </p>

        <form onSubmit={handleJoinGame} className="space-y-6">
          {/* Avatar Selection */}
          <div>
            <label className="block text-xs uppercase tracking-[0.3em] text-muted mb-3">
              アイコン画像（任意）
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-[rgba(5,30,36,0.85)] flex items-center justify-center overflow-hidden border border-cyber-green/40 shadow-[0_0_20px_rgba(34,181,155,0.2)]">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-8 h-8 text-cyber-glow/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="btn-surface px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isBusy}
                >
                  画像を選択
                </button>
                {selectedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isBusy) return;
                      setSelectedImage(null);
                      setImagePreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="btn-accent ml-3 px-3 py-1 text-xs rounded-lg text-white opacity-80 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBusy}
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted mt-2 tracking-[0.2em] uppercase">
              5MB以下の画像ファイル（JPG、PNG、GIF）
            </p>
          </div>

          <div>
            <label htmlFor="nickname" className="block text-xs uppercase tracking-[0.3em] text-muted mb-2">
              ニックネーム
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(3,22,27,0.85)] border border-cyber-green/40 text-app placeholder:text-cyber-green/50 focus:outline-none focus:ring-2 focus:ring-cyber-green/60 focus:border-cyber-green/60 transition-all"
              placeholder="あなたのニックネーム"
              maxLength={20}
              required
            />
          </div>

          <div>
            <label htmlFor="gameId" className="block text-xs uppercase tracking-[0.3em] text-muted mb-2">
              ゲームID
            </label>
            <input
              type="text"
              id="gameId"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(3,22,27,0.85)] border border-cyber-green/40 text-app placeholder:text-cyber-green/50 focus:outline-none focus:ring-2 focus:ring-cyber-green/60 focus:border-cyber-green/60 transition-all"
              placeholder="ゲームIDを入力"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-center bg-[rgba(38,7,24,0.7)] border border-cyber-pink/50 text-cyber-pink px-4 py-3 rounded-xl tracking-widest uppercase">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full btn-accent disabled:opacity-60 disabled:cursor-not-allowed font-semibold py-3 px-4 rounded-full transition-transform"
          >
            {isLoading ? '参加中...' : 'ゲームに参加'}
          </button>
        </form>


        <div className="mt-10 text-[10px] text-muted text-center tracking-[0.35em] uppercase space-y-1">
          <p>位置情報の使用に同意してください</p>
          <p>山手線内でのみプレイ可能です</p>
          <p>ゲーム開始30分後に鬼が有効化されます</p>
        </div>
      </div>
    </div>
  );
}
