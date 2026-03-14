import { supabase } from '@/lib/supabaseClient';

export type Traveler = {
  id: string;
  type_tiers: 'VOYAGEUR';
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  pays: string | null;
  code_auxiliaire: string | null;
  is_blacklisted: boolean;
  nationalite: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  reservations_count?: number;
};

export const travelerService = {
  async getTravelers() {
    const { data, error } = await supabase
      .from('tiers')
      .select('*, reservations:reservations(count)')
      .eq('type_tiers', 'VOYAGEUR')
      .order('nom');
    
    if (error) throw error;
    return data.map((t: any) => ({
      ...t,
      reservations_count: t.reservations?.[0]?.count || 0
    })) as Traveler[];
  },

  async getTravelerById(id: string) {
    const { data, error } = await supabase
      .from('tiers')
      .select('*, reservations(*, logement:logements(nom))')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createTraveler(traveler: Partial<Traveler>) {
    const { data, error } = await supabase
      .from('tiers')
      .insert({ ...traveler, type_tiers: 'VOYAGEUR' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTraveler(id: string, updates: Partial<Traveler>) {
    const { data, error } = await supabase
      .from('tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getTravelerLedger(codeAuxiliaire: string) {
    // For travelers, we look for account 411-LOC or their specific code
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select('*')
      .or(`compte_debit.eq.${codeAuxiliaire},compte_credit.eq.${codeAuxiliaire},compte_debit.eq.411-LOC,compte_credit.eq.411-LOC`)
      .order('date_ecriture', { ascending: true });

    if (error) throw error;
    return data;
  }
};
