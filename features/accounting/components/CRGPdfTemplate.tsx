import React from 'react';
import { format } from 'date-fns';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Font,
  Image 
} from '@react-pdf/renderer';
import { CRGData } from '@/features/reddition/crgBuilder';

// Register a standard font if needed, but standard ones are usually fine
// Font.register({ family: 'Helvetica', src: ... });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingBottom: 20,
  },
  agencyInfo: {
    width: '45%',
  },
  ownerInfo: {
    width: '45%',
    textAlign: 'right',
  },
  agencyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  titleContainer: {
    marginVertical: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  period: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  synthesisContainer: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 4,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'solid',
  },
  synthesisTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
    paddingBottom: 5,
  },
  synthesisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  synthesisTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderTopStyle: 'solid',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  table: {
    width: 'auto',
    marginTop: 10,
  },
  propertyHeader: {
    backgroundColor: '#eee',
    padding: 5,
    marginTop: 15,
    fontWeight: 'bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    backgroundColor: '#fafafa',
    fontWeight: 'bold',
    fontSize: 8,
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderBottomStyle: 'solid',
    paddingVertical: 6,
    fontSize: 8,
  },
  colDates: { width: '15%' },
  colVoyageur: { width: '20%' },
  colBrut: { width: '13%', textAlign: 'right' },
  colOta: { width: '13%', textAlign: 'right' },
  colMenage: { width: '13%', textAlign: 'right' },
  colHonoraires: { width: '13%', textAlign: 'right' },
  colNet: { width: '13%', textAlign: 'right', fontWeight: 'bold' },
  
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderTopStyle: 'solid',
    paddingTop: 15,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
  ibanInfo: {
    marginBottom: 10,
    fontSize: 9,
    color: '#444',
    fontWeight: 'bold',
  },
  legalMentions: {
    lineHeight: 1.4,
  }
});

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  }).format(val);
};

export interface CRGPdfProps {
  data: CRGData;
}

export const CRGPdfTemplate: React.FC<CRGPdfProps> = ({ data }) => {
  const { agence, proprietaire, periode, numero_crg, date_arrete, reservations, operationsDiverses, synthese } = data;

  // Group reservations by property
  const groupedReservations = reservations.reduce((acc, res) => {
    if (!acc[res.logement]) {
      acc[res.logement] = [];
    }
    acc[res.logement].push(res);
    return acc;
  }, {} as Record<string, typeof reservations>);

  const propertyEntries = Object.entries(groupedReservations) as [string, typeof reservations][];

  return (
    <Document title={`CRG - ${proprietaire.nom} - ${periode}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.agencyInfo}>
            <Text style={styles.agencyName}>{agence.nom}</Text>
            <Text>{agence.adresse}</Text>
            <Text>SIRET : {agence.siret}</Text>
          </View>
          <View style={styles.ownerInfo}>
            <Text style={styles.ownerName}>{proprietaire.nom}</Text>
            <Text>{proprietaire.adresse}</Text>
            <Text style={{ marginTop: 10 }}>Période : {periode}</Text>
            <Text>Document N° : {numero_crg}</Text>
            <Text>Mandat : {proprietaire.mandat_ref}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Compte-Rendu de Gestion</Text>
          <Text style={styles.period}>{periode}</Text>
        </View>

        {/* Global Synthesis */}
        <View style={styles.synthesisContainer}>
          <Text style={styles.synthesisTitle}>Synthèse Globale</Text>
          
          <View style={styles.synthesisRow}>
            <Text style={{ fontWeight: 'bold' }}>Payouts nets encaissés (Revenus)</Text>
            <Text style={{ fontWeight: 'bold' }}>{formatCurrency(synthese.payoutNetTotal)}</Text>
          </View>
          
          <View style={{ marginLeft: 10, marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: '#666', fontStyle: 'italic' }}>
              Dont {formatCurrency(synthese.commissionOtaInformative)} de commissions plateformes (Airbnb/Booking) déjà déduites à la source.
            </Text>
          </View>

          <View style={styles.synthesisRow}>
            <Text>- Honoraires de Gestion (HT)</Text>
            <Text>{formatCurrency(synthese.commissionHT)}</Text>
          </View>
          
          <View style={styles.synthesisRow}>
            <Text>- TVA sur Honoraires (20%)</Text>
            <Text>{formatCurrency(synthese.tva)}</Text>
          </View>

          {synthese.assurance > 0 && (
            <View style={styles.synthesisRow}>
              <Text>- Forfait Assurance</Text>
              <Text>{formatCurrency(synthese.assurance)}</Text>
            </View>
          )}

          {synthese.interventions !== 0 && (
            <View style={styles.synthesisRow}>
              <Text>{synthese.interventions < 0 ? '- Interventions & Opérations Diverses' : '+ Régularisations & Autres Revenus'}</Text>
              <Text>{formatCurrency(Math.abs(synthese.interventions))}</Text>
            </View>
          )}

          <View style={styles.synthesisTotal}>
            <Text style={styles.totalLabel}>NET À VERSER</Text>
            <Text style={styles.totalValue}>{formatCurrency(synthese.netAVerser)}</Text>
          </View>
        </View>

        {/* Details by Property */}
        {propertyEntries.length > 0 && (
          <>
            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', color: '#444' }}>
              Détail des réservations par logement
            </Text>
            {propertyEntries.map(([propertyName, resList]) => (
              <View key={propertyName} wrap={false} style={{ marginBottom: 15 }}>
                <Text style={styles.propertyHeader}>LOGEMENT : {propertyName}</Text>
                
                <View style={styles.tableHeader}>
                  <Text style={styles.colDates}>Dates</Text>
                  <Text style={styles.colVoyageur}>Voyageur</Text>
                  <Text style={styles.colBrut}>Payout Net</Text>
                  <Text style={styles.colHonoraires}>Comm. HT</Text>
                  <Text style={styles.colMenage}>TVA</Text>
                  <Text style={styles.colNet}>Net</Text>
                </View>

                {resList.map((res, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.colDates}>{res.dates}</Text>
                    <Text style={styles.colVoyageur}>{res.voyageur}</Text>
                    <Text style={styles.colBrut}>{formatCurrency(res.payout_net)}</Text>
                    <Text style={styles.colHonoraires}>- {formatCurrency(res.commission_ht)}</Text>
                    <Text style={styles.colMenage}>- {formatCurrency(res.tva)}</Text>
                    <Text style={styles.colNet}>{formatCurrency(res.net)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* Operations Diverses */}
        {operationsDiverses.length > 0 && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', color: '#444' }}>
              Autres opérations (OD / Interventions)
            </Text>
            <View style={styles.tableHeader}>
              <Text style={{ width: '12%' }}>Date</Text>
              <Text style={{ width: '50%' }}>Libellé</Text>
              <Text style={{ width: '20%' }}>Nature</Text>
              <Text style={{ width: '18%', textAlign: 'right' }}>Montant</Text>
            </View>
            {operationsDiverses.map((od, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={{ width: '12%' }}>{od.date}</Text>
                <Text style={{ width: '50%' }}>{od.libelle}</Text>
                <Text style={{ width: '20%' }}>{od.type === 'INTERVENTION' ? 'Intervention' : 'Régularisation'}</Text>
                <Text style={{ width: '18%', textAlign: 'right', fontWeight: 'bold' }}>
                  {formatCurrency(od.montant)}
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5, paddingRight: 5 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Sous-total OD : {formatCurrency(synthese.interventions)}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.ibanInfo}>
            Virement effectué sur le compte IBAN finissant par : {proprietaire.iban_masque}
          </Text>
          <View style={styles.legalMentions}>
            <Text>Document généré par PRIMO ERP le {format(new Date(), 'dd/MM/yyyy')}.</Text>
            <Text>Agence immobilière titulaire de la carte professionnelle N° {agence.carte_pro} délivrée par la préfecture de {agence.prefecture}.</Text>
            <Text>Garant financier : {agence.garant} pour un montant de {agence.garant_montant}.</Text>
            <Text>Compte séquestre ouvert auprès de {agence.banque_sequestre} - IBAN : {agence.iban_sequestre}.</Text>
            <Text style={{ marginTop: 4, fontWeight: 'bold' }}>Arrêté des comptes au {date_arrete}.</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
