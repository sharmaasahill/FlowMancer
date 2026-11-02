/**
 * Crimson glow behind the app, with film grain and a vignette.
 * Drawn with plain gradients (no blur filters, no animation), so the browser paints it once
 * instead of re-blurring three full-screen shapes on every frame.
 */
const GLOW = [
  'radial-gradient(38vmax 38vmax at 8% 6%, rgba(155,19,19,0.42), transparent 70%)',
  'radial-gradient(44vmax 44vmax at 96% 104%, rgba(92,10,10,0.55), transparent 70%)',
  'radial-gradient(26vmax 26vmax at 56% 48%, rgba(201,143,143,0.07), transparent 70%)',
  'radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(7,4,5,0.85))',
].join(', ');

export default function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-noir-950" style={{ backgroundImage: GLOW }} aria-hidden>
      <div className="grain absolute inset-0 opacity-[0.035]" />
    </div>
  );
}
