import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

export async function exportFEC(dateDebut: string, dateFin: string): Promise<string> {
  // 1. Fetch all entries for the period with related data
  const { data: entries, error } = await supabase
    .from('journal_ecritures')
    .select(`
      *,
      piece:pieces_comptables(numero_piece, date_piece, journal_code, libelle_piece),
      tiers:tiers(code_auxiliaire, nom)
    `)
    .gte('date_ecriture', dateDebut)
    .lte('date_ecriture', dateFin)
    .order('date_ecriture', { ascending: true });

  if (error) throw error;

  // 2. Fetch plan comptable for labels
  const { data: planData } = await supabase
    .from('plan_comptable')
    .select('numero, libelle');
  
  const planMap = new Map(planData?.map(p => [p.numero, p.libelle]) || []);

  // 3. Prepare FEC lines
  const fecLines: string[] = [];
  
  // FEC Header (18 columns)
  const header = [
    'JournalCode',
    'JournalLib',
    'EcritureNum',
    'EcritureDate',
    'CompteNum',
    'CompteLib',
    'CompteAuxNum',
    'CompteAuxLib',
    'PieceRef',
    'PieceDate',
    'EcritureLib',
    'Debit',
    'Credit',
    'EcritureLet',
    'DateLet',
    'ValidDate',
    'Montantdevise',
    'Idevise'
  ].join('\t');
  
  fecLines.push(header);

  // Helper to format dates to YYYYMMDD
  const formatFECDate = (dateStr: string) => {
    if (!dateStr) return '';
    return format(new Date(dateStr), 'yyyyMMdd');
  };

  // Helper to format amounts with comma
  const formatFECAmount = (amount: number | string) => {
    if (!amount) return '0,00';
    return Number(amount).toFixed(2).replace('.', ',');
  };

  // Helper to get journal name
  const getJournalName = (code: string) => {
    const names: Record<string, string> = {
      'JR': 'Journal des Réservations',
      'OD': 'Opérations Diverses',
      'BQ': 'Banque',
      'AN': 'A-Nouveaux',
      'EX': 'Extérieurs',
      'VT': 'Ventes'
    };
    return names[code] || 'Journal';
  };

  // Process each entry
  entries?.forEach(entry => {
    const piece = entry.piece;
    if (!piece) return;

    const journalCode = piece.journal_code || 'OD';
    const journalLib = getJournalName(journalCode);
    const ecritureNum = piece.numero_piece || entry.id.substring(0, 8);
    const ecritureDate = formatFECDate(entry.date_ecriture);
    const pieceRef = piece.numero_piece || '';
    const pieceDate = formatFECDate(piece.date_piece || entry.date_ecriture);
    const ecritureLib = entry.libelle || piece.libelle_piece || '';
    const montant = entry.montant;
    const lettrage = entry.lettrage || '';
    const dateLet = lettrage ? ecritureDate : ''; // Approximation if no specific lettrage date

    // Handle Debit line if compte_debit exists
    if (entry.compte_debit) {
      const isAuxDebit = entry.compte_debit.includes('-') || entry.compte_debit.startsWith('OTA-') || entry.compte_debit.startsWith('VOY-');
      const compteNumDebit = isAuxDebit ? (entry.compte_debit.startsWith('OTA-') || entry.compte_debit.startsWith('VOY-') ? '411' : entry.compte_debit.split('-')[0]) : entry.compte_debit;
      const compteLibDebit = planMap.get(compteNumDebit) || 'Compte inconnu';
      
      const compteAuxNumDebit = isAuxDebit ? entry.compte_debit : '';
      const compteAuxLibDebit = isAuxDebit ? (entry.tiers?.nom || 'Tiers inconnu') : '';

      const debitLine = [
        journalCode,
        journalLib,
        ecritureNum,
        ecritureDate,
        compteNumDebit,
        compteLibDebit,
        compteAuxNumDebit,
        compteAuxLibDebit,
        pieceRef,
        pieceDate,
        ecritureLib,
        formatFECAmount(montant), // Debit
        '0,00', // Credit
        lettrage,
        dateLet,
        ecritureDate, // ValidDate (using ecriture date as approximation)
        '', // Montantdevise
        ''  // Idevise
      ].join('\t');
      
      fecLines.push(debitLine);
    }

    // Handle Credit line if compte_credit exists
    if (entry.compte_credit) {
      const isAuxCredit = entry.compte_credit.includes('-') || entry.compte_credit.startsWith('OTA-') || entry.compte_credit.startsWith('VOY-');
      const compteNumCredit = isAuxCredit ? (entry.compte_credit.startsWith('OTA-') || entry.compte_credit.startsWith('VOY-') ? '411' : entry.compte_credit.split('-')[0]) : entry.compte_credit;
      const compteLibCredit = planMap.get(compteNumCredit) || 'Compte inconnu';
      
      const compteAuxNumCredit = isAuxCredit ? entry.compte_credit : '';
      const compteAuxLibCredit = isAuxCredit ? (entry.tiers?.nom || 'Tiers inconnu') : '';

      const creditLine = [
        journalCode,
        journalLib,
        ecritureNum,
        ecritureDate,
        compteNumCredit,
        compteLibCredit,
        compteAuxNumCredit,
        compteAuxLibCredit,
        pieceRef,
        pieceDate,
        ecritureLib,
        '0,00', // Debit
        formatFECAmount(montant), // Credit
        lettrage,
        dateLet,
        ecritureDate, // ValidDate
        '', // Montantdevise
        ''  // Idevise
      ].join('\t');
      
      fecLines.push(creditLine);
    }
  });

  return fecLines.join('\n');
}

export function downloadFEC(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
