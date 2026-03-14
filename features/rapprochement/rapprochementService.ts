import { supabase } from '@/lib/supabaseClient';

export type ReconciliationType = 
  | 'ENCAISSEMENT_OTA' 
  | 'ENCAISSEMENT_DIR' 
  | 'PAIEMENT_FOURNR' 
  | 'REDDITION_PROPRIO' 
  | 'TRANSFERT_HONOR' 
  | 'CAUTION_ENCAISS' 
  | 'CAUTION_RESTIT' 
  | 'FRAIS_BANCAIRES' 
  | 'DIVERS';

export type PointableItem = {
  id: string;
  type: ReconciliationType;
  libelle: string;
  montant: number;
  date: string;
  tiers_nom?: string;
  compte?: string;
  reservation_id?: string;
  invoice_id?: string;
  piece_id?: string;
  bail_id?: string;
};

export type BankMovement = {
  id: string;
  date_operation: string;
  date_valeur?: string;
  libelle_banque: string;
  montant: number;
  est_rapproche: boolean;
  hash_unique: string;
  compte_banque: string;
  type_rapprochement?: ReconciliationType;
  piece_comptable_id?: string;
};

/**
 * Trouve un sous-ensemble d'items dont la somme des |montants| = target (±tolerance)
 * Limité à 5 items max pour la performance.
 */
function findSubsetSum(
  items: PointableItem[], 
  target: number, 
  tolerance: number, 
  maxItems: number = 5
): PointableItem[] | null {
  const absTarget = Math.abs(target);
  
  // Essayer les combinaisons de 1 à maxItems éléments
  for (let size = 1; size <= Math.min(maxItems, items.length); size++) {
    const result = findCombo(items, 0, size, absTarget, tolerance, []);
    if (result) return result;
  }
  return null;
}

function findCombo(
  items: PointableItem[],
  start: number,
  remaining: number,
  target: number,
  tolerance: number,
  current: PointableItem[]
): PointableItem[] | null {
  if (remaining === 0) {
    const sum = current.reduce((s, i) => s + Math.abs(i.montant), 0);
    return Math.abs(sum - target) < tolerance ? [...current] : null;
  }
  
  for (let i = start; i <= items.length - remaining; i++) {
    const result = findCombo(items, i + 1, remaining - 1, target, tolerance, [...current, items[i]]);
    if (result) return result;
  }
  return null;
}

export const rapprochementService = {
  /**
   * Récupère les mouvements bancaires non rapprochés.
   */
  async getUnreconciledMovements(compteBanque?: string): Promise<BankMovement[]> {
    let query = supabase
      .from('mouvements_bancaires')
      .select('*')
      .eq('est_rapproche', false)
      .order('date_operation', { ascending: false });

    if (compteBanque) {
      query = query.eq('compte_banque', compteBanque);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Récupère TOUS les éléments pointables côté comptabilité.
   */
  async getAllPointableItems(): Promise<PointableItem[]> {
    const items: PointableItem[] = [];

    // 1. Réservations en attente de paiement
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select(`
        id, 
        guest_name, 
        confirmation_code, 
        source, 
        payout_net, 
        check_in,
        payeur:payeur_tiers_id (nom)
      `)
      .eq('statut_workflow', 'ATTENTE_PAIEMENT');

    if (resError) console.error('Error fetching pointable reservations:', resError);
    reservations?.forEach(r => {
      items.push({
        id: r.id,
        type: r.source === 'DIRECT' ? 'ENCAISSEMENT_DIR' : 'ENCAISSEMENT_OTA',
        libelle: `${r.guest_name} - ${r.confirmation_code} (${r.source})`,
        montant: r.payout_net,
        date: r.check_in,
        tiers_nom: (r.payeur as any)?.nom,
        reservation_id: r.id
      });
    });

    // 2. Factures fournisseurs groupées en attente de paiement (A_PAYER)
    const { data: factures, error: factError } = await supabase
      .from('factures_fournisseurs')
      .select(`
        id,
        reference_facture,
        date_creation,
        montant_total,
        fournisseur:fournisseur_id (nom)
      `)
      .eq('statut', 'A_PAYER');

    if (factError) console.error('Error fetching pointable factures:', factError);
    factures?.forEach(f => {
      items.push({
        id: f.id,
        type: 'PAIEMENT_FOURNR',
        libelle: `Facture ${f.reference_facture} - ${(f.fournisseur as any)?.nom}`,
        montant: -f.montant_total,
        date: f.date_creation,
        tiers_nom: (f.fournisseur as any)?.nom,
        invoice_id: f.id // On utilise invoice_id pour porter l'ID de la facture fournisseur
      });
    });

    // 3. Autres écritures fournisseurs non lettrées (401) - Hors factures groupées
    const { data: invoices, error: invError } = await supabase
      .from('journal_ecritures')
      .select(`
        id, 
        date_ecriture, 
        libelle, 
        montant, 
        compte_credit,
        tiers:tiers_id (nom)
      `)
      .like('compte_credit', '401%')
      .is('lettrage', null)
      .is('facture_fournisseur_id', null); // On exclut celles déjà dans un lot

    if (invError) console.error('Error fetching pointable invoices:', invError);
    invoices?.forEach(i => {
      items.push({
        id: i.id,
        type: 'PAIEMENT_FOURNR',
        libelle: i.libelle,
        montant: -i.montant, // On affiche en négatif pour le rapprochement (décaissement)
        date: i.date_ecriture,
        tiers_nom: (i.tiers as any)?.nom,
        compte: i.compte_credit,
        invoice_id: i.id
      });
    });

    // 3. Redditions non pointées (pièces EX sans lettrage sur le 512)
    const { data: redditions, error: redError } = await supabase
      .from('pieces_comptables')
      .select(`
        id,
        date_piece,
        libelle_piece,
        journal_ecritures!inner (
          id,
          montant,
          compte_credit,
          compte_debit,
          lettrage
        )
      `)
      .eq('journal_code', 'EX')
      .eq('source_type', 'REDDITION')
      .or('compte_credit.ilike.512%,compte_debit.ilike.512%', { foreignTable: 'journal_ecritures' })
      .is('journal_ecritures.lettrage', null);

    if (redError) console.error('Error fetching pointable redditions:', redError);
    redditions?.forEach(p => {
      // On cherche la ligne de banque dans la pièce
      const bankEntry = p.journal_ecritures.find((e: any) => 
        (e.compte_credit?.startsWith('512') || e.compte_debit?.startsWith('512')) && !e.lettrage
      );
      if (bankEntry) {
        items.push({
          id: p.id,
          type: 'REDDITION_PROPRIO',
          libelle: p.libelle_piece,
          montant: bankEntry.compte_credit?.startsWith('512') ? -bankEntry.montant : bankEntry.montant,
          date: p.date_piece,
          piece_id: p.id
        });
      }
    });

    // 4. Cautions en attente d'encaissement (NON_VERSEE)
    const { data: cautionsEnc, error: cautEncError } = await supabase
      .from('baux_mtr')
      .select(`
        id,
        montant_caution,
        date_debut,
        locataire:locataire_id (nom),
        logement:logement_id (nom)
      `)
      .eq('statut_caution', 'NON_VERSEE')
      .gt('montant_caution', 0);

    if (cautEncError) console.error('Error fetching pointable cautions (enc):', cautEncError);
    cautionsEnc?.forEach(c => {
      const locNom = (c.locataire as any)?.nom;
      const logNom = (c.logement as any)?.nom;
      items.push({
        id: c.id,
        type: 'CAUTION_ENCAISS',
        libelle: `Caution ${logNom || 'Logement'} - ${locNom || 'Locataire'}`,
        montant: c.montant_caution,
        date: c.date_debut,
        tiers_nom: locNom,
        bail_id: c.id
      });
    });

    // 5. Cautions en attente de restitution (ENCAISSEE, date_fin passée)
    const today = new Date().toISOString().split('T')[0];
    const { data: cautionsRest, error: cautRestError } = await supabase
      .from('baux_mtr')
      .select(`
        id,
        montant_caution,
        date_fin,
        locataire:locataire_id (nom)
      `)
      .eq('statut_caution', 'ENCAISSEE')
      .lte('date_fin', today);

    if (cautRestError) console.error('Error fetching pointable cautions (rest):', cautRestError);
    cautionsRest?.forEach(c => {
      items.push({
        id: c.id,
        type: 'CAUTION_RESTIT',
        libelle: `Restitution Caution ${(c.locataire as any)?.nom}`,
        montant: -c.montant_caution,
        date: c.date_fin || today,
        tiers_nom: (c.locataire as any)?.nom,
        bail_id: c.id
      });
    });

    return items;
  },

  /**
   * Valide le rapprochement via le RPC v2.
   */
  async validateReconciliation(
    movementId: string,
    type: ReconciliationType,
    selectedItems: PointableItem[],
    options?: { compteContrepartie?: string; libelleManuel?: string }
  ): Promise<void> {
    const { error } = await supabase.rpc('validate_bank_reconciliation_v2', {
      p_movement_id: movementId,
      p_type_rapprochement: type,
      p_reservation_ids: selectedItems.filter(i => i.reservation_id).map(i => i.reservation_id),
      p_invoice_ids: selectedItems.filter(i => i.invoice_id).map(i => i.invoice_id),
      p_facture_fournisseur_id: type === 'PAIEMENT_FOURNR' ? selectedItems.find(i => i.type === 'PAIEMENT_FOURNR')?.id : null,
      p_reddition_piece_id: selectedItems.find(i => i.piece_id)?.piece_id || null,
      p_bail_id: selectedItems.find(i => i.bail_id)?.bail_id || null,
      p_compte_contrepartie: options?.compteContrepartie || null,
      p_libelle_manuel: options?.libelleManuel || null
    });

    if (error) throw error;
  },

  /**
   * Suggère des correspondances pour un mouvement donné.
   */
  suggestMatches(movement: BankMovement, items: PointableItem[]): PointableItem[] {
    const tolerance = 0.01;
    const amt = movement.montant;
    const absAmt = Math.abs(amt);

    // Filtrer par signe : un encaissement (+) ne matche que des items positifs
    const sameSignItems = items.filter(item => 
      (amt > 0 && item.montant > 0) || (amt < 0 && item.montant < 0)
    );

    // 1. Match exact unique par montant → retourner immédiatement si trouvé
    const exactMatches = sameSignItems.filter(
      item => Math.abs(Math.abs(item.montant) - absAmt) < tolerance
    );
    if (exactMatches.length === 1) {
      return exactMatches; // Un seul match exact = haute confiance
    }

    // 2. Chercher une combinaison de N items dont la somme = montant
    //    (limité aux items du même type pour éviter les mélanges)
    if (amt > 0) {
      // Pour les encaissements : chercher une combinaison de réservations
      const otas = sameSignItems.filter(i => 
        i.type === 'ENCAISSEMENT_OTA' || i.type === 'ENCAISSEMENT_DIR'
      );
      const combo = findSubsetSum(otas, absAmt, tolerance);
      if (combo) return combo;
    } else {
      // Pour les décaissements : chercher une combinaison de factures/redditions
      const decaiss = sameSignItems.filter(i => 
        i.type === 'PAIEMENT_FOURNR' || i.type === 'REDDITION_PROPRIO'
      );
      const combo = findSubsetSum(decaiss, absAmt, tolerance);
      if (combo) return combo;
    }

    // 3. Pas de suggestion automatique si aucun match fiable
    //    (on ne fait PAS de matching par libellé — trop de faux positifs)
    return [];
  },

  /**
   * Récupère les données pour l'état de rapprochement bancaire.
   */
  async getReconciliationReport(compteBanque: string = '512000', dateDebut?: string, dateFin?: string) {
    // 1. Solde comptable (Σ débits - Σ crédits)
    let queryCompta = supabase.from('journal_ecritures').select('montant, compte_debit, compte_credit');
    if (dateDebut) queryCompta = queryCompta.gte('date_ecriture', dateDebut);
    if (dateFin) queryCompta = queryCompta.lte('date_ecriture', dateFin);
    
    const { data: entries, error: errEntries } = await queryCompta;
    if (errEntries) throw errEntries;

    let soldeComptable = 0;
    entries?.forEach(e => {
      if (e.compte_debit === compteBanque) soldeComptable += e.montant;
      if (e.compte_credit === compteBanque) soldeComptable -= e.montant;
    });

    // 2. Solde bancaire (Σ montants)
    let queryBank = supabase.from('mouvements_bancaires').select('montant');
    queryBank = queryBank.eq('compte_banque', compteBanque);
    if (dateDebut) queryBank = queryBank.gte('date_operation', dateDebut);
    if (dateFin) queryBank = queryBank.lte('date_operation', dateFin);

    const { data: bankMovs, error: errBank } = await queryBank;
    if (errBank) throw errBank;

    const soldeBancaire = bankMovs?.reduce((sum, m) => sum + m.montant, 0) || 0;

    // 3. Mouvements bancaires non rapprochés
    let queryUnreconciledBank = supabase.from('mouvements_bancaires')
      .select('*')
      .eq('compte_banque', compteBanque)
      .eq('est_rapproche', false);
    if (dateDebut) queryUnreconciledBank = queryUnreconciledBank.gte('date_operation', dateDebut);
    if (dateFin) queryUnreconciledBank = queryUnreconciledBank.lte('date_operation', dateFin);
    
    const { data: unreconciledBank, error: errUnBank } = await queryUnreconciledBank;
    if (errUnBank) throw errUnBank;

    // 4. Écritures comptables sur le 512 sans mouvement bancaire (lettrage null)
    let queryUnreconciledCompta = supabase.from('journal_ecritures')
      .select('*')
      .or(`compte_debit.eq.${compteBanque},compte_credit.eq.${compteBanque}`)
      .is('lettrage', null);
    if (dateDebut) queryUnreconciledCompta = queryUnreconciledCompta.gte('date_ecriture', dateDebut);
    if (dateFin) queryUnreconciledCompta = queryUnreconciledCompta.lte('date_ecriture', dateFin);

    const { data: unreconciledCompta, error: errUnCompta } = await queryUnreconciledCompta;
    if (errUnCompta) throw errUnCompta;

    // 5. Contrôle Loi Hoguet (Soldes 404, 401, 419, 471)
    // On récupère toutes les écritures sur ces comptes
    const hoguetAccounts = ['404', '401', '419', '471'];
    let queryHoguet = supabase.from('journal_ecritures')
      .select('montant, compte_debit, compte_credit');
    // On filtre par préfixe
    const { data: hoguetEntries, error: errHoguet } = await queryHoguet;
    if (errHoguet) throw errHoguet;

    const hoguetBalances: Record<string, number> = { '404': 0, '401': 0, '419': 0, '471': 0 };
    hoguetEntries?.forEach(e => {
      hoguetAccounts.forEach(acc => {
        if (e.compte_debit?.startsWith(acc)) hoguetBalances[acc] -= e.montant;
        if (e.compte_credit?.startsWith(acc)) hoguetBalances[acc] += e.montant;
      });
    });

    return {
      soldeComptable,
      soldeBancaire,
      ecartBrut: soldeBancaire - soldeComptable,
      unreconciledBank,
      unreconciledCompta,
      hoguetBalances
    };
  }
};
