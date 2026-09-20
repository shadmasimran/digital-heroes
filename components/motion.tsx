'use client';
import { motion, useReducedMotion, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

/** Page-load entrance used once, on the hero. Respects prefers-reduced-motion. */
export function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to a rupee amount. */
export function CountUp({ rupees }: { rupees: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? rupees : 0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, rupees, { duration: 1.6, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [rupees, reduce]);
  return <>₹{n.toLocaleString('en-IN')}</>;
}
