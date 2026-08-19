import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Plus,
  Search,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  User as UserIcon,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Edit2,
  Trash2,
  Check,
  X,
  Info,
  Users,
  GraduationCap,
  BookOpen,
  HeartHandshake,
  Ban,
  Flag,
  Copy,
  CheckCheck,
  MessageSquare,
  Sparkles,
  Calendar,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../lib/socket';
import { Avatar, Badge, EmptyState } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const ROLE_BADGE = {
  SUPER_ADMIN: { label: 'Super Admin', variant: 'purple' },
  ADMIN: { label: 'Admin', variant: 'purple' },
  TEACHER: { label: 'Teacher', variant: 'blue' },
  STUDENT: { label: 'Student', variant: 'green' },
  PARENT: { label: 'Parent', variant: 'amber' },
};

export default function ChatPage() {
  const { roomId: paramRoomId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, isTeacher } = useAuthStore();
  const {
    rooms,
    setRooms,
    messages,
    setMessages,
    updateMessage,
    deleteMessage,
    activeRoomId,
    setActiveRoom,
    clearUnread,
    addMessage,
    typingUsers,
  } = useChatStore();

  // Sidebar navigation state
  const [sidebarTab, setSidebarTab] = useState('CONVERSATIONS'); // 'CONVERSATIONS' | 'CONTACTS'
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL'); // 'ALL' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'ADMIN'
  const [searchQuery, setSearchQuery] = useState('');

  // Chat message & interaction state
  const [text, setText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteConfirmMsgId, setDeleteConfirmMsgId] = useState(null);

  // User Profile Drawer / Moderation state
  const [profileUserId, setProfileUserId] = useState(null);
  const [flagModalUser, setFlagModalUser] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagNotes, setFlagNotes] = useState('');

  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const socket = getSocket();

  // ── 1. Fetch User Rooms ─────────────────────────────────────────
  const { data: roomsData } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/chat/rooms').then((r) => r.data.data),
  });

  useEffect(() => {
    if (roomsData) {
      setRooms(roomsData);
    }
  }, [roomsData, setRooms]);

  // Active room finding
  const activeRoom = useMemo(() => {
    return (roomsData ?? []).find((r) => r.roomId === (paramRoomId ?? activeRoomId));
  }, [roomsData, paramRoomId, activeRoomId]);

  // Find other member details in direct room
  const otherMember = useMemo(() => {
    if (!activeRoom || activeRoom.room?.type !== 'DIRECT') return null;
    const mem = activeRoom.room.members?.find((m) => m.userId !== user?.id);
    return mem?.user || mem;
  }, [activeRoom, user?.id]);

  // ── 2. Fetch Messages for Active Room ───────────────────────────
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', paramRoomId],
    queryFn: () =>
      api.get(`/chat/rooms/${paramRoomId}/messages?limit=50`).then((r) => r.data.data),
    enabled: !!paramRoomId,
  });

  useEffect(() => {
    if (paramRoomId && messagesData && Array.isArray(messagesData)) {
      setMessages(paramRoomId, messagesData);
      clearUnread(paramRoomId);
    }
  }, [paramRoomId, messagesData, setMessages, clearUnread]);

  // Join active chat room via socket
  useEffect(() => {
    if (!paramRoomId || !socket) return;
    socket.emit('chat:join', { roomId: paramRoomId });
    socket.emit('chat:read', { roomId: paramRoomId });
  }, [paramRoomId, socket]);

  // ── 3. Fetch Scoped Role Contacts Directory ────────────────────
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['chat-contacts', selectedRoleFilter, searchQuery],
    queryFn: () =>
      api
        .get(
          `/chat/contacts?role=${selectedRoleFilter}&search=${encodeURIComponent(searchQuery)}`,
        )
        .then((r) => r.data.data),
  });

  // ── 4. Fetch User Profile for Drawer ───────────────────────────
  const { data: userProfileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', profileUserId],
    queryFn: () => api.get(`/chat/users/${profileUserId}/profile`).then((r) => r.data.data),
    enabled: !!profileUserId,
  });

  // ── 5. Mutations: Create DM, Edit Msg, Delete Msg, Block, Flag ─
  const createDmMutation = useMutation({
    mutationFn: (userId) => api.post('/chat/rooms/direct', { userId }),
    onSuccess: (res) => {
      const room = res.data.data;
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      qc.invalidateQueries({ queryKey: ['chat-contacts'] });
      navigate(`/chat/${room.id}`);
      setSidebarTab('CONVERSATIONS');
      setSearchQuery('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to open chat');
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ messageId, content }) =>
      api.patch(`/chat/messages/${messageId}`, { content }),
    onSuccess: (res) => {
      const updated = res.data.data;
      if (paramRoomId) updateMessage(paramRoomId, updated);
      setEditingMessageId(null);
      setEditingText('');
      toast.success('Message updated');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to edit message');
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => api.delete(`/chat/messages/${messageId}`),
    onSuccess: (_, messageId) => {
      if (paramRoomId) deleteMessage(paramRoomId, messageId);
      setDeleteConfirmMsgId(null);
      toast.success('Message deleted');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete message');
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ userId, reason }) =>
      api.post(`/chat/users/${userId}/block`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-contacts'] });
      qc.invalidateQueries({ queryKey: ['user-profile', profileUserId] });
      toast.success('User has been blocked from chat access');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to block user');
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: (userId) => api.post(`/chat/users/${userId}/unblock`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-contacts'] });
      qc.invalidateQueries({ queryKey: ['user-profile', profileUserId] });
      toast.success('User chat access restored');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to unblock user');
    },
  });

  const flagUserMutation = useMutation({
    mutationFn: ({ userId, reason, notes }) =>
      api.post(`/chat/users/${userId}/flag`, { reason, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-contacts'] });
      qc.invalidateQueries({ queryKey: ['user-profile', profileUserId] });
      toast.success('User flagged for administrative misconduct review');
      setFlagModalUser(null);
      setFlagReason('');
      setFlagNotes('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to flag user');
    },
  });

  // ── 6. Message Senders & Actions ──────────────────────────────
  const sendMessage = async () => {
    if (!text.trim() || !paramRoomId) return;
    const content = text.trim();
    setText('');

    try {
      const res = await api.post(`/chat/rooms/${paramRoomId}/messages`, { content });
      const newMsg = res.data.data;
      addMessage(paramRoomId, newMsg);
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      qc.invalidateQueries({ queryKey: ['messages', paramRoomId] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!paramRoomId || !socket) return;
    socket.emit('chat:typing', { roomId: paramRoomId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 2000);
  };

  // ── 7. Socket Event Listeners ─────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      if (msg?.roomId) {
        addMessage(msg.roomId, msg);
        qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      }
    };

    const onEdit = (updated) => {
      if (updated?.roomId) updateMessage(updated.roomId, updated);
    };

    const onDelete = (data) => {
      if (data?.roomId && data?.messageId) deleteMessage(data.roomId, data.messageId);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:edit', onEdit);
    socket.on('chat:delete', onDelete);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:edit', onEdit);
      socket.off('chat:delete', onDelete);
    };
  }, [socket, addMessage, updateMessage, deleteMessage, qc]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[paramRoomId], messagesData]);

  const roomMessages = useMemo(() => {
    const storeMsgs = messages[paramRoomId];
    if (storeMsgs && storeMsgs.length > 0) return storeMsgs;
    if (Array.isArray(messagesData)) return messagesData;
    return [];
  }, [messages, paramRoomId, messagesData]);
  const typing = typingUsers[paramRoomId] ?? [];

  // Helper to get room display name
  const getRoomName = (room) => {
    if (room?.room?.type === 'DIRECT') {
      const other = room.room.members?.find((m) => m.userId !== user?.id);
      if (other?.user) {
        return `${other.user.firstName} ${other.user.lastName}`;
      }
      return other ? `${other.firstName ?? ''} ${other.lastName ?? ''}`.trim() : 'Direct Chat';
    }
    return room?.room?.name ?? 'Chat Room';
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
      {/* ════════════════════════════════════════════════════════════════
          SIDEBAR: CONVERSATIONS & ROLE-SCOPED DIRECTORY
      ════════════════════════════════════════════════════════════════ */}
      <div className="w-80 md:w-88 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50">
        {/* Sidebar Navigation Header */}
        <div className="p-3.5 border-b border-gray-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-600" />
              School Chat
            </h2>

            {/* View Switcher Pills */}
            <div className="flex p-0.5 bg-gray-100 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setSidebarTab('CONVERSATIONS')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  sidebarTab === 'CONVERSATIONS'
                    ? 'bg-white text-primary-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Chats
              </button>
              <button
                onClick={() => setSidebarTab('CONTACTS')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  sidebarTab === 'CONTACTS'
                    ? 'bg-white text-primary-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Directory
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 text-xs py-1.5 w-full bg-gray-50 focus:bg-white"
              placeholder={
                sidebarTab === 'CONVERSATIONS'
                  ? 'Search active chats…'
                  : 'Search teachers, students, parents…'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Role Filter Tabs (Shown in Directory mode) */}
          {sidebarTab === 'CONTACTS' && (
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px] font-bold">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'TEACHER', label: 'Teachers' },
                { id: 'STUDENT', label: 'Students' },
                { id: 'PARENT', label: 'Parents' },
                { id: 'ADMIN', label: 'Admins' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedRoleFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                    selectedRoleFilter === tab.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {/* TAB 1: ACTIVE CONVERSATIONS */}
          {sidebarTab === 'CONVERSATIONS' && (
            <div>
              {(roomsData ?? [])
                .filter((r) => {
                  const name = getRoomName(r);
                  return name.toLowerCase().includes(searchQuery.toLowerCase());
                })
                .map((r) => {
                  const name = getRoomName(r);
                  const lastMsg = r.room?.messages?.[0];
                  const isActive = r.roomId === paramRoomId;
                  const other = r.room?.members?.find((m) => m.userId !== user?.id);
                  const partnerRole = other?.user?.role || other?.role;

                  return (
                    <button
                      key={r.roomId}
                      onClick={() => navigate(`/chat/${r.roomId}`)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors relative group',
                        isActive
                          ? 'bg-primary-50/80 border-l-4 border-primary-600'
                          : 'hover:bg-gray-100/70 bg-white',
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar
                          name={name}
                          size="md"
                          src={other?.user?.avatar || other?.avatar}
                        />
                        {partnerRole && (
                          <span
                            className={clsx(
                              'absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white',
                              partnerRole === 'TEACHER'
                                ? 'bg-blue-500'
                                : partnerRole === 'STUDENT'
                                ? 'bg-green-500'
                                : partnerRole === 'PARENT'
                                ? 'bg-amber-500'
                                : 'bg-purple-500',
                            )}
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={clsx(
                              'text-xs font-bold truncate block',
                              isActive ? 'text-primary-900' : 'text-gray-900',
                            )}
                          >
                            {name}
                          </span>
                          {lastMsg && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className="text-[11px] text-gray-500 truncate">
                            {lastMsg?.isDeleted ? (
                              <em className="text-gray-400">Message deleted</em>
                            ) : (
                              lastMsg?.content || 'Started a conversation'
                            )}
                          </p>
                          {r.unread > 0 && (
                            <span className="px-1.5 py-0.2 bg-primary-600 text-white text-[10px] font-bold rounded-full flex-shrink-0">
                              {r.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

              {(!roomsData || roomsData.length === 0) && (
                <div className="p-8 text-center text-gray-400 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="text-xs font-medium">No active chats yet</p>
                  <button
                    onClick={() => setSidebarTab('CONTACTS')}
                    className="text-xs text-primary-600 font-bold hover:underline"
                  >
                    Browse School Directory →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ROLE-SCOPED CONTACTS DIRECTORY */}
          {sidebarTab === 'CONTACTS' && (
            <div>
              {contactsLoading ? (
                <div className="p-8 text-center text-xs text-gray-400">Loading contacts…</div>
              ) : !contactsData?.length ? (
                <div className="p-8 text-center text-gray-400 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="text-xs font-medium">No contacts found</p>
                </div>
              ) : (
                contactsData.map((contact) => {
                  const roleConfig = ROLE_BADGE[contact.role] || {
                    label: contact.role,
                    variant: 'gray',
                  };

                  let subText = '';
                  if (contact.role === 'STUDENT' && contact.details?.student) {
                    subText = `${contact.details.student.className || 'Class'} · Roll #${
                      contact.details.student.rollNumber || '—'
                    }`;
                  } else if (contact.role === 'TEACHER' && contact.details?.teacher) {
                    subText =
                      contact.details.teacher.specialization ||
                      contact.details.teacher.classTeacherOf ||
                      'Teacher';
                  } else if (contact.role === 'PARENT' && contact.details?.parent) {
                    subText = contact.details.parent.children?.length
                      ? `Parent of: ${contact.details.parent.children.join(', ')}`
                      : 'Parent';
                  } else if (contact.role === 'ADMIN') {
                    subText = contact.details?.admin?.department || 'Administration';
                  }

                  return (
                    <div
                      key={contact.id}
                      className="p-3 hover:bg-gray-100/70 bg-white transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div
                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (contact.existingRoomId) {
                            navigate(`/chat/${contact.existingRoomId}`);
                            setSidebarTab('CONVERSATIONS');
                          } else {
                            createDmMutation.mutate(contact.id);
                          }
                        }}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar name={contact.fullName} size="md" src={contact.avatar} />
                          {contact.isBlocked && (
                            <span
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                              title="Blocked from chat"
                            >
                              <Ban className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-900 truncate block">
                              {contact.fullName}
                            </span>
                            <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
                          </div>
                          {subText && (
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">{subText}</p>
                          )}
                        </div>
                      </div>

                      {/* Info Drawer Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfileUserId(contact.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex-shrink-0"
                        title="View user details & bio"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MAIN CHAT WINDOW
      ════════════════════════════════════════════════════════════════ */}
      {!paramRoomId ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50/30 p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Send className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-base text-gray-900">Select or Start a Chat</h3>
            <p className="text-xs text-gray-500 mt-1">
              Select a conversation from the sidebar or browse the school directory by role to start a direct private message.
            </p>
            <button
              onClick={() => setSidebarTab('CONTACTS')}
              className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" /> Browse School Directory
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white shadow-xs">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                if (otherMember?.id) setProfileUserId(otherMember.id);
              }}
            >
              <Avatar
                name={activeRoom ? getRoomName(activeRoom) : '?'}
                size="md"
                src={otherMember?.avatar}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors">
                    {activeRoom ? getRoomName(activeRoom) : 'Loading conversation…'}
                  </h3>
                  {otherMember?.role && (
                    <Badge variant={ROLE_BADGE[otherMember.role]?.variant || 'gray'}>
                      {ROLE_BADGE[otherMember.role]?.label || otherMember.role}
                    </Badge>
                  )}
                </div>

                {typing.length > 0 ? (
                  <p className="text-[11px] text-primary-600 font-semibold animate-pulse">
                    typing a message…
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500">Click to view profile & details</p>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1.5">
              {otherMember?.id && (
                <button
                  onClick={() => setProfileUserId(otherMember.id)}
                  className="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
                  title="View user details & bio"
                >
                  <Info className="w-3.5 h-3.5 text-primary-600" />
                  <span>Profile Info</span>
                </button>
              )}

              {isAdmin() && otherMember?.id && (
                <button
                  onClick={() => setFlagModalUser(otherMember)}
                  className="btn-ghost text-xs text-amber-600 hover:bg-amber-50 p-2 rounded-lg"
                  title="Flag for misconduct"
                >
                  <Flag className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 bg-gray-50/40">
            {messagesLoading && roomMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div className="max-w-xs space-y-2 text-xs text-gray-400">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading messages…</p>
                </div>
              </div>
            ) : roomMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div className="max-w-xs space-y-2">
                  <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-gray-800">No messages yet</h4>
                  <p className="text-xs text-gray-500">
                    Send a message to start the conversation!
                  </p>
                </div>
              </div>
            ) : (
              roomMessages.map((msg) => {
                const isOwn = msg.senderId === user?.id;
                const isEditingThis = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={clsx('flex gap-2.5 group', isOwn ? 'justify-end' : 'justify-start')}
                  >
                    {!isOwn && (
                      <div
                        className="cursor-pointer flex-shrink-0 mt-0.5"
                        onClick={() => setProfileUserId(msg.sender?.id)}
                        title="View user profile"
                      >
                        <Avatar
                          name={`${msg.sender?.firstName} ${msg.sender?.lastName}`}
                          size="sm"
                          src={msg.sender?.avatar}
                        />
                      </div>
                    )}

                    <div
                      className={clsx(
                        'max-w-xs md:max-w-md lg:max-w-lg flex flex-col gap-1',
                        isOwn ? 'items-end' : 'items-start',
                      )}
                    >
                      {!isOwn && (
                        <span className="text-[10px] text-gray-500 font-semibold px-1">
                          {msg.sender?.firstName} {msg.sender?.lastName}
                        </span>
                      )}

                      {/* Reply Bubble if any */}
                      {msg.replyTo && (
                        <div
                          className={clsx(
                            'text-xs px-3 py-1 rounded-lg border',
                            isOwn
                              ? 'bg-primary-800/20 border-primary-400/30 text-primary-900'
                              : 'bg-gray-100 border-gray-200 text-gray-600',
                          )}
                        >
                          ↩ {msg.replyTo.content?.slice(0, 60)}…
                        </div>
                      )}

                      {/* Message Bubble or Inline Editor */}
                      {isEditingThis ? (
                        <div className="bg-white p-2 rounded-xl border border-primary-300 shadow-sm space-y-2 w-full min-w-64">
                          <textarea
                            className="input text-xs w-full min-h-16 resize-none"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditingText('');
                              }}
                              className="btn-ghost text-xs py-1 px-2"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() =>
                                editMessageMutation.mutate({
                                  messageId: msg.id,
                                  content: editingText,
                                })
                              }
                              disabled={!editingText.trim() || editMessageMutation.isPending}
                              className="btn-primary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative group/bubble flex items-center gap-1">
                          {/* Hover Actions for Own Messages (or Admin) */}
                          {isOwn && !msg.isDeleted && (
                            <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs">
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditingText(msg.content || '');
                                }}
                                className="p-1 text-gray-500 hover:text-primary-600 rounded hover:bg-gray-100"
                                title="Edit message"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmMsgId(msg.id)}
                                className="p-1 text-gray-500 hover:text-red-600 rounded hover:bg-red-50"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div
                            className={clsx(
                              'px-4 py-2.5 rounded-2xl text-xs break-words shadow-xs',
                              msg.isDeleted
                                ? 'bg-gray-100 text-gray-400 italic border border-gray-200'
                                : isOwn
                                ? 'bg-primary-600 text-white rounded-br-xs'
                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs',
                            )}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            {msg.isEdited && !msg.isDeleted && (
                              <span
                                className={clsx(
                                  'text-[9px] block text-right mt-0.5 opacity-75',
                                  isOwn ? 'text-primary-200' : 'text-gray-400',
                                )}
                              >
                                (edited)
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Delete Confirmation Inline */}
                      {deleteConfirmMsgId === msg.id && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2 text-xs text-red-700">
                          <span>Delete this message for everyone?</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setDeleteConfirmMsgId(null)}
                              className="btn-ghost text-xs py-0.5 px-1.5"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => deleteMessageMutation.mutate(msg.id)}
                              className="btn-danger text-xs py-0.5 px-2"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                    <span className="text-[10px] text-gray-400 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            }))}
            <div ref={bottomRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-3.5 border-t border-gray-200 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                className="input flex-1 resize-none min-h-[42px] max-h-32 py-2.5 text-xs"
                placeholder="Type your message… (Press Enter to send, Shift+Enter for new line)"
                value={text}
                onChange={handleTyping}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim()}
                className="btn-primary btn-icon flex-shrink-0 h-[42px] w-[42px] disabled:opacity-40"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          USER PROFILE DETAILS & MODERATION MODAL
      ════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!profileUserId}
        onClose={() => setProfileUserId(null)}
        title="User Profile & Chat Details"
        size="md"
      >
        {profileLoading || !userProfileData ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading user details…</div>
        ) : (
          <div className="space-y-5">
            {/* Header & Avatar */}
            <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-primary-50/30 rounded-xl border border-gray-200">
              <Avatar
                name={userProfileData.fullName}
                size="lg"
                src={userProfileData.avatar}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-gray-900">
                    {userProfileData.fullName}
                  </h3>
                  <Badge variant={ROLE_BADGE[userProfileData.role]?.variant || 'gray'}>
                    {ROLE_BADGE[userProfileData.role]?.label || userProfileData.role}
                  </Badge>
                  {userProfileData.isBlocked && (
                    <Badge variant="red">Chat Access Blocked</Badge>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span>{userProfileData.email}</span>
                </p>

                {userProfileData.phone && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{userProfileData.phone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Role-Specific Detail Highlights */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                Academic & Contact Information
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Location */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-400 block text-[10px] uppercase">City / Address</span>
                  <span className="font-semibold text-gray-800">
                    {userProfileData.city || userProfileData.address || 'Not specified'}
                  </span>
                </div>

                {/* Gender */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-400 block text-[10px] uppercase">Gender</span>
                  <span className="font-semibold text-gray-800">
                    {userProfileData.gender || 'Not specified'}
                  </span>
                </div>

                {/* If Student */}
                {userProfileData.profiles?.student && (
                  <>
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <span className="text-blue-500 block text-[10px] uppercase">Assigned Class</span>
                      <strong className="text-blue-950">
                        {userProfileData.profiles.student.class?.name || 'Unassigned'}
                      </strong>
                    </div>
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <span className="text-blue-500 block text-[10px] uppercase">Roll Number</span>
                      <strong className="text-blue-950 font-mono">
                        #{userProfileData.profiles.student.rollNumber || '—'}
                      </strong>
                    </div>
                  </>
                )}

                {/* If Teacher */}
                {userProfileData.profiles?.teacher && (
                  <>
                    <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 col-span-2">
                      <span className="text-purple-500 block text-[10px] uppercase">Specialization / Subject</span>
                      <strong className="text-purple-950">
                        {userProfileData.profiles.teacher.specialization ||
                          userProfileData.profiles.teacher.qualification ||
                          'Faculty Member'}
                      </strong>
                    </div>
                  </>
                )}

                {/* If Parent */}
                {userProfileData.profiles?.parent && (
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100 col-span-2">
                    <span className="text-amber-600 block text-[10px] uppercase">Occupation & Relation</span>
                    <strong className="text-amber-950">
                      {userProfileData.profiles.parent.occupation || 'Parent / Guardian'} (
                      {userProfileData.profiles.parent.relation || 'Guardian'})
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Moderation Controls */}
            {isAdmin() && userProfileData.id !== user?.id && (
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-red-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Administration & Chat Moderation
                  </h4>
                  {userProfileData.isBlocked ? (
                    <Badge variant="red">Chat Restricted</Badge>
                  ) : (
                    <Badge variant="green">In Good Standing</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {userProfileData.isBlocked ? (
                    <button
                      onClick={() => unblockUserMutation.mutate(userProfileData.id)}
                      disabled={unblockUserMutation.isPending}
                      className="btn-secondary text-xs inline-flex items-center gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {unblockUserMutation.isPending ? 'Unblocking…' : 'Unblock Chat Access'}
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        blockUserMutation.mutate({
                          userId: userProfileData.id,
                          reason: 'Policy violation',
                        })
                      }
                      disabled={blockUserMutation.isPending}
                      className="btn-secondary text-xs inline-flex items-center gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {blockUserMutation.isPending ? 'Blocking…' : 'Block User from Chat'}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setFlagModalUser(userProfileData);
                    }}
                    className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-600" />
                    Flag / Log Incident
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Flag Misconduct Incident Modal ── */}
      <Modal
        open={!!flagModalUser}
        onClose={() => setFlagModalUser(null)}
        title={`Flag User: ${flagModalUser?.fullName || flagModalUser?.firstName || 'User'}`}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setFlagModalUser(null)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (!flagReason.trim()) {
                  toast.error('Please enter a reason for flagging');
                  return;
                }
                flagUserMutation.mutate({
                  userId: flagModalUser.id,
                  reason: flagReason,
                  notes: flagNotes,
                });
              }}
              disabled={flagUserMutation.isPending}
            >
              <Flag className="w-4 h-4" />
              {flagUserMutation.isPending ? 'Submitting…' : 'Flag & Log Violation'}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-gray-600">
            Log a misconduct report or illegal policy violation against this user. This will record a moderation flag under school administration records.
          </p>

          <div>
            <label className="label">Reason / Violation Type *</label>
            <select
              className="input text-xs"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            >
              <option value="">Select violation reason…</option>
              <option value="Inappropriate language or harassment">
                Inappropriate language or harassment
              </option>
              <option value="Illegal academic dishonesty / leak">
                Illegal academic dishonesty / leak
              </option>
              <option value="Spam / disruptive behavior">Spam / disruptive behavior</option>
              <option value="Impersonation / Unauthorized contact">
                Impersonation / Unauthorized contact
              </option>
              <option value="Other code of conduct violation">
                Other code of conduct violation
              </option>
            </select>
          </div>

          <div>
            <label className="label">Incident Notes & Evidence</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              placeholder="Describe the incident or paste relevant message excerpts…"
              value={flagNotes}
              onChange={(e) => setFlagNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete Message Modal ── */}
      <Modal
        open={!!deleteConfirmMsgId}
        onClose={() => setDeleteConfirmMsgId(null)}
        title="Delete Message"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteConfirmMsgId(null)}>
              Cancel
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => deleteMessageMutation.mutate(deleteConfirmMsgId)}
              disabled={deleteMessageMutation.isPending}
            >
              {deleteMessageMutation.isPending ? 'Deleting…' : 'Delete for Everyone'}
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600">
          Are you sure you want to delete this message? This action will remove the message text for all members of this conversation.
        </p>
      </Modal>
    </div>
  );
}
