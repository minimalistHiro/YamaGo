'use client';

import { useState } from 'react';

export type TabType = 'map' | 'chat' | 'settings';

interface BottomTabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function BottomTabNavigation({ activeTab, onTabChange }: BottomTabNavigationProps) {
  const tabs = [
    {
      id: 'map' as TabType,
      label: 'マップ',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      id: 'chat' as TabType,
      label: 'チャット',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    {
      id: 'settings' as TabType,
      label: '設定',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="bg-[rgba(3,22,27,0.92)] border-t border-cyber-green/30 backdrop-blur safe-area-pb shadow-[0_-10px_30px_rgba(4,12,24,0.55)]">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-cyber-green'
                : 'text-muted hover:text-cyber-green/80'
            }`}
          >
            <div
              className={`mb-1 transition-transform ${
                activeTab === tab.id ? 'text-cyber-green scale-110 drop-shadow-[0_0_8px_rgba(34,181,155,0.4)]' : 'text-muted'
              }`}
            >
              {tab.icon}
            </div>
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.35em] ${
                activeTab === tab.id ? 'text-cyber-green' : 'text-muted'
              }`}
            >
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <span className="mt-1 h-[2px] w-10 bg-gradient-to-r from-cyber-green via-cyber-glow to-cyber-green rounded-full shadow-[0_0_12px_rgba(95,251,241,0.6)]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
