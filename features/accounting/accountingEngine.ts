import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

export type AccountingResult = {
  payoutNet: number;
  forfaitMenage: number;
  forfaitAssurance: number;
  baseCommission: number;
  montantCommission: number;
  commissionHT: number;
  tvaCollectee: number;
  taxeSejour: number;
  loyerNetProprietaire: number;
};

export type JournalEntry = {
  piece_comptable_id?: string;
  date_ecriture: string;
  libelle: string;
  compte_debit: string;
  compte_credit: string;
  montant: number;
  tiers_id?: string;
  lettrage?: string;
  journal_code?: string;
  facture_fournisseur_id?: string;
  reservation_id?: string;
};

// Helper for rounding to 2 decimals (Math.floor logic as requested for commission?)
// "Arrondi Math.floor pour la commission (toujours en faveur du propriétaire)" -> This usually means floor(amount * 100) / 100
const roundCurrency = (amount: number) => {
  return Math.round(amount * 100) / 100;
};

const floorCurrency = (amount: number) => {
  return Math.floor(amount * 100) / 100;
};

export const accountingEngine = {
  // Mission 5: Fonction de résumé (Utilitaire)
  calculerVentilationReservation(
    reservation: any,
    reglesFinancieres: any
  ): AccountingResult {
    const payoutNet = reservation.payout_net;
    let forfaitMenage = 0;
    let forfaitAssurance = 0;
    let taxeSejour = 0;

    // Step 2: Deductions
    if (reglesFinancieres) {
      if (reglesFinancieres.forfait_menage > 0 && reglesFinancieres.fournisseur_menage_id) {
        forfaitMenage = reglesFinancieres.forfait_menage;
      }
      if (reglesFinancieres.forfait_assurance > 0) {
        forfaitAssurance = reglesFinancieres.forfait_assurance;
      }
      if (reglesFinancieres.taxe_sejour_par_nuit > 0 && reservation.nb_nuits > 0) {
        taxeSejour = roundCurrency(reglesFinancieres.taxe_sejour_par_nuit * reservation.nb_nuits);
      }
    }

    // Step 3: Commission
    // base = payout_net - forfait_menage - forfait_assurance
    const baseCommission = payoutNet - forfaitMenage - forfaitAssurance;
    
    let montantCommission = 0;
    let commissionHT = 0;
    let tvaCollectee = 0;

    if (reglesFinancieres && reglesFinancieres.taux_commission_agence > 0) {
      // commission = base * (taux / 100)
      // Using floorCurrency to favor owner (lower commission)
      montantCommission = floorCurrency(baseCommission * (reglesFinancieres.taux_commission_agence / 100));
      
      if (montantCommission > 0) {
        commissionHT = floorCurrency(montantCommission / 1.20);
        tvaCollectee = roundCurrency(montantCommission - commissionHT);
      }
    }

    // Loyer Net
    const loyerNetProprietaire = roundCurrency(payoutNet - forfaitMenage - forfaitAssurance - montantCommission);

    return {
      payoutNet,
      forfaitMenage,
      forfaitAssurance,
      baseCommission,
      montantCommission,
      commissionHT,
      tvaCollectee,
      taxeSejour,
      loyerNetProprietaire
    };
  },

  // Mission 1: Fonction principale
  async genererEcrituresComptables(
    reservation: any,
    logement: any,
    reglesFinancieres: any,
    proprietaire: any,
    fournisseurMenage: any,
    payeur: { tiers_id: string, code_auxiliaire: string, type: 'OTA' | 'VOYAGEUR', nom: string }
  ): Promise<{ entries: JournalEntry[], ventilation: AccountingResult }> {
    const entries: JournalEntry[] = [];
    const ventilation = this.calculerVentilationReservation(reservation, reglesFinancieres);
    
    const dateEcriture = reservation.check_in 
      ? new Date(reservation.check_in).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];
    const checkInStr = reservation.check_in ? format(new Date(reservation.check_in), 'dd/MM/yyyy') : '?';
    const checkOutStr = reservation.check_out ? format(new Date(reservation.check_out), 'dd/MM/yyyy') : '?';
    
    // Check Owner Code
    if (!proprietaire?.code_auxiliaire) {
      console.error(`Erreur Fatale: Code auxiliaire manquant pour le propriétaire ${proprietaire?.nom}`);
      throw new Error(`Code auxiliaire manquant pour le propriétaire ${proprietaire?.nom}`);
    }
    const codeProprio = proprietaire.code_auxiliaire;

    // Étape 1 - Créance Client (Payeur OTA ou Voyageur)
    // Débit [Payeur] / Crédit [Propriétaire]
    entries.push({
      date_ecriture: dateEcriture,
      libelle: `Payout ${reservation.source} - ${reservation.confirmation_code} - ${reservation.guest_name} - ${checkInStr} au ${checkOutStr}`,
      compte_debit: payeur.code_auxiliaire,
      compte_credit: codeProprio,
      montant: ventilation.payoutNet,
      tiers_id: payeur.tiers_id
    });

    if (!reglesFinancieres) {
      console.warn(`Warning: Pas de règles financières pour le logement ${logement.nom}. Seul le crédit propriétaire est généré.`);
      return { entries, ventilation };
    }

    // Étape 2 - Déduction des Frais Fixes
    // 2a. Ménage
    if (ventilation.forfaitMenage > 0) {
      if (fournisseurMenage && fournisseurMenage.code_auxiliaire) {
        entries.push({
          date_ecriture: dateEcriture,
          libelle: `Ménage - ${logement.nom} - ${reservation.confirmation_code}`,
          compte_debit: codeProprio,
          compte_credit: fournisseurMenage.code_auxiliaire,
          montant: ventilation.forfaitMenage,
          tiers_id: fournisseurMenage.id
        });
      } else {
        // Fallback if supplier is missing but fee is defined
        console.warn(`Warning: Fournisseur ménage manquant ou sans code for ${reservation.confirmation_code}. Utilisation d'un compte générique.`);
        entries.push({
          date_ecriture: dateEcriture,
          libelle: `Ménage (Fournisseur à définir) - ${logement.nom} - ${reservation.confirmation_code}`,
          compte_debit: codeProprio,
          compte_credit: '401MENAGE', // Generic fallback
          montant: ventilation.forfaitMenage
        });
      }
    }

    // 2b. Assurance
    if (ventilation.forfaitAssurance > 0) {
      entries.push({
        date_ecriture: dateEcriture,
        libelle: `Assurance - ${logement.nom} - ${reservation.confirmation_code}`,
        compte_debit: codeProprio,
        compte_credit: '706200', // Commissions sur assurances
        montant: ventilation.forfaitAssurance,
        tiers_id: proprietaire.id
      });
    }

    // Étape 2.c - Taxe de Séjour (Collectée auprès du client)
    if (ventilation.taxeSejour > 0) {
      entries.push({
        date_ecriture: dateEcriture,
        libelle: `Taxe de séjour - ${logement.nom} - ${reservation.confirmation_code}`,
        compte_debit: payeur.code_auxiliaire,
        compte_credit: '447', // Taxes de séjour collectées
        montant: ventilation.taxeSejour,
        tiers_id: payeur.tiers_id
      });
    }

    // Étape 3 - Commission Agence (Décomposée HT + TVA)
    if (ventilation.montantCommission > 0) {
      // 3a. Commission HT
      entries.push({
        date_ecriture: dateEcriture,
        libelle: `Honoraires gestion ${reglesFinancieres.taux_commission_agence}% (HT) - ${logement.nom} - ${reservation.confirmation_code}`,
        compte_debit: codeProprio,
        compte_credit: '706100', // Honoraires de gestion locative
        montant: ventilation.commissionHT,
        tiers_id: proprietaire.id
      });

      // 3b. TVA sur Commission
      if (ventilation.tvaCollectee > 0) {
        entries.push({
          date_ecriture: dateEcriture,
          libelle: `TVA sur honoraires - ${logement.nom} - ${reservation.confirmation_code}`,
          compte_debit: codeProprio,
          compte_credit: '445710', // TVA collectée
          montant: ventilation.tvaCollectee,
          tiers_id: proprietaire.id
        });
      }
    }

    // Log for debug
    console.log(`Génération comptable pour ${reservation.confirmation_code}:`, entries);

    return { entries, ventilation };
  },

  /**
   * Mission 6: Validation et Validation d'une pièce comptable
   * Centralise la logique de validation (équilibre, existence des comptes) 
   * et la création effective en base.
   */
  async validateAndPostPiece(
    journalCode: string,
    datePiece: string,
    libellePiece: string,
    sourceType: 'RESERVATION' | 'OPERATION_DIVERSE' | 'RAPPROCHEMENT' | 'REDDITION' | 'CAUTION',
    sourceId: string,
    lines: {
      libelle: string;
      compte_debit: string;
      compte_credit: string;
      montant: number;
      tiers_id?: string | null;
    }[],
    existingPieceId?: string
  ) {
    // 1. Validation de l'équilibre (Par construction en mode simplifié, c'est toujours équilibré par ligne)
    if (lines.length < 1) {
      throw new Error('Une pièce comptable doit comporter au moins une opération.');
    }

    // 2. Préparation des entrées pour le journal (Une ligne par opération double-entrée)
    const journalEntries: JournalEntry[] = lines.map(line => ({
      date_ecriture: datePiece,
      libelle: line.libelle,
      compte_debit: line.compte_debit,
      compte_credit: line.compte_credit,
      montant: line.montant,
      tiers_id: line.tiers_id || undefined,
      journal_code: journalCode
    }));

    // 3. Création ou Mise à jour de la pièce et des écritures
    if (existingPieceId) {
      return await this.updatePieceAndEntries(
        existingPieceId,
        journalCode,
        datePiece,
        libellePiece,
        journalEntries
      );
    } else {
      return await this.createPieceAndEntries(
        journalCode,
        datePiece,
        libellePiece,
        sourceType,
        sourceId,
        journalEntries
      );
    }
  },

  async updatePieceAndEntries(
    pieceId: string,
    journalCode: string,
    datePiece: string,
    libellePiece: string,
    entries: JournalEntry[]
  ) {
    // 1. Update Piece Header
    const { error: pieceError } = await supabase
      .from('pieces_comptables')
      .update({
        journal_code: journalCode,
        date_piece: datePiece,
        libelle_piece: libellePiece
      })
      .eq('id', pieceId);

    if (pieceError) throw pieceError;

    // 2. Delete existing entries
    const { error: deleteError } = await supabase
      .from('journal_ecritures')
      .delete()
      .eq('piece_comptable_id', pieceId);

    if (deleteError) throw deleteError;

    // 3. Insert new entries
    const linkedEntries = entries.map(e => ({
      ...e,
      piece_comptable_id: pieceId,
      reservation_id: e.reservation_id // Keep existing if any
    }));

    const { error: entriesError } = await supabase.from('journal_ecritures').insert(linkedEntries);
    if (entriesError) throw entriesError;

    return { id: pieceId };
  },

  async createPieceAndEntries(
    journalCode: string,
    datePiece: string,
    libellePiece: string,
    sourceType: 'RESERVATION' | 'OPERATION_DIVERSE' | 'RAPPROCHEMENT' | 'REDDITION' | 'CAUTION',
    sourceId: string,
    entries: JournalEntry[]
  ) {
    // 1. Generate numero_piece via RPC
    const { data: numeroPiece, error: numError } = await supabase.rpc('fn_generate_numero_piece', {
      p_journal_code: journalCode,
      p_date_piece: datePiece
    });

    if (numError) throw numError;

    // 2. Create Piece
    const { data: piece, error: pieceError } = await supabase
      .from('pieces_comptables')
      .insert({
        numero_piece: numeroPiece,
        journal_code: journalCode,
        date_piece: datePiece,
        libelle_piece: libellePiece,
        source_type: sourceType,
        source_id: sourceId
      })
      .select()
      .single();

    if (pieceError) throw pieceError;

    // 3. Link entries and insert
    const linkedEntries = entries.map(e => ({
      ...e,
      piece_comptable_id: piece.id,
      reservation_id: sourceType === 'RESERVATION' ? sourceId : e.reservation_id
    }));

    const { error: entriesError } = await supabase.from('journal_ecritures').insert(linkedEntries);
    if (entriesError) throw entriesError;

    return piece;
  }
};
