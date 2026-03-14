import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

export interface Supplier {
  id: string;
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  iban?: string;
  bic?: string;
  siret?: string;
  code_auxiliaire: string;
  solde: number;
}

export interface PendingInvoice {
  id: string;
  date_ecriture: string;
  libelle: string;
  montant: number;
  compte_debit: string;
  compte_credit: string;
  lettrage?: string;
}

export const suppliersApi = {
  async getFournisseursAvecSolde(): Promise<Supplier[]> {
    const { data, error } = await supabase.rpc('fn_get_fournisseurs_solde');

    if (error) throw error;
    return data as Supplier[];
  },

  async getFacturesEnAttente(fournisseurId: string): Promise<PendingInvoice[]> {
    // Get the supplier's code_auxiliaire
    const { data: supplier, error: supplierError } = await supabase
      .from('tiers')
      .select('code_auxiliaire')
      .eq('id', fournisseurId)
      .single();

    if (supplierError) throw supplierError;

    // Get non-lettered entries where the supplier's code is in credit (invoice) or debit (payment)
    // Usually, "factures en attente" are credits (401 is credited when invoice is received)
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select('*')
      .eq('compte_credit', supplier.code_auxiliaire)
      .is('lettrage', null)
      .order('date_ecriture', { ascending: true });

    if (error) throw error;
    return data;
  },

  async updateFournisseur(id: string, updates: Partial<Supplier>) {
    const { data, error } = await supabase
      .from('tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
