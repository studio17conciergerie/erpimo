import { supabase } from '@/lib/supabaseClient';
import { accountingEngine, JournalEntry } from './accountingEngine';

export type StatutOD = 'BROUILLON' | 'VALIDEE' | 'ANNULEE';

export interface OperationDiverse {
  id: string;
  numero_od: string;
  date_ecriture: string;
  libelle: string;
  statut: StatutOD;
  journal_code: string;
  pieces_jointes: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lignes?: OperationDiverseLigne[];
}

export interface OperationDiverseLigne {
  id?: string;
  operation_diverse_id?: string;
  libelle: string;
  compte_debit: string;
  compte_credit: string;
  montant: number;
  tiers_id?: string | null;
  ordre: number;
  created_at?: string;
}

export const odApi = {
  async getODs(filters?: any) {
    let query = supabase
      .from('operations_diverses')
      .select(`
        *,
        lignes:operations_diverses_lignes(*)
      `)
      .order('date_ecriture', { ascending: false });

    if (filters?.month && filters?.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(filters.year, filters.month, 0).toISOString().split('T')[0];
      query = query.gte('date_ecriture', startDate).lte('date_ecriture', endDate);
    }

    if (filters?.statut && filters.statut !== 'ALL') {
      query = query.eq('statut', filters.statut);
    }

    if (filters?.journal_code) {
      query = query.eq('journal_code', filters.journal_code);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as OperationDiverse[];
  },

  async getODById(id: string) {
    const { data, error } = await supabase
      .from('operations_diverses')
      .select(`
        *,
        lignes:operations_diverses_lignes(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // Simplified reading: each line is a complete operation
    const rawLines = data.lignes || [];
    rawLines.sort((a: any, b: any) => a.ordre - b.ordre);
    
    const lines: OperationDiverseLigne[] = rawLines.map((l: any) => ({
      id: l.id,
      operation_diverse_id: l.operation_diverse_id,
      libelle: l.libelle,
      compte_debit: l.compte_debit,
      compte_credit: l.compte_credit,
      montant: l.montant,
      tiers_id: l.tiers_id,
      ordre: l.ordre
    }));
    
    return { ...data, lignes: lines } as OperationDiverse;
  },

  async saveOD(od: Partial<OperationDiverse>, operations: OperationDiverseLigne[]) {
    // 1. Save Header
    // Ne plus fournir numero_od pour les nouvelles OD (laisser le trigger SQL le générer)
    const headerPayload: any = { 
      ...od, 
      updated_at: new Date().toISOString() 
    };
    
    if (!od.id) {
      delete headerPayload.numero_od;
    }

    const { data: header, error: headerError } = await supabase
      .from('operations_diverses')
      .upsert(headerPayload)
      .select()
      .single();

    if (headerError) throw headerError;

    // 2. Delete existing lines if updating
    if (od.id) {
      const { error: deleteError } = await supabase
        .from('operations_diverses_lignes')
        .delete()
        .eq('operation_diverse_id', od.id);
      if (deleteError) throw deleteError;
    }

    // 3. Insert new lines (Simplified format: 1 line per operation)
    const linesToInsert = operations.map((op, index) => ({
      operation_diverse_id: header.id,
      libelle: op.libelle,
      compte_debit: op.compte_debit,
      compte_credit: op.compte_credit,
      compte_debit_full: op.compte_debit,
      compte_credit_full: op.compte_credit,
      montant: op.montant,
      tiers_id: op.tiers_id,
      ordre: index
    }));

    const { error: linesError } = await supabase
      .from('operations_diverses_lignes')
      .insert(linesToInsert);

    if (linesError) throw linesError;

    return header;
  },

  async validerOD(id: string): Promise<string[]> {
    // 1. Get OD details
    const od = await this.getODById(id);
    if (od.statut !== 'BROUILLON') throw new Error('Seules les OD en brouillon peuvent être validées');
    
    // 2. Validation controls
    const errors: string[] = [];
    if (!od.lignes || od.lignes.length < 1) {
      errors.push('Une écriture doit avoir au moins 1 opération');
    } else {
      od.lignes.forEach((op, i) => {
        if (op.montant <= 0) {
          errors.push(`Ligne ${i + 1} : Le montant doit être supérieur à 0`);
        }
        if (op.compte_debit === op.compte_credit) {
          errors.push(`Ligne ${i + 1} : Le compte débit doit être différent du compte crédit`);
        }
        if (!op.libelle || op.libelle.trim() === '') {
          errors.push(`Ligne ${i + 1} : Le libellé est obligatoire`);
        }
      });
    }

    if (errors.length > 0) {
      return errors;
    }

    // 3. Création via le moteur comptable
    await accountingEngine.validateAndPostPiece(
      od.journal_code,
      od.date_ecriture,
      od.libelle,
      'OPERATION_DIVERSE',
      od.id,
      od.lignes.map(op => ({
        libelle: op.libelle,
        compte_debit: op.compte_debit,
        compte_credit: op.compte_credit,
        montant: op.montant,
        tiers_id: op.tiers_id
      }))
    );

    // 4. Update OD status
    const { error: updateError } = await supabase
      .from('operations_diverses')
      .update({ statut: 'VALIDEE', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;
    return [];
  },

  async annulerOD(id: string) {
    const od = await this.getODById(id);
    if (od.statut !== 'VALIDEE') throw new Error('Seules les OD validées peuvent être annulées');

    // 1. Get original piece and entries via pieces_comptables
    const { data: piece, error: pieceError } = await supabase
      .from('pieces_comptables')
      .select('id')
      .eq('source_type', 'OPERATION_DIVERSE')
      .eq('source_id', id)
      .single();

    if (pieceError) throw pieceError;

    const { data: entries, error: entriesError } = await supabase
      .from('journal_ecritures')
      .select('*')
      .eq('piece_comptable_id', piece.id);

    if (entriesError) throw entriesError;

    // 2. Generate reversal entries (invert debit/credit)
    const reversalEntries: JournalEntry[] = entries.map(e => ({
      date_ecriture: new Date().toISOString().split('T')[0],
      libelle: `ANNULATION: ${e.libelle}`,
      compte_debit: e.compte_credit,
      compte_credit: e.compte_debit,
      montant: e.montant,
      journal_code: od.journal_code,
      tiers_id: e.tiers_id || undefined,
      lettrage: e.lettrage // Reprendre le même code de lettrage si présent
    }));

    await accountingEngine.createPieceAndEntries(
      od.journal_code,
      new Date().toISOString().split('T')[0],
      `Annulation OD ${od.numero_od}`,
      'OPERATION_DIVERSE',
      id,
      reversalEntries
    );

    // 3. Update OD status
    const { error: updateError } = await supabase
      .from('operations_diverses')
      .update({ statut: 'ANNULEE', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;
    return true;
  },

  async deleteOD(id: string) {
    const { error } = await supabase
      .from('operations_diverses')
      .delete()
      .eq('id', id)
      .eq('statut', 'BROUILLON');

    if (error) throw error;
    return true;
  }
};
