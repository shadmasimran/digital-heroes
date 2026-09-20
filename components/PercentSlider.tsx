'use client';
import { useState } from 'react';

/** Charity contribution picker (10–100%) with a live rupee preview. */
export function PercentSlider({ defaultValue = 10, monthlyCents }: { defaultValue?: number; monthlyCents: number }) {
  const [pct, setPct] = useState(defaultValue);
  const rupees = Math.round((monthlyCents * pct) / 100 / 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor="charity_percent" className="label">Share of your subscription for charity</label>
        <span className="font-display text-2xl">{pct}%</span>
      </div>
      <input
        id="charity_percent" name="charity_percent" type="range" min={10} max={100} step={1}
        value={pct} onChange={(e) => setPct(Number(e.target.value))}
        className="w-full accent-[#2F7F79]"
      />
      <p className="hint">That is about ₹{rupees.toLocaleString('en-IN')} of every monthly payment. The minimum is 10%.</p>
    </div>
  );
}
