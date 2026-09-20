'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { flash } from '@/lib/flash';

const MAX_BYTES = 5 * 1024 * 1024;

/** Winner uploads a screenshot of their scores as proof (PRD §09). */
export async function uploadProof(formData: FormData) {
  const v = await requireUser();
  const winnerId = String(formData.get('winner_id') ?? '');
  const file = formData.get('proof');
  const admin = createAdminClient();

  const { data: winner } = await admin.from('winners').select('*').eq('id', winnerId).maybeSingle();
  if (!winner || winner.user_id !== v.user.id) flash('/dashboard', 'error', 'Winning entry not found.');
  if (!['pending_proof', 'rejected'].includes(winner.verification_status))
    flash('/dashboard', 'error', 'Proof has already been submitted for this win.');
  if (!(file instanceof File) || file.size === 0) flash('/dashboard', 'error', 'Choose a screenshot to upload.');
  const f = file as File;
  if (!f.type.startsWith('image/')) flash('/dashboard', 'error', 'Proof must be an image (PNG, JPG, WebP).');
  if (f.size > MAX_BYTES) flash('/dashboard', 'error', 'Image is too large — keep it under 5 MB.');

  const ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${v.user.id}/${winnerId}-${Date.now()}.${ext}`;
  const { error } = await admin.storage.from('proofs').upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
  if (error) flash('/dashboard', 'error', 'Upload failed. Please try again.');

  await admin.from('winners').update({ proof_path: path, verification_status: 'submitted', review_note: null }).eq('id', winnerId);
  flash('/dashboard', 'msg', 'Proof submitted. An admin will review it shortly.');
}
