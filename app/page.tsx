'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import SafeArea from '@/components/SafeArea';

export default function Home() {
  const [gameId, setGameId] = useState<string | null>(null);
  const buttonSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // URLパラメータからゲームIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('gameId');
    if (id) {
      setGameId(id);
    }
  }, []);
  
  useEffect(() => {
    // 初期画面のボタンで使う効果音を準備
    buttonSoundRef.current = new Audio('/sounds/button_sound.mp3');
    return () => {
      buttonSoundRef.current?.pause();
      buttonSoundRef.current = null;
    };
  }, []);

  const playButtonSound = () => {
    const audio = buttonSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.warn('Failed to play button sound:', error);
    });
  };

  const copyGameId = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
      alert('ゲームIDをコピーしました！');
    }
  };

  return (
    <SafeArea className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-30 blur-3xl pointer-events-none" aria-hidden>
        <div className="w-64 h-64 brand-gradient rounded-full absolute -top-16 -left-16 mix-blend-screen" />
        <div className="w-72 h-72 brand-gradient rounded-full absolute -bottom-24 -right-6 mix-blend-screen" />
      </div>
      <div className="max-w-md w-full cyber-card rounded-3xl border border-cyber-green/30 shadow-[0_0_40px_rgba(34,181,155,0.2)] p-8 text-center relative">
        <div className="absolute inset-x-6 -top-1 h-1 bg-gradient-to-r from-cyber-green via-cyber-glow to-cyber-pink rounded-full shadow-[0_0_16px_rgba(95,251,241,0.6)]" />
        <h1 className="text-4xl font-semibold tracking-widest text-primary drop-shadow-lg mb-3 uppercase">Yamago</h1>
        <p className="text-sm text-muted mb-8 tracking-[0.35em] uppercase">山手線リアル鬼ごっこ</p>
        
        {gameId && (
          <div className="mb-6 p-6 bg-[rgba(7,32,36,0.85)] border border-cyber-green/40 rounded-2xl shadow-[0_0_22px_rgba(34,181,155,0.25)] backdrop-blur">
            <div className="text-center">
              <div className="text-2xl mb-2">🎉</div>
              <h3 className="text-xl font-semibold text-primary mb-3 tracking-wide">ゲーム作成完了！</h3>
              <p className="text-xs text-muted mb-3 uppercase tracking-[0.3em]">ゲームID</p>
              <div className="flex items-center justify-center space-x-2 mb-3">
                <code className="bg-[rgba(0,20,24,0.85)] border border-cyber-green/40 px-4 py-2 rounded-lg text-lg font-mono text-cyber-glow shadow-[0_0_18px_rgba(34,181,155,0.35)]">
                  {gameId}
                </code>
                <button
                  onClick={copyGameId}
                  className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold shadow-[0_0_12px_rgba(34,181,155,0.4)]"
                >
                  コピー
                </button>
              </div>
              <p className="text-xs text-muted uppercase tracking-[0.2em]">他のプレイヤーにこのIDを共有してください</p>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <Link 
            href="/join"
            className="block w-full btn-accent py-3 px-6 rounded-full font-semibold"
            onClick={playButtonSound}
          >
            ゲームに参加
          </Link>
          
          <Link 
            href="/create"
            className="block w-full btn-primary py-3 px-6 rounded-full font-semibold"
            onClick={playButtonSound}
          >
            ゲームを作成
          </Link>
        </div>
        
        <div className="mt-8 text-xs text-muted tracking-[0.25em] space-y-1">
          <p className="uppercase">位置情報の使用に同意してください</p>
          <p className="uppercase">山手線内でのみプレイ可能です</p>
        </div>
      </div>
    </SafeArea>
  );
}
