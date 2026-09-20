import { CountUp, Rise } from '@/components/motion';

/**
 * Hero visual: a single gift at the centre, ripples travelling out to the causes it reaches.
 * Pure CSS animation for the rings; reduced-motion users get static rings.
 */
export function RippleArt({ raisedCents, causes, charityCount }: { raisedCents: number; causes: string[]; charityCount: number }) {
  const positions = [
    'left-[4%] top-[22%]',
    'right-[2%] top-[44%]',
    'left-[16%] bottom-[10%]',
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <div className="absolute inset-0 rounded-full bg-kelp" />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="ripple-ring" style={{ animationDelay: `${i * 1.8}s`, ['--s' as any]: 0.32 + i * 0.22 }} />
      ))}
      <div className="absolute left-1/2 top-1/2 h-[13%] w-[13%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marigold shadow-[0_0_60px_10px_rgba(245,184,61,.45)]" />

      {causes.slice(0, 3).map((c, i) => (
        <span key={c} className={`absolute ${positions[i]} rounded-full bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-kelp shadow-lg`}>
          {c}
        </span>
      ))}

      <Rise delay={0.9} className="absolute -bottom-4 left-1/2 w-[86%] -translate-x-1/2 rounded-2xl bg-paper px-5 py-4 text-center shadow-xl sm:w-[74%]">
        {raisedCents > 0 ? (
          <>
            <p className="font-display text-3xl leading-none text-kelp"><CountUp rupees={Math.round(raisedCents / 100)} /></p>
            <p className="mt-1.5 text-sm text-kelp/70">given to {charityCount} charities so far</p>
          </>
        ) : (
          <p className="text-sm font-semibold text-kelp">{charityCount} charities are waiting for their first gift.</p>
        )}
      </Rise>
    </div>
  );
}
