import { supabase } from '@/lib/supabaseClient';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export type AgencyRevenueSummary = {
  ownerName: string;
  propertyName: string;
  invoiceNumber: string;
  mgmtFees: number;
  insuranceCommissions: number;
  interventionFees: number;
  totalHT: number;
  tva: number;
  totalTTC: number;
  reservationId: string;
};

export type AgencyRevenueStats = {
  totalMgmtFees: number;
  totalOtherCommissions: number;
  totalHT: number;
};

export const agencyRevenueService = {
  async getSyntheseHonorairesAgence(month: number, year: number): Promise<{ 
    details: AgencyRevenueSummary[], 
    stats: AgencyRevenueStats 
  }> {
    const startDate = format(new Date(year, month, 1), 'yyyy-MM-01');
    const endDate = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');

    // Query journal_ecritures for credits on 706% accounts
    // We also need to join with reservations and logements to get owner/property names
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select(`
        *,
        reservation:reservation_id (
          id,
          confirmation_code,
          guest_name,
          logement:logements (
            nom,
            owner:proprietaire_id (nom)
          )
        )
      `)
      .gte('date_ecriture', startDate)
      .lte('date_ecriture', endDate)
      .like('compte_credit', '706%');

    if (error) throw error;

    const detailsMap = new Map<string, AgencyRevenueSummary>();
    let totalMgmtFees = 0;
    let totalOtherCommissions = 0;

    data?.forEach((entry: any) => {
      const res = entry.reservation;
      if (!res) return;

      const resId = res.id;
      if (!detailsMap.has(resId)) {
        detailsMap.set(resId, {
          ownerName: res.logement?.owner?.nom || 'Inconnu',
          propertyName: res.logement?.nom || 'Inconnu',
          invoiceNumber: `FACT-${res.confirmation_code}`, // Placeholder for invoice number
          mgmtFees: 0,
          insuranceCommissions: 0,
          interventionFees: 0,
          totalHT: 0,
          tva: 0,
          totalTTC: 0,
          reservationId: resId
        });
      }

      const summary = detailsMap.get(resId)!;
      const amount = Number(entry.montant);

      if (entry.compte_credit === '706100') {
        summary.mgmtFees += amount;
        totalMgmtFees += amount;
      } else if (entry.compte_credit === '706200') {
        summary.insuranceCommissions += amount;
        totalOtherCommissions += amount;
      } else if (entry.compte_credit === '706300') {
        summary.interventionFees += amount;
        totalOtherCommissions += amount;
      }

      summary.totalHT += amount;
      summary.tva = summary.totalHT * 0.20;
      summary.totalTTC = summary.totalHT + summary.tva;
    });

    const details = Array.from(detailsMap.values());
    const stats = {
      totalMgmtFees,
      totalOtherCommissions,
      totalHT: totalMgmtFees + totalOtherCommissions
    };

    return { details, stats };
  },

  async markAsTransferred(reservationIds: string[]): Promise<void> {
    // This would involve creating a journal entry:
    // Debit 512000 / Credit 512100
    // For the total amount of commissions
    
    // For now, we'll just simulate it or create a generic entry if we have enough info
    const dateEcriture = new Date().toISOString().split('T')[0];
    
    // Fetch total amount for these reservations
    const { data, error } = await supabase
      .from('journal_ecritures')
      .select('montant')
      .in('reservation_id', reservationIds)
      .like('compte_credit', '706%');

    if (error) throw error;

    const totalAmount = data?.reduce((sum, e) => sum + Number(e.montant), 0) || 0;

    if (totalAmount > 0) {
      const { error: insertError } = await supabase.from('journal_ecritures').insert({
        date_ecriture: dateEcriture,
        libelle: `Virement Honoraires Agence - ${reservationIds.length} résas`,
        compte_debit: '512100', // Banque Agence
        compte_credit: '512000', // Banque Séquestre
        montant: totalAmount,
      });

      if (insertError) throw insertError;
    }
  },

  generateFECExport(details: AgencyRevenueSummary[]): string {
    // FEC format: JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompteAuxNum|CompteAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise
    const headers = [
      'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 
      'CompteAuxNum', 'CompteAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 
      'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'
    ];

    const rows = [headers.join('\t')];
    let ecritureNum = 1;

    details.forEach(item => {
      const date = format(new Date(), 'yyyyMMdd');
      
      // 1. Line for Management Fees (Credit 706100)
      if (item.mgmtFees > 0) {
        rows.push([
          'VT', 'VENTES', ecritureNum, date, '706100', 'HONORAIRES GESTION', 
          '', '', item.invoiceNumber, date, `Honoraires - ${item.propertyName}`, '0,00', item.mgmtFees.toFixed(2).replace('.', ','),
          '', '', date, '', ''
        ].join('\t'));
      }

      // 2. Line for Insurance (Credit 706200)
      if (item.insuranceCommissions > 0) {
        rows.push([
          'VT', 'VENTES', ecritureNum, date, '706200', 'COMMISSIONS ASSURANCE', 
          '', '', item.invoiceNumber, date, `Assurance - ${item.propertyName}`, '0,00', item.insuranceCommissions.toFixed(2).replace('.', ','),
          '', '', date, '', ''
        ].join('\t'));
      }

      // 3. Line for Intervention (Credit 706300)
      if (item.interventionFees > 0) {
        rows.push([
          'VT', 'VENTES', ecritureNum, date, '706300', 'FRAIS INTERVENTION', 
          '', '', item.invoiceNumber, date, `Intervention - ${item.propertyName}`, '0,00', item.interventionFees.toFixed(2).replace('.', ','),
          '', '', date, '', ''
        ].join('\t'));
      }

      // 4. Line for TVA (Credit 445710)
      if (item.tva > 0) {
        rows.push([
          'VT', 'VENTES', ecritureNum, date, '445710', 'TVA COLLECTEE', 
          '', '', item.invoiceNumber, date, `TVA - ${item.propertyName}`, '0,00', item.tva.toFixed(2).replace('.', ','),
          '', '', date, '', ''
        ].join('\t'));
      }

      // 5. Line for Client (Debit 411)
      if (item.totalTTC > 0) {
        rows.push([
          'VT', 'VENTES', ecritureNum, date, '411000', 'CLIENTS', 
          '', '', item.invoiceNumber, date, `Vente - ${item.propertyName}`, item.totalTTC.toFixed(2).replace('.', ','), '0,00',
          '', '', date, '', ''
        ].join('\t'));
      }

      ecritureNum++;
    });

    return rows.join('\n');
  }
};
