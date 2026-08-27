import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Search, Settings, Phone, Video, Info, MessageCircle, Smile } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import EmojiPicker from 'emoji-picker-react';
import { isOnlyEmoji, formatDateSeparator, formatLastSeen } from './ChatUtils';

const Chat = () => {
  const { currentUser } = useAuth();
  const { activeRoom, setActiveRoom, rooms, messages, sendMessage, unreadRooms, onlineUsers, setIsChatUIActive } = useChat();

  useEffect(() => {
    setIsChatUIActive(true);
    return () => setIsChatUIActive(false);
  }, [setIsChatUIActive]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);

  const getActiveRoomId = (room) => {
    if (room.type === 'dm') {
      return [currentUser.uid, room.id].sort().join('_');
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

  const onEmojiClick = (emojiData) => {
    setInputValue(prev => prev + emojiData.emoji);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentMessages = messages.filter(m => m.roomId === getActiveRoomId(activeRoom));

  const currentRoomData = rooms.find(r => r.id === activeRoom.id) || activeRoom;

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, activeRoom]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage(inputValue, activeRoom);
    setInputValue('');
    setShowEmoji(false);
  };

  const filteredRooms = rooms.filter(r => {
    if (r.id === 'general') return true;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (searchQuery.trim() !== '') return matchesSearch;
    
    // Only show if has messages
    const roomId = getActiveRoomId(r);
    return messages.some(m => m.roomId === roomId);
  });
  
  const groupRooms = filteredRooms.filter(r => r.type === 'group');
  const dmRooms = filteredRooms.filter(r => r.type === 'dm');

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
      {/* Sidebar: Room List */}
      <div style={{ width: '320px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', backgroundColor: '#F8F9FB' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Messages</h2>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Cari chat atau teman..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', fontSize: '14px', outline: 'none' }} 
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          {groupRooms.length > 0 && (
            <>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 12px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Channels</p>
              {groupRooms.map(room => (
                <div 
                  key={room.id} 
                  onClick={() => { setActiveRoom(room); setSearchQuery(''); }}
                  style={{ 
                    padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px',
                    backgroundColor: activeRoom.id === room.id ? 'var(--primary-soft)' : 'transparent' 
                  }}
                  className="hover:bg-white"
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: activeRoom.id === room.id ? 'var(--primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeRoom.id === room.id ? 'white' : 'var(--primary)', fontWeight: 600 }}>
                    #
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: activeRoom.id === room.id ? 'var(--primary)' : 'var(--text-primary)', margin: 0 }}>{room.name}</h4>
                      {unreadRooms.includes(getActiveRoomId(room)) && activeRoom.id !== room.id && (
                        <div style={{ width: '10px', height: '10px', backgroundColor: '#FF4D4F', borderRadius: '50%' }}></div>
                      )}
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                      {messages.filter(m => m.roomId === getActiveRoomId(room)).slice(-1)[0]?.text || 'Belum ada pesan.'}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop: '24px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 12px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {searchQuery ? 'Hasil Pencarian' : 'Direct Messages'}
            </p>
            {dmRooms.map(room => (
              <div 
                key={room.id} 
                onClick={() => { setActiveRoom(room); setSearchQuery(''); }}
                style={{ 
                  padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px',
                  backgroundColor: activeRoom.id === room.id ? 'var(--primary-soft)' : 'transparent' 
                }}
                className="hover:bg-white"
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {room.photo_url ? <img src={room.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE', color: 'var(--primary)', fontWeight: 600 }}>{room.name.charAt(0)}</div>}
                  </div>
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', backgroundColor: checkOnline(room) ? '#2ED47A' : '#7A849C', borderRadius: '50%', border: '2px solid white' }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: activeRoom.id === room.id ? 'var(--primary)' : 'var(--text-primary)', margin: 0 }}>{room.name}</h4>
                    {unreadRooms.includes(getActiveRoomId(room)) && activeRoom.id !== room.id && (
                      <div style={{ width: '10px', height: '10px', backgroundColor: '#FF4D4F', borderRadius: '50%' }}></div>
                    )}
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                    {messages.filter(m => m.roomId === getActiveRoomId(room)).slice(-1)[0]?.text || 'Mulai obrolan...'}
                  </p>
                </div>
              </div>
            ))}
            {dmRooms.length === 0 && searchQuery && (
              <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '20px' }}>Staf tidak ditemukan.</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}
        onClick={() => { setSearchQuery(''); setShowEmoji(false); }}
      >
        {/* Chat Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: currentRoomData.type === 'group' ? '14px' : '50%', backgroundColor: '#F4F6F9', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentRoomData.type === 'group' ? <Users size={24} /> : <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary-soft)', fontSize: '18px', fontWeight: 600 }}>{currentRoomData.photo_url ? <img src={currentRoomData.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover'}} /> : currentRoomData.name.charAt(0)}</div>}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{currentRoomData.type === 'group' ? '#' : ''} {currentRoomData.name}</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {currentRoomData.type === 'group' ? `${onlineUsers.length} Orang Online` : (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: checkOnline(currentRoomData) ? '#2ED47A' : '#7A849C' }}></span>
                    {checkOnline(currentRoomData) ? 'Online Sekarang' : formatLastSeen(currentRoomData.lastSeen)}
                  </>
                )}
              </p>
            </div>
          </div>

          {currentRoomData.id === 'general' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                {onlineUsers.slice(0, 3).map((u, i) => (
                  <div key={u.id} style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', border: '2px solid white', 
                    marginLeft: i === 0 ? 0 : '-12px', overflow: 'hidden', backgroundColor: 'var(--primary-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--primary)'
                  }}>
                    {u.photo_url ? <img src={u.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.name.charAt(0)}
                  </div>
                ))}
                {onlineUsers.length > 3 && (
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', border: '2px solid white', 
                    marginLeft: '-12px', backgroundColor: '#F0F2F5', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600
                  }}>
                    +{onlineUsers.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#FAFBFC' }}>
          {currentMessages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <MessageCircle size={32} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Mulai Percakapan</h3>
              <p style={{ fontSize: '14px' }}>Kirim pesan sapaan pertama ke {activeRoom.name}.</p>
            </div>
          )}
          {currentMessages.map((msg, index) => {
            const msgDate = msg.timestamp?.toDate()?.toDateString();
            const prevMsgDate = index > 0 ? currentMessages[index - 1].timestamp?.toDate()?.toDateString() : null;
            const showDate = index === 0 || (msgDate && msgDate !== prevMsgDate);
            const showName = index === 0 || currentMessages[index - 1].senderId !== msg.senderId || showDate;
            const emojiOnly = isOnlyEmoji(msg.text);

            return (
              <React.Fragment key={msg.id}>
                {showDate && msg.timestamp && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '12px 0' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)', opacity: 0.5 }}></div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: '#F0F2F5', padding: '4px 12px', borderRadius: '12px' }}>
                      {formatDateSeparator(msg.timestamp)}
                    </span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)', opacity: 0.5 }}></div>
                  </div>
                )}
                <div style={{
                  alignSelf: msg.isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.isMe ? 'flex-end' : 'flex-start'
                }}>
                  {!msg.isMe && showName && (
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', marginLeft: '6px' }}>
                      {msg.sender}
                    </span>
                  )}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.isMe ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={emojiOnly ? {
                      fontSize: '48px',
                      lineHeight: '1.2',
                    } : {
                      backgroundColor: msg.isMe ? 'var(--primary)' : 'white',
                      color: msg.isMe ? 'white' : 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: '20px',
                      borderBottomRightRadius: msg.isMe ? '4px' : '20px',
                      borderTopLeftRadius: !msg.isMe && showName ? '4px' : '20px',
                      borderBottomLeftRadius: !msg.isMe ? '4px' : '20px',
                      fontSize: '15px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      lineHeight: '1.5',
                      wordBreak: 'break-word'
                    }}>
                      {msg.text}
                    </div>
                    {msg.timestamp && (
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', marginPadding: '0 4px' }}>
                        {msg.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{ padding: '24px', borderTop: '1px solid var(--border)', backgroundColor: 'white', position: 'relative' }}>
          {showEmoji && (
            <div style={{ position: 'absolute', bottom: '100%', left: '24px', zIndex: 1000 }}>
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} style={{ color: showEmoji ? 'var(--primary)' : 'var(--text-secondary)' }} className="hover:text-primary">
              <Smile size={24} />
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ketik pesan..."
                style={{ width: '100%', padding: '16px 24px', borderRadius: '100px', border: '1px solid var(--border)', outline: 'none', backgroundColor: '#F4F6F9', fontSize: '15px' }}
              />
            </div>
            <button type="submit" style={{
              width: '56px', height: '56px', borderRadius: '50%', backgroundColor: inputValue.trim() ? 'var(--primary)' : '#E9ECEF', color: inputValue.trim() ? 'white' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', cursor: inputValue.trim() ? 'pointer' : 'default', border: 'none',
              boxShadow: inputValue.trim() ? '0 4px 12px rgba(82,0,0,0.2)' : 'none'
            }}>
              <Send size={24} style={{ marginLeft: '-2px' }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
