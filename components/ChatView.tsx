'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  uid: string;
  nickname: string;
  message: string;
  timestamp: Date;
  type: 'user' | 'system';
}

interface ChatViewProps {
  gameId: string;
  currentUser: {
    uid: string;
    nickname: string;
  };
}

export default function ChatView({ gameId, currentUser }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock messages for now - in production this would connect to Firestore
  useEffect(() => {
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        uid: 'system',
        nickname: 'システム',
        message: 'ゲームが開始されました！',
        timestamp: new Date(),
        type: 'system'
      },
      {
        id: '2',
        uid: 'user1',
        nickname: 'プレイヤー1',
        message: 'みんな、頑張ろう！',
        timestamp: new Date(),
        type: 'user'
      }
    ];
    setMessages(mockMessages);
  }, [gameId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsLoading(true);
    
    // Mock sending message - in production this would save to Firestore
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      uid: currentUser.uid,
      nickname: currentUser.nickname,
      message: newMessage.trim(),
      timestamp: new Date(),
      type: 'user'
    };

    setMessages(prev => [...prev, newMsg]);
    setNewMessage('');
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800">ゲームチャット</h2>
        <p className="text-sm text-gray-600">プレイヤー同士でコミュニケーション</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.uid === currentUser.uid ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'system'
                  ? 'bg-yellow-100 text-yellow-800 mx-auto'
                  : message.uid === currentUser.uid
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              {message.type === 'user' && message.uid !== currentUser.uid && (
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {message.nickname}
                </div>
              )}
              <div className="text-sm">{message.message}</div>
              <div className="text-xs opacity-75 mt-1">
                {message.timestamp.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            maxLength={200}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !newMessage.trim()}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              '送信'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
