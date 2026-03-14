import { supabase } from '@/lib/supabaseClient';

export type Property = {
  id: string;
  proprietaire_id: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  listing_id: string | null;
  nickname: string | null;
  type_bien: string | null;
  surface_m2: number | null;
  nb_chambres: number | null;
  statut: 'ACTIF' | 'INACTIF' | 'MAINTENANCE';
  created_at: string;
  updated_at: string;
  tiers?: { nom: string; prenom: string | null };
  regles_financieres_logement?: FinancialRules;
};

export type FinancialRules = {
  id: string;
  logement_id: string;
  taux_commission_agence: number | null;
  fournisseur_menage_id: string | null;
  forfait_menage: number | null;
  forfait_assurance: number | null;
  taxe_sejour_par_nuit: number | null;
  notes: string | null;
};

export const propertyService = {
  async getProperties() {
    const { data, error } = await supabase
      .from('logements')
      .select(`
        *,
        tiers:proprietaire_id (nom, prenom),
        regles_financieres_logement (*)
      `)
      .order('nom');
    
    if (error) throw error;
    return data as Property[];
  },

  async getPropertyById(id: string) {
    const { data, error } = await supabase
      .from('logements')
      .select(`
        *,
        tiers:proprietaire_id (nom, prenom),
        regles_financieres_logement (*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Property;
  },

  async createProperty(property: Partial<Property>) {
    const { data, error } = await supabase
      .from('logements')
      .insert(property)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateProperty(id: string, updates: Partial<Property>) {
    const { data, error } = await supabase
      .from('logements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async upsertFinancialRules(rules: Partial<FinancialRules>) {
    const { data, error } = await supabase
      .from('regles_financieres_logement')
      .upsert(rules, { onConflict: 'logement_id' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getOwners() {
    const { data, error } = await supabase
      .from('tiers')
      .select('id, nom, prenom')
      .eq('type_tiers', 'PROPRIETAIRE')
      .order('nom');
      
    if (error) throw error;
    return data;
  },

  async getSuppliers() {
    const { data, error } = await supabase
      .from('tiers')
      .select('id, nom')
      .eq('type_tiers', 'FOURNISSEUR')
      .order('nom');

    if (error) throw error;
    return data;
  }
};
