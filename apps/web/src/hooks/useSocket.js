import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const { isAuthenticated, accessToken } = useAuthStore();
  const { addMessage, setTyping, setOnline, setOffline, setUnread } = useChatStore();
  const { addNotification } = useUIStore();
  const boundRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    if (boundRef.current) return;

    const socket = connectSocket(accessToken);
    boundRef.current = true;

    // ── Chat events ──────────────────────────────────────────────────────
    socket.on('chat:message', (message) => {
      addMessage(message.roomId, message);
      const { activeRoomId } = useChatStore.getState();
      if (message.roomId !== activeRoomId) {
        setUnread(message.roomId, (useChatStore.getState().unreadCounts[message.roomId] ?? 0) + 1);
      }
    });

    socket.on('chat:typing', ({ userId, roomId }) => {
      setTyping(roomId, userId, true);
      setTimeout(() => setTyping(roomId, userId, false), 3000);
    });

    // ── Presence ─────────────────────────────────────────────────────────
    socket.on('presence:online', ({ userId }) => setOnline(userId));
    socket.on('presence:offline', ({ userId }) => setOffline(userId));

    // ── Notifications ─────────────────────────────────────────────────────
    socket.on('notification:new', (notif) => {
      addNotification(notif);
      toast(notif.body, {
        icon: notif.type === 'GRADE' ? '📊' : notif.type === 'ASSIGNMENT' ? '📚' : notif.type === 'ATTENDANCE' ? '📋' : '🔔',
        duration: 4000,
      });
    });

    // ── Announcements ─────────────────────────────────────────────────────
    socket.on('announcement:new', (announcement) => {
      toast(`📢 ${announcement.title}`, { duration: 5000 });
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    return () => {
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('presence:online');
      socket.off('presence:offline');
      socket.off('notification:new');
      socket.off('announcement:new');
      boundRef.current = false;
    };
  }, [isAuthenticated, accessToken]);

  return getSocket();
};
