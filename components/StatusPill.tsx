const STYLES: Record<string, string> = {
  active: 'bg-tide/15 text-tide',
  lapsed: 'bg-marigold/30 text-kelp',
  cancelled: 'bg-kelp/10 text-kelp/70',
  inactive: 'bg-kelp/10 text-kelp/70',
  pending_proof: 'bg-marigold/30 text-kelp',
  submitted: 'bg-blush text-kelp',
  approved: 'bg-tide/15 text-tide',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-marigold/30 text-kelp',
  paid: 'bg-tide text-paper',
  published: 'bg-tide/15 text-tide',
  simulated: 'bg-marigold/30 text-kelp',
};
const LABELS: Record<string, string> = {
  pending_proof: 'Proof needed', submitted: 'Under review',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${STYLES[status] || 'bg-kelp/10'}`}>
      {LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
