import { Wrench } from "lucide-react";

export default function MaintenancePage({ title, message }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

      <section className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <Wrench className="h-8 w-8" aria-hidden="true" />
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
          Manutenção programada
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-300">
          {message}
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          Equipe trabalhando nas atualizações
        </div>
      </section>
    </main>
  );
}
