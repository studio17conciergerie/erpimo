import { supabase } from '@/lib/supabaseClient';

export type StatutIntervention = 'PLANIFIE' | 'REALISE' | 'FACTURE_VALIDEE' | 'PAYE';
export type ImputationCible = 'PROPRIETAIRE' | 'LOCATAIRE' | 'AGENCE';

export interface Intervention {
  id: string;
  titre: string;
  description: string;
  logement_id: string;
  fournisseur_id: string;
  statut: StatutIntervention;
  montant_ttc: number | null;
  imputation_cible: ImputationCible | null;
  created_at: string;
  updated_at: string;
  logement?: {
    id: string;
    nom: string;
    proprietaire_id: string;
  };
  fournisseur?: {
    id: string;
    nom: string;
    code_auxiliaire: string;
  };
}

export const interventionsApi = {
  async getInterventions() {
    const { data, error } = await supabase
      .from('interventions')
      .select(`
        *,
        logement:logements(id, nom, proprietaire_id),
        fournisseur:tiers!fournisseur_id(id, nom, code_auxiliaire)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Intervention[];
  },

  async getInterventionById(id: string) {
    const { data, error } = await supabase
      .from('interventions')
      .select(`
        *,
        logement:logements(id, nom, proprietaire_id),
        fournisseur:tiers!fournisseur_id(id, nom, code_auxiliaire)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Intervention;
  },

  async createIntervention(intervention: Partial<Intervention>) {
    const { data, error } = await supabase
      .from('interventions')
      .insert(intervention)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateIntervention(id: string, updates: Partial<Intervention>) {
    const { data, error } = await supabase
      .from('interventions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async validerFactureIntervention(id: string, montant: number, imputation: ImputationCible) {
    // 1. Get intervention details with owner info
    const { data: intervention, error: intError } = await supabase
      .from('interventions')
      .select(`
        *,
        logement:logements(
          id, 
          nom, 
          proprietaire:tiers!proprietaire_id(id, nom, code_auxiliaire)
        ),
        fournisseur:tiers!fournisseur_id(id, nom, code_auxiliaire, categorie_id)
      `)
      .eq('id', id)
      .single();

    if (intError) throw intError;
    if (!intervention.fournisseur?.code_auxiliaire) throw new Error('Code auxiliaire fournisseur manquant');

    const ownerCode = (intervention.logement as any).proprietaire.code_auxiliaire;
    const supplierCode = intervention.fournisseur.code_auxiliaire;
    const journalCode = 'OD';
    const dateEcriture = new Date().toISOString().split('T')[0];

    // 2. Determine Debit Account for Invoice
    let debitAccountInvoice = '';
    if (imputation === 'PROPRIETAIRE') {
      debitAccountInvoice = ownerCode;
    } else if (imputation === 'AGENCE') {
      debitAccountInvoice = '615000'; // Entretien et réparations
    } else if (imputation === 'LOCATAIRE') {
      // Find active tenant
      const { data: bail } = await supabase
        .from('baux_mtr')
        .select('locataire:tiers(code_auxiliaire)')
        .eq('logement_id', intervention.logement_id)
        .eq('statut', 'ACTIF')
        .maybeSingle();
      
      debitAccountInvoice = (bail?.locataire as any)?.code_auxiliaire || '411LOC';
    }

    // 3. Generate Piece Number
    const { data: numeroPiece, error: numError } = await supabase.rpc('fn_generate_numero_piece', {
      p_journal_code: journalCode,
      p_date_piece: dateEcriture
    });

    if (numError) throw numError;

    // 4. Create Piece
    const { data: piece, error: pieceError } = await supabase
      .from('pieces_comptables')
      .insert({
        numero_piece: numeroPiece,
        journal_code: journalCode,
        date_piece: dateEcriture,
        libelle_piece: `Validation Facture - ${intervention.titre}`,
        source_type: 'INTERVENTION',
        source_id: id
      })
      .select()
      .single();

    if (pieceError) throw pieceError;

    // 5. Calculate VAT
    let tvaRate = 0;
    if (intervention.fournisseur.categorie_id) {
      const { data: categorie } = await supabase
        .from('categories_fournisseurs')
        .select('tva_defaut')
        .eq('id', intervention.fournisseur.categorie_id)
        .single();
      if (categorie) {
        tvaRate = categorie.tva_defaut || 0;
      }
    }

    const montantHT = Number((montant / (1 + tvaRate / 100)).toFixed(2));
    const montantTVA = Number((montant - montantHT).toFixed(2));

    // 6. Create Accounting Entries
    const entries = [];
    
    // Debit HT
    entries.push({
      date_ecriture: dateEcriture,
      libelle: `Facture Intervention HT - ${intervention.titre} - ${intervention.logement?.nom}`,
      compte_debit: debitAccountInvoice,
      compte_credit: null,
      montant: montantHT,
      journal_code: journalCode,
      tiers_id: intervention.fournisseur_id,
      piece_comptable_id: piece.id
    });

    // Debit TVA (if any)
    if (montantTVA > 0) {
      entries.push({
        date_ecriture: dateEcriture,
        libelle: `TVA déductible - ${intervention.titre}`,
        compte_debit: '445660', // TVA déductible sur autres biens et services
        compte_credit: null,
        montant: montantTVA,
        journal_code: journalCode,
        tiers_id: intervention.fournisseur_id,
        piece_comptable_id: piece.id
      });
    }

    // Credit TTC
    entries.push({
      date_ecriture: dateEcriture,
      libelle: `Facture Intervention TTC - ${intervention.titre} - ${intervention.logement?.nom}`,
      compte_debit: null,
      compte_credit: supplierCode,
      montant: montant,
      journal_code: journalCode,
      tiers_id: intervention.fournisseur_id,
      piece_comptable_id: piece.id
    });

    const { error: entriesError } = await supabase
      .from('journal_ecritures')
      .insert(entries);

    if (entriesError) throw entriesError;

    // 7. Update Intervention Status
    const { data: updated, error: updateError } = await supabase
      .from('interventions')
      .update({
        statut: 'FACTURE_VALIDEE',
        montant_ttc: montant,
        imputation_cible: imputation,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }
};
