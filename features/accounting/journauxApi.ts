import { supabase } from '@/lib/supabaseClient';

export interface JournalStats {
  code: string;
  count: number;
  totalDebit: number;
  totalCredit: number;
  lastEntry?: {
    date: string;
    libelle: string;
  };
}

export const journauxApi = {
  async getJournauxStats(month: number, year: number): Promise<JournalStats[]> {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Fetch all pieces for the month with their totals
    const { data, error } = await supabase
      .from('pieces_comptables')
      .select(`
        id,
        journal_code,
        date_piece,
        libelle_piece,
        journal_ecritures(montant)
      `)
      .gte('date_piece', startDate)
      .lte('date_piece', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const statsMap = new Map<string, JournalStats>();

    // Initialize stats for each known journal
    ['JR', 'OD', 'BQ', 'AN', 'EX', 'VT'].forEach(code => {
      statsMap.set(code, {
        code,
        count: 0,
        totalDebit: 0,
        totalCredit: 0
      });
    });

    data?.forEach(piece => {
      const code = piece.journal_code;
      if (statsMap.has(code)) {
        const s = statsMap.get(code)!;
        s.count++;
        
        // Sum of debits (which equals sum of credits since it's balanced)
        const pieceTotal = (piece.journal_ecritures as any[]).reduce((acc, curr) => acc + Number(curr.montant), 0);
        s.totalDebit += pieceTotal;
        s.totalCredit += pieceTotal;
        
        if (!s.lastEntry) {
          s.lastEntry = {
            date: piece.date_piece,
            libelle: piece.libelle_piece
          };
        }
      }
    });

    return Array.from(statsMap.values());
  },

  inferJournalCode(entry: any): string {
    if (entry.reservation_id) return 'JR';
    if (entry.operation_diverse_id) return 'OD';
    if (entry.compte_debit.startsWith('512') || entry.compte_credit.startsWith('512')) return 'BQ';
    if (entry.numero_piece?.startsWith('AN-')) return 'AN';
    if (entry.numero_piece?.startsWith('RED-')) return 'EX';
    if (entry.numero_piece?.startsWith('FAC-')) return 'VT';
    return 'OD'; // Default to OD if unknown
  },

  async getJournalEntries(code: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select(`
        *,
        piece:pieces_comptables!inner(numero_piece, journal_code, source_type)
      `)
      .eq('piece.journal_code', code)
      .gte('date_ecriture', startDate)
      .lte('date_ecriture', endDate)
      .order('date_ecriture', { ascending: true });

    if (error) throw error;

    // Flatten numero_piece
    return (data as any[]).map(entry => ({
      ...entry,
      numero_piece: entry.piece?.numero_piece,
      source_type: entry.piece?.source_type
    }));
  },

  async getPieceById(id: string) {
    const { data, error } = await supabase
      .from('pieces_comptables')
      .select(`
        *,
        journal_ecritures(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    const rawEntries = data.journal_ecritures || [];
    // Sort by created_at to maintain the original sequence
    rawEntries.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));

    const lignes = rawEntries.map((e: any) => ({
      libelle: e.libelle,
      compte_debit: e.compte_debit,
      compte_credit: e.compte_credit,
      montant: e.montant,
      tiers_id: e.tiers_id,
      lettrage: e.lettrage
    }));

    return { ...data, lignes };
  }
};
