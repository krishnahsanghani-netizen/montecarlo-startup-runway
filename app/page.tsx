import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">Startup Runway and Growth Monte Carlo Lab</h1>
        <p className="max-w-3xl text-slate-700 dark:text-slate-300">
          Quantify runway risk under uncertainty across growth, churn, costs, macro conditions, and fundraising outcomes.
        </p>
        <Link href="/model" className="inline-block rounded bg-sky-500 px-4 py-2 font-medium text-slate-950">
          Get Started
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-semibold">Runway Risk</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">View default probability curves and cash fan charts.</p>
        </article>
        <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-semibold">Fundraising Odds</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">Model close probability with ARR, growth, and macro effects.</p>
        </article>
        <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-semibold">Scenario Comparison</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">Compare base, bull, and bear outcomes side by side.</p>
        </article>
      </div>
    </section>
  );
}
