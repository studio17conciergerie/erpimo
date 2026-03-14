import { supabase } from '@/lib/supabaseClient';

export interface BalanceEntry {
  compteNumero: string;
  compteLibelle: string;
  classeComptable: number;
  reportDebit: number;
  reportCredit: number;
  mouvementDebit: number;
  mouvementCredit: number;
  soldeDebit: number;
  soldeCredit: number;
  isAuxiliaire: boolean;
  rootCompte?: string;
}

function getCompteRacine(compte: string): string {
  if (compte.startsWith('OTA-') || compte.startsWith('VOY-')) return '411';
  if (compte.startsWith('512000')) return '512000';
  if (compte.startsWith('512100')) return '512100';
  
  const match = compte.match(/^(\d{3})/);
  if (match) return match[1];
  
  if (compte.includes('-')) return compte.split('-')[0];
  
  return compte.substring(0, 3);
}

export const balanceApi = {
  async getBalanceComptable(dateDebut: string, dateFin: string, type: 'GENERALE' | 'AUXILIAIRE'): Promise<BalanceEntry[]> {
    // 1. Fetch raw data from RPC
    const { data: rawData, error: rpcError } = await supabase.rpc('get_balance_data', {
      p_date_debut: dateDebut,
      p_date_fin: dateFin
    });

    if (rpcError) throw rpcError;

    // 2. Fetch labels from plan_comptable and tiers
    const [{ data: planData }, { data: tiersData }] = await Promise.all([
      supabase.from('plan_comptable').select('numero, libelle, classe'),
      supabase.from('tiers').select('code_auxiliaire, nom')
    ]);

    const planMap = new Map(planData?.map(p => [p.numero, p]) || []);
    const tiersMap = new Map(tiersData?.map(t => [t.code_auxiliaire, t.nom]) || []);

    // 3. Process each account
    const entries: BalanceEntry[] = (rawData as any[]).map(row => {
      const compte = row.compte;
      const isAux = compte.includes('-') || (compte.length > 6 && !compte.startsWith('OTA-') && !compte.startsWith('VOY-')) || compte.startsWith('OTA-') || compte.startsWith('VOY-');
      const rootCompte = getCompteRacine(compte);
      
      let libelle = planMap.get(compte)?.libelle || tiersMap.get(compte) || 'Compte inconnu';
      const classe = planMap.get(compte)?.classe || parseInt(rootCompte[0]) || 4;

      // Calculate closing balances
      const totalDebit = Number(row.report_debit) + Number(row.mvt_debit);
      const totalCredit = Number(row.report_credit) + Number(row.mvt_credit);
      
      let soldeDebit = 0;
      let soldeCredit = 0;

      if (totalDebit > totalCredit) {
        soldeDebit = totalDebit - totalCredit;
      } else {
        soldeCredit = totalCredit - totalDebit;
      }

      return {
        compteNumero: compte,
        compteLibelle: libelle,
        classeComptable: classe,
        reportDebit: Number(row.report_debit),
        reportCredit: Number(row.report_credit),
        mouvementDebit: Number(row.mvt_debit),
        mouvementCredit: Number(row.mvt_credit),
        soldeDebit,
        soldeCredit,
        isAuxiliaire: isAux,
        rootCompte
      };
    });

    if (type === 'AUXILIAIRE') {
      return entries.sort((a, b) => a.compteNumero.localeCompare(b.compteNumero));
    }

    // 4. Group by root account for 'GENERALE'
    const grouped = new Map<string, BalanceEntry>();

    entries.forEach(entry => {
      const root = entry.rootCompte || getCompteRacine(entry.compteNumero);
      if (!grouped.has(root)) {
        const rootLibelle = planMap.get(root)?.libelle || `Compte racine ${root}`;
        grouped.set(root, {
          compteNumero: root,
          compteLibelle: rootLibelle,
          classeComptable: entry.classeComptable,
          reportDebit: 0,
          reportCredit: 0,
          mouvementDebit: 0,
          mouvementCredit: 0,
          soldeDebit: 0,
          soldeCredit: 0,
          isAuxiliaire: false
        });
      }

      const g = grouped.get(root)!;
      g.reportDebit += entry.reportDebit;
      g.reportCredit += entry.reportCredit;
      g.mouvementDebit += entry.mouvementDebit;
      g.mouvementCredit += entry.mouvementCredit;
    });

    // Recalculate closing balances for grouped entries
    return Array.from(grouped.values()).map(g => {
      const totalDebit = g.reportDebit + g.mouvementDebit;
      const totalCredit = g.reportCredit + g.mouvementCredit;
      
      if (totalDebit > totalCredit) {
        g.soldeDebit = totalDebit - totalCredit;
        g.soldeCredit = 0;
      } else {
        g.soldeCredit = totalCredit - totalDebit;
        g.soldeDebit = 0;
      }
      return g;
    }).sort((a, b) => a.compteNumero.localeCompare(b.compteNumero));
  }
};
