import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Plus, Search, MoreVertical, Phone } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../lib/socket';
import { Avatar } from '../../components/ui/index';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { roomId: paramRoomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { rooms, setRooms, messages, setMessages, appendMessages, activeRoomId, setActiveRoom, clearUnread, addMessage, setTyping, typingUsers } = useChatStore();
  const [text, setText] = useState('');
  const [newDmSearch, setNewDmSearch] = useState('');
  const [newDmOpen, setNewDmOpen] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const socket = getSocket();

  // Load user's rooms
  const { data: roomsData } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/chat/rooms').then((r) => r.data.data),
    onSuccess: (data) => setRooms(data ?? []),
  });

  // Active room
  const activeRoom = rooms.find((r) => r.roomId === (paramRoomId ?? activeRoomId));

  // Load messages when room changes
  useQuery({
    queryKey: ['messages', paramRoomId],
    queryFn: () => api.get(`/chat/rooms/${paramRoomId}/messages?limit=50`).then((r) => r.data.data),
    enabled: !!paramRoomId,
    onSuccess: (data) => { if (paramRoomId) { setMessages(paramRoomId, data); clearUnread(paramRoomId); } },
  });

  // Users search for new DM
  const { data: searchUsers } = useQuery({
    queryKey: ['users-search', newDmSearch],
    queryFn: () => api.get(`/users?search=${newDmSearch}&limit=10`).then((r) => r.data.data),
    enabled: newDmSearch.length > 1,
  });

  const createDmMutation = useMutation({
    mutationFn: (userId) => api.post('/chat/rooms/direct', { userId }),
    onSuccess: (res) => {
      const room = res.data.data;
      navigate(`/chat/${room.id}`);
      setNewDmOpen(false);
      setNewDmSearch('');
    },
  });

  // Send message
  const sendMessage = () => {
    if (!text.trim() || !paramRoomId) return;
    socket.emit('chat:send', { roomId: paramRoomId, content: text.trim() });
    setText('');
  };

  // Typing indicator
  const handleTyping = (e) => {
    setText(e.target.value);
    if (!paramRoomId) return;
    socket.emit('chat:typing', { roomId: paramRoomId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 2000);
  };

  // Listen for new messages from socket
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => addMessage(msg.roomId, msg);
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[paramRoomId]]);

  const roomMessages = messages[paramRoomId] ?? [];
  const typing = typingUsers[paramRoomId] ?? [];

  // Get display name for a room
  const getRoomName = (room) => {
    if (room?.room?.type === 'DIRECT') {
      const other = room.room.members?.[0];
      return other ? `${other.firstName ?? ''} ${other.lastName ?? ''}`.trim() : 'Direct Message';
    }
    return room?.room?.name ?? 'Room';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-gray-100 shadow-card bg-white">

      {/* ── Rooms sidebar ────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Messages</h2>
            <button onClick={() => setNewDmOpen((o) => !o)} className="btn-ghost btn-icon"><Plus className="w-4 h-4" /></button>
          </div>
          {newDmOpen && (
            <div className="space-y-2">
              <input className="input text-sm" placeholder="Search users…" value={newDmSearch} onChange={(e) => setNewDmSearch(e.target.value)} autoFocus />
              {(searchUsers ?? []).filter((u) => u.id !== user?.id).map((u) => (
                <button key={u.id} onClick={() => createDmMutation.mutate(u.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
                  <span className="text-sm">{u.firstName} {u.lastName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {(roomsData ?? []).map((r) => {
            const name = getRoomName(r);
            const lastMsg = r.room?.messages?.[0];
            const isActive = r.roomId === paramRoomId;
            return (
              <button key={r.roomId} onClick={() => navigate(`/chat/${r.roomId}`)}
                className={clsx('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors', isActive && 'bg-primary-50')}>
                <Avatar name={name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={clsx('text-sm font-medium truncate', isActive ? 'text-primary-700' : 'text-gray-900')}>{name}</span>
                    {lastMsg && <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{new Date(lastMsg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {lastMsg && <p className="text-xs text-gray-400 truncate mt-0.5">{lastMsg.content}</p>}
                </div>
                {r.unread > 0 && (
                  <span className="w-5 h-5 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{r.unread}</span>
                )}
              </button>
            );
          })}
          {!roomsData?.length && <p className="text-center text-gray-400 text-sm py-8">No conversations yet</p>}
        </div>
      </div>

      {/* ── Message window ───────────────────────────────────────────────── */}
      {!paramRoomId ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Send className="w-8 h-8 text-primary-300" />
            </div>
            <p className="font-medium text-gray-500">Select a conversation</p>
            <p className="text-sm">Or start a new message with the + button</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <Avatar name={activeRoom ? getRoomName(activeRoom) : '?'} size="md" />
              <div>
                <p className="font-semibold text-gray-900">{activeRoom ? getRoomName(activeRoom) : '...'}</p>
                {typing.length > 0 && <p className="text-xs text-primary-500 animate-pulse">typing…</p>}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {roomMessages.map((msg) => {
              const isOwn = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={clsx('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
                  {!isOwn && <Avatar name={`${msg.sender?.firstName} ${msg.sender?.lastName}`} size="sm" src={msg.sender?.avatar} />}
                  <div className={clsx('max-w-xs lg:max-w-md', isOwn ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
                    {!isOwn && <span className="text-xs text-gray-400 px-1">{msg.sender?.firstName}</span>}
                    {msg.replyTo && (
                      <div className={clsx('text-xs px-3 py-1 rounded-lg border', isOwn ? 'bg-primary-800/20 border-primary-400/30 text-primary-200' : 'bg-gray-100 border-gray-200 text-gray-500')}>
                        ↩ {msg.replyTo.content?.slice(0, 60)}…
                      </div>
                    )}
                    <div className={clsx(isOwn ? 'chat-bubble-out' : 'chat-bubble-in')}>
                      {msg.isDeleted ? <em className="opacity-50 text-xs">Message deleted</em> : msg.content}
                    </div>
                    <span className="text-[10px] text-gray-400 px-1">{new Date(msg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-end gap-2">
            <textarea
              className="input flex-1 resize-none min-h-[40px] max-h-32 py-2 text-sm"
              placeholder="Type a message…"
              value={text}
              onChange={handleTyping}
              rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim()}
              className="btn-primary btn-icon flex-shrink-0 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
