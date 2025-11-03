'use client';

import { useState, useEffect } from 'react';
import { getGame, updateGame, Game } from '@/lib/game';

interface GameSettingsViewProps {
  gameId: string;
  onBack: () => void;
}

export default function GameSettingsView({ gameId, onBack }: GameSettingsViewProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Settings state
  const [captureRadiusM, setCaptureRadiusM] = useState<number>(100);
  const [runnerSeeKillerRadiusM, setRunnerSeeKillerRadiusM] = useState<number>(200);
  const [killerDetectRunnerRadiusM, setKillerDetectRunnerRadiusM] = useState<number>(500);
  const [pinCount, setPinCount] = useState<number>(10);
  const [countdownMinutes, setCountdownMinutes] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(20);

  useEffect(() => {
    loadGameSettings();
  }, [gameId]);

  const loadGameSettings = async () => {
    try {
      setIsLoading(true);
      const gameData = await getGame(gameId);
      if (gameData) {
        setGame(gameData);
        setCaptureRadiusM(gameData.captureRadiusM || 100);
        setRunnerSeeKillerRadiusM(gameData.runnerSeeKillerRadiusM || 200);
        setKillerDetectRunnerRadiusM(gameData.killerDetectRunnerRadiusM || 500);
        const savedPinCount = Math.max(1, Math.min(20, gameData.pinCount ?? 10));
        setPinCount(savedPinCount);
        
        // Convert countdownDurationSec to minutes and seconds
        const totalSeconds = gameData.countdownDurationSec || 900;
        setCountdownMinutes(Math.floor(totalSeconds / 60));
        setCountdownSeconds(totalSeconds % 60);
      }
    } catch (err) {
      console.error('Error loading game settings:', err);
      setError('ゲーム設定の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      
      // Convert minutes and seconds to total seconds
      const totalCountdownSeconds = countdownMinutes * 60 + countdownSeconds;
      const clampedPinCount = Math.max(1, Math.min(20, pinCount));
      
      await updateGame(gameId, {
        captureRadiusM,
        runnerSeeKillerRadiusM,
        killerDetectRunnerRadiusM,
        pinCount: clampedPinCount,
        countdownDurationSec: totalCountdownSeconds
      });
      
      // Show success message then automatically return
      alert('ゲーム設定を保存しました');
      onBack();
    } catch (err) {
      console.error('Error saving game settings:', err);
      setError('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">ゲーム設定を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0 flex items-center">
        <button
          onClick={onBack}
          className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="戻る"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-800">ゲーム設定</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Pin Count */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-gray-800 mb-4">発電所の数</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">設置数: {pinCount}個</span>
                <span className="text-sm text-gray-500 font-mono">{pinCount}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={pinCount}
                onChange={(e) => setPinCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${((pinCount - 1) / 19) * 100}%, #e5e7eb ${((pinCount - 1) / 19) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1</span>
                <span>20</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ゲーム開始時にマップへ配置される発電所（黄色ピン）の数です。1〜20個の範囲で設定できます（初期値: 10個）。
              </p>
            </div>
          </div>

          {/* Capture Radius */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-gray-800 mb-4">捕獲半径</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">半径: {captureRadiusM}m</span>
                <span className="text-sm text-gray-500 font-mono">{captureRadiusM}m</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={captureRadiusM}
                onChange={(e) => setCaptureRadiusM(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${((captureRadiusM - 10) / 190) * 100}%, #e5e7eb ${((captureRadiusM - 10) / 190) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>10m</span>
                <span>200m</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                鬼が逃走者を捕獲できる距離を設定します。
              </p>
            </div>
          </div>

          {/* Runner visibility radius for killers */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-gray-800 mb-4">逃走者が鬼を視認できる距離</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">半径: {runnerSeeKillerRadiusM}m</span>
                <span className="text-sm text-gray-500 font-mono">{runnerSeeKillerRadiusM}m</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="10"
                value={runnerSeeKillerRadiusM}
                onChange={(e) => setRunnerSeeKillerRadiusM(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${((runnerSeeKillerRadiusM - 50) / 950) * 100}%, #e5e7eb ${((runnerSeeKillerRadiusM - 50) / 950) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>50m</span>
                <span>1000m</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                逃走者から見える鬼の最大距離を設定します（初期値: 200m）。
              </p>
            </div>
          </div>

          {/* Killer detection radius for runners */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-gray-800 mb-4">鬼が逃走者を検知できる距離</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">半径: {killerDetectRunnerRadiusM}m</span>
                <span className="text-sm text-gray-500 font-mono">{killerDetectRunnerRadiusM}m</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="10"
                value={killerDetectRunnerRadiusM}
                onChange={(e) => setKillerDetectRunnerRadiusM(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${((killerDetectRunnerRadiusM - 50) / 950) * 100}%, #e5e7eb ${((killerDetectRunnerRadiusM - 50) / 950) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>50m</span>
                <span>1000m</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                鬼が逃走者をマップ上で可視化できる最大距離を設定します（初期値: 500m）。
              </p>
            </div>
          </div>

          {/* Countdown Duration */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-gray-800 mb-4">カウントダウン時間</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">カウントダウン時間</span>
                <div className="flex items-center space-x-2">
                  <select
                    value={countdownMinutes}
                    onChange={(e) => setCountdownMinutes(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg font-mono bg-white"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={`m-${i}`} value={i}>{i}</option>
                    ))}
                  </select>
                  <span className="text-gray-500">分</span>
                  <select
                    value={countdownSeconds}
                    onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg font-mono bg-white"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={`s-${i}`} value={i}>{i}</option>
                    ))}
                  </select>
                  <span className="text-gray-500">秒</span>
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <p>合計: {countdownMinutes * 60 + countdownSeconds}秒 ({countdownMinutes}分{countdownSeconds}秒)</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ゲーム開始ボタンを押してからカウントダウンが終了するまでの時間です。
              </p>
            </div>
          </div>


          {/* Save Button */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
