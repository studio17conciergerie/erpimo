import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Register a font for better look and consistency
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: 'Inter',
    flexDirection: 'column',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  reportRow: {
    backgroundColor: '#f8fafc',
    padding: 5,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
    fontWeight: 'bold',
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
  },
  colCompteGen: { width: '8%' },
  colCompteAux: { width: '12%' },
  colPiece: { width: '10%' },
  colDate: { width: '10%' },
  colLibelle: { width: '25%' },
  colJrn: { width: '5%' },
  colDebit: { width: '10%', textAlign: 'right' },
  colCredit: { width: '10%', textAlign: 'right' },
  colSolde: { width: '10%', textAlign: 'right' },
  footer: {
    marginTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#000',
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  footerLabel: {
    fontWeight: 'bold',
    marginRight: 10,
  },
  footerValue: {
    width: 100,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
  },
});

interface GrandLivrePdfProps {
  title: string;
  periode: string;
  entries: any[];
  reportANouveau: number;
  totalDebit: number;
  totalCredit: number;
  soldeCloture: number;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' €';
};

export const GrandLivrePdf = ({ title, periode, entries, reportANouveau, totalDebit, totalCredit, soldeCloture }: GrandLivrePdfProps) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Grand Livre Général</Text>
        <Text style={styles.subtitle}>{title}</Text>
        <Text style={styles.subtitle}>Période : {periode}</Text>
      </View>

      <View style={styles.reportRow}>
        <Text>Report à nouveau : {formatCurrency(reportANouveau)}</Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={styles.colCompteGen}>Cpt. Gen.</Text>
          <Text style={styles.colCompteAux}>Cpt. Aux.</Text>
          <Text style={styles.colPiece}>N° Pièce</Text>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colLibelle}>Libellé</Text>
          <Text style={styles.colJrn}>Jrn</Text>
          <Text style={styles.colDebit}>Débit</Text>
          <Text style={styles.colCredit}>Crédit</Text>
          <Text style={styles.colSolde}>Solde</Text>
        </View>

        {entries.map((entry, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colCompteGen}>{entry.compte_general}</Text>
            <Text style={styles.colCompteAux}>{entry.compte_auxiliaire}</Text>
            <Text style={styles.colPiece}>{entry.numero_piece || '-'}</Text>
            <Text style={styles.colDate}>{entry.date_piece ? format(new Date(entry.date_piece), 'dd/MM/yyyy') : format(new Date(entry.date_ecriture), 'dd/MM/yyyy')}</Text>
            <Text style={styles.colLibelle}>{entry.libelle}</Text>
            <Text style={styles.colJrn}>{entry.journal_code || '-'}</Text>
            <Text style={styles.colDebit}>{entry.debit > 0 ? formatCurrency(entry.debit) : ''}</Text>
            <Text style={styles.colCredit}>{entry.credit > 0 ? formatCurrency(entry.credit) : ''}</Text>
            <Text style={styles.colSolde}>{formatCurrency(entry.solde_progressif)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={{ flexDirection: 'column' }}>
          <View style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={styles.footerLabel}>Total Débits :</Text>
            <Text style={styles.footerValue}>{formatCurrency(totalDebit)}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={styles.footerLabel}>Total Crédits :</Text>
            <Text style={styles.footerValue}>{formatCurrency(totalCredit)}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#000', borderTopStyle: 'solid', paddingTop: 5 }}>
            <Text style={styles.footerLabel}>Solde de clôture :</Text>
            <Text style={styles.footerValue}>{formatCurrency(soldeCloture)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
        `Page ${pageNumber} / ${totalPages} - Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
      )} fixed />
    </Page>
  </Document>
);
