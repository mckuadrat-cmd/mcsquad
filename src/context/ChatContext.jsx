import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, parseDates, invokeApi } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [activeRoom, setActiveRoom] = useState({ id: 'general', name: 'General Chat', type: 'group' });
  const [rooms, setRooms] = useState([{ id: 'general', name: 'General Chat', type: 'group' }]);
  const [messages, setMessages] = useState([]);
  const [activeToast, setActiveToast] = useState(null);
  const [unreadRooms, setUnreadRooms] = useState([]);
  const [isChatUIActive, setIsChatUIActive] = useState(false);

  const activeRoomRef = useRef(activeRoom);
  const isChatUIActiveRef = useRef(isChatUIActive);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
    isChatUIActiveRef.current = isChatUIActive;
    
    if (currentUser && isChatUIActive) {
      let rid = activeRoom.id;
      if (activeRoom.type === 'dm') rid = [currentUser.uid, activeRoom.id].sort().join('_');
      markAsRead(rid);
    }
  }, [activeRoom, currentUser, isChatUIActive]);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Fetch initial chat data
    const fetchInitialData = async () => {
      try {
        // 1. Fetch initial profiles (team members)
        const { data: usersData } = await invokeApi('/profiles');

        const mappedUsers = (usersData || [])
          .map(u => ({
            id: u.id,
            name: u.name || 'User',
            type: 'dm',
            email: u.email,
            isOnline: u.isOnline || false,
            lastSeen: u.lastSeen ? new Date(u.lastSeen) : null,
            photo_url: u.photo_url || ''
          }))
          .filter(u => u.id !== currentUser.uid);

        setRooms([
          { id: 'general', name: 'General Chat', type: 'group' },
          ...mappedUsers
        ]);

        // 2. Fetch initial messages (last 100)
        const { data: msgsData } = await invokeApi('/messages?order=timestamp.asc&limit=100');

        const mappedMsgs = parseDates(msgsData || []).map(m => ({
          ...m,
          isMe: m.senderId === currentUser.uid
        }));
        setMessages(mappedMsgs);
      } catch (err) {
        console.error("Error setting up chat context data:", err);
      }
    };

    fetchInitialData();

    // 2. Setup Realtime Channel for profile status updates
    const usersChannelName = 'chat-profiles';
    const existingUsersChan = supabase.getChannels().find(c => c.name === usersChannelName);
    if (existingUsersChan) {
      supabase.removeChannel(existingUsersChan);
    }
    const usersChannel = supabase.channel(usersChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const item = payload.new;
        if (payload.eventType === 'DELETE' || item.id === currentUser.uid) {
          if (payload.eventType === 'DELETE') {
            setRooms(prev => prev.filter(r => r.id !== payload.old.id));
          }
          return;
        }

        const roomItem = {
          id: item.id,
          name: item.name || 'User',
          type: 'dm',
          email: item.email,
          isOnline: item.isOnline || false,
          lastSeen: item.lastSeen ? new Date(item.lastSeen) : null,
          photo_url: item.photo_url || ''
        };

        setRooms(prev => {
          const exists = prev.some(r => r.id === item.id);
          if (exists) {
            return prev.map(r => r.id === item.id ? roomItem : r);
          } else {
            return [...prev, roomItem];
          }
        });
      })
      .subscribe();

    // 3. Setup Realtime Channel for new messages
    const messagesChannelName = 'chat-messages';
    const existingMessagesChan = supabase.getChannels().find(c => c.name === messagesChannelName);
    if (existingMessagesChan) {
      supabase.removeChannel(existingMessagesChan);
    }
    const messagesChannel = supabase.channel(messagesChannelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = parseDates(payload.new);
        newMsg.isMe = newMsg.senderId === currentUser.uid;

        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });

        if (newMsg.senderId !== currentUser.uid) {
          try {
            const soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';
            const audio = new Audio(soundUrl);
            audio.volume = 1.0;
            audio.play().catch(() => {});
          } catch (e) { }

          let currentRID = activeRoomRef.current.id;
          if (activeRoomRef.current.type === 'dm') {
            currentRID = [currentUser.uid, activeRoomRef.current.id].sort().join('_');
          }

          if (newMsg.roomId !== currentRID || !isChatUIActiveRef.current) {
            setActiveToast({ sender: newMsg.sender, text: newMsg.text });
            setTimeout(() => setActiveToast(null), 5000); 

            setUnreadRooms(prev => {
              if (prev.includes(newMsg.roomId)) return prev;
              return [...prev, newMsg.roomId];
            });
          } else {
            markAsRead(newMsg.roomId);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [currentUser]);

  const sendMessage = async (text, room) => {
    if (!currentUser || !text.trim()) return;

    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch(e) {}

    let finalRoomId = room.id;
    if (room.type === 'dm') {
      finalRoomId = [currentUser.uid, room.id].sort().join('_');
    }

    try {
      await invokeApi('/messages', {
        method: 'POST',
        body: {
          roomId: finalRoomId,
          text: text,
          senderId: currentUser.uid,
          sender: (userProfile?.nickname?.trim() || userProfile?.name) || currentUser.displayName || 'User',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error("Chat send error:", err);
    }
  };

  const markAsRead = (roomId) => {
    setUnreadRooms(prev => {
      if (!prev.includes(roomId)) return prev;
      return prev.filter(id => id !== roomId);
    });
  };

  const checkOnline = (room) => {
    if (!room.isOnline) return false;
    if (!room.lastSeen) return false;
    const lastSeen = new Date(room.lastSeen);
    const now = new Date();
    return (now - lastSeen) < 3 * 60 * 1000;
  };

  const onlineUsers = rooms.filter(r => r.type === 'dm' && checkOnline(r));

  const value = {
    activeRoom,
    setActiveRoom: (room) => {
      setActiveRoom(room);
      let rid = room.id;
      if (room.type === 'dm') rid = [currentUser.uid, room.id].sort().join('_');
      markAsRead(rid);
    },
    rooms,
    onlineUsers,
    messages,
    sendMessage,
    unreadRooms,
    markAsRead,
    activeToast,
    setActiveToast,
    isChatUIActive,
    setIsChatUIActive
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
