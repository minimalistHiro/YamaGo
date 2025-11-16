'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously, User } from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase/client';
import { createGame, joinGame, getGame } from '@/lib/game';
import SafeArea from '@/components/SafeArea';

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
  const isBusy = isLoading;

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
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
    if (isBusy) return;
    router.push('/');
  };

  if (gameCreated) {
    return (
      <SafeArea className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center p-6 pt-safe-area pb-safe-area">
        <div className="absolute inset-0 opacity-35 blur-3xl pointer-events-none" aria-hidden>
          <div className="w-80 h-80 brand-gradient rounded-full absolute -top-24 -right-10 mix-blend-screen" />
          <div className="w-[22rem] h-[22rem] brand-gradient rounded-full absolute -bottom-32 -left-10 mix-blend-screen" />
        </div>
        <div className="max-w-2xl w-full cyber-card rounded-3xl border border-cyber-green/30 shadow-[0_0_55px_rgba(34,181,155,0.2)] p-10 relative">
          <div className="absolute inset-x-10 -top-1 h-1 bg-gradient-to-r from-cyber-green via-cyber-glow to-cyber-pink rounded-full shadow-[0_0_20px_rgba(95,251,241,0.55)]" />
          {/* Back to Home Button */}
          <div className="mb-10 flex items-center justify-between">
            <button
              onClick={handleBackToHome}
              className="btn-surface inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm tracking-[0.25em]"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              戻る
            </button>
            <span className="text-xs text-muted uppercase tracking-[0.4em]">Session Deployed</span>
          </div>
          
          <div className="text-center space-y-8">
            <div className="w-24 h-24 mx-auto rounded-full border border-cyber-green/40 bg-[rgba(3,22,27,0.85)] flex items-center justify-center shadow-[0_0_28px_rgba(34,181,155,0.3)]">
              <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div>
              <h1 className="text-3xl font-semibold text-primary tracking-[0.35em] uppercase mb-3">
                ゲームを作成しました
              </h1>
              <p className="text-xs text-muted tracking-[0.3em] uppercase">Share The Access Code</p>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs text-muted uppercase tracking-[0.35em]">ゲームID</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="font-mono text-base sm:flex-1 w-full break-all bg-[rgba(3,22,27,0.85)] border border-cyber-green/45 px-4 py-3 rounded-xl text-cyber-glow shadow-[0_0_20px_rgba(34,181,155,0.25)] tracking-[0.18em]">
                  {gameId}
                </span>
                <button
                  onClick={handleCopyGameId}
                  className={`btn-primary px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-[0.25em] ${
                    copied ? 'opacity-80' : ''
                  }`}
                >
                  {copied ? 'コピー済み' : 'コピー'}
                </button>
              </div>
            </div>
            
            <div className="bg-[rgba(5,32,40,0.8)] border border-cyber-green/35 rounded-2xl p-6 text-left space-y-2 shadow-[0_0_24px_rgba(34,181,155,0.2)]">
              <h3 className="text-sm text-primary tracking-[0.3em] uppercase">ゲーム情報</h3>
              <div className="cyber-divider" />
              <div className="text-xs text-muted tracking-[0.25em] uppercase space-y-1">
                <p>ゲームが正常に保存されました</p>
                <p>あなたは鬼として参加しています</p>
                <p>他のプレイヤーにゲームIDを共有してください</p>
                <p>ゲーム開始するには「ゲーム開始」ボタンを押して下さい</p>
              </div>
            </div>
            
            <button
              onClick={handleStartGame}
              className="w-full btn-accent font-semibold py-3 px-4 rounded-xl uppercase tracking-[0.25em]"
            >
              ゲームを開始
            </button>
            
            <div className="text-[10px] text-muted tracking-[0.35em] uppercase space-y-1">
              <p>位置情報の使用に同意してください</p>
              <p>山手線内でのみプレイ可能です</p>
            </div>
          </div>
        </div>
      </SafeArea>
    );
  }

  return (
    <SafeArea className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center p-6 pt-safe-area pb-safe-area">
      <div className="absolute inset-0 opacity-35 blur-3xl pointer-events-none" aria-hidden>
        <div className="w-[18rem] h-[18rem] brand-gradient rounded-full absolute -top-24 -left-14 mix-blend-screen" />
        <div className="w-[20rem] h-[20rem] brand-gradient rounded-full absolute -bottom-20 -right-24 mix-blend-screen" />
      </div>
      <div className="max-w-2xl w-full cyber-card rounded-3xl border border-cyber-green/30 shadow-[0_0_50px_rgba(34,181,155,0.18)] p-8 relative">
        {isBusy && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl bg-[rgba(1,10,14,0.75)] backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" aria-hidden />
            <p className="mt-4 text-xs text-cyber-green tracking-[0.3em] uppercase">作成中...</p>
          </div>
        )}
        <div className="absolute inset-x-8 -top-1 h-1 bg-gradient-to-r from-cyber-green via-cyber-glow to-cyber-pink rounded-full shadow-[0_0_18px_rgba(95,251,241,0.5)]" />
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
          <span className="text-xs text-muted uppercase tracking-[0.4em]">Create Session</span>
        </div>
        
        <h1 className="text-3xl font-semibold text-primary text-center mb-2 tracking-[0.4em] uppercase">
          ゲームを作成
        </h1>
        <p className="text-xs text-muted text-center mb-10 tracking-[0.3em] uppercase">
          Launch The Yamago Arena
        </p>

        <form onSubmit={handleCreateGame} className="space-y-6">
          <div>
            <label htmlFor="nickname" className="block text-xs uppercase tracking-[0.3em] text-muted mb-2">
              ニックネーム
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[rgba(3,22,27,0.85)] border border-cyber-green/40 text-app placeholder:text-cyber-green/45 focus:outline-none focus:ring-2 focus:ring-cyber-green/60 focus:border-cyber-green/60 transition-all"
              placeholder="あなたのニックネーム"
              maxLength={20}
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
            className="w-full btn-primary disabled:opacity-60 disabled:cursor-not-allowed font-semibold py-3 px-4 rounded-full uppercase tracking-[0.25em]"
          >
            {isLoading ? '作成中...' : 'ゲームを作成'}
          </button>
        </form>

        <div className="mt-10 text-[10px] text-muted text-center tracking-[0.35em] uppercase space-y-1">
          <p>ゲーム作成者は鬼になります</p>
          <p>位置情報の使用に同意してください</p>
          <p>山手線内でのみプレイ可能です</p>
          <p>ゲーム開始30分後に鬼が有効化されます</p>
        </div>
      </div>
    </SafeArea>
  );
}
