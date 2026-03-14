import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { JOURNAUX } from '@/lib/journauxComptables';
import { journauxApi, JournalStats } from '../journauxApi';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

interface ControleJournauxProps {
  month: number;
  year: number;
  onBack: () => void;
}

export default function ControleJournaux({ month, year, onBack }: ControleJournauxProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<JournalStats[]>([]);
  const [globalStats, setGlobalStats] = useState({ count: 0, total: 0 });
  const [orphans, setOrphans] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 1. Get journal stats
      const journalData = await journauxApi.getJournauxStats(month, year);
      setStats(journalData);

      // 2. Get global stats from journal_ecritures
      const { data: allEntries, error } = await supabase
        .from('journal_ecritures')
        .select('*')
        .gte('date_ecriture', startDate)
        .lte('date_ecriture', endDate);

      if (error) throw error;

      const totalCount = allEntries?.length || 0;
      const totalAmount = allEntries?.reduce((acc, curr) => acc + Number(curr.montant), 0) || 0;
      setGlobalStats({ count: totalCount, total: totalAmount });

      // 3. Find orphans (no journal_code and can't be inferred)
      const orphanList = allEntries?.filter(e => !e.journal_code) || [];
      setOrphans(orphanList);

    } catch (error) {
      console.error('Error loading control data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const journalsTotal = useMemo(() => {
    return stats.reduce((acc, curr) => ({
      count: acc.count + curr.count,
      total: acc.total + curr.totalDebit
    }), { count: 0, total: 0 });
  }, [stats]);

  const isCoherent = journalsTotal.count === globalStats.count && 
                     Math.abs(journalsTotal.total - globalStats.total) < 0.01 &&
                     orphans.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contrôle de Cohérence</h1>
            <p className="text-slate-500 text-sm">Vérification de l'intégrité des journaux comptables</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-slate-500">Analyse de la cohérence en cours...</p>
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <div className={cn(
            "p-4 rounded-lg border flex items-center gap-4",
            isCoherent ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          )}>
            {isCoherent ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <div>
              <p className="font-bold text-lg">
                {isCoherent ? "Cohérence validée" : "Anomalies détectées"}
              </p>
              <p className="text-sm opacity-90">
                {isCoherent 
                  ? "Toutes les écritures sont correctement affectées et les journaux sont équilibrés." 
                  : "Certaines écritures ne sont pas affectées à un journal ou des écarts existent."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary Table */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Récapitulatif par Journal</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Journal</th>
                      <th className="px-4 py-3 text-center">Écritures</th>
                      <th className="px-4 py-3 text-right">Total Débits</th>
                      <th className="px-4 py-3 text-right">Total Crédits</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.map((s) => {
                      const isBalanced = Math.abs(s.totalDebit - s.totalCredit) < 0.01;
                      return (
                        <tr key={s.code}>
                          <td className="px-4 py-3 font-medium text-slate-900">{s.code} - {JOURNAUX.find(j => j.code === s.code)?.nom}</td>
                          <td className="px-4 py-3 text-center">{s.count}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(s.totalDebit)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(s.totalCredit)}</td>
                          <td className="px-4 py-3 text-center">
                            {isBalanced ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-bold">
                    <tr>
                      <td className="px-4 py-3 uppercase text-[10px]">Total Journaux</td>
                      <td className="px-4 py-3 text-center">{journalsTotal.count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(journalsTotal.total)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(journalsTotal.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      </td>
                    </tr>
                    <tr className="bg-slate-800">
                      <td className="px-4 py-3 uppercase text-[10px]">Total Général (DB)</td>
                      <td className="px-4 py-3 text-center">{globalStats.count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(globalStats.total)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(globalStats.total)}</td>
                      <td className="px-4 py-3 text-center">
                        {isCoherent ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Orphans / Alerts */}
            <div className="space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="p-4 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Écritures Orphelines</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {orphans.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-20" />
                      <p className="text-sm text-slate-500">Aucune écriture orpheline détectée.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-rose-600 font-medium">{orphans.length} écritures n'ont pas de code journal assigné.</p>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {orphans.map(o => (
                          <div key={o.id} className="p-2 bg-rose-50 rounded border border-rose-100 text-[10px]">
                            <p className="font-bold text-rose-900">{o.libelle}</p>
                            <p className="text-rose-700">{o.date_ecriture} | {formatCurrency(o.montant)}</p>
                            <p className="text-rose-500 font-mono mt-1">{o.compte_debit} / {o.compte_credit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 bg-blue-50/30">
                <CardHeader className="p-4 border-b border-blue-100">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-600">Aide au Diagnostic</CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-xs text-blue-800 space-y-2">
                  <p>• Le <b>Journal JR</b> regroupe les écritures liées à une réservation.</p>
                  <p>• Le <b>Journal BQ</b> regroupe les écritures touchant un compte 512000.</p>
                  <p>• Le <b>Journal EX</b> regroupe les redditions (RED-).</p>
                  <p>• Le <b>Journal AN</b> regroupe les reports (AN-).</p>
                  <p>• Le <b>Journal OD</b> regroupe tout le reste.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
