import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { GraduationCap } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    schoolName: '', schoolEmail: '', schoolPhone: '',
    adminFirstName: '', adminLastName: '', adminEmail: '', password: '', country: 'Ethiopia',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('School registered! Please log in.');
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.errors?.length
        ? err.response.data.errors.map((e) => e.message || `${e.field}: invalid`).join(' · ')
        : err.response?.data?.message ?? 'Registration failed';
      toast.error(errorMsg);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Register your school</h2>
      <p className="text-sm text-gray-500 mb-6">Start your 14-day free trial — no credit card needed</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">School Info</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">School name</label>
            <input className="input" value={form.schoolName} onChange={set('schoolName')} placeholder="Addis International School" required />
          </div>
          <div>
            <label className="label">School email</label>
            <input className="input" type="email" value={form.schoolEmail} onChange={set('schoolEmail')} placeholder="info@school.edu" required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.schoolPhone} onChange={set('schoolPhone')} placeholder="+251..." />
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Admin Account</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" value={form.adminFirstName} onChange={set('adminFirstName')} required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" value={form.adminLastName} onChange={set('adminLastName')} required />
          </div>
          <div>
            <label className="label">Admin email</label>
            <input className="input" type="email" value={form.adminEmail} onChange={set('adminEmail')} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} minLength={8} required />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
          {loading ? 'Creating account…' : 'Create School Account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        Already registered? <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
