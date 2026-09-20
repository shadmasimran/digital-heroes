'use client';
import { useFormStatus } from 'react-dom';

/** Submit button that shows a pending state while a server action runs. */
export function SubmitButton({
  children, className = 'btn btn-dark', pending: pendingText = 'Saving…',
}: { children: React.ReactNode; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
