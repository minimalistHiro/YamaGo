'use client';

import type { ReactNode } from 'react';

type GameLayoutProps = {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared shell for in-game screens.
 * Handles safe-area padding plus a fixed header/footer and a flexible content area.
 */
export default function GameLayout({
  header,
  footer,
  children,
  className = '',
  contentClassName = '',
}: GameLayoutProps) {
  return (
    <div
      className={`flex h-[100dvh] flex-col bg-app text-app ${className}`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex-shrink-0">{header}</div>
      <div className={`flex-1 min-h-0 ${contentClassName}`}>{children}</div>
      {footer && (
        <div
          className="flex-shrink-0"
          style={{ marginBottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))' }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
