import { supabase } from '@/lib/supabaseClient';
import { accountingEngine, JournalEntry } from '@/features/accounting/accountingEngine';

export type TypeBailMtr = 'MOBILITE' | 'ETUDIANT' | 'CIVIL';
export type StatutBailMtr = 'BROUILLON' | 'ACTIF' | 'TERMINE' | 'RESILIE';
export type SourceBailMtr = 'DIRECT' | 'AIRBNB';
export type MotifBailMtr = 'FORMATION_PROFESSIONNELLE' | 'ETUDES_SUPERIEURES' | 'STAGE' | 'MUTATION_PROFESSIONNELLE' | 'MISSION_TEMPORAIRE' | 'SERVICE_CIVIQUE' | 'AUTRE';
export type StatutCautionMtr = 'NON_APPLICABLE' | 'NON_VERSEE' | 'ENCAISSEE' | 'RESTITUEE' | 'RETENUE_PARTIELLE';

export interface BailMtr {
  id: string;
  numero_bail: string;
  logement_id: string;
  locataire_id: string;
  mandat_id: string | null;
  statut: StatutBailMtr;
  type_bail: TypeBailMtr;
  source: SourceBailMtr;
  motif_bail: MotifBailMtr | null;
  motif_bail_detail: string | null;
  date_debut: string;
  date_fin: string;
  date_signature: string | null;
  date_notification_preavis: string | null;
  duree_preavis_mois: number;
  loyer_hc: number;
  provision_charges: number;
  loyer_cc: number;
  montant_caution: number;
  frais_agence_locataire: number;
  jour_exigibilite: number;
  statut_caution: StatutCautionMtr;
  date_encaissement_caution: string | null;
  date_restitution_caution: string | null;
  montant_retenue_caution: number;
  motif_retenue_caution: string | null;
  etat_lieux_entree_url: string | null;
  etat_lieux_sortie_url: string | null;
  contrat_bail_url: string | null;
  meuble: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  logement?: { id: string; nom: string; proprietaire_id: string; proprietaire?: { id: string; nom: string; code_auxiliaire?: string } };
  locataire?: { id: string; nom: string; prenom: string; code_auxiliaire: string; is_blacklisted?: boolean };
}

export const mtrService = {
  async getBaux(filters?: { statut?: StatutBailMtr[]; logementId?: string; proprietaireId?: string }) {
    let query = supabase
      .from('baux_mtr')
      .select(`
        *,
        logement:logements(id, nom, proprietaire:proprietaire_id(id, nom, code_auxiliaire)),
        locataire:tiers(id, nom, prenom, code_auxiliaire)
      `)
      .order('created_at', { ascending: false });

    if (filters?.statut && filters.statut.length > 0) {
      query = query.in('statut', filters.statut);
    }
    if (filters?.logementId) {
      query = query.eq('logement_id', filters.logementId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as BailMtr[];
  },

  async getBailById(id: string) {
    const { data, error } = await supabase
      .from('baux_mtr')
      .select(`
        *,
        logement:logements(id, nom, proprietaire:proprietaire_id(id, nom, code_auxiliaire)),
        locataire:tiers(id, nom, prenom, code_auxiliaire, email, telephone, is_blacklisted)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as BailMtr;
  },

  async createBail(bail: Partial<BailMtr>) {
    const { data, error } = await supabase
      .from('baux_mtr')
      .insert(bail)
      .select()
      .single();
    
    if (error) throw error;
    return data as BailMtr;
  },

  async updateBail(id: string, updates: Partial<BailMtr>) {
    const { data, error } = await supabase
      .from('baux_mtr')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as BailMtr;
  },

  async checkConflicts(logementId: string, dateDebut: string, dateFin: string) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, check_in, check_out, guest_name')
      .eq('logement_id', logementId)
      .neq('statut_workflow', 'REDDITION')
      .or(`check_in.lte.${dateFin},check_out.gte.${dateDebut}`);

    if (error) throw error;
    
    // Filter overlaps more precisely in JS
    const overlaps = data.filter(res => {
        return (res.check_in <= dateFin && res.check_out >= dateDebut);
    });

    return overlaps;
  },

  async getActiveProperties() {
    const { data, error } = await supabase
      .from('logements')
      .select('id, nom, proprietaire:proprietaire_id(id, nom)')
      .eq('statut', 'ACTIF')
      .order('nom');
    
    if (error) throw error;
    return data;
  },

  async getTenants() {
    const { data, error } = await supabase
      .from('tiers')
      .select('id, nom, prenom, code_auxiliaire, is_blacklisted')
      .eq('type_tiers', 'VOYAGEUR')
      .order('nom');
    
    if (error) throw error;
    return data;
  },

  async createQuickTenant(tenant: { nom: string; prenom: string; email: string; telephone: string }) {
    const { data, error } = await supabase
      .from('tiers')
      .insert({
        ...tenant,
        type_tiers: 'VOYAGEUR'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async recordCautionAccounting(bail: BailMtr, type: 'ENCAISSEMENT' | 'RESTITUTION' | 'RETENUE', amount: number, details?: { retenueAmount?: number; motif?: string }) {
    const entries: JournalEntry[] = [];
    const date = new Date().toISOString().split('T')[0];
    const locataireNom = `${bail.locataire?.nom} ${bail.locataire?.prenom}`;
    let journalCode = 'OD';
    let libellePiece = '';

    if (type === 'ENCAISSEMENT') {
      // L'écriture 512000 sera créée par le rapprochement bancaire
      return true;
    } else if (type === 'RESTITUTION') {
      // L'écriture 512000 sera créée par le rapprochement bancaire
      return true;
    } else if (type === 'RETENUE') {
      libellePiece = `Retenue Caution ${locataireNom}`;
      const retenueAmount = details?.retenueAmount || 0;
      const ownerCode = bail.logement?.proprietaire?.code_auxiliaire;

      if (retenueAmount > 0) {
        entries.push({
          date_ecriture: date,
          libelle: `Retenue Caution ${locataireNom} - ${details?.motif}`,
          compte_debit: '419000',
          compte_credit: ownerCode || '404000',
          montant: retenueAmount,
          journal_code: 'OD',
          tiers_id: bail.locataire_id
        });
        journalCode = 'OD';
      }
    }

    if (entries.length > 0) {
      await accountingEngine.createPieceAndEntries(
        journalCode,
        date,
        libellePiece,
        'CAUTION',
        bail.id,
        entries
      );
    }
    
    return true;
  }
};
