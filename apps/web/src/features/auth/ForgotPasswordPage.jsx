import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Mail, CheckCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/password/request-reset', { email });
      setSent(true);
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  if (sent) return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">Check your email</h3>
      <p className="text-sm text-gray-500 mb-4">If that email exists, a reset link has been sent.</p>
      <Link to="/login" className="btn-primary">Back to login</Link>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Reset password</h2>
      <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send a reset link</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" required autoFocus />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Sending…' : <><Mail className="w-4 h-4" /> Send reset link</>}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        <Link to="/login" className="text-primary-600 hover:underline">← Back to login</Link>
      </p>
    </div>
  );
}

export default ForgotPasswordPage;
