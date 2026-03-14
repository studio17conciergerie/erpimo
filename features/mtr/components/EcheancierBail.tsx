import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Calculator, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Info,
  Download,
  Mail,
  FileCheck
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AvisEcheancePdf } from './AvisEcheancePdf';
import { QuittanceLoyerPdf } from './QuittanceLoyerPdf';
import { BailMtr } from '../mtrService';
import { EcheanceMtr, genererEcheancierBail, StatutEcheanceMtr } from '../utils/genererEcheancierBail';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { cn } from '@/lib/utils';

interface EcheancierBailProps {
  bail: BailMtr;
}

export const EcheancierBail: React.FC<EcheancierBailProps> = ({ bail }) => {
  const [echeances, setEcheances] = useState<EcheanceMtr[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // In a real app, we would fetch from DB. 
    // Here we generate on the fly for the demo or if not exists.
    const generated = genererEcheancierBail(bail);
    setEcheances(generated);
  }, [bail]);

  const getStatusBadge = (statut: StatutEcheanceMtr) => {
    switch (statut) {
      case 'PAYE':
      case 'PAYOUT_RECU':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {statut === 'PAYE' ? 'Payé' : 'Payout Reçu'}
          </span>
        );
      case 'EN_ATTENTE':
      case 'ATTENTE_PAYOUT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" />
            {statut === 'EN_ATTENTE' ? 'En attente' : 'Attente Payout'}
          </span>
        );
      case 'A_APPELER':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            À appeler
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SIGNATURE': return 'Signature / Entrée';
      case 'LOYER_MENSUEL': return 'Loyer Mensuel';
      case 'SOLDE_SORTIE': return 'Solde de sortie';
      case 'PAYOUT_OTA_ATTENDU': return 'Payout Mensuel';
      case 'PAYOUT_OTA_RELIQUAT': return 'Reliquat Payout';
      default: return type;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-slate-500" />
          Échéancier de Paiement
        </CardTitle>
        <div className="flex items-center gap-2">
          {bail.source === 'AIRBNB' && (
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              <Info className="w-3 h-3" />
              Payout géré par la plateforme
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Exigibilité</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Période</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Loyer CC</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Autres</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Statut</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {echeances.map((e, idx) => {
                const otherFees = (e.montant_caution || 0) + (e.montant_frais_agence || 0);
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{getTypeLabel(e.type)}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(e.date_exigibilite)}
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      Du {formatDate(e.periode_debut)}<br />
                      Au {formatDate(e.periode_fin)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium">
                      {formatCurrency(e.montant_loyer + e.montant_charges)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-500">
                      {otherFees > 0 ? formatCurrency(otherFees) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900">
                      {formatCurrency(e.montant_total)}
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(e.statut)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {bail.source === 'DIRECT' ? (
                          <>
                            {(e.statut === 'A_APPELER' || e.statut === 'EN_ATTENTE') && (
                              <PDFDownloadLink
                                document={<AvisEcheancePdf bail={bail} echeance={e} />}
                                fileName={`Avis_Echeance_${e.periode_debut}.pdf`}
                              >
                                {({ loading }) => (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={loading}
                                    className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                    title="Générer l'avis d'échéance"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                )}
                              </PDFDownloadLink>
                            )}
                            {e.statut === 'PAYE' && (
                              <PDFDownloadLink
                                document={<QuittanceLoyerPdf bail={bail} echeance={e} />}
                                fileName={`Quittance_Loyer_${e.periode_debut}.pdf`}
                              >
                                {({ loading }) => (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={loading}
                                    className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                    title="Générer la quittance de loyer"
                                  >
                                    <FileCheck className="w-4 h-4" />
                                  </Button>
                                )}
                              </PDFDownloadLink>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-8 w-8 p-0 opacity-50 cursor-not-allowed"
                            title="Payout géré par la plateforme"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-slate-600 hover:bg-slate-100"
                          title="Voir les détails"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-700">Récapitulatif du bail</div>
            <div className="text-xs text-slate-500">
              {bail.source === 'DIRECT' 
                ? "Gestion en direct : Prorata calendaire aligné sur le 1er du mois." 
                : "Gestion Airbnb : Blocs mensuels à date anniversaire."}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total à percevoir</div>
              <div className="text-lg font-bold text-slate-900">
                {formatCurrency(echeances.reduce((acc, e) => acc + e.montant_total, 0))}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />
            <Button className="bg-slate-900 hover:bg-slate-800 text-white">
              <Download className="w-4 h-4 mr-2" />
              Exporter l'échéancier
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
