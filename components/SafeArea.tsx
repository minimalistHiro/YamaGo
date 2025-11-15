import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type SafeAreaProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
};

type CleanupFn = () => void;

let activePolyfillCount = 0;
let detachPolyfill: CleanupFn | null = null;
type SafeAreaValues = { top: string; right: string; bottom: string; left: string };
let initialSafeAreaValues: SafeAreaValues | null = null;

const getInitialSafeAreaValues = (): SafeAreaValues => {
  if (initialSafeAreaValues) return initialSafeAreaValues;
  if (typeof window === 'undefined') {
    initialSafeAreaValues = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
    return initialSafeAreaValues;
  }

  const computed = window.getComputedStyle(document.documentElement);
  initialSafeAreaValues = {
    top: computed.getPropertyValue('--safe-area-top') || '0px',
    right: computed.getPropertyValue('--safe-area-right') || '0px',
    bottom: computed.getPropertyValue('--safe-area-bottom') || '0px',
    left: computed.getPropertyValue('--safe-area-left') || '0px',
  };
  return initialSafeAreaValues;
};

const applySafeAreaPolyfill = (): CleanupFn => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const root = document.documentElement;

  const updateVars = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const top = Math.max(viewport.offsetTop, 0);
    const left = Math.max(viewport.offsetLeft, 0);
    const bottom = Math.max(window.innerHeight - viewport.height - viewport.offsetTop, 0);
    const right = Math.max(window.innerWidth - viewport.width - viewport.offsetLeft, 0);

    const baseValues = getInitialSafeAreaValues();
    const resolveValue = (value: number, fallback: string) => {
      if (value > 0) return `${value}px`;
      return fallback.trim() || '0px';
    };

    root.style.setProperty('--safe-area-top', resolveValue(top, baseValues.top));
    root.style.setProperty('--safe-area-left', resolveValue(left, baseValues.left));
    root.style.setProperty('--safe-area-bottom', resolveValue(bottom, baseValues.bottom));
    root.style.setProperty('--safe-area-right', resolveValue(right, baseValues.right));
  };

  updateVars();

  const handleViewportChange = () => {
    updateVars();
  };

  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', handleViewportChange);
  viewport?.addEventListener('scroll', handleViewportChange);

  return () => {
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('orientationchange', handleViewportChange);
    viewport?.removeEventListener('resize', handleViewportChange);
    viewport?.removeEventListener('scroll', handleViewportChange);
  };
};

const ensureSafeAreaPolyfill = () => {
  activePolyfillCount += 1;
  if (activePolyfillCount === 1) {
    detachPolyfill = applySafeAreaPolyfill();
  }

  return () => {
    activePolyfillCount = Math.max(activePolyfillCount - 1, 0);
    if (activePolyfillCount === 0 && detachPolyfill) {
      detachPolyfill();
      detachPolyfill = null;
    }
  };
};

export default function SafeArea({
  children,
  className = '',
  style,
  as: Component = 'div'
}: SafeAreaProps) {
  useEffect(() => {
    const detach = ensureSafeAreaPolyfill();
    return () => {
      detach();
    };
  }, []);

  const combinedClassName = ['safe-area', className].filter(Boolean).join(' ');
  return (
    <Component className={combinedClassName} style={style}>
      {children}
    </Component>
  );
}
