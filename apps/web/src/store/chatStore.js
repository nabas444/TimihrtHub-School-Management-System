import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  rooms: [],
  activeRoomId: null,
  messages: {},        // roomId -> Message[]
  unreadCounts: {},    // roomId -> number
  typingUsers: {},     // roomId -> userId[]
  onlineUsers: new Set(),

  setRooms: (rooms) => set({ rooms }),
  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

  addMessage: (roomId, message) =>
    set((state) => {
      const existing = state.messages[roomId] ?? [];
      const alreadyExists = existing.some((m) => m.id === message.id);
      const newMessages = alreadyExists
        ? existing.map((m) => (m.id === message.id ? { ...m, ...message } : m))
        : [...existing, message];

      return {
        messages: {
          ...state.messages,
          [roomId]: newMessages,
        },
        // Update last message in room list
        rooms: state.rooms.map((r) =>
          r.roomId === roomId ? { ...r, room: { ...r.room, messages: [message] } } : r,
        ),
      };
    }),

  setMessages: (roomId, messages) =>
    set((state) => ({ messages: { ...state.messages, [roomId]: messages } })),

  updateMessage: (roomId, updatedMessage) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: (state.messages[roomId] ?? []).map((m) =>
          m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m,
        ),
      },
    })),

  deleteMessage: (roomId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: (state.messages[roomId] ?? []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m,
        ),
      },
    })),

  appendMessages: (roomId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [roomId]: [...messages, ...(state.messages[roomId] ?? [])] },
    })),

  setUnread: (roomId, count) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [roomId]: count } })),

  clearUnread: (roomId) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [roomId]: 0 } })),

  setTyping: (roomId, userId, isTyping) =>
    set((state) => {
      const current = state.typingUsers[roomId] ?? [];
      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: isTyping ? [...new Set([...current, userId])] : current.filter((id) => id !== userId),
        },
      };
    }),

  setOnline: (userId) =>
    set((state) => { const s = new Set(state.onlineUsers); s.add(userId); return { onlineUsers: s }; }),

  setOffline: (userId) =>
    set((state) => { const s = new Set(state.onlineUsers); s.delete(userId); return { onlineUsers: s }; }),

  totalUnread: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),
}));
