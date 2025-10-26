'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  query, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase/client';
import { getPlayer } from '../lib/game';

interface ChatMessage {
  id: string;
  uid: string;
  nickname: string;
  message: string;
  timestamp: Timestamp;
  type: 'user' | 'system';
  role: 'oni' | 'runner';
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
  const [playerRole, setPlayerRole] = useState<'oni' | 'runner' | null>(null);
  const [activeTab, setActiveTab] = useState<'oni' | 'runner'>('oni');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Layout constants
  const HEADER_HEIGHT = 56;
  const TAB_HEIGHT = 44;
  const INPUT_HEIGHT = 52;
  const TABBAR_HEIGHT = 60;

  // Get player role
  useEffect(() => {
    const fetchPlayerRole = async () => {
      if (!gameId || !currentUser.uid) return;
      
      try {
        const player = await getPlayer(gameId, currentUser.uid);
        if (player) {
          setPlayerRole(player.role);
        }
      } catch (error) {
        console.error('Error fetching player role:', error);
      }
    };

    fetchPlayerRole();
  }, [gameId, currentUser.uid]);

  // Subscribe to chat messages from Firestore (both roles)
  useEffect(() => {
    if (!gameId) return;

    // Get Firebase services (client-side only)
    const { db } = getFirebaseServices();
    if (!db) return;

    const unsubscribeOni = onSnapshot(
      query(collection(db, 'games', gameId, 'messages_oni'), orderBy('timestamp', 'asc')),
      (snapshot) => {
        const oniMessages: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          oniMessages.push({
            id: doc.id,
            uid: data.uid,
            nickname: data.nickname,
            message: data.message,
            timestamp: data.timestamp,
            type: data.type || 'user',
            role: 'oni'
          });
        });
        
        setMessages(prev => {
          const filtered = prev.filter(m => m.role !== 'oni');
          return [...filtered, ...oniMessages].sort((a, b) => 
            a.timestamp?.toMillis() - b.timestamp?.toMillis()
          );
        });
      },
      (error) => console.error('Error fetching oni messages:', error)
    );

    const unsubscribeRunner = onSnapshot(
      query(collection(db, 'games', gameId, 'messages_runner'), orderBy('timestamp', 'asc')),
      (snapshot) => {
        const runnerMessages: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          runnerMessages.push({
            id: doc.id,
            uid: data.uid,
            nickname: data.nickname,
            message: data.message,
            timestamp: data.timestamp,
            type: data.type || 'user',
            role: 'runner'
          });
        });
        
        setMessages(prev => {
          const filtered = prev.filter(m => m.role !== 'runner');
          return [...filtered, ...runnerMessages].sort((a, b) => 
            a.timestamp?.toMillis() - b.timestamp?.toMillis()
          );
        });
      },
      (error) => console.error('Error fetching runner messages:', error)
    );

    return () => {
      unsubscribeOni();
      unsubscribeRunner();
    };
  }, [gameId]);

  // Filter messages based on active tab
  const filteredMessages = useMemo(() => {
    return messages.filter(message => message.role === activeTab);
  }, [messages, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Get Firebase services (client-side only)
    const { db } = getFirebaseServices();
    if (!db) return;

    setIsLoading(true);
    
    try {
      const messagesRef = collection(db, 'games', gameId, `messages_${activeTab}`);
      await addDoc(messagesRef, {
        uid: currentUser.uid,
        nickname: currentUser.nickname,
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        type: 'user',
        role: activeTab
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while fetching player role
  if (playerRole === null) {
    return (
      <div className="flex flex-col h-full bg-gray-50 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        <p className="mt-2 text-gray-600">チャットを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-white flex flex-col">
      {/* Fixed Header */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur border-b border-gray-200 z-40">
        <div className="flex items-center justify-center px-4 py-3">
          <span className={`px-4 py-2 rounded-full text-white font-medium text-sm ${
            playerRole === 'oni' 
              ? 'bg-red-500' 
              : 'bg-green-500'
          }`}>
            {playerRole === 'oni' ? '鬼' : '逃走者'}
          </span>
        </div>
      </header>

      {/* Fixed Top Tabs */}
      <div 
        className="flex-shrink-0 bg-white border-b border-gray-200 z-30"
        style={{ height: TAB_HEIGHT }}
      >
        <div className="flex h-full">
          <button
            onClick={() => setActiveTab('oni')}
            className={`flex-1 flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'oni'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            鬼チャット
          </button>
          <button
            onClick={() => setActiveTab('runner')}
            className={`flex-1 flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'runner'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            逃走者チャット
          </button>
        </div>
      </div>

      {/* Scrollable Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent',
          paddingTop: HEADER_HEIGHT + TAB_HEIGHT,
        }}
      >
        <div className="p-4 space-y-3">
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.uid === currentUser.uid ? 'items-end' : 'items-start'
              }`}
            >
              {message.uid !== currentUser.uid && message.type === 'user' && (
                <div className="flex items-center mb-1">
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                    <span className="text-xs font-medium text-gray-600">
                      {message.nickname.charAt(0)}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {message.nickname}
                  </span>
                </div>
              )}
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'system'
                    ? 'bg-yellow-100 text-yellow-800 mx-auto'
                    : message.uid === currentUser.uid
                    ? message.role === 'oni'
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <div className="text-sm">{message.message}</div>
              </div>
              <div className={`text-xs text-gray-500 mt-1 ${
                message.uid === currentUser.uid ? 'text-right' : 'text-left'
              }`}>
                {message.timestamp?.toDate?.().toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) || '--:--'}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Message Input */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur border-t border-gray-200 z-40">
        <div className="p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`${activeTab === 'oni' ? '鬼' : '逃走者'}チャットにメッセージを入力...`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                maxLength={200}
                disabled={isLoading}
                autoComplete="off"
              />
              {newMessage.length > 0 && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                  {newMessage.length}/200
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || !newMessage.trim()}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center min-w-[60px]"
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
    </div>
  );
}
