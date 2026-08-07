import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Badge, Avatar } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import Modal from '../../components/ui/Modal';
import { ArrowLeft, Clock, CheckCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function AssignmentDetailPage() {
  const { id } = useParams();
  const { isStudent, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const [gradeOpen, setGradeOpen] = useState(null);
  const [gradeForm, setGradeForm] = useState({ marksObtained: '', feedback: '' });

  const { data: assignment, isLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api.get(`/academics/assignments/${id}`).then((r) => r.data.data),
  });

  const gradeMutation = useMutation({
    mutationFn: ({ subId, ...d }) => api.patch(`/academics/assignments/submissions/${subId}/grade`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignment', id] }); toast.success('Graded!'); setGradeOpen(null); },
  });

  if (isLoading) return <PageLoader />;
  if (!assignment) return <div className="text-center text-gray-400 py-16">Assignment not found</div>;

  const overdue = isPast(new Date(assignment.dueDate));
  const isStaff = isAdmin() || isTeacher();

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/assignments" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Assignments
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start gap-3 flex-wrap mb-3">
          <Badge variant="primary">{assignment.subject?.name}</Badge>
          {overdue && <Badge variant="red">Overdue</Badge>}
          {!assignment.isPublished && <Badge variant="yellow">Draft</Badge>}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
        {assignment.description && <p className="text-gray-600">{assignment.description}</p>}
        {assignment.instructions && (
          <div className="mt-4 p-4 bg-primary-50 rounded-xl">
            <p className="text-sm font-semibold text-primary-700 mb-1">Instructions</p>
            <p className="text-sm text-primary-800 whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />Due: <strong>{format(new Date(assignment.dueDate), 'dd MMM yyyy, HH:mm')}</strong></span>
          <span>Total marks: <strong>{assignment.totalMarks}</strong></span>
          <span>By: <strong>{assignment.createdBy?.firstName} {assignment.createdBy?.lastName}</strong></span>
        </div>
      </div>

      {/* Submissions (staff only) */}
      {isStaff && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Submissions ({assignment.submissions?.length ?? 0})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th>Score</th><th>Action</th></tr></thead>
              <tbody>
                {assignment.submissions?.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={`${s.student?.firstName} ${s.student?.lastName}`} size="sm" />
                        <span className="text-sm font-medium">{s.student?.firstName} {s.student?.lastName}</span>
                      </div>
                    </td>
                    <td><Badge variant={s.status === 'GRADED' ? 'green' : s.status === 'LATE' ? 'red' : 'blue'}>{s.status}</Badge></td>
                    <td className="text-sm text-gray-500">{s.submittedAt ? format(new Date(s.submittedAt), 'dd MMM, HH:mm') : '—'}</td>
                    <td className="font-mono text-sm">{s.marksObtained != null ? `${s.marksObtained}/${assignment.totalMarks}` : '—'}</td>
                    <td>
                      {s.status !== 'PENDING' && s.status !== 'GRADED' && (
                        <button className="btn-primary btn-sm" onClick={() => { setGradeOpen(s); setGradeForm({ marksObtained: '', feedback: '' }); }}>
                          <CheckCircle className="w-3 h-3" /> Grade
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grade modal */}
      <Modal open={!!gradeOpen} onClose={() => setGradeOpen(null)} title="Grade Submission" size="sm"
        footer={<><button className="btn-secondary" onClick={() => setGradeOpen(null)}>Cancel</button><button className="btn-primary" onClick={() => gradeMutation.mutate({ subId: gradeOpen?.id, marksObtained: parseFloat(gradeForm.marksObtained), feedback: gradeForm.feedback })} disabled={gradeMutation.isPending}>{gradeMutation.isPending ? 'Saving…' : 'Save Grade'}</button></>}
      >
        <div className="space-y-4">
          {gradeOpen?.content && <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">{gradeOpen.content}</div>}
          <div><label className="label">Marks (out of {assignment.totalMarks}) *</label><input className="input" type="number" min="0" max={assignment.totalMarks} value={gradeForm.marksObtained} onChange={(e) => setGradeForm((f) => ({ ...f, marksObtained: e.target.value }))} required /></div>
          <div><label className="label">Feedback</label><textarea className="input min-h-20 resize-none" value={gradeForm.feedback} onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))} placeholder="Optional feedback…" /></div>
        </div>
      </Modal>
    </div>
  );
}
