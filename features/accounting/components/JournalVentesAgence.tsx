import React, { useState, useEffect } from 'react';
import { agencyRevenueService, AgencyRevenueSummary, AgencyRevenueStats } from '../agencyRevenueService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  TrendingUp, 
  Download, 
  ArrowRightLeft, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function JournalVentesAgence() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<AgencyRevenueSummary[]>([]);
  const [stats, setStats] = useState<AgencyRevenueStats>({
    totalMgmtFees: 0,
    totalOtherCommissions: 0,
    totalHT: 0
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  async function loadData() {
    setLoading(true);
    try {
      const { details, stats } = await agencyRevenueService.getSyntheseHonorairesAgence(
        currentDate.getMonth(),
        currentDate.getFullYear()
      );
      setData(details);
      setStats(stats);
    } catch (error) {
      console.error('Error loading agency revenue:', error);
    } finally {
      setLoading(false);
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleExportCSV = () => {
    const fecContent = agencyRevenueService.generateFECExport(data);
    const blob = new Blob([fecContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FEC_Ventes_${format(currentDate, 'yyyy_MM')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTransferToOperating = async () => {
    if (!confirm(`Confirmer le virement de ${formatCurrency(stats.totalHT * 1.2)} (TTC) vers le compte de fonctionnement ?`)) {
      return;
    }

    setProcessing(true);
    try {
      const resIds = data.map(d => d.reservationId);
      await agencyRevenueService.markAsTransferred(resIds);
      alert('Transfert vers le compte de fonctionnement enregistré avec succès.');
    } catch (error) {
      console.error('Error during transfer:', error);
      alert('Erreur lors du transfert.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chiffre d'Affaires Agence</h1>
          <p className="text-slate-500">Synthèse des honoraires et commissions encaissés</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 font-medium min-w-[140px] text-center capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={handleExportCSV}
            disabled={data.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exporter FEC (CSV)
          </Button>
          <Button 
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleTransferToOperating}
            disabled={data.length === 0 || processing}
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Virer vers fonctionnement
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Honoraires Gestion</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(stats.totalMgmtFees)}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Autres Commissions</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(stats.totalOtherCommissions)}
                </h3>
              </div>
              <div className="p-3 bg-indigo-50 rounded-full">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">TOTAL CA HT</p>
                <h3 className="text-2xl font-bold text-emerald-900 mt-1">
                  {formatCurrency(stats.totalHT)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Journal des Ventes Détaillé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Propriétaire | Logement</th>
                  <th className="px-4 py-3 font-semibold">N° Facture</th>
                  <th className="px-4 py-3 font-semibold text-right">Gestion</th>
                  <th className="px-4 py-3 font-semibold text-right">Assurance</th>
                  <th className="px-4 py-3 font-semibold text-right">Intervention</th>
                  <th className="px-4 py-3 font-semibold text-right">Total HT</th>
                  <th className="px-4 py-3 font-semibold text-right">TVA (20%)</th>
                  <th className="px-4 py-3 font-semibold text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Chargement des données...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">
                      Aucune vente enregistrée pour cette période.
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{item.ownerName}</div>
                          <div className="text-xs text-slate-500">{item.propertyName}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                          {item.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(item.mgmtFees)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(item.insuranceCommissions)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(item.interventionFees)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(item.totalHT)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {formatCurrency(item.tva)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                          {formatCurrency(item.totalTTC)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td colSpan={2} className="px-4 py-4 text-slate-900">GRAND TOTAL</td>
                      <td className="px-4 py-4 text-right">{formatCurrency(stats.totalMgmtFees)}</td>
                      <td className="px-4 py-4 text-right">
                        {formatCurrency(data.reduce((sum, i) => sum + i.insuranceCommissions, 0))}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {formatCurrency(data.reduce((sum, i) => sum + i.interventionFees, 0))}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-900">{formatCurrency(stats.totalHT)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {formatCurrency(data.reduce((sum, i) => sum + i.tva, 0))}
                      </td>
                      <td className="px-4 py-4 text-right text-blue-700">
                        {formatCurrency(data.reduce((sum, i) => sum + i.totalTTC, 0))}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
