'use client';

import { useState, useEffect } from 'react';
import { getGame, updateGame, Game, reconcilePinsWithTargetCount } from '@/lib/game';
import PinLocationEditor from './PinLocationEditor';

interface GameSettingsViewProps {
  gameId: string;
  onBack: () => void;
  onPinEditModeChange?: (isEditing: boolean) => void;
}

export default function GameSettingsView({ gameId, onBack, onPinEditModeChange }: GameSettingsViewProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Settings state
  const [captureRadiusM, setCaptureRadiusM] = useState<number>(100);
  const [runnerSeeKillerRadiusM, setRunnerSeeKillerRadiusM] = useState<number>(3000);
  const [killerDetectRunnerRadiusM, setKillerDetectRunnerRadiusM] = useState<number>(500);
  const [killerSeeGeneratorRadiusM, setKillerSeeGeneratorRadiusM] = useState<number>(3000);
  const [pinCount, setPinCount] = useState<number>(10);
  const [countdownMinutes, setCountdownMinutes] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(20);
  const [gameDurationMinutes, setGameDurationMinutes] = useState<number>(120);
  const isBusy = isSaving;
  const [isEditingPins, setIsEditingPins] = useState(false);

  useEffect(() => {
    return () => {
      onPinEditModeChange?.(false);
    };
  }, [onPinEditModeChange]);

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
        const runnerVisibilityRadius = Math.max(100, Math.min(10000, gameData.runnerSeeKillerRadiusM ?? 3000));
        setRunnerSeeKillerRadiusM(runnerVisibilityRadius);
        setKillerDetectRunnerRadiusM(gameData.killerDetectRunnerRadiusM || 500);
        const killerSeeRadius = Math.max(100, Math.min(10000, gameData.killerSeeGeneratorRadiusM ?? 3000));
        setKillerSeeGeneratorRadiusM(killerSeeRadius);
        const savedPinCount = Math.max(1, Math.min(20, gameData.pinCount ?? 10));
        setPinCount(savedPinCount);
        
        // Convert countdownDurationSec to minutes and seconds
        const totalSeconds = gameData.countdownDurationSec || 900;
        setCountdownMinutes(Math.floor(totalSeconds / 60));
        setCountdownSeconds(totalSeconds % 60);

        const totalGameDurationSec = gameData.gameDurationSec ?? 7200;
        setGameDurationMinutes(Math.floor(totalGameDurationSec / 60));
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
      const previousPinCount = game?.pinCount ?? pinCount;
      
      // Convert minutes and seconds to total seconds
      const totalCountdownSeconds = countdownMinutes * 60 + countdownSeconds;
      const clampedPinCount = Math.max(1, Math.min(20, pinCount));
      const clampedRunnerSeeKillerRadiusM = Math.max(100, Math.min(10000, runnerSeeKillerRadiusM));
      const clampedKillerSeeGeneratorRadiusM = Math.max(100, Math.min(10000, killerSeeGeneratorRadiusM));
      const clampedGameDurationMinutes = Math.max(10, Math.min(480, gameDurationMinutes));
      
      await updateGame(gameId, {
        captureRadiusM,
        runnerSeeKillerRadiusM: clampedRunnerSeeKillerRadiusM,
        killerSeeGeneratorRadiusM: clampedKillerSeeGeneratorRadiusM,
        killerDetectRunnerRadiusM,
        pinCount: clampedPinCount,
        countdownDurationSec: totalCountdownSeconds,
        gameDurationSec: clampedGameDurationMinutes * 60
      });

      if (previousPinCount !== clampedPinCount) {
        await reconcilePinsWithTargetCount(gameId, clampedPinCount);
      }

      setGame((prev) =>
        prev
          ? {
              ...prev,
              pinCount: clampedPinCount,
              captureRadiusM,
              runnerSeeKillerRadiusM: clampedRunnerSeeKillerRadiusM,
              killerSeeGeneratorRadiusM: clampedKillerSeeGeneratorRadiusM,
              killerDetectRunnerRadiusM,
              countdownDurationSec: totalCountdownSeconds,
              gameDurationSec: clampedGameDurationMinutes * 60,
            }
          : prev
      );
      
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
      <div className="h-full bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyber-green mx-auto mb-6"></div>
          <p className="text-muted uppercase tracking-[0.3em]">ゲーム設定を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (isEditingPins) {
    return (
      <PinLocationEditor
        gameId={gameId}
        onBack={() => {
          setIsEditingPins(false);
          onPinEditModeChange?.(false);
        }}
      />
    );
  }

  const formatGameDurationLabel = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}時間`);
    }

    if (mins > 0) {
      parts.push(`${mins}分`);
    }

    if (parts.length === 0) {
      parts.push('0分');
    }

    return parts.join(' ');
  };

  const formatDistanceLabel = (meters: number) => {
    if (meters >= 1000) {
      const km = meters / 1000;
      return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
    }
    return `${meters}m`;
  };

  return (
    <div className="h-full bg-app flex flex-col relative">
      {isBusy && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(1,10,14,0.75)] backdrop-blur-sm">
          <div className="h-12 w-12 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" aria-hidden />
          <p className="mt-4 text-xs text-cyber-green tracking-[0.3em] uppercase">保存中...</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-[rgba(3,22,27,0.96)] border-b border-cyber-green/35 p-5 flex-shrink-0 flex items-center justify-between shadow-[0_6px_24px_rgba(4,12,24,0.4)]">
        <button
          onClick={onBack}
          className="btn-surface inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs tracking-[0.2em] disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="戻る"
          disabled={isBusy}
        >
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <h2 className="text-lg font-semibold text-primary uppercase tracking-[0.35em]">ゲーム設定</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-4 bg-[rgba(38,7,24,0.7)] border border-cyber-pink/50 rounded-2xl shadow-[0_0_20px_rgba(255,71,194,0.25)]">
            <p className="text-xs text-cyber-pink uppercase tracking-[0.3em]">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Pin Count */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">発電所の数</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">設置数: {pinCount}個</span>
                <span className="text-xs text-cyber-glow font-mono tracking-[0.3em]">{pinCount}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={pinCount}
                onChange={(e) => setPinCount(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyber-green disabled:cursor-not-allowed"
                disabled={isBusy}
                style={{
                  background: `linear-gradient(to right, rgba(34,181,155,0.9) 0%, rgba(34,181,155,0.9) ${((pinCount - 1) / 19) * 100}%, rgba(5,28,34,0.8) ${((pinCount - 1) / 19) * 100}%, rgba(5,28,34,0.8) 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em]">
                <span>1</span>
                <span>20</span>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                ゲーム開始時にマップへ配置される発電所（黄色ピン）の数です。1〜20個の範囲で設定できます（初期値: 10個）。
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPins(true);
                    onPinEditModeChange?.(true);
                  }}
                  className="btn-surface w-full rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition-colors hover:border-cyber-green/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                >
                  発電所の場所を変更
                </button>
                <p className="mt-2 text-[10px] text-muted leading-relaxed tracking-[0.2em]">
                  現在配置されている発電所のピンのみを表示し、ドラッグ&ドロップで位置を調整できます。
                </p>
              </div>
            </div>
          </div>

          {/* Game Duration */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">ゲーム時間</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">
                  長さ: {formatGameDurationLabel(gameDurationMinutes)}
                </span>
                <span className="text-xs text-cyber-glow font-mono tracking-[0.3em]">
                  {gameDurationMinutes}分
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={480}
                step={5}
                value={gameDurationMinutes}
                onChange={(e) => setGameDurationMinutes(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyber-green disabled:cursor-not-allowed"
                disabled={isBusy}
                style={{
                  background: `linear-gradient(to right, rgba(34,181,155,0.9) 0%, rgba(34,181,155,0.9) ${((gameDurationMinutes - 10) / 470) * 100}%, rgba(5,28,34,0.8) ${((gameDurationMinutes - 10) / 470) * 100}%, rgba(5,28,34,0.8) 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em]">
                <span>10分</span>
                <span>8時間</span>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                ゲーム開始から終了までの制限時間です。10分〜8時間の範囲で設定できます（初期値: 2時間）。
              </p>
            </div>
          </div>

          {/* Capture Radius */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">捕獲半径</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">半径: {captureRadiusM}m</span>
                <span className="text-xs text-cyber-glow font-mono tracking-[0.3em]">{captureRadiusM}m</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={captureRadiusM}
                onChange={(e) => setCaptureRadiusM(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyber-pink disabled:cursor-not-allowed"
                disabled={isBusy}
                style={{
                  background: `linear-gradient(to right, rgba(255,71,194,0.9) 0%, rgba(255,71,194,0.9) ${((captureRadiusM - 10) / 190) * 100}%, rgba(5,28,34,0.8) ${((captureRadiusM - 10) / 190) * 100}%, rgba(5,28,34,0.8) 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em]">
                <span>10m</span>
                <span>200m</span>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                鬼が逃走者を捕獲できる距離を設定します。
              </p>
            </div>
          </div>

          {/* Runner visibility radius for killers */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">逃走者が発電所を視認できる距離</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">
                  半径: {formatDistanceLabel(runnerSeeKillerRadiusM)}
                </span>
                <span className="text-xs text-cyber-glow font-mono tracking-[0.3em]">
                  {formatDistanceLabel(runnerSeeKillerRadiusM)}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="50"
                value={runnerSeeKillerRadiusM}
                onChange={(e) => setRunnerSeeKillerRadiusM(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyber-green disabled:cursor-not-allowed"
                disabled={isBusy}
                style={{
                  background: `linear-gradient(to right, rgba(34,181,155,0.9) 0%, rgba(34,181,155,0.9) ${((runnerSeeKillerRadiusM - 100) / 9900) * 100}%, rgba(5,28,34,0.8) ${((runnerSeeKillerRadiusM - 100) / 9900) * 100}%, rgba(5,28,34,0.8) 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em]">
                <span>100m</span>
                <span>10km</span>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                逃走者から見える発電所の最大距離を設定します（初期値: 3km）。
              </p>
            </div>
          </div>

          {/* Killer visibility radius for generators */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">鬼が発電所を検知できる距離</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">
                  半径: {formatDistanceLabel(killerSeeGeneratorRadiusM)}
                </span>
                <span className="text-xs text-cyber-glow font-mono tracking-[0.3em]">
                  {formatDistanceLabel(killerSeeGeneratorRadiusM)}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="50"
                value={killerSeeGeneratorRadiusM}
                onChange={(e) => setKillerSeeGeneratorRadiusM(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyber-pink disabled:cursor-not-allowed"
                disabled={isBusy}
                style={{
                  background: `linear-gradient(to right, rgba(255,71,194,0.9) 0%, rgba(255,71,194,0.9) ${((killerSeeGeneratorRadiusM - 100) / 9900) * 100}%, rgba(5,28,34,0.8) ${((killerSeeGeneratorRadiusM - 100) / 9900) * 100}%, rgba(5,28,34,0.8) 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em]">
                <span>100m</span>
                <span>10km</span>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                鬼がレーダーで検知できる発電所の最大距離です（初期値: 3km）。
              </p>
            </div>
          </div>

          {/* Killer detection radius for runners */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">鬼が逃走者を検知できる距離</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">半径: {killerDetectRunnerRadiusM}m</span>
                <span className="text-xs text-cyber-glow font-mono tracking-[0.3em]">{killerDetectRunnerRadiusM}m</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="10"
                value={killerDetectRunnerRadiusM}
                onChange={(e) => setKillerDetectRunnerRadiusM(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyber-pink disabled:cursor-not-allowed"
                disabled={isBusy}
                style={{
                  background: `linear-gradient(to right, rgba(255,71,194,0.9) 0%, rgba(255,71,194,0.9) ${((killerDetectRunnerRadiusM - 50) / 950) * 100}%, rgba(5,28,34,0.8) ${((killerDetectRunnerRadiusM - 50) / 950) * 100}%, rgba(5,28,34,0.8) 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-muted uppercase tracking-[0.3em]">
                <span>50m</span>
                <span>1000m</span>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                鬼が逃走者をマップ上で可視化できる最大距離を設定します（初期値: 500m）。
              </p>
            </div>
          </div>

          {/* Countdown Duration */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-[0.3em]">カウントダウン時間</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-[0.25em]">カウントダウン時間</span>
                <div className="flex items-center space-x-2">
                  <select
                    value={countdownMinutes}
                    onChange={(e) => setCountdownMinutes(Number(e.target.value))}
                    className="px-3 py-2 border border-cyber-green/35 bg-[rgba(3,22,27,0.85)] text-app rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-cyber-green/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isBusy}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={`m-${i}`} value={i}>{i}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted uppercase tracking-[0.25em]">分</span>
                  <select
                    value={countdownSeconds}
                    onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                    className="px-3 py-2 border border-cyber-green/35 bg-[rgba(3,22,27,0.85)] text-app rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-cyber-green/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isBusy}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={`s-${i}`} value={i}>{i}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted uppercase tracking-[0.25em]">秒</span>
                </div>
              </div>
              <div className="text-xs text-muted bg-[rgba(5,32,40,0.75)] border border-cyber-green/30 p-4 rounded-xl">
                <p className="tracking-[0.25em] uppercase">合計: {countdownMinutes * 60 + countdownSeconds} 秒 ({countdownMinutes}分{countdownSeconds}秒)</p>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed tracking-[0.2em] uppercase">
                ゲーム開始ボタンを押してからカウントダウンが終了するまでの時間です。
              </p>
            </div>
          </div>


          {/* Save Button */}
          <div className="bg-[rgba(3,22,27,0.92)] border border-cyber-green/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(34,181,155,0.18)]">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full btn-accent disabled:opacity-60 disabled:cursor-not-allowed font-semibold py-3 px-6 rounded-full uppercase tracking-[0.3em]"
            >
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
