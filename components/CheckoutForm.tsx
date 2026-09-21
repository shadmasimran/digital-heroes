'use client';
import { useState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';

/** Test-card form with light input formatting and a one-click "use test card" helper. */
export function CheckoutForm({
  action, plan, payLabel,
}: { action: (formData: FormData) => void | Promise<void>; plan: string; payLabel: string }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const fmtNumber = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const fillTestCard = () => {
    setName((n) => n || 'Test User');
    setNumber('4242 4242 4242 4242');
    setExpiry(`12/${String((new Date().getFullYear() + 3) % 100).padStart(2, '0')}`);
    setCvc('123');
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="plan" value={plan} />
      <div>
        <label htmlFor="name" className="label">Name on card</label>
        <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="cc-name" required className="field" />
      </div>
      <div>
        <label htmlFor="number" className="label">Card number</label>
        <input
          id="number" name="number" value={number} onChange={(e) => setNumber(fmtNumber(e.target.value))}
          inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" required className="field tracking-wide"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expiry" className="label">Expiry (MM/YY)</label>
          <input
            id="expiry" name="expiry" value={expiry} onChange={(e) => setExpiry(fmtExpiry(e.target.value))}
            inputMode="numeric" autoComplete="cc-exp" placeholder="12/30" required className="field"
          />
        </div>
        <div>
          <label htmlFor="cvc" className="label">CVC</label>
          <input
            id="cvc" name="cvc" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric" autoComplete="cc-csc" placeholder="123" required className="field"
          />
        </div>
      </div>
      <button type="button" onClick={fillTestCard} className="text-sm font-semibold text-tide underline">
        Fill in the test card for me
      </button>
      <SubmitButton className="btn btn-primary w-full py-3.5 text-base" pending="Processing payment…">{payLabel}</SubmitButton>
    </form>
  );
}
