import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Check, Zap, Shield, Star, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { Badge } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const PLAN_ICONS = { FREE: Zap, BASIC: Shield, STANDARD: Star, ENTERPRISE: CreditCard };
const PLAN_COLORS = {
  FREE:       'border-gray-200 bg-white',
  BASIC:      'border-blue-200 bg-blue-50',
  STANDARD:   'border-primary-300 bg-primary-50 ring-2 ring-primary-500',
  ENTERPRISE: 'border-purple-200 bg-purple-50',
};

export default function BillingPage() {
  const qc = useQueryClient();

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/billing/subscription').then((r) => r.data.data),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get('/billing/plans').then((r) => r.data.data),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan) => api.post('/billing/checkout', { plan }),
    onSuccess: (res) => {
      const url = res.data?.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Unable to retrieve checkout session URL.');
      }
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message || 'Could not start checkout. Please try again.';
      toast.error(msg);
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => api.post('/billing/portal'),
    onSuccess: (res) => {
      const url = res.data?.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Unable to retrieve billing portal URL.');
      }
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message || 'Could not open billing portal.';
      toast.error(msg);
    },
  });

  // Handle Stripe Checkout return URLs (?success=true&session_id=... or ?cancelled=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('success') === 'true';
    const isCancelled = params.get('cancelled') === 'true';
    const sessionId = params.get('session_id');

    if (isSuccess && sessionId) {
      toast.loading('Confirming your subscription…', { id: 'verify-sub' });
      api
        .post('/billing/verify-session', { sessionId })
        .then(() => {
          toast.success('Subscription activated successfully! Welcome to your new plan.', {
            id: 'verify-sub',
          });
          qc.invalidateQueries({ queryKey: ['subscription'] });
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          qc.invalidateQueries({ queryKey: ['subscription'] });
          toast.error(
            err.response?.data?.message ||
              'Subscription verification pending. Please refresh in a moment.',
            { id: 'verify-sub' }
          );
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (isCancelled) {
      toast('Checkout was cancelled.', { icon: 'ℹ️' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [qc]);

  if (subLoading || plansLoading) return <PageLoader />;

  const currentPlan = sub?.plan ?? 'FREE';
  const status      = sub?.status ?? 'INACTIVE';
  const periodEnd   = sub?.currentPeriodEnd;
  const trialEnd    = sub?.trialEndsAt;

  const STATUS_BADGE = {
    ACTIVE: 'green',
    TRIALING: 'blue',
    PAST_DUE: 'red',
    CANCELLED: 'gray',
    INACTIVE: 'gray',
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="page-title">Billing & Subscription</h1>
        <p className="page-subtitle">Manage your school's subscription plan</p>
      </div>

      {/* Current plan card */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold text-gray-900">
                Current Plan: <span className="text-primary-600">{currentPlan}</span>
              </h2>
              <Badge variant={STATUS_BADGE[status] ?? 'gray'}>{status}</Badge>
            </div>
            {status === 'TRIALING' && trialEnd && (
              <p className="text-sm text-amber-600">
                ⏳ Trial ends {new Date(trialEnd).toLocaleDateString()}
              </p>
            )}
            {periodEnd && status === 'ACTIVE' && (
              <p className="text-sm text-gray-500">
                Next billing: {new Date(periodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          {currentPlan !== 'FREE' && (
            <button
              className="btn-secondary"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              <CreditCard className="w-4 h-4" />
              {portalMutation.isPending ? 'Loading…' : 'Manage Billing'}
              <ExternalLink className="w-3.5 h-3.5 ml-1 text-gray-400" />
            </button>
          )}
        </div>

        {/* Recent payments */}
        {sub?.payments?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Recent Payments</p>
            <div className="space-y-2">
              {sub.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-medium">
                    ${p.amount} {p.currency}
                  </span>
                  <Badge variant={p.status === 'succeeded' ? 'green' : 'red'}>
                    {p.status}
                  </Badge>
                  {p.invoiceUrl && (
                    <a
                      href={p.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 text-xs hover:underline inline-flex items-center gap-1"
                    >
                      Receipt <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose a Plan</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(plans ?? []).map((plan) => {
            const Icon = PLAN_ICONS[plan.id] ?? Zap;
            const isCurrent = plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={clsx(
                  'card p-5 flex flex-col transition-all',
                  PLAN_COLORS[plan.id] ?? 'border-gray-200 bg-white'
                )}
              >
                {plan.id === 'STANDARD' && (
                  <div className="text-xs font-bold text-primary-600 mb-2 flex items-center gap-1">
                    <Star className="w-3 h-3" /> MOST POPULAR
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-gray-900">
                    ${plan.price}
                  </span>
                  {plan.price > 0 && <span className="text-gray-400 text-sm">/mo</span>}
                  {plan.price === 0 && <span className="text-gray-400 text-sm"> free</span>}
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  {plan.maxStudents === -1
                    ? 'Unlimited students'
                    : `Up to ${plan.maxStudents} students`}
                </p>

                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button className="btn-secondary w-full" disabled>
                    Current Plan
                  </button>
                ) : plan.price === 0 ? (
                  <button className="btn-secondary w-full" disabled>
                    Downgrade
                  </button>
                ) : (
                  <button
                    className="btn-primary w-full"
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending
                      ? 'Redirecting…'
                      : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {[
            [
              'Can I change my plan anytime?',
              'Yes, you can upgrade or downgrade at any time. Changes take effect immediately.',
            ],
            [
              'What happens when my trial ends?',
              'Your school will be moved to the Free plan automatically. No charges without your consent.',
            ],
            [
              'Do you offer discounts for non-profits?',
              'Yes! Contact us at billing@timhirthub.com for special pricing for NGOs and community schools.',
            ],
            [
              'Is my payment data secure?',
              'All payments are processed by Stripe, a PCI-DSS Level 1 certified provider. We never store card details.',
            ],
          ].map(([q, a]) => (
            <div key={q}>
              <p className="text-sm font-semibold text-gray-800">{q}</p>
              <p className="text-sm text-gray-500 mt-0.5">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
