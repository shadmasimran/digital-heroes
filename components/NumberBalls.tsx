/** Drawn numbers as circles; numbers the viewer holds are highlighted. */
export function NumberBalls({ numbers, mine = [] }: { numbers: number[]; mine?: number[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label={`Drawn numbers: ${numbers.join(', ')}`}>
      {numbers.map((n) => {
        const hit = mine.includes(n);
        return (
          <li key={n} className={`flex h-11 w-11 items-center justify-center rounded-full font-display text-lg ${hit ? 'bg-marigold text-kelp' : 'bg-kelp text-paper'}`}>
            {n}
          </li>
        );
      })}
    </ul>
  );
}
