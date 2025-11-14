'use client';

import { useState, useEffect, useRef } from 'react';
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
import { getPlayer, subscribeToPlayers, type Player } from '../lib/game';

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
  const [playersByUid, setPlayersByUid] = useState<Record<string, Player>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Subscribe to chat messages from Firestore (single channel based on role)
  useEffect(() => {
    if (!gameId || !playerRole) return;

    // Get Firebase services (client-side only)
    const { db } = getFirebaseServices();
    if (!db) return;

    const channel = playerRole; // 'oni' or 'runner'
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'games', gameId, `messages_${channel}`), orderBy('timestamp', 'asc')),
      (snapshot) => {
        const channelMessages: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          channelMessages.push({
            id: doc.id,
            uid: data.uid,
            nickname: data.nickname,
            message: data.message,
            timestamp: data.timestamp,
            type: data.type || 'user',
            role: channel
          });
        });
        
        setMessages(channelMessages);
      },
      (error) => console.error(`Error fetching ${channel} messages:`, error)
    );

    return () => {
      unsubscribe();
    };
  }, [gameId, playerRole]);

  useEffect(() => {
    if (!gameId) return;

    const unsubscribe = subscribeToPlayers(gameId, (players) => {
      const mapped = players.reduce<Record<string, Player>>((acc, player) => {
        acc[player.uid] = player;
        return acc;
      }, {});
      setPlayersByUid(mapped);
    });

    return () => {
      unsubscribe();
    };
  }, [gameId]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !playerRole) return;

    // Get Firebase services (client-side only)
    const { db } = getFirebaseServices();
    if (!db) return;

    setIsLoading(true);
    
    try {
      const messagesRef = collection(db, 'games', gameId, `messages_${playerRole}`);
      await addDoc(messagesRef, {
        uid: currentUser.uid,
        nickname: currentUser.nickname,
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        type: 'user',
        role: playerRole
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while fetching player role
  if (playerRole === null) {
    return (
      <div className="flex flex-col h-[100dvh] bg-app items-center justify-center pt-safe-area pb-safe-area">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyber-green"></div>
        <p className="mt-4 text-muted uppercase tracking-[0.3em]">チャットを読み込み中...</p>
      </div>
    );
  }

  // Only show chat for players with valid roles
  if (playerRole !== 'oni' && playerRole !== 'runner') {
    return null;
  }

  const headerTheme =
    playerRole === 'oni'
      ? 'bg-gradient-to-r from-cyber-pink/95 via-cyber-purple/90 to-cyber-pink/85 border-cyber-pink/50 shadow-[0_6px_24px_rgba(138,31,189,0.35)]'
      : 'bg-gradient-to-r from-cyber-green/95 via-cyber-glow/90 to-cyber-green/90 border-cyber-green/55 shadow-[0_6px_24px_rgba(34,181,155,0.35)]';
  const sendButtonClass = playerRole === 'oni' ? 'btn-accent' : 'btn-primary';
  const myBubbleTheme =
    playerRole === 'oni'
      ? 'bg-gradient-to-r from-cyber-pink to-cyber-purple text-white shadow-[0_0_18px_rgba(255,71,194,0.45)]'
      : 'bg-gradient-to-r from-cyber-green to-cyber-glow text-[#031f1a] shadow-[0_0_18px_rgba(95,251,241,0.45)]';
  const otherBubbleTheme = 'bg-[rgba(3,22,27,0.85)] border border-cyber-green/25 text-app shadow-[0_0_14px_rgba(34,181,155,0.2)]';
  const systemBubbleTheme = 'bg-[rgba(138,31,189,0.18)] border border-cyber-purple/35 text-cyber-glow shadow-[0_0_16px_rgba(138,31,189,0.35)]';

  return (
    <main className="flex flex-col h-full min-h-0 overflow-hidden bg-[rgba(3,22,27,0.94)] text-app pt-safe-area pb-safe-area">
      {/* Fixed Header */}
      <header
        className={`sticky top-0 z-20 px-4 py-4 border-b text-white uppercase tracking-[0.35em] ${headerTheme}`}
      >
        <h1 className="text-lg font-semibold">
          {playerRole === 'oni' ? '鬼チャット' : '逃走者チャット'}
        </h1>
      </header>

      {/* Scrollable Messages Container */}
      <section
        id="messages"
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-6"
      >
        <div className="space-y-3">
          {messages.map((message) => {
            const isCurrentUser = message.uid === currentUser.uid;
            const isUserMessage = message.type === 'user';
            const playerProfile = playersByUid[message.uid];
            const displayNickname = message.nickname || playerProfile?.nickname || '';
            const avatarUrl = playerProfile?.avatarUrl;

            return (
              <div
                key={message.id}
                className={`flex flex-col first:mt-0 ${isCurrentUser ? 'items-end' : 'items-start'}`}
              >
                {isUserMessage && (
                  <div
                    className={`flex items-center mb-1 gap-2 ${
                      isCurrentUser ? 'justify-end flex-row-reverse' : ''
                    }`}
                  >
                    <div className="w-7 h-7 bg-[rgba(3,22,27,0.8)] border border-cyber-green/35 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(34,181,155,0.25)] overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={`${displayNickname || 'ユーザー'}のアイコン`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src="/icons/default-avatar.svg"
                          alt="デフォルトアイコン"
                          className="w-5 h-5 opacity-80"
                        />
                      )}
                    </div>
                    {displayNickname && (
                      <span
                        className={`text-[10px] font-medium text-muted tracking-[0.25em] uppercase ${
                          isCurrentUser ? 'text-right' : ''
                        }`}
                      >
                        {displayNickname}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === 'system'
                      ? `${systemBubbleTheme} mx-auto`
                      : isCurrentUser
                      ? myBubbleTheme
                      : otherBubbleTheme
                  }`}
                >
                  <div className="text-sm leading-relaxed">{message.message}</div>
                </div>
                <div
                  className={`text-[10px] text-muted mt-1 tracking-[0.25em] uppercase ${
                    isCurrentUser ? 'text-right' : 'text-left'
                  }`}
                >
                  {message.timestamp?.toDate?.().toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit'
                  }) || '--:--'}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </section>

      {/* Fixed Message Input */}
      <footer
        className="sticky bottom-0 z-20 bg-[rgba(3,22,27,0.96)] backdrop-blur border-t border-cyber-green/30 px-3 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`${playerRole === 'oni' ? '鬼' : '逃走者'}チャットにメッセージを入力...`}
              className="w-full px-4 py-3 bg-[rgba(3,22,27,0.85)] border border-cyber-green/35 rounded-xl text-app placeholder:text-cyber-green/45 focus:outline-none focus:ring-2 focus:ring-cyber-green/60 focus:border-cyber-green/60 pr-14 transition-all"
              maxLength={200}
              disabled={isLoading}
              autoComplete="off"
            />
            {newMessage.length > 0 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] text-muted tracking-[0.3em] uppercase">
                {newMessage.length}/200
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !newMessage.trim()}
            className={`${sendButtonClass} disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-transform duration-200 flex items-center justify-center min-w-[80px] uppercase tracking-[0.3em]`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              '送信'
            )}
          </button>
        </form>
      </footer>
    </main>
  );
}
