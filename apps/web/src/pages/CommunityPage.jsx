import { MessageSquare, Github, Lightbulb, HeartHandshake, ArrowUpRight, Map } from 'lucide-react';

const CHANNELS = [
  {
    icon: MessageSquare,
    title: 'Discussion Forum',
    desc: 'Ask questions, share how your school uses TimhirtHub, and get answers from the team and other admins.',
    cta: 'Join the discussion',
    href: '#',
  },
  {
    icon: Github,
    title: 'GitHub',
    desc: 'Browse the roadmap, file bug reports, or open a pull request. TimhirtHub development happens in the open.',
    cta: 'View on GitHub',
    href: '#',
  },
  {
    icon: Lightbulb,
    title: 'Feature Requests',
    desc: 'Have an idea for TimhirtHub? Submit and upvote feature requests to help shape what we build next.',
    cta: 'Suggest a feature',
    href: '#',
  },
  {
    icon: HeartHandshake,
    title: 'Contribute',
    desc: 'Read the contribution guide to help translate, report issues, or contribute code — including the AM/OM translations.',
    cta: 'Read the contribution guide',
    href: '#',
  },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <HeartHandshake className="w-10 h-10 mx-auto mb-4 text-primary-200" />
          <h1 className="text-3xl font-bold">TimhirtHub Community</h1>
          <p className="mt-2 text-primary-100 max-w-xl mx-auto">
            Built with schools, for schools. Connect with other administrators, teachers, and contributors.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 gap-6">
          {CHANNELS.map((c) => (
            <a key={c.title} href={c.href} className="card-hover card-body flex flex-col">
              <c.icon className="w-6 h-6 text-primary-600 mb-3" />
              <h2 className="font-semibold text-gray-900 mb-1">{c.title}</h2>
              <p className="text-sm text-gray-600 flex-1">{c.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700">
                {c.cta} <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </a>
          ))}
        </div>

        <section className="card card-body mt-6">
          <div className="flex items-center gap-3 mb-3">
            <Map className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Where TimhirtHub is headed</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            The current focus is test coverage and hardening across every module. After that, we\u2019re prioritizing
            expanded parent-facing views and deeper offline support.
          </p>
          <a href="/release-notes" className="btn-secondary btn-sm">
            View release notes <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </section>

        <p className="text-center text-xs text-gray-400 mt-10">
          Please be respectful in all community spaces. See our Code of Conduct for details.
        </p>
      </div>
    </div>
  );
}
