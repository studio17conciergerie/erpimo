import { supabase } from '@/lib/supabaseClient';

export type Owner = {
  id: string;
  type_tiers: 'PROPRIETAIRE';
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
  created_at: string;
  updated_at: string;
  logements?: { count: number }[];
  logements_details?: any[];
};

export type LedgerEntry = {
  id: string;
  date_ecriture: string;
  libelle: string;
  compte_debit: string;
  compte_credit: string;
  montant: number;
  tiers_id: string | null;
  lettrage: string | null;
  numero_piece?: string;
  journal_code?: string;
};

export const ownerService = {
  async getOwners() {
    const { data, error } = await supabase
      .from('tiers')
      .select('*, logements(count)')
      .eq('type_tiers', 'PROPRIETAIRE')
      .order('nom');
    
    if (error) throw error;
    return data.map((owner: any) => ({
      ...owner,
      logements_count: owner.logements?.[0]?.count || 0
    }));
  },

  async getOwnerById(id: string) {
    const { data, error } = await supabase
      .from('tiers')
      .select('*, logements(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createOwner(owner: Partial<Owner>) {
    const { data, error } = await supabase
      .from('tiers')
      .insert({ ...owner, type_tiers: 'PROPRIETAIRE' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateOwner(id: string, updates: Partial<Owner>) {
    const { data, error } = await supabase
      .from('tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getOwnerLedger(ownerId: string, codeAuxiliaire: string) {
    // Fetch entries where the owner is involved via account code
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select(`
        *,
        piece:pieces_comptables(numero_piece, journal_code)
      `)
      .or(`compte_debit.eq.${codeAuxiliaire},compte_credit.eq.${codeAuxiliaire}`)
      .order('date_ecriture', { ascending: true });

    if (error) throw error;
    
    // Flatten piece info and sort by piece number if dates are equal
    const entries = (data as any[]).map(entry => ({
      ...entry,
      numero_piece: entry.piece?.numero_piece,
      journal_code: entry.piece?.journal_code
    }));

    entries.sort((a, b) => {
      if (a.date_ecriture !== b.date_ecriture) {
        return a.date_ecriture.localeCompare(b.date_ecriture);
      }
      return (a.numero_piece || '').localeCompare(b.numero_piece || '');
    });

    return entries as LedgerEntry[];
  }
};
