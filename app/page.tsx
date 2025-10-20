'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    // URLパラメータからゲームIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('gameId');
    if (id) {
      setGameId(id);
    }
  }, []);

  const copyGameId = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
      alert('ゲームIDをコピーしました！');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Yamago</h1>
        <p className="text-gray-600 mb-8">山手線リアル鬼ごっこ</p>
        
        {gameId && (
          <div className="mb-6 p-6 bg-green-50 border-2 border-green-300 rounded-lg shadow-md">
            <div className="text-center">
              <div className="text-2xl mb-2">🎉</div>
              <h3 className="text-xl font-bold text-green-800 mb-3">ゲーム作成完了！</h3>
              <p className="text-sm text-green-700 mb-3">ゲームID:</p>
              <div className="flex items-center justify-center space-x-2 mb-3">
                <code className="bg-white border border-green-300 px-4 py-2 rounded-lg text-lg font-mono text-gray-800 shadow-sm">{gameId}</code>
                <button
                  onClick={copyGameId}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  コピー
                </button>
              </div>
              <p className="text-sm text-green-600 font-medium">他のプレイヤーにこのIDを共有してください</p>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <Link 
            href="/join"
            className="block w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            ゲームに参加
          </Link>
          
          <Link 
            href="/create"
            className="block w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            ゲームを作成
          </Link>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>位置情報の使用に同意してください</p>
          <p>山手線内でのみプレイ可能です</p>
        </div>
      </div>
    </div>
  );
}
