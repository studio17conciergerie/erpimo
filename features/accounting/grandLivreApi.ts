import { supabase } from '@/lib/supabaseClient';

export interface GrandLivreFilters {
  societe?: string;
  compteCentralisateur?: string;
  compteDe?: string;
  compteAu?: string;
  dateDebut: string;
  dateFin: string;
  ecrituresPointees?: boolean;
  lettrageFilter?: 'TOUTES' | 'NON_LETTREES' | 'LETTREES';
  tri?: 'alphanumerique' | 'alphabetique';
}

export interface GrandLivreEntry {
  id: string;
  date_ecriture: string;
  piece_comptable_id?: string;
  numero_piece?: string;
  journal_code?: string;
  date_piece?: string;
  source_type?: string;
  source_id?: string;
  libelle: string;
  compte_debit: string;
  compte_credit: string;
  montant: number;
  reservation_id?: string;
  tiers_id?: string;
  tiers_nom?: string;
  solde_progressif?: number;
  compte_general?: string;
  compte_auxiliaire?: string;
  lettrage?: string;
  debit: number;
  credit: number;
}

export const grandLivreApi = {
  async getReportANouveau(filtres: any): Promise<number> {
    const { compteNumero, compteCentralisateur, compteDe, compteAu, dateDebut } = filtres;
    
    const accountFilter = (compteNumero || compteCentralisateur || '').replace('%', '');

    let query = supabase
      .from('journal_ecritures')
      .select('compte_debit, compte_credit, montant')
      .lt('date_ecriture', dateDebut);

    if (compteDe && compteAu) {
      query = query.or(`and(compte_debit.gte.${compteDe},compte_debit.lte.${compteAu}),and(compte_credit.gte.${compteDe},compte_credit.lte.${compteAu})`);
    } else if (accountFilter) {
      query = query.or(`compte_debit.ilike.${accountFilter}%,compte_credit.ilike.${accountFilter}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    let total = 0;
    data.forEach(entry => {
      const montant = Number(entry.montant);
      if (this.matchesCompte(entry.compte_debit, { ...filtres, compteCentralisateur: accountFilter })) {
        total += montant;
      }
      if (this.matchesCompte(entry.compte_credit, { ...filtres, compteCentralisateur: accountFilter })) {
        total -= montant;
      }
    });

    return total;
  },

  matchesCompte(compte: string, filtres: any): boolean {
    const { compteNumero, compteCentralisateur, compteDe, compteAu } = filtres;
    const accountFilter = (compteNumero || compteCentralisateur || '').replace('%', '');
    
    if (compteDe && compteAu) {
      return compte >= compteDe && compte <= compteAu;
    }
    if (accountFilter) {
      return compte.startsWith(accountFilter);
    }
    return true;
  },

  async getGrandLivre(filtres: any): Promise<{ 
    entries: GrandLivreEntry[], 
    reportANouveau: number,
    totalDebit: number,
    totalCredit: number,
    soldeCloture: number
  }> {
    const { 
      compteNumero, 
      compteCentralisateur, 
      compteDe, 
      compteAu, 
      dateDebut, 
      dateFin, 
      ecrituresPointees, 
      tri 
    } = filtres;

    // Normalize account filter
    const accountFilter = (compteNumero || compteCentralisateur || '').replace('%', '');
    const normalizedFiltres = { ...filtres, compteCentralisateur: accountFilter };

    // 1. Calcul du report à nouveau
    const reportANouveau = await this.getReportANouveau(normalizedFiltres);

    // 2. Requête des écritures de la période
    const baseColumns = `
      id, 
      date_ecriture, 
      libelle, 
      compte_debit, 
      compte_credit, 
      montant, 
      tiers_id, 
      lettrage, 
      piece_comptable_id,
      piece:pieces_comptables(numero_piece, journal_code, source_type, source_id, date_piece),
      tiers:tiers_id(nom, code_auxiliaire)
    `;
    
    let query = supabase
      .from('journal_ecritures')
      .select(baseColumns)
      .gte('date_ecriture', dateDebut)
      .lte('date_ecriture', dateFin);

    if (compteDe && compteAu) {
      query = query.or(`and(compte_debit.gte.${compteDe},compte_debit.lte.${compteAu}),and(compte_credit.gte.${compteDe},compte_credit.lte.${compteAu})`);
    } else if (accountFilter) {
      query = query.or(`compte_debit.ilike.${accountFilter}%,compte_credit.ilike.${accountFilter}%`);
    }

    if (filtres.lettrageFilter === 'NON_LETTREES') {
      query = query.is('lettrage', null);
    } else if (filtres.lettrageFilter === 'LETTREES') {
      query = query.not('lettrage', 'is', null);
    } else if (ecrituresPointees === false) {
      query = query.is('lettrage', null);
    }

    let { data, error } = await query;
    
    if (error) throw error;

    // 3. Calcul du solde progressif et totaux
    let soldeProgressif = reportANouveau;
    let totalDebit = 0;
    let totalCredit = 0;

    let entries = (data as any[]).map((entry: any) => {
      const montant = Number(entry.montant);
      let debit = 0;
      let credit = 0;

      // Flatten piece info
      const numero_piece = entry.piece?.numero_piece;
      const journal_code = entry.piece?.journal_code;
      const date_piece = entry.piece?.date_piece;
      const source_type = entry.piece?.source_type;
      const source_id = entry.piece?.source_id;

      // Déterminer si c'est un débit ou crédit pour le compte filtré
      const isDebit = this.matchesCompte(entry.compte_debit, filtres);
      const isCredit = this.matchesCompte(entry.compte_credit, filtres);

      if (isDebit) {
        debit = montant;
        totalDebit += montant;
        soldeProgressif += montant;
      }
      if (isCredit) {
        credit = montant;
        totalCredit += montant;
        soldeProgressif -= montant;
      }

      return {
        ...entry,
        numero_piece,
        journal_code,
        date_piece,
        source_type,
        source_id,
        debit,
        credit,
        solde_progressif: soldeProgressif,
        compte_general: isDebit ? entry.compte_debit.substring(0, 3) : entry.compte_credit.substring(0, 3),
        compte_auxiliaire: isDebit ? entry.compte_debit : entry.compte_credit,
        tiers_nom: entry.tiers?.nom
      };
    });

    // Tri
    entries.sort((a, b) => {
      // 1. Sort by account
      let cmp = 0;
      if (tri === 'alphabetique') {
        cmp = a.compte_auxiliaire.localeCompare(b.compte_auxiliaire);
      } else {
        const numA = parseInt(a.compte_auxiliaire.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.compte_auxiliaire.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) cmp = numA - numB;
        else cmp = a.compte_auxiliaire.localeCompare(b.compte_auxiliaire);
      }
      
      if (cmp !== 0) return cmp;
      
      // 2. Sort by date within account
      if (a.date_ecriture !== b.date_ecriture) {
        return a.date_ecriture.localeCompare(b.date_ecriture);
      }
      
      // 3. Sort by piece number within account
      return (a.numero_piece || '').localeCompare(b.numero_piece || '');
    });

    // Recalculate solde progressif after sort
    soldeProgressif = reportANouveau;
    entries = entries.map(entry => {
      if (entry.debit) soldeProgressif += entry.debit;
      if (entry.credit) soldeProgressif -= entry.credit;
      return { ...entry, solde_progressif: soldeProgressif };
    });

    return {
      entries,
      reportANouveau,
      totalDebit,
      totalCredit,
      soldeCloture: soldeProgressif
    };
  }
};
