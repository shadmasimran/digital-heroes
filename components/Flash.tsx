/** Success / error message carried in the URL by server actions (see lib/flash.ts). */
export function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  const isError = Boolean(error);
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium ${isError ? 'bg-red-100 text-red-900' : 'bg-tide/15 text-kelp'}`}
    >
      {error || msg}
    </div>
  );
}
