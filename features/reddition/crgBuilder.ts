import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface CRGData {
  agence: {
    nom: string;
    adresse: string;
    siret: string;
    carte_pro: string;
    prefecture: string;
    garant: string;
    garant_montant: string;
    banque_sequestre: string;
    iban_sequestre: string;
  };
  proprietaire: {
    nom: string;
    adresse: string;
    iban_masque: string;
    mandat_ref: string;
  };
  periode: string;
  numero_crg: string;
  date_arrete: string;
  reservations: Array<{
    id: string;
    dates: string;
    voyageur: string;
    logement: string;
    payout_net: number;
    menage: number;
    commission_ht: number;
    tva: number;
    assurance: number;
    net: number;
  }>;
  operationsDiverses: Array<{
    date: string;
    libelle: string;
    montant: number;
    type: string;
  }>;
  synthese: {
    payoutNetTotal: number;
    fraisMenage: number;
    commissionHT: number;
    tva: number;
    assurance: number;
    interventions: number;
    commissionOtaInformative: number;
    netAVerser: number;
  };
}

export async function buildCRGData(
  proprietaireId: string,
  codeAuxiliaire: string,
  releveId: string
): Promise<CRGData> {
  // 1. Fetch Relevé details
  const { data: releve, error: releveError } = await supabase
    .from('releves_gestion')
    .select('*')
    .eq('id', releveId)
    .single();

  if (releveError) throw releveError;

  // 2. Fetch Agency Config (with fallback)
  let agenceConfig: any = {
    nom: 'PRIMO CONCIERGERIE', adresse: '', siret: '',
    carte_professionnelle: 'N/A', prefecture_carte: 'N/A',
    garant_nom: 'N/A', garant_montant: null,
    banque_sequestre: 'N/A', iban_sequestre: 'N/A'
  };
  try {
    const { data, error } = await supabase
      .from('configuration_agence').select('*').single();
    if (!error && data) agenceConfig = data;
  } catch (e) {
    console.warn('configuration_agence not available, using defaults');
  }

  // 3. Fetch Owner details
  const { data: owner, error: ownerError } = await supabase
    .from('tiers')
    .select('*')
    .eq('id', proprietaireId)
    .single();

  if (ownerError) throw ownerError;

  // 4. Fetch all entries linked to the relevé
  const { data: entries, error: entriesError } = await supabase
    .from('journal_ecritures')
    .select(`
      *,
      piece:pieces_comptables(*),
      tiers:tiers(*)
    `)
    .eq('releve_gestion_id', releveId);

  if (entriesError) throw entriesError;

  // 5. Fetch Reservation details for enrichment
  const resIds = Array.from(new Set(entries
    .filter(e => e.piece?.source_type === 'RESERVATION')
    .map(e => e.piece?.source_id)
  )).filter(Boolean) as string[];

  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select('*, logement:logements(nom)')
    .in('id', resIds);

  if (resError) throw resError;

  // 6. Process entries
  const crgReservations: Map<string, any> = new Map();
  const operationsDiverses: any[] = [];
  
  let reservationCredits = 0;
  let reservationDebits = 0;
  let totalCredits404 = 0;
  let totalDebits404 = 0;
  let commissionHT = 0;
  let tvaTotal = 0;
  let interventionsNet = 0;
  let commissionOtaInformative = 0;

  for (const entry of entries) {
    const piece = entry.piece;
    if (!piece) continue;

    const montant = Number(entry.montant);

    // Track 404 totals
    if (entry.compte_credit === codeAuxiliaire) {
      totalCredits404 += montant;
      if (piece.source_type === 'RESERVATION') {
        reservationCredits += montant;
      }
    } else if (entry.compte_debit === codeAuxiliaire) {
      if (piece.source_type !== 'REDDITION') {
        totalDebits404 += montant;
        if (piece.source_type === 'RESERVATION') {
          reservationDebits += montant;
        }
      }
    }

    // Track Commissions and TVA globally (from any piece)
    if (entry.compte_credit?.startsWith('706')) {
      commissionHT += montant;
    } else if (entry.compte_credit === '445710') {
      tvaTotal += montant;
    }

    if (piece.source_type === 'RESERVATION') {
      const resId = piece.source_id;
      if (!crgReservations.has(resId)) {
        const res = reservations.find(r => r.id === resId);
        crgReservations.set(resId, {
          id: resId,
          dates: res ? `${format(new Date(res.check_in), 'dd/MM')} - ${format(new Date(res.check_out), 'dd/MM')}` : '',
          voyageur: res?.guest_name || 'Voyageur',
          logement: res?.logement?.nom || 'Logement',
          payout_net: 0,
          menage: 0,
          commission_ht: 0,
          tva: 0,
          assurance: 0,
          net: 0
        });
      }

      const resData = crgReservations.get(resId);
      const res = reservations.find(r => r.id === resId);
      if (res && resData.payout_net === 0) {
        commissionOtaInformative += (res.commission_ota || 0);
      }
      
      if (entry.compte_credit === codeAuxiliaire) {
        resData.payout_net += montant;
      } else if (entry.compte_debit === codeAuxiliaire) {
        // Deduction on reservation
        resData.net -= montant;
      }

      if (entry.compte_credit?.startsWith('706')) {
        resData.commission_ht += montant;
      } else if (entry.compte_credit === '445710') {
        resData.tva += montant;
      }
    } else if (piece.source_type === 'OPERATION_DIVERSE' || piece.source_type === 'INTERVENTION') {
      if (entry.compte_debit === codeAuxiliaire || entry.compte_credit === codeAuxiliaire) {
        const isDebit = entry.compte_debit === codeAuxiliaire;
        const netMontant = isDebit ? -montant : montant;
        operationsDiverses.push({
          date: format(new Date(entry.date_ecriture), 'dd/MM/yyyy'),
          libelle: entry.libelle,
          montant: netMontant,
          type: piece.source_type
        });
        interventionsNet += netMontant;
      }
    }
  }

  // Finalize reservation nets
  crgReservations.forEach(res => {
    res.net = res.payout_net - res.menage - res.commission_ht - res.tva - res.assurance;
  });

  const netAVerser = totalCredits404 - totalDebits404;

  // 7. Consistency check
  if (Math.abs(netAVerser - (releve.montant_total || 0)) > 0.01) {
    console.warn(`CRG Consistency Warning: Calculated ${netAVerser} vs Relevé ${releve.montant_total}`);
  }

  return {
    agence: {
      nom: agenceConfig.nom || 'PRIMO CONCIERGERIE',
      adresse: agenceConfig.adresse || '',
      siret: agenceConfig.siret || '',
      carte_pro: agenceConfig.carte_professionnelle || 'N/A',
      prefecture: agenceConfig.prefecture_carte || 'N/A',
      garant: agenceConfig.garant_nom || 'N/A',
      garant_montant: agenceConfig.garant_montant ? `${agenceConfig.garant_montant} €` : 'N/A',
      banque_sequestre: agenceConfig.banque_sequestre || 'N/A',
      iban_sequestre: agenceConfig.iban_sequestre || 'N/A'
    },
    proprietaire: {
      nom: `${owner.nom} ${owner.prenom || ''}`,
      adresse: owner.adresse || 'Adresse non renseignée',
      iban_masque: owner.iban ? `**** **** **** ${owner.iban.slice(-4)}` : 'Non renseigné',
      mandat_ref: owner.mandat_ref || 'N/A'
    },
    periode: format(new Date(releve.date_generation), 'MMMM yyyy', { locale: fr }),
    numero_crg: releve.numero_crg || `CRG-${releve.id.substring(0, 8).toUpperCase()}`,
    date_arrete: format(new Date(releve.date_generation), 'dd/MM/yyyy'),
    reservations: Array.from(crgReservations.values()),
    operationsDiverses,
    synthese: {
      payoutNetTotal: reservationCredits,
      fraisMenage: 0, 
      commissionHT,
      tva: tvaTotal,
      assurance: 0, 
      interventions: interventionsNet,
      commissionOtaInformative,
      netAVerser
    }
  };
}
