import React, { useState, useEffect, useMemo } from 'react';
import { balanceApi, BalanceEntry } from '../balanceApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2,
  ArrowRight,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Users,
  CreditCard
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate, Link } from 'react-router-dom';
import Papa from 'papaparse';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { BalancePdf } from './BalancePdf';

export default function BalanceComptable() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'GENERALE' | 'AUXILIAIRE'>('GENERALE');
  const [dateDebut, setDateDebut] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [dateFin, setDateFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [classeFilter, setClasseFilter] = useState<number | 'ALL'>('ALL');
  const [data, setData] = useState<BalanceEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'COMPLETE' | 'MANDANT' | 'AGENCE'>('COMPLETE');

  useEffect(() => {
    loadBalance();
  }, [dateDebut, dateFin, type]);

  async function loadBalance() {
    setLoading(true);
    try {
      const result = await balanceApi.getBalanceComptable(dateDebut, dateFin, type);
      setData(result);
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = useMemo(() => {
    return data.filter(entry => {
      const matchesClasse = classeFilter === 'ALL' || entry.classeComptable === classeFilter;
      const matchesSearch = entry.compteNumero.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           entry.compteLibelle.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesTab = true;
      if (activeTab === 'MANDANT') {
        matchesTab = (entry.classeComptable === 4 || entry.compteNumero.startsWith('512000')) && 
                     !entry.compteNumero.startsWith('706') && 
                     entry.classeComptable !== 6;
      } else if (activeTab === 'AGENCE') {
        matchesTab = entry.compteNumero.startsWith('512100') || 
                     entry.compteNumero.startsWith('706') || 
                     entry.classeComptable === 6 || 
                     entry.compteNumero.startsWith('445');
      }

      return matchesClasse && matchesSearch && matchesTab;
    });
  }, [data, classeFilter, searchQuery, activeTab]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      reportDebit: acc.reportDebit + curr.reportDebit,
      reportCredit: acc.reportCredit + curr.reportCredit,
      mouvementDebit: acc.mouvementDebit + curr.mouvementDebit,
      mouvementCredit: acc.mouvementCredit + curr.mouvementCredit,
      soldeDebit: acc.soldeDebit + curr.soldeDebit,
      soldeCredit: acc.soldeCredit + curr.soldeCredit,
    }), {
      reportDebit: 0, reportCredit: 0,
      mouvementDebit: 0, mouvementCredit: 0,
      soldeDebit: 0, soldeCredit: 0
    });
  }, [filteredData]);

  const ecart = Math.abs(totals.soldeDebit - totals.soldeCredit);
  const isEquilibree = ecart < 0.01;

  const kpis = useMemo(() => {
    // Total Fonds Propriétaires (solde 404)
    const fondsProprio = data.filter(e => e.compteNumero.startsWith('404'))
                             .reduce((acc, curr) => acc + (curr.soldeCredit - curr.soldeDebit), 0);
    
    // Total Dettes Fournisseurs (solde 401)
    const dettesFournisseurs = data.filter(e => e.compteNumero.startsWith('401'))
                                   .reduce((acc, curr) => acc + (curr.soldeCredit - curr.soldeDebit), 0);
    
    // Total Créances Clients (solde 411)
    const creancesClients = data.filter(e => e.compteNumero.startsWith('411'))
                                .reduce((acc, curr) => acc + (curr.soldeDebit - curr.soldeCredit), 0);
    
    // Solde Banque Séquestre (512000)
    const soldeSequestre = data.filter(e => e.compteNumero.startsWith('512000'))
                            .reduce((acc, curr) => acc + (curr.soldeDebit - curr.soldeCredit), 0);

    // Solde Banque Fonctionnement (512100)
    const soldeFonctionnement = data.filter(e => e.compteNumero.startsWith('512100'))
                            .reduce((acc, curr) => acc + (curr.soldeDebit - curr.soldeCredit), 0);

    // Contrôle Séquestre Hoguet
    const sumTiers = data.filter(e => e.compteNumero.startsWith('404') || e.compteNumero.startsWith('401') || e.compteNumero.startsWith('419') || e.compteNumero.startsWith('471'))
                         .reduce((acc, curr) => acc + (curr.soldeCredit - curr.soldeDebit), 0);
    const ecartHoguet = soldeSequestre - sumTiers;

    return { fondsProprio, dettesFournisseurs, creancesClients, soldeSequestre, soldeFonctionnement, sumTiers, ecartHoguet };
  }, [data]);

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleExportCSV = () => {
    const csvData = filteredData.map(e => ({
      'N° Compte': e.compteNumero,
      Libellé: e.compteLibelle,
      'Report Débit': e.reportDebit.toFixed(2),
      'Report Crédit': e.reportCredit.toFixed(2),
      'Mouvement Débit': e.mouvementDebit.toFixed(2),
      'Mouvement Crédit': e.mouvementCredit.toFixed(2),
      'Solde Débit': e.soldeDebit.toFixed(2),
      'Solde Crédit': e.soldeCredit.toFixed(2)
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Balance_${type}_${dateDebut}_${dateFin}.csv`);
    link.click();
  };

  const setQuickPeriod = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'month':
        setDateDebut(format(startOfMonth(now), 'yyyy-MM-dd'));
        setDateFin(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'prev_month':
        setDateDebut(format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'));
        setDateFin(format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'));
        break;
      case 'quarter':
        setDateDebut(format(startOfQuarter(now), 'yyyy-MM-dd'));
        setDateFin(format(endOfQuarter(now), 'yyyy-MM-dd'));
        break;
      case 'year':
        setDateDebut(format(startOfYear(now), 'yyyy-MM-dd'));
        setDateFin(format(endOfYear(now), 'yyyy-MM-dd'));
        break;
    }
  };

  const classes = [
    { id: 4, label: 'Classe 4 - Tiers' },
    { id: 5, label: 'Classe 5 - Financiers' },
    { id: 6, label: 'Classe 6 - Charges' },
    { id: 7, label: 'Classe 7 - Produits' }
  ];

  const groupedByClass = useMemo(() => {
    const groups = new Map<number, BalanceEntry[]>();
    filteredData.forEach(entry => {
      if (!groups.has(entry.classeComptable)) groups.set(entry.classeComptable, []);
      groups.get(entry.classeComptable)!.push(entry);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Balance Comptable</h1>
          <p className="text-slate-500 text-sm">Contrôle de l'équilibre des comptes et synthèse des soldes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            CSV
          </Button>
          <PDFDownloadLink 
            key={`${type}-${dateDebut}-${dateFin}-${data.length}`}
            document={<BalancePdf data={filteredData} totals={totals} period={`${format(new Date(dateDebut), 'dd/MM/yyyy')} au ${format(new Date(dateFin), 'dd/MM/yyyy')}`} isEquilibree={isEquilibree} ecart={ecart} type={type} />}
            fileName={`Balance_${type}_${dateDebut}.pdf`}
          >
            {({ loading }) => (
              <Button variant="outline" size="sm" disabled={loading} className="gap-2">
                <FileText className="w-4 h-4" />
                {loading ? 'Génération...' : 'PDF'}
              </Button>
            )}
          </PDFDownloadLink>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-violet-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fonds Propriétaires</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(kpis.fondsProprio)}</p>
              </div>
              <div className="p-2 bg-violet-50 rounded-full">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dettes Fournisseurs</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(kpis.dettesFournisseurs)}</p>
              </div>
              <div className="p-2 bg-rose-50 rounded-full">
                <Building2 className="w-5 h-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Créances Clients</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(kpis.creancesClients)}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-full">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Séquestre (512000)</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(kpis.soldeSequestre)}</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-full">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fonctionnement (512100)</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(kpis.soldeFonctionnement)}</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-full">
                <Wallet className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contrôle Séquestre Hoguet */}
      <Card className={cn(
        "border-l-4 shadow-sm",
        kpis.ecartHoguet >= 0 ? "border-l-emerald-500 bg-emerald-50/30" : "border-l-rose-500 bg-rose-50/30"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                kpis.ecartHoguet >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}>
                {kpis.ecartHoguet >= 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Contrôle Séquestre Hoguet</h3>
                <p className="text-xs text-slate-500">
                  Vérification de la couverture des fonds mandants par le compte séquestre
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Solde 512000</p>
                <p className="font-mono font-bold text-slate-900">{formatCurrency(kpis.soldeSequestre)}</p>
              </div>
              <div className="text-slate-300">-</div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Σ (404+401+419+471)</p>
                <p className="font-mono font-bold text-slate-900">{formatCurrency(kpis.sumTiers)}</p>
              </div>
              <div className="text-slate-300">=</div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Écart (Honoraires non transférés)</p>
                <p className={cn(
                  "font-mono font-bold text-lg",
                  kpis.ecartHoguet >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {formatCurrency(kpis.ecartHoguet)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('COMPLETE')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'COMPLETE' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          Balance Complète
        </button>
        <button
          onClick={() => setActiveTab('MANDANT')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'MANDANT' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          Balance Mandant
        </button>
        <button
          onClick={() => setActiveTab('AGENCE')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'AGENCE' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          Balance Agence
        </button>
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Type de Balance</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setType('GENERALE')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                    type === 'GENERALE' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Générale
                </button>
                <button 
                  onClick={() => setType('AUXILIAIRE')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                    type === 'AUXILIAIRE' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Auxiliaire
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Période</label>
              <div className="flex items-center gap-2">
                <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="h-9 text-xs w-36" />
                <span className="text-slate-400">au</span>
                <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="h-9 text-xs w-36" />
              </div>
            </div>

            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('month')} className="text-[10px] h-9">Mois</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('quarter')} className="text-[10px] h-9">Trim.</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod('year')} className="text-[10px] h-9">Année</Button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Classe</label>
              <select 
                value={classeFilter} 
                onChange={(e) => setClasseFilter(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                className="h-9 text-xs border border-slate-200 rounded-md px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Rechercher un compte..." 
                className="pl-9 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Bar */}
      <div className={cn(
        "p-3 rounded-lg border flex items-center justify-between transition-all",
        isEquilibree 
          ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
          : "bg-rose-50 border-rose-200 text-rose-800 animate-pulse"
      )}>
        <div className="flex items-center gap-3">
          {isEquilibree ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-bold">
            {isEquilibree 
              ? "Balance équilibrée (Écart : 0,00 €)" 
              : `ATTENTION : Balance déséquilibrée ! Écart : ${formatCurrency(ecart)}`}
          </span>
        </div>
        <div className="text-xs opacity-80">
          Total Débits : {formatCurrency(totals.soldeDebit)} | Total Crédits : {formatCurrency(totals.soldeCredit)}
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 w-24">N° Compte</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 min-w-[200px]">Libellé du Compte</th>
                  <th colSpan={2} className="px-4 py-2 border-b border-r border-slate-200 text-center bg-slate-100/50">Report</th>
                  <th colSpan={2} className="px-4 py-2 border-b border-r border-slate-200 text-center bg-slate-100/50">Mouvements</th>
                  <th colSpan={2} className="px-4 py-2 border-b border-slate-200 text-center bg-slate-100/50">Solde Clôture</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 border-r border-slate-200 text-right w-28">Débit</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right w-28">Crédit</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right w-28">Débit</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right w-28">Crédit</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right w-28">Débit</th>
                  <th className="px-4 py-2 text-right w-28">Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                      <p className="text-slate-500">Calcul de la balance...</p>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-20 text-center text-slate-400 italic">
                      Aucun compte mouvementé sur cette période.
                    </td>
                  </tr>
                ) : (
                  groupedByClass.map(([classe, entries]) => (
                    <React.Fragment key={classe}>
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          CLASSE {classe} — {classe === 4 ? 'COMPTES DE TIERS' : classe === 5 ? 'COMPTES FINANCIERS' : classe === 6 ? 'COMPTES DE CHARGES' : 'COMPTES DE PRODUITS'}
                        </td>
                      </tr>
                      {entries.map((entry) => (
                        <tr 
                          key={entry.compteNumero} 
                          className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('tab', 'grand-livre');
                            params.set('compte', entry.compteNumero);
                            params.set('start', dateDebut);
                            params.set('end', dateFin);
                            params.set('title', entry.compteLibelle);
                            navigate(`/accounting?${params.toString()}`);
                          }}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-slate-500 border-r border-slate-100">
                            {entry.compteNumero}
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className={cn("font-medium", entry.isAuxiliaire ? "text-slate-600 pl-4" : "text-slate-900")}>
                                {entry.compteLibelle}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs border-r border-slate-100">{formatCurrency(entry.reportDebit)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs border-r border-slate-100">{formatCurrency(entry.reportCredit)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs border-r border-slate-100">{formatCurrency(entry.mouvementDebit)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs border-r border-slate-100">{formatCurrency(entry.mouvementCredit)}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-bold font-mono text-xs border-r border-slate-100",
                            entry.soldeDebit > 0 ? "text-blue-600" : "text-slate-400"
                          )}>
                            {formatCurrency(entry.soldeDebit)}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right font-bold font-mono text-xs",
                            entry.soldeCredit > 0 ? "text-indigo-600" : "text-slate-400"
                          )}>
                            {formatCurrency(entry.soldeCredit)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
              {!loading && filteredData.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-4 uppercase text-xs tracking-wider">Totaux Généraux</td>
                    <td className="px-4 py-4 text-right font-mono text-xs border-l border-white/10">{formatCurrency(totals.reportDebit)}</td>
                    <td className="px-4 py-4 text-right font-mono text-xs border-l border-white/10">{formatCurrency(totals.reportCredit)}</td>
                    <td className="px-4 py-4 text-right font-mono text-xs border-l border-white/10">{formatCurrency(totals.mouvementDebit)}</td>
                    <td className="px-4 py-4 text-right font-mono text-xs border-l border-white/10">{formatCurrency(totals.mouvementCredit)}</td>
                    <td className="px-4 py-4 text-right font-mono text-xs border-l border-white/10">{formatCurrency(totals.soldeDebit)}</td>
                    <td className="px-4 py-4 text-right font-mono text-xs border-l border-white/10">{formatCurrency(totals.soldeCredit)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
