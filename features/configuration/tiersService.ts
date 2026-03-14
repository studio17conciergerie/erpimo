import { supabase } from '@/lib/supabaseClient';

export type Tiers = {
  id: string;
  type_tiers: 'PROPRIETAIRE' | 'LOCATAIRE' | 'FOURNISSEUR' | 'SYSTEME';
  sous_type: 'OTA' | 'MENAGE' | 'MAINTENANCE' | 'ASSURANCE' | 'AUTRE' | null;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  pays: string | null;
  iban: string | null;
  bic: string | null;
  code_auxiliaire: string | null;
  notes: string | null;
  is_systeme: boolean;
  created_at: string;
  updated_at: string;
};

export const tiersService = {
  async getTiers() {
    const { data, error } = await supabase
      .from('tiers')
      .select('*')
      .order('nom');
    
    if (error) throw error;
    return data as Tiers[];
  },

  async createTiers(tiers: Partial<Tiers>) {
    const { data, error } = await supabase
      .from('tiers')
      .insert(tiers)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTiers(id: string, updates: Partial<Tiers>) {
    const { data, error } = await supabase
      .from('tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTiers(id: string) {
    const { error } = await supabase
      .from('tiers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
