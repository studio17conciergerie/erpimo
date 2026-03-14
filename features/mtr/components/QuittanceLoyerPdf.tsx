import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
// @ts-ignore
import { toCurrency } from 'n2words/fr-FR';
import { BailMtr } from '../mtrService';
import { EcheanceMtr } from '../utils/genererEcheancierBail';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  agencyInfo: {
    width: '45%',
  },
  tenantInfo: {
    width: '45%',
    marginTop: 60,
    padding: 10,
    border: '1pt solid #eee',
    borderRadius: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    textTransform: 'uppercase',
    color: '#000',
  },
  section: {
    marginBottom: 20,
  },
  legalMention: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderLeft: '4pt solid #10b981',
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCellLabel: {
    flex: 2,
    padding: 8,
  },
  tableCellValue: {
    flex: 1,
    padding: 8,
    textAlign: 'right',
  },
  totalBox: {
    backgroundColor: '#ecfdf5',
    padding: 15,
    marginTop: 20,
    borderRadius: 4,
    border: '1pt solid #10b981',
  },
  totalText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#065f46',
  },
  footer: {
    marginTop: 60,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  signature: {
    marginTop: 40,
    textAlign: 'right',
  },
  bold: {
    fontWeight: 'bold',
  },
});

interface QuittanceLoyerPdfProps {
  bail: BailMtr;
  echeance: EcheanceMtr;
}

export const QuittanceLoyerPdf: React.FC<QuittanceLoyerPdfProps> = ({ bail, echeance }) => {
  const monthName = format(parseISO(echeance.periode_debut), 'MMMM yyyy', { locale: fr });
  const totalAmount = echeance.montant_total;
  const amountInWords = toCurrency(totalAmount);
  const paymentDate = echeance.date_exigibilite;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.agencyInfo}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>PRIMO CONCIERGERIE</Text>
            <Text>17 Rue de Paris</Text>
            <Text>75017 Paris</Text>
            <Text>SIRET : 123 456 789 00012</Text>
            <Text>Carte G : CPI 7501 2024 000 000 123</Text>
            <Text>Email : contact@primoconciergerie.fr</Text>
          </View>
          <View style={styles.tenantInfo}>
            <Text style={styles.bold}>{bail.locataire?.prenom} {bail.locataire?.nom}</Text>
            <Text>{bail.logement?.nom}</Text>
            <Text>Paris, France</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>QUITTANCE DE LOYER - {monthName}</Text>

        {/* Legal Mention */}
        <View style={styles.legalMention}>
          <Text>
            L'agence soussignée déclare avoir reçu de M./Mme {bail.locataire?.prenom} {bail.locataire?.nom} la somme de {totalAmount.toFixed(2)} € ({amountInWords}), au titre du paiement du loyer et des charges pour la période du {format(parseISO(echeance.periode_debut), 'dd/MM/yyyy')} au {format(parseISO(echeance.periode_fin), 'dd/MM/yyyy')}.
          </Text>
        </View>

        <View style={styles.section}>
          <Text>Détail du règlement :</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Loyer Hors Charges</Text>
            <Text style={styles.tableCellValue}>{echeance.montant_loyer.toFixed(2)} €</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Provisions pour charges</Text>
            <Text style={styles.tableCellValue}>{echeance.montant_charges.toFixed(2)} €</Text>
          </View>
          {echeance.montant_caution && echeance.montant_caution > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Dépôt de garantie</Text>
              <Text style={styles.tableCellValue}>{echeance.montant_caution.toFixed(2)} €</Text>
            </View>
          )}
          {echeance.montant_frais_agence && echeance.montant_frais_agence > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Honoraires de location</Text>
              <Text style={styles.tableCellValue}>{echeance.montant_frais_agence.toFixed(2)} €</Text>
            </View>
          )}
        </View>

        {/* Total */}
        <View style={styles.totalBox}>
          <Text style={styles.totalText}>
            Total acquitté : {totalAmount.toFixed(2)} €
          </Text>
        </View>

        <View style={styles.signature}>
          <Text>Fait à Paris, le {format(new Date(), 'dd/MM/yyyy')}, pour valoir ce que de droit.</Text>
          <Text style={{ marginTop: 20, fontWeight: 'bold' }}>La Gérance</Text>
          <Text style={{ fontSize: 8, color: '#999', marginTop: 10 }}>Signature électronique certifiée</Text>
        </View>

        <View style={styles.footer}>
          <Text style={{ textAlign: 'center', color: '#999', fontSize: 8 }}>
            Cette quittance annule tout reçu relatif à la même période. Elle ne vaut que pour la période indiquée ci-dessus.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
