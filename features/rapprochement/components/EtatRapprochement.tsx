import React, { useEffect, useState } from 'react';
import { rapprochementService, BankMovement } from '../rapprochementService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  Filter,
  ArrowRightLeft,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

type ReconciliationReport = {
  soldeComptable: number;
  soldeBancaire: number;
  ecartBrut: number;
  unreconciledBank: BankMovement[];
  unreconciledCompta: any[];
  hoguetBalances: Record<string, number>;
};

export default function EtatRapprochement() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [compteBanque, setCompteBanque] = useState('512000');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    loadReport();
  }, [compteBanque, dateDebut, dateFin]);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await rapprochementService.getReconciliationReport(compteBanque, dateDebut || undefined, dateFin || undefined);
      setReport(data);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Génération de l'état de rapprochement...</p>
      </div>
    );
  }

  if (!report) return null;

  let totalDettesTiers = 0;
  Object.keys(report.hoguetBalances).forEach(key => {
    totalDettesTiers += report.hoguetBalances[key] || 0;
  });
  const ecartHoguet = report.soldeComptable - totalDettesTiers;

  const chartData = [
    { name: 'Comptabilité', value: report.soldeComptable },
    { name: 'Banque', value: report.soldeBancaire },
  ];

  const hoguetChartData = [
    { name: '404 Mandants', value: report.hoguetBalances['404'] },
    { name: '401 Fourn.', value: report.hoguetBalances['401'] },
    { name: '419 Cautions', value: report.hoguetBalances['419'] },
    { name: '471 Attente', value: report.hoguetBalances['471'] },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Filtres */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Compte Banque</label>
                <select 
                  className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={compteBanque}
                  onChange={(e) => setCompteBanque(e.target.value)}
                >
                  <option value="512000">512000 — Compte Séquestre</option>
                  <option value="512100">512100 — Compte Fonctionnement</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Du</label>
                <input 
                  type="date" 
                  className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Au</label>
                <input 
                  type="date" 
                  className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                />
              </div>
            </div>

            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={loadReport} className="gap-2">
                <Calendar className="w-4 h-4" />
                Actualiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 1 — Soldes comparés */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Solde Comptable</span>
              <FileText className="w-5 h-5 text-blue-500 opacity-50" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {report.soldeComptable.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-slate-400 mt-2">Position dans le grand livre (Compte {compteBanque})</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Solde Bancaire</span>
              <Landmark className="w-5 h-5 text-emerald-500 opacity-50" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {report.soldeBancaire.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-slate-400 mt-2">Somme des mouvements importés</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-l-4 shadow-sm",
          Math.abs(report.ecartBrut) < 0.01 ? "border-l-emerald-500 bg-emerald-50/30" : "border-l-rose-500 bg-rose-50/30"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Écart Brut</span>
              {Math.abs(report.ecartBrut) < 0.01 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              )}
            </div>
            <div className={cn(
              "text-3xl font-black font-mono",
              Math.abs(report.ecartBrut) < 0.01 ? "text-emerald-600" : "text-rose-600"
            )}>
              {report.ecartBrut.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </div>
            <p className="text-xs text-slate-400 mt-2">Différence à justifier par le pointage</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 2 — Justification de l'écart */}
        <div className="space-y-6">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Justification de l'écart
          </h3>
          
          <Card className="overflow-hidden border-slate-200">
            <CardHeader className="bg-slate-50 py-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                Banque : Mouvements non rapprochés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b text-slate-400 uppercase font-bold">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Libellé</th>
                      <th className="p-3 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.unreconciledBank.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">{format(new Date(m.date_operation), 'dd/MM/yy')}</td>
                        <td className="p-3 font-medium text-slate-900">{m.libelle_banque}</td>
                        <td className={cn("p-3 text-right font-bold", m.montant > 0 ? "text-emerald-600" : "text-rose-600")}>
                          {m.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </td>
                      </tr>
                    ))}
                    {report.unreconciledBank.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 italic">Aucun mouvement en suspens</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200">
            <CardHeader className="bg-slate-50 py-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-blue-500" />
                Compta : Écritures sans banque
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b text-slate-400 uppercase font-bold">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Libellé</th>
                      <th className="p-3 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.unreconciledCompta.map(e => {
                      const isDebit = e.compte_debit === compteBanque;
                      return (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-500">{format(new Date(e.date_ecriture), 'dd/MM/yy')}</td>
                          <td className="p-3 font-medium text-slate-900">{e.libelle}</td>
                          <td className={cn("p-3 text-right font-bold", isDebit ? "text-emerald-600" : "text-rose-600")}>
                            {(isDebit ? e.montant : -e.montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          </td>
                        </tr>
                      );
                    })}
                    {report.unreconciledCompta.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 italic">Aucune écriture en suspens</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION 3 — Contrôle de cohérence Loi Hoguet */}
        <div className="space-y-6">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Contrôle de cohérence Loi Hoguet
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(report.hoguetBalances).map(([acc, bal]) => (
              <Card key={acc} className="border-slate-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Compte {acc}</div>
                  <div className="text-xl font-bold text-slate-900 font-mono">
                    {(bal as number).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-slate-900 text-white shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="w-24 h-24" />
            </div>
            <CardContent className="p-8 space-y-6">
              <div className="flex justify-between items-end border-b border-white/10 pb-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total Dettes Tiers</div>
                  <div className="text-2xl font-black font-mono">{(totalDettesTiers as number).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Solde Banque {compteBanque}</div>
                  <div className="text-2xl font-black font-mono">{report.soldeBancaire.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
                <div>
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-1">Écart (Honoraires à transférer)</div>
                  <div className={cn(
                    "text-3xl font-black font-mono",
                    ecartHoguet >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {ecartHoguet.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>
                {ecartHoguet >= 0 ? (
                  <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                    Conforme
                  </div>
                ) : (
                  <div className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-500/30">
                    Déficit
                  </div>
                )}
              </div>
              
              <p className="text-[10px] text-slate-400 italic leading-relaxed">
                Conformément à la Loi Hoguet, le solde du compte séquestre doit être au moins égal à la somme des dettes envers les mandants (404), fournisseurs (401) et cautions (419). L'excédent représente les honoraires de gestion non encore transférés sur le compte de fonctionnement.
              </p>
            </CardContent>
          </Card>

          {/* Graphique Recharts */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Répartition des Dettes Tiers</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoguetChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    tickFormatter={(value) => `${value}€`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {hoguetChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#f59e0b', '#10b981', '#64748b'][index % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
