/** Image if the charity has one, otherwise a generated tile from its initials. */
const TONES = [
  { bg: '#F6DCD2', fg: '#10312B', ring: '#F5B83D' },
  { bg: '#2F7F79', fg: '#FBFCFA', ring: '#F6DCD2' },
  { bg: '#F5B83D', fg: '#10312B', ring: '#10312B' },
  { bg: '#10312B', fg: '#FBFCFA', ring: '#F5B83D' },
];

export function CharityArt({ name, imageUrl, className = '' }: { name: string; imageUrl?: string | null; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const t = TONES[hash % TONES.length];
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`} style={{ background: t.bg }} aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        {[30, 60, 90].map((r, i) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={t.ring} strokeOpacity={0.55 - i * 0.14} strokeWidth="2" />
        ))}
      </svg>
      <span className="relative font-display text-5xl" style={{ color: t.fg }}>{initials}</span>
    </div>
  );
}
