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
  const [captureRadiusM, setCaptureRadiusM] = useState<number>(50);
  const [startDelaySec, setStartDelaySec] = useState<number>(1800);

  useEffect(() => {
    loadGameSettings();
  }, [gameId]);

  const loadGameSettings = async () => {
    try {
      setIsLoading(true);
      const gameData = await getGame(gameId);
      if (gameData) {
        setGame(gameData);
        setCaptureRadiusM(gameData.captureRadiusM || 50);
        setStartDelaySec(gameData.startDelaySec || 1800);
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
      
      await updateGame(gameId, {
        captureRadiusM,
        startDelaySec
      });
      
      alert('ゲーム設定を保存しました');
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

          {/* Start Delay */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-md font-medium text-gray-800 mb-4">ゲーム開始までの待機時間</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">待機時間</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="7200"
                    step="60"
                    value={startDelaySec}
                    onChange={(e) => setStartDelaySec(Math.max(0, Math.min(7200, Number(e.target.value))))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right font-mono"
                  />
                  <span className="text-gray-500">秒</span>
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <p>{Math.floor(startDelaySec / 60)}分{startDelaySec % 60}秒</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ゲーム開始ボタンを押してから実際にゲームが開始されるまでの待機時間です。
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

