import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase/client';
import type { Player } from '@/lib/game';

type FinalRole = Player['role'] | null;

interface PersonalResult {
  loading: boolean;
  finalRole: FinalRole;
  captures: number;
  generatorsCleared: number;
  metricLabel: string | null;
  metricValue: number | null;
  metricUnit: string | null;
  roleLabel: string | null;
}

interface UsePersonalResultOptions {
  displayName?: string;
}

const ROLE_LABEL: Record<NonNullable<FinalRole>, string> = {
  oni: '鬼',
  runner: '逃走者'
};

export function usePersonalResult(
  gameId?: string | null,
  uid?: string | null,
  { displayName }: UsePersonalResultOptions = {}
): PersonalResult & { displayName: string | null } {
  const [state, setState] = useState<PersonalResult>({
    loading: Boolean(gameId && uid),
    finalRole: null,
    captures: 0,
    generatorsCleared: 0,
    metricLabel: null,
    metricValue: null,
    metricUnit: null,
    roleLabel: null
  });

  useEffect(() => {
    if (!gameId || !uid) {
      setState((prev) => ({
        ...prev,
        loading: false,
        finalRole: null,
        captures: 0,
        generatorsCleared: 0,
        metricLabel: null,
        metricValue: null,
        metricUnit: null,
        roleLabel: null
      }));
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const { db } = getFirebaseServices();
    const playerRef = doc(db, 'games', gameId, 'players', uid);
    unsubscribe = onSnapshot(
      playerRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({
            loading: false,
            finalRole: null,
            captures: 0,
            generatorsCleared: 0,
            metricLabel: null,
            metricValue: null,
            metricUnit: null,
            roleLabel: null
          });
          return;
        }

        const data = snapshot.data() as Player;
        const finalRole = data?.role ?? null;
        const captures = data?.stats?.captures ?? 0;
        const generatorsCleared = data?.stats?.generatorsCleared ?? 0;

        const { metricLabel, metricValue, metricUnit } = (() => {
          if (finalRole === 'oni') {
            return {
              metricLabel: '捕獲数',
              metricValue: captures,
              metricUnit: '人'
            };
          }
          if (finalRole === 'runner') {
            return {
              metricLabel: '発電機解除数',
              metricValue: generatorsCleared,
              metricUnit: '台'
            };
          }
          return {
            metricLabel: null,
            metricValue: null,
            metricUnit: null
          };
        })();

        setState({
          loading: false,
          finalRole,
          captures,
          generatorsCleared,
          metricLabel,
          metricValue,
          metricUnit,
          roleLabel: finalRole ? ROLE_LABEL[finalRole] : null
        });
      },
      (error) => {
        console.error('Failed to load personal result:', error);
        setState({
          loading: false,
          finalRole: null,
          captures: 0,
          generatorsCleared: 0,
          metricLabel: null,
          metricValue: null,
          metricUnit: null,
          roleLabel: null
        });
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [gameId, uid]);

  const resolvedDisplayName = useMemo(() => {
    if (displayName) return displayName;
    return uid ? 'あなた' : null;
  }, [displayName, uid]);

  return {
    ...state,
    displayName: resolvedDisplayName
  };
}
