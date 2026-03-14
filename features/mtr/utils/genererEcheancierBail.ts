import { 
  addMonths, 
  differenceInDays, 
  endOfMonth, 
  format, 
  isAfter, 
  isBefore, 
  isSameDay, 
  isSameMonth, 
  lastDayOfMonth, 
  parseISO, 
  setDay, 
  setDate,
  startOfMonth,
  addDays,
  subDays,
  getDaysInMonth,
  differenceInCalendarDays
} from 'date-fns';
import { BailMtr } from '../mtrService';

export type TypeEcheanceMtr = 'SIGNATURE' | 'LOYER_MENSUEL' | 'SOLDE_SORTIE' | 'PAYOUT_OTA_ATTENDU' | 'PAYOUT_OTA_RELIQUAT';
export type StatutEcheanceMtr = 'A_APPELER' | 'EN_ATTENTE' | 'PAYE' | 'ATTENTE_PAYOUT' | 'PAYOUT_RECU';

export interface EcheanceMtr {
  id?: string;
  bail_id: string;
  type: TypeEcheanceMtr;
  date_exigibilite: string;
  periode_debut: string;
  periode_fin: string;
  montant_loyer: number;
  montant_charges: number;
  montant_caution?: number;
  montant_frais_agence?: number;
  montant_total: number;
  statut: StatutEcheanceMtr;
  notes?: string;
}

export function genererEcheancierBail(bail: BailMtr): EcheanceMtr[] {
  const echeances: EcheanceMtr[] = [];
  const start = parseISO(bail.date_debut);
  const end = parseISO(bail.date_fin);

  if (bail.source === 'DIRECT') {
    // --- BRANCHE A : DIRECT (Calendaire) ---
    
    let current = start;
    
    // 1. Premier mois (SIGNATURE ou Premier Loyer)
    const isFirstDayOfMonth = start.getDate() === 1;
    const endOfFirstMonth = endOfMonth(start);
    const actualEndFirstMonth = isBefore(end, endOfFirstMonth) ? end : endOfFirstMonth;
    
    const daysInFirstMonth = getDaysInMonth(start);
    const occupiedDaysFirstMonth = differenceInCalendarDays(actualEndFirstMonth, start) + 1;
    
    const prorataRatio = occupiedDaysFirstMonth / daysInFirstMonth;
    
    echeances.push({
      bail_id: bail.id,
      type: 'SIGNATURE',
      date_exigibilite: bail.date_signature || bail.date_debut,
      periode_debut: format(start, 'yyyy-MM-dd'),
      periode_fin: format(actualEndFirstMonth, 'yyyy-MM-dd'),
      montant_loyer: Math.round(bail.loyer_hc * prorataRatio * 100) / 100,
      montant_charges: Math.round(bail.provision_charges * prorataRatio * 100) / 100,
      montant_caution: bail.montant_caution,
      montant_frais_agence: bail.frais_agence_locataire,
      montant_total: 0, // Will calculate below
      statut: 'A_APPELER'
    });

    // 2. Mois intermédiaires
    let nextMonthStart = startOfMonth(addMonths(start, 1));
    
    while (isBefore(nextMonthStart, startOfMonth(end))) {
      const monthEnd = endOfMonth(nextMonthStart);
      
      // Date d'exigibilité (jour_exigibilite du mois en cours)
      let dateExigibilite = setDate(nextMonthStart, Math.min(bail.jour_exigibilite, getDaysInMonth(nextMonthStart)));
      
      echeances.push({
        bail_id: bail.id,
        type: 'LOYER_MENSUEL',
        date_exigibilite: format(dateExigibilite, 'yyyy-MM-dd'),
        periode_debut: format(nextMonthStart, 'yyyy-MM-dd'),
        periode_fin: format(monthEnd, 'yyyy-MM-dd'),
        montant_loyer: bail.loyer_hc,
        montant_charges: bail.provision_charges,
        montant_total: 0,
        statut: 'EN_ATTENTE'
      });
      
      nextMonthStart = addMonths(nextMonthStart, 1);
    }

    // 3. Dernier mois (SOLDE_SORTIE) si différent du premier mois et pas un mois complet déjà traité
    if (!isSameMonth(start, end)) {
      const startOfLastMonth = startOfMonth(end);
      const isLastDayOfMonth = isSameDay(end, endOfMonth(end));
      
      const daysInLastMonth = getDaysInMonth(end);
      const occupiedDaysLastMonth = end.getDate();
      const prorataRatioLast = occupiedDaysLastMonth / daysInLastMonth;

      echeances.push({
        bail_id: bail.id,
        type: 'SOLDE_SORTIE',
        date_exigibilite: format(setDate(startOfLastMonth, Math.min(bail.jour_exigibilite, daysInLastMonth)), 'yyyy-MM-dd'),
        periode_debut: format(startOfLastMonth, 'yyyy-MM-dd'),
        periode_fin: format(end, 'yyyy-MM-dd'),
        montant_loyer: Math.round(bail.loyer_hc * prorataRatioLast * 100) / 100,
        montant_charges: Math.round(bail.provision_charges * prorataRatioLast * 100) / 100,
        montant_total: 0,
        statut: 'EN_ATTENTE'
      });
    }

  } else {
    // --- BRANCHE B : AIRBNB (Blocs Mensuels) ---
    
    let current = start;
    
    while (true) {
      const nextAnniversary = addMonths(current, 1);
      
      if (isAfter(nextAnniversary, end)) {
        // Reliquat
        if (!isSameDay(current, end)) {
          const daysInReliquat = differenceInCalendarDays(end, current) + 1;
          // For Airbnb, we might want to use a standard 30-day month for prorata or actual days in month
          // The prompt says "Prorata uniquement en fin si reliquat"
          const daysInMonth = getDaysInMonth(current);
          const prorataRatio = daysInReliquat / daysInMonth;

          echeances.push({
            bail_id: bail.id,
            type: 'PAYOUT_OTA_RELIQUAT',
            date_exigibilite: format(current, 'yyyy-MM-dd'),
            periode_debut: format(current, 'yyyy-MM-dd'),
            periode_fin: format(end, 'yyyy-MM-dd'),
            montant_loyer: Math.round(bail.loyer_hc * prorataRatio * 100) / 100,
            montant_charges: Math.round(bail.provision_charges * prorataRatio * 100) / 100,
            montant_total: 0,
            statut: 'ATTENTE_PAYOUT'
          });
        }
        break;
      } else {
        // Mois complet (Anniversaire)
        echeances.push({
          bail_id: bail.id,
          type: 'PAYOUT_OTA_ATTENDU',
          date_exigibilite: format(current, 'yyyy-MM-dd'),
          periode_debut: format(current, 'yyyy-MM-dd'),
          periode_fin: format(subDays(nextAnniversary, 1), 'yyyy-MM-dd'),
          montant_loyer: bail.loyer_hc,
          montant_charges: bail.provision_charges,
          montant_total: 0,
          statut: 'ATTENTE_PAYOUT'
        });
        current = nextAnniversary;
      }
    }
  }

  // Calculate totals for all lines
  return echeances.map(e => ({
    ...e,
    montant_total: Math.round((e.montant_loyer + e.montant_charges + (e.montant_caution || 0) + (e.montant_frais_agence || 0)) * 100) / 100
  }));
}
