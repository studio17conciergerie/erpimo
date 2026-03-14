import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { accountingEngine } from '@/features/accounting/accountingEngine';

export interface DecaissementSynthese {
  proprietaireId: string;
  code: string;
  nom: string;
  prenom: string;
  montantHonorairesHT: number;
  montantHonorairesTTC: number;
  montantDu: number;
  dettesLocataires: number;
  soldeComptable404: number;
  soldeACeJour: number;
  // Fields for PDF/Internal use
  payoutNetTotal: number;
  loyerBrutTotal: number;
  commissionsOtaTotal: number;
  reservationsIds: string[];
  nbReservations: number;
  iban: string | null;
  ibanPresent: boolean;
  email: string | null;
}

export const redditionApi = {
  async getDecaissementsEnAttente(dateCible: string) {
    // 1. Fetch all owners
    const { data: owners, error: ownersError } = await supabase
      .from('tiers')
      .select('*')
      .eq('type_tiers', 'PROPRIETAIRE');

    if (ownersError) throw ownersError;

    // 2. Fetch all 'ENCAISSE' and 'ATTENTE_PAIEMENT' reservations that are not yet redditioned
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('*, logement:logements(id, nom, proprietaire_id)')
      .in('statut_workflow', ['ENCAISSE', 'ATTENTE_PAIEMENT'])
      .is('releve_gestion_id', null);

    if (resError) throw resError;

    // 3. Fetch all ledger entries for 404 accounts to calculate real balances
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('journal_ecritures')
      .select('compte_debit, compte_credit, montant')
      .or('compte_debit.ilike.404%,compte_credit.ilike.404%');

    if (ledgerError) throw ledgerError;

    const synthese: DecaissementSynthese[] = [];

    for (const owner of owners) {
      const ownerReservations = reservations.filter(r => r.logement?.proprietaire_id === owner.id);
      const collectedReservations = ownerReservations.filter(r => r.statut_workflow === 'ENCAISSE');
      const uncollectedReservations = ownerReservations.filter(r => r.statut_workflow === 'ATTENTE_PAIEMENT');
      
      if (ownerReservations.length === 0) continue;

      const montantHonorairesTTC = collectedReservations.reduce((sum, r) => sum + (r.montant_commission_agence || 0), 0);
      const montantHonorairesHT = montantHonorairesTTC / 1.2;
      const montantDu = collectedReservations.reduce((sum, r) => sum + (r.loyer_net_proprietaire || 0), 0);
      
      // Dettes locataires = uncollected reservations
      const dettesLocataires = uncollectedReservations.reduce((sum, r) => sum + (r.loyer_net_proprietaire || 0), 0);

      // Solde comptable réel du 404
      const ownerCode = owner.code_auxiliaire;
      const soldeComptable404 = ledgerEntries.reduce((sum, entry) => {
        if (entry.compte_credit === ownerCode) return sum + Number(entry.montant);
        if (entry.compte_debit === ownerCode) return sum - Number(entry.montant);
        return sum;
      }, 0);

      // Solde à virer = montant dû (Reservations ENCAISSE only)
      const soldeACeJour = montantDu;

      // PDF Data
      const payoutNetTotal = collectedReservations.reduce((sum, r) => sum + (r.payout_net || 0), 0);
      const loyerBrutTotal = collectedReservations.reduce((sum, r) => sum + (r.montant_brut || 0), 0);
      const commissionsOtaTotal = collectedReservations.reduce((sum, r) => sum + (r.commission_ota || 0), 0);

      synthese.push({
        proprietaireId: owner.id,
        code: owner.code_auxiliaire || '000000',
        nom: owner.nom,
        prenom: owner.prenom || '',
        montantHonorairesHT,
        montantHonorairesTTC,
        montantDu,
        dettesLocataires,
        soldeComptable404,
        soldeACeJour,
        payoutNetTotal,
        loyerBrutTotal,
        commissionsOtaTotal,
        reservationsIds: collectedReservations.map(r => r.id),
        nbReservations: collectedReservations.length,
        iban: owner.iban,
        ibanPresent: !!owner.iban,
        email: owner.email
      });
    }

    return synthese;
  },

  async validerDecaissementBatch(proprietairesSelection: DecaissementSynthese[], dateCible: string) {
    const periode = format(new Date(dateCible), 'yyyy-MM');
    const createdReleveIds: string[] = [];
    
    try {
      for (const prop of proprietairesSelection) {
        // 1. Create Relevé de Gestion
        const { data: releve, error: releveError } = await supabase
          .from('releves_gestion')
          .insert({
            proprietaire_id: prop.proprietaireId,
            periode,
            date_generation: dateCible,
            montant_total: prop.soldeACeJour,
            nb_reservations: prop.nbReservations
          })
          .select()
          .single();

        if (releveError) throw releveError;
        createdReleveIds.push(releve.id);

        // 2. Generate Accounting Piece (Debit 404 / Credit 512000)
        const piece = await accountingEngine.createPieceAndEntries(
          'EX',
          dateCible,
          `Reddition ${periode} - ${prop.nom}`,
          'REDDITION',
          releve.id,
          [{
            date_ecriture: dateCible,
            libelle: `Reddition ${periode} - ${prop.nom}`,
            compte_debit: prop.code, // Utilisation directe du code auxiliaire
            compte_credit: '512000',
            montant: prop.soldeACeJour,
            journal_code: 'EX',
            tiers_id: prop.proprietaireId
          }]
        );

        // 3. Link the new piece entries to the releve (AVANT le changement de statut)
        await supabase
          .from('journal_ecritures')
          .update({ releve_gestion_id: releve.id })
          .eq('piece_comptable_id', piece.id);

        // 4. Link reservation piece entries
        if (prop.reservationsIds.length > 0) {
          const { data: pieces } = await supabase
            .from('pieces_comptables')
            .select('id')
            .eq('source_type', 'RESERVATION')
            .in('source_id', prop.reservationsIds);

          const pieceIds = pieces?.map(p => p.id) || [];
          if (pieceIds.length > 0) {
            const { error: linkError } = await supabase
              .from('journal_ecritures')
              .update({ releve_gestion_id: releve.id })
              .in('piece_comptable_id', pieceIds);
            
            if (linkError) throw linkError;
          }

          // 5. Update Reservations to 'REDDITION_EMISE' (EN DERNIER)
          // Temporaire : utiliser REDDITION si REDDITION_EMISE n'existe pas
          const { error: resError } = await supabase
            .from('reservations')
            .update({ 
              statut_workflow: 'REDDITION', // fallback safe
              releve_gestion_id: releve.id
            })
            .in('id', prop.reservationsIds);

          if (resError) throw resError;
        }
      }
      return createdReleveIds;
    } catch (error) {
      console.error('Error in batch reddition:', error);
      throw error;
    }
  },

  async preValidationChecks(selection: DecaissementSynthese[]) {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // 1. IBAN check
    const missingIban = selection.filter(s => !s.ibanPresent);
    if (missingIban.length > 0) {
      blockers.push(`IBAN manquant pour ${missingIban.length} propriétaire(s) : ${missingIban.map(m => m.nom).join(', ')}`);
    }

    // 2. Escrow balance check (512000)
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('journal_ecritures')
      .select('compte_debit, compte_credit, montant')
      .or('compte_debit.eq.512000,compte_credit.eq.512000');

    if (ledgerError) throw ledgerError;

    const soldeSequestre = ledgerEntries.reduce((sum, entry) => {
      if (entry.compte_debit === '512000') return sum + Number(entry.montant);
      if (entry.compte_credit === '512000') return sum - Number(entry.montant);
      return sum;
    }, 0);

    const totalVirements = selection.reduce((sum, s) => sum + s.soldeACeJour, 0);
    if (soldeSequestre < totalVirements) {
      blockers.push(`Solde séquestre insuffisant (${soldeSequestre.toFixed(2)}€) pour couvrir les virements (${totalVirements.toFixed(2)}€)`);
    }

    // 3. Consistency check (Calculated vs 404 balance)
    for (const s of selection) {
      const ecart = Math.abs(s.montantDu - s.soldeComptable404);
      if (ecart > 0.01) {
        warnings.push(`Écart de cohérence pour ${s.nom} : Calculé (${s.montantDu.toFixed(2)}€) vs Comptable (${s.soldeComptable404.toFixed(2)}€)`);
      }
    }

    // 4. All reservations ENCAISSE check
    // This is already handled by getDecaissementsEnAttente which only includes ENCAISSE in montantDu
    // but we can double check if any reservation in the selection is not ENCAISSE
    // Actually, the selection contains reservationsIds which are already filtered.
    // However, if the user somehow passed a selection with uncollected reservations in the payout list:
    // (In this UI, dettesLocataires is info only, so it's fine)

    return {
      ok: blockers.length === 0,
      warnings,
      blockers
    };
  }
};
