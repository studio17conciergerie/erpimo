import React, { useState, useEffect, useMemo } from 'react';
import { grandLivreApi, GrandLivreEntry } from '../grandLivreApi';
import GrandLivreFilters, { FilterState } from './GrandLivreFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Loader2, 
  ArrowUpRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  History,
  LayoutGrid
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { GrandLivrePdf } from './GrandLivrePdf';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

export default function GrandLivre() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tiers, setTiers] = useState<any[]>([]);

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    const { data } = await supabase.from('tiers').select('*');
    if (data) setTiers(data);
  }
  
  const initialFilters = useMemo(() => ({
    compteNumero: searchParams.get('compte') || '404%',
    dateDebut: searchParams.get('start') || format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    dateFin: searchParams.get('end') || format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
    tiersId: searchParams.get('tiersId') || undefined,
    journalType: (searchParams.get('journal') as any) || 'TOUS',
    title: searchParams.get('title') || 'Tous les Propriétaires (404)'
  }), [searchParams]);

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const [data, setData] = useState<{
    entries: GrandLivreEntry[],
    reportANouveau: number,
    totalDebit: number,
    totalCredit: number,
    soldeCloture: number
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    loadGrandLivre();
  }, [filters]);

  async function loadGrandLivre() {
    setLoading(true);
    try {
      const result = await grandLivreApi.getGrandLivre(filters);
      setData(result);
      setPage(1);
    } catch (error) {
      console.error('Error loading Grand Livre:', error);
    } finally {
      setLoading(false);
    }
  }

  const paginatedEntries = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * pageSize;
    return data.entries.slice(start, start + pageSize);
  }, [data, page]);

  const totalPages = data ? Math.ceil(data.entries.length / pageSize) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleExportCSV = () => {
    if (!data) return;
    
    const csvData = data.entries.map(e => ({
      Date: format(new Date(e.date_ecriture), 'dd/MM/yyyy'),
      'N° Pièce': e.numero_piece || '',
      Libellé: e.libelle,
      'Compte Débit': e.compte_debit,
      'Compte Crédit': e.compte_credit,
      Débit: e.debit.toFixed(2),
      Crédit: e.credit.toFixed(2),
      'Solde Progressif': e.solde_progressif?.toFixed(2)
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GrandLivre_${filters.compteNumero}_${filters.dateDebut}.csv`);
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const getSoldeColor = (solde: number, compte: string) => {
    if (compte.startsWith('404')) {
      return solde <= 0 ? 'text-emerald-600' : 'text-rose-600';
    }
    if (compte.startsWith('411') || compte.startsWith('512')) {
      return solde >= 0 ? 'text-emerald-600' : 'text-rose-600';
    }
    return 'text-slate-900';
  };

  const handleRowClick = (entry: GrandLivreEntry) => {
    if (entry.piece_comptable_id) {
      navigate(`/accounting/piece/${entry.piece_comptable_id}`);
    } else if (entry.reservation_id) {
      navigate(`/reservations/${entry.reservation_id}`);
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const params: any = {
      tab: 'grand-livre',
      compte: newFilters.compteNumero,
      start: newFilters.dateDebut,
      end: newFilters.dateFin,
      title: newFilters.title,
      journal: newFilters.journalType
    };
    if (newFilters.tiersId) params.tiersId = newFilters.tiersId;
    setSearchParams(params);
  };

  const groupedEntries = useMemo(() => {
    if (!data) return null;
    
    // Allow grouping if the account number ends with % OR if it's a 3-digit root account
    const isRootAccount = filters.compteNumero.length === 3 || filters.compteNumero.includes('%');
    if (!isRootAccount) return null;
    
    const prefix = filters.compteNumero.replace('%', '');
    const groups = new Map<string, { entries: GrandLivreEntry[], solde: number, name: string }>();
    
    data.entries.forEach(entry => {
      const compte = [entry.compte_debit, entry.compte_credit].find(c => c.startsWith(prefix));
      if (!compte) return;

      if (!groups.has(compte)) {
        const tier = tiers.find(t => t.code_auxiliaire === compte);
        groups.set(compte, { entries: [], solde: 0, name: tier?.nom || compte });
      }
      
      const group = groups.get(compte)!;
      group.entries.push(entry);
      
      if (entry.compte_debit === compte) group.solde += entry.montant;
      if (entry.compte_credit === compte) group.solde -= entry.montant;
    });
    
    return Array.from(groups.entries()).map(([compte, data]) => ({ compte, ...data }));
  }, [data, filters.compteNumero, tiers]);

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-80px)] overflow-hidden bg-slate-50/30">
      <GrandLivreFilters 
        onFilterChange={handleFilterChange} 
        initialFilters={filters}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8 space-y-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Grand Livre Comptable
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                {filters.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-sm">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Du {format(new Date(filters.dateDebut), 'dd MMMM yyyy', { locale: fr })} au {format(new Date(filters.dateFin), 'dd MMMM yyyy', { locale: fr })}</span>
                </div>
                {filters.journalType !== 'TOUS' && (
                  <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-blue-100">
                    <LayoutGrid className="w-3 h-3" />
                    Journal: {filters.journalType}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 no-print">
              <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <Button variant="ghost" size="sm" className="h-8 text-xs px-3" onClick={handleExportCSV} disabled={!data}>
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                  Excel
                </Button>
                
                {data && (
                  <PDFDownloadLink 
                    key={`${filters.compteNumero}-${filters.dateDebut}-${data?.entries.length}`}
                    document={
                      <GrandLivrePdf 
                        title={filters.title}
                        periode={`Du ${format(new Date(filters.dateDebut), 'dd/MM/yyyy')} au ${format(new Date(filters.dateFin), 'dd/MM/yyyy')}`}
                        entries={data.entries}
                        reportANouveau={data.reportANouveau}
                        totalDebit={data.totalDebit}
                        totalCredit={data.totalCredit}
                        soldeCloture={data.soldeCloture}
                      />
                    } 
                    fileName={`GrandLivre_${filters.compteNumero}.pdf`}
                  >
                    {({ loading }) => (
                      <Button variant="ghost" size="sm" className="h-8 text-xs px-3" disabled={loading}>
                        <FileText className="w-3.5 h-3.5 mr-2 text-rose-600" />
                        PDF
                      </Button>
                    )}
                  </PDFDownloadLink>
                )}

                <Button variant="ghost" size="sm" className="h-8 text-xs px-3" onClick={handlePrint} disabled={!data}>
                  <Printer className="w-3.5 h-3.5 mr-2 text-slate-600" />
                  Imprimer
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Report à nouveau</div>
                <div className={cn("text-lg font-mono font-bold", getSoldeColor(data?.reportANouveau || 0, filters.compteNumero))}>
                  {formatCurrency(data?.reportANouveau || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Débit</div>
                <div className="text-lg font-mono font-bold text-slate-900">
                  {formatCurrency(data?.totalDebit || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Crédit</div>
                <div className="text-lg font-mono font-bold text-slate-900">
                  {formatCurrency(data?.totalCredit || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 shadow-md">
              <CardContent className="p-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Solde de clôture</div>
                <div className={cn("text-lg font-mono font-bold", getSoldeColor(data?.soldeCloture || 0, filters.compteNumero))}>
                  {formatCurrency(data?.soldeCloture || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {filters.compteNumero.startsWith('512') && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
              <div className="p-2 bg-amber-100 rounded-lg">
                <History className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Note sur les encaissements</h4>
                <p className="text-xs text-amber-700 leading-relaxed mt-1">
                  Les encaissements de réservations n'apparaissent dans ce compte qu'une fois le <strong>rapprochement bancaire</strong> validé. 
                  Si vous ne voyez pas un virement attendu, vérifiez qu'il a bien été importé et rapproché dans le module de rapprochement.
                </p>
              </div>
            </div>
          )}

          {groupedEntries ? (
            <div className="space-y-8">
              {groupedEntries.map((group, gIdx) => (
                <div key={gIdx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Account Header - Styled like the image */}
                  <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-500 shadow-sm">
                        {group.compte.substring(0, 3)}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {group.compte}
                        </div>
                        <div className="text-xl font-black text-slate-900 tracking-tight">
                          {group.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                        Solde
                      </div>
                      <div className={cn("text-2xl font-mono font-black", getSoldeColor(group.solde, group.compte))}>
                        {formatCurrency(group.solde)}
                      </div>
                    </div>
                  </div>

                  {/* Table - Styled like the image */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-[0.15em] border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3 w-32">Date</th>
                          <th className="px-6 py-3 w-32">N° Pièce</th>
                          <th className="px-6 py-3">Libellé</th>
                          <th className="px-6 py-3 w-28">Lettrage</th>
                          <th className="px-6 py-3 text-right w-36">Débit</th>
                          <th className="px-6 py-3 text-right w-36">Crédit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {group.entries.map((entry) => (
                          <tr 
                            key={entry.id} 
                            className="hover:bg-blue-50/30 transition-colors cursor-pointer group" 
                            onClick={() => handleRowClick(entry)}
                          >
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                              {format(new Date(entry.date_ecriture), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-mono font-bold border border-slate-200/50">
                                  {entry.numero_piece || '-'}
                                </span>
                                {entry.journal_code && (
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-mono font-bold border border-blue-100">
                                    {entry.journal_code}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-700 text-sm">
                                {entry.libelle}
                              </div>
                              {entry.tiers_nom && (
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Users className="w-3 h-3" /> {entry.tiers_nom}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {entry.lettrage ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-mono font-bold border border-emerald-200">
                                  {entry.lettrage}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-600 text-sm">
                              {entry.compte_debit === group.compte ? formatCurrency(entry.montant) : '—'}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-600 text-sm">
                              {entry.compte_credit === group.compte ? formatCurrency(entry.montant) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest bg-slate-50/50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 w-28">Date</th>
                        <th className="px-6 py-4 w-28">N° Pièce</th>
                        <th className="px-6 py-4">Libellé</th>
                        <th className="px-6 py-4 w-28">Lettrage</th>
                        <th className="px-6 py-4 text-right w-32">Débit (€)</th>
                        <th className="px-6 py-4 text-right w-32">Crédit (€)</th>
                        <th className="px-6 py-4 text-right w-36">Solde (€)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-24 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                            <p className="text-slate-500 font-medium">Récupération des écritures...</p>
                          </td>
                        </tr>
                      ) : paginatedEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-24 text-center">
                            <div className="max-w-xs mx-auto space-y-2">
                              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-6 h-6 text-slate-300" />
                              </div>
                              <p className="text-slate-900 font-bold">Aucune écriture</p>
                              <p className="text-slate-500 text-xs">Il n'y a pas d'opérations enregistrées pour ce compte sur la période sélectionnée.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedEntries.map((entry, idx) => (
                          <tr 
                            key={entry.id} 
                            className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                            onClick={() => handleRowClick(entry)}
                          >
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                              {format(new Date(entry.date_ecriture), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">
                                  {entry.numero_piece || 'SANS N°'}
                                </span>
                                {entry.journal_code && (
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-mono font-bold border border-blue-100">
                                    {entry.journal_code}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900 truncate max-w-md">{entry.libelle}</span>
                                {entry.reservation_id && (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-mono text-slate-400 uppercase">D: {entry.compte_debit}</span>
                                <span className="text-[9px] font-mono text-slate-400 uppercase">C: {entry.compte_credit}</span>
                                {entry.tiers_nom && (
                                  <>
                                    <span className="text-[9px] text-slate-300">•</span>
                                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {entry.tiers_nom}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {entry.lettrage ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-mono font-bold border border-emerald-200">
                                  {entry.lettrage}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-900 font-medium">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-900 font-medium">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </td>
                            <td className={cn(
                              "px-6 py-4 text-right font-bold font-mono border-l border-slate-50",
                              getSoldeColor(entry.solde_progressif!, filters.compteNumero)
                            )}>
                              {formatCurrency(entry.solde_progressif!)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {data && !loading && data.entries.length > 0 && (
                      <tfoot className="bg-slate-900 text-white font-bold">
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-[10px] uppercase tracking-[0.2em] font-black">
                            Totaux de la période
                          </td>
                          <td className="px-6 py-6 text-right font-mono text-sm">
                            {formatCurrency(data.totalDebit)}
                          </td>
                          <td className="px-6 py-6 text-right font-mono text-sm">
                            {formatCurrency(data.totalCredit)}
                          </td>
                          <td className="px-6 py-6 text-right font-mono text-lg bg-blue-600 text-white">
                            {formatCurrency(data.soldeCloture)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 no-print">
              <div className="text-xs text-slate-500 font-medium">
                Affichage de <span className="text-slate-900">{(page - 1) * pageSize + 1}</span> à <span className="text-slate-900">{Math.min(page * pageSize, data?.entries.length || 0)}</span> sur <span className="text-slate-900">{data?.entries.length}</span> écritures
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = page;
                    if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    
                    if (pageNum <= 0 || pageNum > totalPages) return null;

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        className={cn("h-8 w-8 p-0 text-xs", page === pageNum ? "bg-blue-600" : "")}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
