import { createAdminClient } from '@/lib/supabase/admin';
import { markPaid, reviewWinner } from '@/app/actions/admin';
import { money, monthLabel } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { StatusPill } from '@/components/StatusPill';

export default async function AdminWinners({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const admin = createAdminClient();
  const { data: winners } = await admin
    .from('winners').select('*, draws(month), profiles(full_name)').order('created_at', { ascending: false });

  // Proof screenshots live in a private bucket; hand the admin a short-lived link.
  const withProof = await Promise.all((winners || []).map(async (w: any) => {
    if (!w.proof_path) return { ...w, proofUrl: null };
    const { data } = await admin.storage.from('proofs').createSignedUrl(w.proof_path, 3600);
    return { ...w, proofUrl: data?.signedUrl || null };
  }));

  return (
    <div>
      <h1 className="text-4xl">Winners</h1>
      <p className="mt-2 text-kelp/70">Review each screenshot, approve or reject it, then mark the payout as paid.</p>
      <div className="mt-5"><Flash msg={searchParams.msg} error={searchParams.error} /></div>

      {withProof.length === 0 ? (
        <p className="rounded-xl border border-dashed border-kelp/25 p-8 text-center text-kelp/60">No winners yet. They appear here as soon as a draw is published.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-paper">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-kelp/10"><tr>
              <th className="th">Winner</th><th className="th">Draw</th><th className="th">Prize</th><th className="th">Proof</th><th className="th">Verification</th><th className="th">Payment</th><th className="th">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-kelp/10">
              {withProof.map((w: any) => (
                <tr key={w.id}>
                  <td className="td font-semibold">{w.profiles?.full_name || 'Subscriber'}<br /><span className="text-xs font-normal text-kelp/60">{w.tier} matches</span></td>
                  <td className="td">{monthLabel(w.draws.month)}</td>
                  <td className="td font-display text-lg">{money(w.prize_cents)}</td>
                  <td className="td">{w.proofUrl ? <a href={w.proofUrl} target="_blank" rel="noreferrer" className="font-semibold text-tide underline">View screenshot</a> : <span className="text-kelp/50">Not uploaded</span>}</td>
                  <td className="td"><StatusPill status={w.verification_status} /></td>
                  <td className="td"><StatusPill status={w.payment_status} /></td>
                  <td className="td">
                    {w.verification_status === 'submitted' && (
                      <div className="space-y-2">
                        <form action={reviewWinner}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="decision" value="approve" /><SubmitButton className="btn btn-dark btn-sm" pending="…">Approve</SubmitButton></form>
                        <form action={reviewWinner} className="flex gap-2">
                          <input type="hidden" name="id" value={w.id} /><input type="hidden" name="decision" value="reject" />
                          <input name="note" placeholder="Reason" aria-label="Rejection reason" className="field py-1.5 text-sm" />
                          <SubmitButton className="btn btn-danger btn-sm" pending="…">Reject</SubmitButton>
                        </form>
                      </div>
                    )}
                    {w.verification_status === 'approved' && w.payment_status === 'pending' && (
                      <form action={markPaid}><input type="hidden" name="id" value={w.id} /><SubmitButton className="btn btn-primary btn-sm" pending="…">Mark as paid</SubmitButton></form>
                    )}
                    {w.payment_status === 'paid' && <span className="text-sm text-kelp/60">Complete</span>}
                    {w.verification_status === 'pending_proof' && <span className="text-sm text-kelp/60">Waiting for proof</span>}
                    {w.verification_status === 'rejected' && <span className="text-sm text-kelp/60">Waiting for new proof</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
