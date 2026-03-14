import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BailMtr } from '../mtrService';
import { EcheanceMtr } from '../utils/genererEcheancierBail';

// Register fonts if needed, but standard ones are usually fine
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
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  tableHeader: {
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    fontWeight: 'bold',
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
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalBox: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    marginTop: 20,
    borderRadius: 4,
  },
  totalText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  iban: {
    marginTop: 20,
    fontSize: 9,
    color: '#666',
  },
  bold: {
    fontWeight: 'bold',
  },
});

interface AvisEcheancePdfProps {
  bail: BailMtr;
  echeance: EcheanceMtr;
}

export const AvisEcheancePdf: React.FC<AvisEcheancePdfProps> = ({ bail, echeance }) => {
  const monthName = format(parseISO(echeance.periode_debut), 'MMMM yyyy', { locale: fr });
  const totalAmount = echeance.montant_total;
  const dueDate = echeance.date_exigibilite;

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

        <Text style={{ textAlign: 'right', marginBottom: 20 }}>Fait à Paris, le {format(new Date(), 'dd/MM/yyyy')}</Text>

        {/* Title */}
        <Text style={styles.title}>AVIS D'ÉCHÉANCE - {monthName}</Text>

        <View style={styles.section}>
          <Text>Objet : Appel de loyer pour la période du {format(parseISO(echeance.periode_debut), 'dd/MM/yyyy')} au {format(parseISO(echeance.periode_fin), 'dd/MM/yyyy')}</Text>
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
            Montant total à régler avant le {format(parseISO(dueDate), 'dd/MM/yyyy')} : {totalAmount.toFixed(2)} €
          </Text>
        </View>

        {/* IBAN */}
        <View style={styles.iban}>
          <Text style={styles.bold}>Coordonnées bancaires pour le virement :</Text>
          <Text>Titulaire : PRIMO CONCIERGERIE SEQUESTRE</Text>
          <Text>IBAN : FR76 3000 1007 9812 3456 7890 123</Text>
          <Text>BIC : AGRIFRPPXXX</Text>
          <Text style={{ marginTop: 10, fontStyle: 'italic' }}>Merci de préciser la référence "{bail.numero_bail}" dans l'intitulé de votre virement.</Text>
        </View>

        <View style={styles.footer}>
          <Text style={{ textAlign: 'center', color: '#999', fontSize: 8 }}>
            Cet avis d'échéance ne vaut pas quittance. Une quittance vous sera adressée dès réception de votre règlement.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
