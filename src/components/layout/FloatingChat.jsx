import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Users, User, ChevronDown, Search, Smile } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import EmojiPicker from 'emoji-picker-react';
import { isOnlyEmoji, formatDateSeparator } from '../../pages/Chat/ChatUtils';

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [roomListOpen, setRoomListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const lastMsgId = useRef(null);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { currentUser } = useAuth();
  const { activeRoom, setActiveRoom, rooms, messages, sendMessage, unreadRooms, markAsRead, onlineUsers, setIsChatUIActive } = useChat();

  useEffect(() => {
    setIsChatUIActive(isOpen);
    return () => setIsChatUIActive(false);
  }, [isOpen, setIsChatUIActive]);

  // Helper for DM Room ID Resolution
  const getActiveRoomId = (room) => {
    if (room.type === 'dm') {
      return [currentUser?.uid, room.id].sort().join('_');
    }
    return room.id;
  };
  
  const checkOnline = (room) => {
    if (!room.isOnline) return false;
    if (!room.lastSeen) return false;
    const lastSeen = room.lastSeen.toDate();
    const now = new Date();
    // Consider offline if last seen > 3 mins ago
    return (now - lastSeen) < 3 * 60 * 1000;
  };

  // Auto-scroll logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentMessages = messages.filter(m => m.roomId === getActiveRoomId(activeRoom));

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [currentMessages, isOpen]);

  // Click Outside logic
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        setIsOpen(false);
        setRoomListOpen(false);
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notification logic (Tracking only)
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      lastMsgId.current = latest.id;
    }
  }, [messages]);

  const toggleChat = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      markAsRead(getActiveRoomId(activeRoom));
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage(inputValue, activeRoom);
    setInputValue('');
    setShowEmoji(false);
  };

  const onEmojiClick = (emojiData) => {
    setInputValue(prev => prev + emojiData.emoji);
  };

  // Determine if a room should be shown in the list
  const shouldShowRoom = (room) => {
    if (room.id === 'general') return true;
    if (searchQuery.trim() !== '' && room.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    
    // Check if room has messages
    const roomId = getActiveRoomId(room);
    return messages.some(m => m.roomId === roomId);
  };

  const displayedRooms = rooms.filter(shouldShowRoom);

  return (
    <div style={{ position: 'fixed', bottom: isMobile ? '20px' : '24px', left: isMobile ? '20px' : '110px', zIndex: 1000 }} ref={chatRef}>
      {isOpen && (
        <div style={{
          width: isMobile ? 'calc(100vw - 40px)' : '320px',
          height: isMobile ? '450px' : '520px',
          backgroundColor: 'var(--surface)',
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border)'
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative'
          }}>
            <div 
              onClick={() => setRoomListOpen(!roomListOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 10px', backgroundColor: '#F0F2F5', borderRadius: '10px' }}
              className="hover:bg-gray-200"
            >
              <div style={{ position: 'relative' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', overflow: 'hidden' }}>
                  {activeRoom.photo_url ? <img src={activeRoom.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (activeRoom.type === 'group' ? '#' : (activeRoom.name ? activeRoom.name.charAt(0) : 'U'))}
                </div>
                {activeRoom.type === 'dm' && checkOnline(rooms.find(r => r.id === activeRoom.id) || activeRoom) && (
                  <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', backgroundColor: '#2ED47A', borderRadius: '50%', border: '1.5px solid white' }}></div>
                )}
              </div>
              <h4 style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{activeRoom.name}</h4>
              <ChevronDown size={14} className="text-secondary" />
            </div>

            {activeRoom.id === 'general' && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#2ED47A', backgroundColor: '#E5F6EB', padding: '2px 8px', borderRadius: '10px' }}>
                {onlineUsers.length} Online
              </span>
            )}
            
            <button onClick={toggleChat} className="icon-btn" style={{ padding: '4px' }}>
              <X size={18} />
            </button>

            {/* Room List Selection Menu */}
            {roomListOpen && (
              <div style={{
                position: 'absolute', top: '56px', left: '12px', right: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.98)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                borderRadius: '16px', padding: '12px', zIndex: 100, border: '1px solid var(--border)',
                maxHeight: '320px', overflowY: 'auto', backdropFilter: 'blur(10px)'
              }}>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                    placeholder="Cari nama tim..." 
                    value={searchQuery}
                    autoFocus
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', backgroundColor: '#F4F6F9' }}
                  />
                </div>

                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 8px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {searchQuery ? 'Hasil Pencarian' : 'Chat Aktif'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {displayedRooms.map(room => (
                    <div 
                      key={room.id}
                      onClick={() => { setActiveRoom(room); setRoomListOpen(false); setSearchQuery(''); markAsRead(getActiveRoomId(room)); }}
                      style={{ 
                        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                        backgroundColor: activeRoom.id === room.id ? 'var(--primary-soft)' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                      className="hover:bg-gray-100"
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: room.type === 'group' ? 'var(--primary-soft)' : '#E9ECEF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '14px', fontWeight: 600 }}>
                           {room.photo_url ? <img src={room.photo_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} /> : (room.type === 'group' ? '#' : (room.name ? room.name.charAt(0) : 'U'))}
                        </div>
                        {room.type === 'dm' && (
                          <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px', backgroundColor: checkOnline(room) ? '#2ED47A' : '#7A849C', borderRadius: '50%', border: '2px solid white' }}></div>
                        )}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: activeRoom.id === room.id ? 'var(--primary)' : 'var(--text-primary)' }}>{room.name}</span>
                      {unreadRooms.includes(getActiveRoomId(room)) && (
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#FF4D4F', borderRadius: '50%', marginLeft: 'auto' }}></div>
                      )}
                    </div>
                  ))}
                  {displayedRooms.length === 0 && (
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>Anggota tim tidak ditemukan.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Messages Area */}
          <div 
            onClick={() => { setRoomListOpen(false); setShowEmoji(false); }}
            style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F8F9FB' }}
          >
            {currentMessages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
                 <MessageCircle size={24} style={{ margin: '0 auto 8px' }} />
                 <p style={{ fontSize: '14px' }}>Kirim pesan pertamamu!</p>
              </div>
            ) : (
            currentMessages.map((msg, index) => {
              const msgDate = msg.timestamp?.toDate()?.toDateString();
              const prevMsgDate = index > 0 ? currentMessages[index - 1].timestamp?.toDate()?.toDateString() : null;
              const showDate = index === 0 || (msgDate && msgDate !== prevMsgDate);
              const showName = index === 0 || currentMessages[index - 1].senderId !== msg.senderId || showDate;
              const emojiOnly = isOnlyEmoji(msg.text);

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && msg.timestamp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)', opacity: 0.3 }}></div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          {formatDateSeparator(msg.timestamp, 'short')}
                        </span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)', opacity: 0.3 }}></div>
                      </div>
                    )}
                    <div style={{
                      alignSelf: msg.isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.isMe ? 'flex-end' : 'flex-start'
                    }}>
                      {!msg.isMe && showName && (
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px', marginLeft: '4px' }}>
                          {msg.sender}
                        </span>
                      )}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.isMe ? 'flex-end' : 'flex-start'
                      }}>
                        <div style={emojiOnly ? {
                          fontSize: '32px',
                          lineHeight: '1.2',
                        } : {
                          backgroundColor: msg.isMe ? 'var(--primary)' : 'white',
                          color: msg.isMe ? 'white' : 'var(--text-primary)',
                          padding: '10px 14px',
                          borderRadius: '16px',
                          borderBottomRightRadius: msg.isMe ? '4px' : '16px',
                          borderTopLeftRadius: !msg.isMe && showName ? '4px' : '16px',
                          borderBottomLeftRadius: !msg.isMe ? '4px' : '16px',
                          fontSize: '14px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          lineHeight: '1.4',
                          wordBreak: 'break-word'
                        }}>
                          {msg.text}
                        </div>
                        {msg.timestamp && (
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', padding: '0 4px' }}>
                            {msg.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', position: 'relative' }}>
            {showEmoji && (
              <div style={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 1000 }}>
                <EmojiPicker 
                  onEmojiClick={onEmojiClick} 
                  width={300} 
                  height={350} 
                  searchDisabled 
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
            <form onSubmit={handleSend} style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" onClick={() => setShowEmoji(!showEmoji)} style={{ color: showEmoji ? 'var(--primary)' : 'var(--text-secondary)' }} className="hover:text-primary">
                <Smile size={20} />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => { setRoomListOpen(false); setShowEmoji(false); }}
                placeholder="Ketik pesan..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: '100px', border: '1px solid var(--border)', outline: 'none', backgroundColor: '#F4F6F9', fontSize: '14px' }}
              />
              <button type="submit" style={{
                width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                backgroundColor: inputValue.trim() ? 'var(--primary)' : '#E9ECEF',
                color: inputValue.trim() ? 'white' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                cursor: inputValue.trim() ? 'pointer' : 'default'
              }}>
                <Send size={16} style={{ marginLeft: '-1px' }} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <div style={{ position: 'relative' }}>
        {!isOpen && (
          <button
            onClick={toggleChat}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(82, 0, 0, 0.25)',
              cursor: 'pointer',
              border: 'none',
              position: 'relative'
            }}
          >
            <MessageCircle size={28} />
            {unreadRooms.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '20px',
                height: '20px',
                backgroundColor: '#FF4D4F',
                color: 'white',
                borderRadius: '50%',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white'
              }}>
                {unreadRooms.size}
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default FloatingChat;
