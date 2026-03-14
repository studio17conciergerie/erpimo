import { supabase } from '@/lib/supabaseClient';

export interface BankMovement {
  id?: string;
  date_operation: string;
  libelle_banque: string;
  montant: number;
  est_rapproche: boolean;
  hash_unique: string;
  created_at?: string;
}

export const banqueService = {
  async getMovements() {
    const { data, error } = await supabase
      .from('mouvements_bancaires')
      .select('*')
      .order('date_operation', { ascending: false });
    
    if (error) throw error;
    return data as BankMovement[];
  },

  async importMovements(movements: BankMovement[], compteBanque: string = '512000') {
    const { data, error } = await supabase.rpc('fn_import_bank_movements_v2', {
      p_movements: movements,
      p_compte_banque: compteBanque
    });

    if (error) throw error;
    return data;
  },

  async deleteMovement(id: string) {
    const { error } = await supabase
      .from('mouvements_bancaires')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
