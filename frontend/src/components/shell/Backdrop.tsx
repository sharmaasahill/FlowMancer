/** Slow crimson aurora behind the app, with film grain and a vignette. */
export default function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-noir-950" aria-hidden>
      <div className="absolute -left-[12%] -top-[22%] h-[70vh] w-[70vh] animate-drift rounded-full bg-crimson/45 blur-[120px]" />
      <div className="absolute -bottom-[25%] right-[-10%] h-[80vh] w-[80vh] animate-drift-slow rounded-full bg-crimson-800/55 blur-[140px]" />
      <div className="absolute left-[38%] top-[30%] h-[45vh] w-[45vh] animate-drift rounded-full bg-rose/[0.10] blur-[120px] [animation-delay:-9s]" />
      <div className="grain absolute inset-0 opacity-[0.07] mix-blend-soft-light" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(7,4,5,0.85))' }} />
    </div>
  );
}
