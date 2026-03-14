import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { BalanceEntry } from '../balanceApi';

// Register a font for better look
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
    fontFamily: 'Inter',
    fontSize: 8,
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agencyInfo: {
    flexDirection: 'column',
  },
  agencyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  reportSubtitle: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  table: {
    display: 'flex',
    width: 'auto',
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    minHeight: 20,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 4,
  },
  colCompte: { width: '8%' },
  colLibelle: { width: '22%' },
  colAmount: { width: '11.66%', textAlign: 'right' },
  
  classHeader: {
    backgroundColor: '#F1F5F9',
    padding: 5,
    fontWeight: 'bold',
    fontSize: 7,
    textTransform: 'uppercase',
    color: '#475569',
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#1E293B',
    borderTopStyle: 'solid',
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    fontWeight: 'bold',
  },
  verificationBar: {
    marginTop: 15,
    padding: 8,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successBar: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    color: '#065F46',
  },
  errorBar: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    color: '#991B1B',
  },
  meta: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 7,
    color: '#94A3B8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});

interface BalancePdfProps {
  data: BalanceEntry[];
  totals: any;
  period: string;
  isEquilibree: boolean;
  ecart: number;
  type: string;
}

export const BalancePdf = ({ data, totals, period, isEquilibree, ecart, type }: BalancePdfProps) => {
  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const groupedByClass = data.reduce((acc: any, curr) => {
    if (!acc[curr.classeComptable]) acc[curr.classeComptable] = [];
    acc[curr.classeComptable].push(curr);
    return acc;
  }, {});

  const classes = Object.keys(groupedByClass).sort();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.agencyInfo}>
            <Text style={styles.agencyName}>PRIMO CONCIERGERIE</Text>
            <Text>Expertise en Gestion Locative</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text>Date d'édition : {new Date().toLocaleDateString('fr-FR')}</Text>
            <Text>Période : {period}</Text>
          </View>
        </View>

        <Text style={styles.reportTitle}>Balance Comptable {type === 'GENERALE' ? 'Générale' : 'Auxiliaire'}</Text>
        <Text style={styles.reportSubtitle}>État de synthèse des comptes mouvementés</Text>

        {/* Table */}
        <View style={styles.table}>
          {/* Main Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.colCompte]}>N° Compte</Text>
            <Text style={[styles.tableCell, styles.colLibelle]}>Libellé du Compte</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Report Débit</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Report Crédit</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Mvt Débit</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Mvt Crédit</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Solde Débit</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>Solde Crédit</Text>
          </View>

          {/* Data Rows grouped by class */}
          {classes.map((classe) => (
            <View key={classe}>
              <View style={styles.classHeader}>
                <Text>CLASSE {classe} — {classe === '4' ? 'COMPTES DE TIERS' : classe === '5' ? 'COMPTES FINANCIERS' : classe === '6' ? 'COMPTES DE CHARGES' : 'COMPTES DE PRODUITS'}</Text>
              </View>
              {groupedByClass[classe].map((entry: BalanceEntry) => (
                <View key={entry.compteNumero} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colCompte]}>{entry.compteNumero}</Text>
                  <Text style={[styles.tableCell, styles.colLibelle, { paddingLeft: entry.isAuxiliaire ? 15 : 4 }]}>{entry.compteLibelle}</Text>
                  <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(entry.reportDebit)}</Text>
                  <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(entry.reportCredit)}</Text>
                  <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(entry.mouvementDebit)}</Text>
                  <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(entry.mouvementCredit)}</Text>
                  <Text style={[styles.tableCell, styles.colAmount, { fontWeight: 'bold' }]}>{formatCurrency(entry.soldeDebit)}</Text>
                  <Text style={[styles.tableCell, styles.colAmount, { fontWeight: 'bold' }]}>{formatCurrency(entry.soldeCredit)}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Totals Footer */}
          <View style={[styles.tableRow, styles.footer]}>
            <Text style={[styles.tableCell, { width: '30%' }]}>TOTAUX GÉNÉRAUX</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(totals.reportDebit)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(totals.reportCredit)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(totals.mouvementDebit)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(totals.mouvementCredit)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(totals.soldeDebit)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(totals.soldeCredit)}</Text>
          </View>
        </View>

        {/* Verification Bar */}
        <View style={[styles.verificationBar, isEquilibree ? styles.successBar : styles.errorBar]}>
          <Text style={{ fontWeight: 'bold' }}>
            {isEquilibree 
              ? "VERDICT : Balance équilibrée (Écart : 0,00 €)" 
              : `VERDICT : Balance déséquilibrée ! Écart : ${formatCurrency(ecart)}`}
          </Text>
          <Text>
            Total Débits : {formatCurrency(totals.soldeDebit)} | Total Crédits : {formatCurrency(totals.soldeCredit)}
          </Text>
        </View>

        {/* Meta */}
        <View style={styles.meta}>
          <Text>Document généré par l'ERP Primo Conciergerie</Text>
          <Text>Page 1 / 1</Text>
        </View>
      </Page>
    </Document>
  );
};
