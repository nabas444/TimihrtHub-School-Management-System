import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Avatar, Badge, SearchInput, Pagination } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import { Users } from 'lucide-react';

export default function StaffPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['teachers', page, search],
    queryFn: () => api.get(`/staff/teachers?page=${page}&limit=15&search=${search}`).then((r) => r.data),
    keepPreviousData: true,
  });

  const teachers = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Staff & Teachers</h1><p className="page-subtitle">{meta.total ?? 0} staff members</p></div>
      </div>

      <div className="w-full max-w-sm">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search staff…" />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={`${t.firstName} ${t.lastName}`} src={t.avatar} size="lg" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{t.firstName} {t.lastName}</h3>
                  <p className="text-xs text-gray-500 truncate">{t.teacherProfile?.qualification ?? 'Teacher'}</p>
                  {t.teacherProfile?.specialization && <p className="text-xs text-primary-600">{t.teacherProfile.specialization}</p>}
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-400">
                <p>📧 {t.email}</p>
                {t.phone && <p>📞 {t.phone}</p>}
                {t.teacherProfile?.classTeacherOf && <p className="text-primary-600 font-medium">Class Teacher: {t.teacherProfile.classTeacherOf.name}</p>}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {t.teacherProfile?.subjectTeachings?.slice(0, 3).map((st) => (
                  <Badge key={st.subjectId} variant="gray">{st.subject?.name}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}
