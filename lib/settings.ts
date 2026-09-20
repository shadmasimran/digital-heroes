import { createClient } from '@/lib/supabase/server';

export type Settings = {
  monthly_price_cents: number;
  yearly_price_cents: number;
  /** % of each subscription (monthly-equivalent) that feeds the prize pool. */
  prize_pool_percent: number;
};

const DEFAULTS: Settings = { monthly_price_cents: 49900, yearly_price_cents: 499900, prize_pool_percent: 50 };

export async function getSettings(): Promise<Settings> {
  const supabase = createClient();
  const { data } = await supabase.from('settings').select('key,value');
  const out: any = { ...DEFAULTS };
  (data || []).forEach((r: any) => { out[r.key] = Number(r.value); });
  return out as Settings;
}
