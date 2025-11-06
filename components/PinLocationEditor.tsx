'use client';

import { useEffect, useMemo, useState } from 'react';
import MapView from './MapView';
import { PinPoint, subscribeToPins, updatePinPosition, getGame } from '@/lib/game';

interface PinLocationEditorProps {
  gameId: string;
  onBack: () => void;
}

export default function PinLocationEditor({ gameId, onBack }: PinLocationEditorProps) {
  const [pins, setPins] = useState<PinPoint[]>([]);
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinTargetCount, setPinTargetCount] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPins(gameId, (nextPins) => {
      setPins(nextPins);
    });
    return () => {
      unsubscribe();
    };
  }, [gameId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const game = await getGame(gameId);
        if (!active) return;
        setPinTargetCount(game?.pinCount ?? null);
      } catch (e) {
        console.error('Failed to load game info for pin target count', e);
        if (active) {
          setPinTargetCount(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [gameId]);

  const handlePinDragStart = (pinId: string) => {
    setError(null);
    setPendingPinId(pinId);
  };

  const handlePinDragEnd = async (pinId: string, lat: number, lng: number) => {
    try {
      await updatePinPosition(gameId, pinId, lat, lng);
    } catch (e) {
      console.error('Failed to update pin location', e);
      setError('発電所の場所を保存できませんでした。再度お試しください。');
    } finally {
      setPendingPinId(null);
    }
  };

  const isPinCountResolved = pinTargetCount !== null;
  const configuredPinCount = isPinCountResolved ? Math.max(pinTargetCount ?? 0, 0) : pins.length;
  const displayPins = useMemo(() => {
    if (configuredPinCount <= 0) return [];
    if (pins.length <= configuredPinCount) return pins;
    return pins.slice(0, configuredPinCount);
  }, [pins, configuredPinCount]);

  const hiddenPinCount = isPinCountResolved ? Math.max(0, pins.length - configuredPinCount) : 0;
  const missingPinCount = isPinCountResolved ? Math.max(0, configuredPinCount - pins.length) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-app">
      <div className="bg-[rgba(3,22,27,0.96)] border-b border-cyber-green/35 p-5 flex-shrink-0 flex items-center justify-between shadow-[0_6px_24px_rgba(4,12,24,0.4)]">
        <button
          onClick={onBack}
          className="btn-surface inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs tracking-[0.2em]"
          aria-label="戻る"
        >
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <h2 className="text-lg font-semibold text-primary uppercase tracking-[0.35em]">
          発電所の場所を変更
        </h2>
      </div>

      <div className="relative flex-1 min-h-[360px]">
        <MapView
          pins={displayPins}
          players={[]}
          gameId={gameId}
          currentUserRole="runner"
          gameStatus="pending"
          isOwner={false}
          runnerSeeKillerRadiusM={0}
          runnerSeeGeneratorRadiusM={0}
          killerDetectRunnerRadiusM={0}
          captureRadiusM={0}
          pinTargetCount={configuredPinCount}
          pinEditingMode
          onPinDragStart={handlePinDragStart}
          onPinDragEnd={handlePinDragEnd}
        />

        {isPinCountResolved && configuredPinCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-cyber-green/40 bg-[rgba(3,22,27,0.88)] px-6 py-4 text-center shadow-[0_0_24px_rgba(34,181,155,0.25)]">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                発電所の数が 0 に設定されています
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted tracking-[0.2em]">
                ゲーム設定から 1 以上の発電所数を設定してください。
              </p>
            </div>
          </div>
        )}

        {isPinCountResolved && configuredPinCount > 0 && displayPins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-cyber-green/40 bg-[rgba(3,22,27,0.88)] px-6 py-4 text-center shadow-[0_0_24px_rgba(34,181,155,0.25)]">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                発電所のピンがまだ配置されていません
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted tracking-[0.2em]">
                ゲーム設定で発電所の数を変更すると自動でピンが生成されます。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[rgba(3,22,27,0.92)] border-t border-cyber-green/30 p-5 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-muted">
          <span>表示中のピン</span>
          <span className="text-primary font-semibold">
            {displayPins.length}
            {isPinCountResolved ? ` / ${configuredPinCount}` : ''} 箇所
          </span>
        </div>
        {isPinCountResolved && hiddenPinCount > 0 && (
          <p className="text-[10px] text-cyber-pink tracking-[0.2em]">
            設定された発電所数を超えるピンが存在するため、余分な {hiddenPinCount} 件は非表示にしています。
          </p>
        )}
        {isPinCountResolved && missingPinCount > 0 && hiddenPinCount === 0 && (
          <p className="text-[10px] text-cyber-gold tracking-[0.2em]">
            発電所の数に対して {missingPinCount} 件不足しています。ゲーム設定でピンの再配置を行ってください。
          </p>
        )}
        <p className="text-[11px] text-muted uppercase tracking-[0.3em]">
          ピンをドラッグ&ドロップして位置を調整できます。
        </p>
        <p className="text-[10px] text-muted tracking-[0.2em] leading-relaxed">
          位置の変更は自動的に保存されます。ゲーム開始前に参加者の集合場所や安全な位置に調整してください。
        </p>
        {pendingPinId && (
          <p className="text-[10px] text-cyber-green tracking-[0.3em] uppercase">
            位置を保存中...
          </p>
        )}
        {error && (
          <p className="text-[10px] text-cyber-pink tracking-[0.3em] uppercase">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
