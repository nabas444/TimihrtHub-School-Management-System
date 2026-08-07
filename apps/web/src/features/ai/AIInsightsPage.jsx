import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Brain, Send, AlertTriangle, TrendingUp, Lightbulb, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

const RISK_BADGE = { LOW: 'green', MEDIUM: 'yellow', HIGH: 'red' };

export default function AIInsightsPage() {
  const { user, isStudent, isAdmin, isTeacher } = useAuthStore();
  const isStaff = isAdmin() || isTeacher();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${user?.firstName}! I'm your AI assistant. I can help you understand academic progress, answer school-related questions, or provide study tips. What would you like to know?` },
  ]);
  const [input, setInput] = useState('');

  const { data: insight, isLoading, refetch } = useQuery({
    queryKey: ['ai-insight', 'me'],
    queryFn: () => api.get('/ai/insights/me').then((r) => r.data.data),
    enabled: isStudent(),
    retry: false,
  });

  const chatMutation = useMutation({
    mutationFn: (msgs) => api.post('/ai/chat', { messages: msgs }),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.data.reply }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    },
  });

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = { role: 'user', content: input.trim() };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput('');
    chatMutation.mutate(updated.slice(-10).map(({ role, content }) => ({ role, content })));
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Brain className="w-6 h-6 text-purple-600" /> AI Insights</h1>
          <p className="page-subtitle">AI-powered academic analysis and recommendations</p>
        </div>
        {isStudent() && <button className="btn-secondary" onClick={() => refetch()}><Sparkles className="w-4 h-4" /> Refresh Analysis</button>}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* AI Performance Insight */}
        {isStudent() && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900 text-base">📊 Your Performance Analysis</h2>
            {isLoading ? <PageLoader text="Analyzing your performance…" /> : !insight ? (
              <div className="card card-body text-center">
                <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No analysis yet. Make sure you have exam results and attendance data.</p>
                <button className="btn-primary mt-3" onClick={() => refetch()}>Generate Analysis</button>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Overall Summary</h3>
                    <Badge variant={RISK_BADGE[insight.riskLevel] ?? 'gray'}>Risk: {insight.riskLevel}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{insight.summary}</p>
                </div>

                {/* Alerts */}
                {(insight.attendanceAlert || insight.academicAlert) && (
                  <div className="card p-4 bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {insight.attendanceAlert && <p className="text-sm text-amber-800 font-medium">⚠️ Attendance needs improvement</p>}
                        {insight.academicAlert && <p className="text-sm text-amber-800 font-medium">⚠️ Academic performance needs attention</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {insight.strengths?.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> Strengths</h3>
                    <ul className="space-y-1">
                      {insight.strengths.map((s, i) => <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span>{s}</li>)}
                    </ul>
                  </div>
                )}

                {/* Areas for improvement */}
                {insight.areasForImprovement?.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Areas to Improve</h3>
                    <ul className="space-y-1">
                      {insight.areasForImprovement.map((a, i) => <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-amber-500 mt-0.5">→</span>{a}</li>)}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {insight.recommendations?.length > 0 && (
                  <div className="card p-5 bg-primary-50 border border-primary-100">
                    <h3 className="font-semibold text-primary-900 mb-3">💡 Recommendations</h3>
                    <ul className="space-y-2">
                      {insight.recommendations.map((r, i) => <li key={i} className="text-sm text-primary-800 flex items-start gap-2"><span className="font-bold">{i + 1}.</span>{r}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* AI Chatbot */}
        <div className="flex flex-col">
          <h2 className="font-semibold text-gray-900 text-base mb-4">🤖 AI Assistant</h2>
          <div className="card flex flex-col h-[500px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={clsx('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-purple-600" />
                    </div>
                  )}
                  <div className={clsx('max-w-xs lg:max-w-sm px-4 py-2 rounded-2xl text-sm', msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm')}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-2 justify-start">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-purple-600 animate-pulse" />
                  </div>
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Ask about your studies, grades, school…"
                disabled={chatMutation.isPending}
              />
              <button className="btn-primary btn-icon flex-shrink-0" onClick={sendMessage} disabled={!input.trim() || chatMutation.isPending}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
