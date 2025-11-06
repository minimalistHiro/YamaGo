'use client';

import { useState, useEffect } from 'react';

interface HUDProps {
  gameStatus: 'pending' | 'countdown' | 'running' | 'ended';
  timeRemaining?: number;
  onStartGame?: () => void;
  onEndGame?: () => void;
  playerCount?: number;
  oniCount?: number;
  runnerCount?: number;
  captures?: number;
  capturedTimes?: number;
  runnerCapturedCount?: number;
  generatorsClearedCount?: number;
  pinTargetCount?: number;
}

export default function HUD({
  gameStatus,
  timeRemaining,
  onStartGame,
  onEndGame,
  playerCount = 0,
  oniCount = 0,
  runnerCount = 0,
  captures = 0,
  capturedTimes = 0,
  runnerCapturedCount = 0,
  generatorsClearedCount = 0,
  pinTargetCount,
}: HUDProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(timeRemaining ?? null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (timeRemaining !== undefined) {
      setTimeLeft(timeRemaining);
    } else {
      setTimeLeft(null);
    }
  }, [timeRemaining]);

  useEffect(() => {
    if (gameStatus === 'running' && timeLeft !== null && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null) return prev;
          return Math.max(0, prev - 1);
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStatus, timeLeft]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-4 right-4 bg-[rgba(3,22,27,0.92)] border border-cyber-green/40 rounded-2xl shadow-[0_18px_40px_rgba(4,12,24,0.65)] p-5 min-w-[220px] backdrop-blur">
      <div className="space-y-4">
        {/* Header with toggle */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm tracking-[0.3em] uppercase text-primary">
            {gameStatus === 'pending' && '待機中'}
            {gameStatus === 'countdown' && 'カウントダウン中'}
            {gameStatus === 'running' && 'ゲーム中'}
            {gameStatus === 'ended' && '終了'}
          </h3>
          <button
            type="button"
            aria-label="カードを折りたたむ/展開"
            className="text-muted hover:text-cyber-green transition-colors"
            onClick={() => setIsCollapsed((v) => !v)}
          >
            {isCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12 8.25a.75.75 0 01.53.22l6 6a.75.75 0 11-1.06 1.06L12 10.06l-5.47 5.47a.75.75 0 11-1.06-1.06l6-6a.75.75 0 01.53-.22z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12 15.75a.75.75 0 01-.53-.22l-6-6a.75.75 0 111.06-1.06L12 13.94l5.47-5.47a.75.75 0 111.06 1.06l-6 6a.75.75 0 01-.53.22z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {!isCollapsed && (
          <>
            {/* Timer */}
            {gameStatus === 'running' && timeLeft !== null && (
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-cyber-green drop-shadow-[0_0_12px_rgba(34,181,155,0.45)]">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-[10px] text-muted uppercase tracking-[0.3em] mt-1">残り時間</div>
              </div>
            )}

            {/* Player Stats */}
            <div className="space-y-3">
              <div className="flex justify-between text-[11px] text-muted uppercase tracking-[0.25em]">
                <span>参加者</span>
                <span className="font-semibold text-app">{playerCount}人</span>
              </div>
              <div className="flex justify-between text-[11px] uppercase tracking-[0.25em] text-cyber-pink">
                <span>鬼</span>
                <span className="font-semibold text-app">{oniCount}人</span>
              </div>
              <div className="flex justify-between text-[11px] uppercase tracking-[0.25em] text-cyber-green">
                <span>逃走者</span>
                <span className="font-semibold text-app">{runnerCount}人</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em] pl-2">
                <span>捕獲済み</span>
                <span className="font-semibold text-app">{runnerCapturedCount}人</span>
              </div>
            </div>

            {/* Generators */}
            <div className="cyber-divider" />
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.25em] text-app">
                <span className="text-cyber-gold">発電所</span>
                {pinTargetCount !== undefined && (
                  <span className="text-[10px] text-app font-semibold">{pinTargetCount}箇所</span>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em] pl-2">
                <span>解除済み</span>
                <span className="font-semibold text-app">{generatorsClearedCount}箇所</span>
              </div>
            </div>

            {/* Personal Stats */}
            {(captures > 0 || capturedTimes > 0) && (
              <div className="cyber-divider" />
            )}

            {(captures > 0 || capturedTimes > 0) && (
              <div className="pt-2 space-y-2">
                <div className="flex justify-between text-[11px] uppercase tracking-[0.25em]">
                  <span className="text-muted">捕獲数</span>
                  <span className="font-semibold text-cyber-pink">{captures}</span>
                </div>
                <div className="flex justify-between text-[11px] uppercase tracking-[0.25em]">
                  <span className="text-muted">捕獲された回数</span>
                  <span className="font-semibold text-cyber-gold">{capturedTimes}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {(gameStatus === 'pending' || gameStatus === 'ended') && onStartGame && (
                <button
                  onClick={onStartGame}
                  className="w-full btn-primary font-semibold py-2 px-4 rounded-lg uppercase tracking-[0.2em]"
                >
                  ゲーム開始
                </button>
              )}
              
              {gameStatus === 'running' && onEndGame && (
                <button
                  onClick={onEndGame}
                  className="w-full btn-accent font-semibold py-2 px-4 rounded-lg uppercase tracking-[0.2em]"
                >
                  ゲーム終了
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
