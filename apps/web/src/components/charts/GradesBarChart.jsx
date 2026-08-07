import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function GradesBarChart({ results = [] }) {
  const labels = results.map((r) => r.exam?.subject?.name ?? r.assignment?.subject?.name ?? '?');
  const scores = results.map((r) => {
    if (r.exam) return Math.round((r.marksObtained / r.exam.totalMarks) * 100);
    if (r.assignment) return r.marksObtained != null ? Math.round((r.marksObtained / r.assignment.totalMarks) * 100) : 0;
    return 0;
  });

  const colors = scores.map((s) => s >= 70 ? 'rgba(16,185,129,0.8)' : s >= 50 ? 'rgba(245,158,11,0.8)' : 'rgba(239,68,68,0.8)');

  const data = {
    labels,
    datasets: [{ label: 'Score %', data: scores, backgroundColor: colors, borderRadius: 6, borderSkipped: false }],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } } },
    scales: {
      y: { min: 0, max: 100, grid: { color: '#f3f4f6' }, ticks: { callback: (v) => `${v}%`, font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  if (!results.length) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No grades yet</div>;

  return <div className="h-48"><Bar data={data} options={options} /></div>;
}
