'use client';

import { useState, useEffect } from 'react';

interface HUDProps {
  gameStatus: 'pending' | 'running' | 'ended';
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
  generatorsClearedCount = 0
}: HUDProps) {
  const [timeLeft, setTimeLeft] = useState(timeRemaining || 0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (timeRemaining !== undefined) {
      setTimeLeft(timeRemaining);
    }
  }, [timeRemaining]);

  useEffect(() => {
    if (gameStatus === 'running' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStatus, timeLeft]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
      <div className="space-y-3">
        {/* Header with toggle */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">
            {gameStatus === 'pending' && '待機中'}
            {gameStatus === 'running' && 'ゲーム中'}
            {gameStatus === 'ended' && '終了'}
          </h3>
          <button
            type="button"
            aria-label="カードを折りたたむ/展開"
            className="text-gray-500 hover:text-gray-700"
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
            {gameStatus === 'running' && timeLeft > 0 && (
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-red-600">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-gray-600">残り時間</div>
              </div>
            )}

            {/* Player Stats */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>参加者:</span>
                <span className="font-semibold">{playerCount}人</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">鬼:</span>
                <span className="font-semibold">{oniCount}人</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">逃走者:</span>
                <span className="font-semibold">{runnerCount}人</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 pl-2">
                <span>捕獲済み:</span>
                <span className="font-semibold">{runnerCapturedCount}人</span>
              </div>
            </div>

            {/* Generators */}
            <div className="border-t pt-2 space-y-1">
              <div className="text-sm font-medium text-yellow-500">発電所</div>
              <div className="flex justify-between text-xs text-gray-600 pl-2">
                <span>解除済み:</span>
                <span className="font-semibold">{generatorsClearedCount}箇所</span>
              </div>
            </div>

            {/* Personal Stats */}
            {(captures > 0 || capturedTimes > 0) && (
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>捕獲数:</span>
                  <span className="font-semibold text-red-600">{captures}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>捕獲された回数:</span>
                  <span className="font-semibold text-orange-600">{capturedTimes}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {gameStatus === 'pending' && onStartGame && (
                <button
                  onClick={onStartGame}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  ゲーム開始
                </button>
              )}
              
              {gameStatus === 'running' && onEndGame && (
                <button
                  onClick={onEndGame}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition-colors"
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
