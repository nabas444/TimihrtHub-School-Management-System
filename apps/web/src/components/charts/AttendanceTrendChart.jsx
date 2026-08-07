import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function AttendanceTrendChart({ classId }) {
  const { isAdmin, isTeacher } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-trend', classId],
    queryFn: () => api.get(`/attendance/trend${classId ? `?classId=${classId}` : ''}`).then((r) => r.data.data),
    enabled: isAdmin() || isTeacher(),
  });

  if (isLoading) return <div className="card p-6 h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  const trend = data ?? [];

  const chartData = {
    labels: trend.map((d) => new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Attendance %',
        data: trend.map((d) => d.percentage),
        fill: true,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79,70,229,0.08)',
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#4f46e5',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.parsed.y}% attendance` },
        backgroundColor: '#1e1b4b',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: { min: 0, max: 100, grid: { color: '#f3f4f6' }, ticks: { callback: (v) => `${v}%`, font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900">Attendance Trend (30 days)</h3>
      </div>
      <div className="p-6 h-56">
        {trend.length > 0 ? <Line data={chartData} options={options} /> : <p className="text-center text-gray-400 text-sm pt-16">No attendance data yet</p>}
      </div>
    </div>
  );
}
