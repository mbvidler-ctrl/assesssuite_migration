import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Stethoscope,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildTimeProfession } from '@/lib/profession';

const capabilities = [
  {
    icon: ClipboardList,
    title: '236 canonical assessments',
    description: 'Search, administer, score and save a broad outcome-measure library from the same patient record.',
  },
  {
    icon: HeartPulse,
    title: 'Complete episodes of care',
    description: 'Keep referral context, examination, goals, treatment, repeated measures and discharge in one clinical thread.',
  },
  {
    icon: Bot,
    title: 'Six structured AI workflows',
    description: 'Prepare editable drafts for initial summaries, SOAP notes, plans, progress, referrer updates and discharge.',
  },
  {
    icon: FileText,
    title: 'Reports that stay connected',
    description: 'Build, revise, save, print and download clinical outputs from the information already recorded.',
  },
  {
    icon: Users,
    title: 'Patient and practice workspace',
    description: 'Manage clinician profiles, patients, referrers and episode history in a dedicated Physio application.',
  },
  {
    icon: CalendarCheck2,
    title: 'Progress over time',
    description: 'Compare baseline and review findings while retaining measure names, values, units and dates.',
  },
];

const workflow = [
  ['01', 'Assess', 'Capture structured subjective and objective findings, red flags and outcome measures.'],
  ['02', 'Treat and review', 'Record encounters, goals, management, home programmes and change across time.'],
  ['03', 'Report and discharge', 'Turn the episode record into editable communications and a complete closing summary.'],
];

export default function PhysioPublicLanding() {
  if (buildTimeProfession.id !== 'physio') return null;

  return (
    <div className="min-h-screen bg-[#f5faf9] text-slate-950">
      <header className="border-b border-teal-950/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="AssessSuite Physio home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white shadow-sm">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">AssessSuite</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">Physio</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
            <Button asChild className="bg-teal-800 hover:bg-teal-900">
              <Link to="/register">
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Start free trial</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-teal-950/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(13,148,136,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(15,118,110,0.10),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 shadow-sm">
                <Stethoscope className="h-4 w-4" aria-hidden="true" /> Built for Australian physiotherapy practice
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                Assessment, documentation and outcomes in one clinical thread.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                {buildTimeProfession.productName} brings patient assessment, episodes of care, outcome measures,
                clinical notes, structured AI drafts and reporting into one dedicated workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-teal-800 px-6 text-base hover:bg-teal-900">
                  <Link to="/register">Create your account <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-slate-300 bg-white px-6 text-base">
                  <Link to="/login">Sign in to your practice</Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                {['Public self-registration', 'Email verification', 'Trial access'].map((label) => (
                  <span key={label} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-700" />{label}</span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-teal-950/10 bg-slate-950 p-5 text-white shadow-2xl shadow-teal-950/15 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Episode of care</p><p className="mt-1 text-xl font-semibold">Right knee rehabilitation</p></div>
                <span className="rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-200">Active</span>
              </div>
              <div className="grid gap-3 py-5 sm:grid-cols-3">
                {[['Baseline', '42/80'], ['Current', '61/80'], ['Change', '+19']].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {['Initial examination complete', 'Outcome measures linked', 'Progress draft ready for review'].map((label, index) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${index === 2 ? 'bg-amber-300' : 'bg-teal-300'}`} />
                    <span className="text-sm text-slate-200">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">One working record</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From first presentation to discharge</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">Keep the information that matters connected, searchable and ready to reuse throughout the episode.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {workflow.map(([number, title, description]) => (
              <article key={number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-sm font-bold text-teal-700">{number}</span>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-teal-950/10 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-2xl border border-slate-200 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 leading-7 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20 text-center lg:px-8">
          <div className="rounded-[2rem] bg-teal-900 px-6 py-14 text-white shadow-xl shadow-teal-950/15 sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start your Physio workspace</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-teal-100">Register, verify your email and set up your clinician or practice profile through the normal self-service journey.</p>
            <Button asChild size="lg" className="mt-8 h-12 bg-white px-7 text-base text-teal-950 hover:bg-teal-50">
              <Link to="/register">Start free trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} {buildTimeProfession.productName}</p>
          <div className="flex gap-5"><Link to="/login" className="hover:text-teal-800">Sign in</Link><Link to="/register" className="hover:text-teal-800">Register</Link></div>
        </div>
      </footer>
    </div>
  );
}
