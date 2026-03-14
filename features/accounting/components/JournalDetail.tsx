import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Search
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getJournalByCode } from '@/lib/journauxComptables';
import { journauxApi } from '../journauxApi';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';

interface JournalDetailProps {
  code: string;
  month: number;
  year: number;
  onBack: () => void;
}

export default function JournalDetail({ code, month, year, onBack }: JournalDetailProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const journal = getJournalByCode(code);

  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

  useEffect(() => {
    loadEntries();
  }, [code, month, year]);

  async function loadEntries() {
    setLoading(true);
    try {
      const data = await journauxApi.getJournalEntries(code, startDate, endDate);
      setEntries(data);
    } catch (error) {
      console.error('Error loading journal entries:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => 
      e.libelle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.numero_piece?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.compte_debit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.compte_credit.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, searchQuery]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, any[]>();
    filteredEntries.forEach(e => {
      const date = e.date_ecriture;
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(e);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEntries]);

  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, curr) => {
      // Pour les journaux, chaque ligne d'écriture a un compte débit ou crédit
      // Dans notre modèle, une ligne a SOIT un compte_debit SOIT un compte_credit
      // Si elle a les deux (ancien modèle), on compte le montant dans les deux
      const hasDebit = curr.compte_debit && curr.compte_debit !== '';
      const hasCredit = curr.compte_credit && curr.compte_credit !== '';
      
      // Si la ligne a les deux comptes (modèle de paire), on ajoute le montant aux deux
      if (hasDebit && hasCredit) {
        return {
          debit: acc.debit + Number(curr.montant),
          credit: acc.credit + Number(curr.montant)
        };
      }
      
      // Sinon, on ajoute au débit ou au crédit selon le compte renseigné
      return {
        debit: acc.debit + (hasDebit ? Number(curr.montant) : 0),
        credit: acc.credit + (hasCredit ? Number(curr.montant) : 0)
      };
    }, { debit: 0, credit: 0 });
  }, [filteredEntries]);

  const handleExportCSV = () => {
    const csvData = filteredEntries.map(e => {
      const hasDebit = e.compte_debit && e.compte_debit !== '';
      const hasCredit = e.compte_credit && e.compte_credit !== '';
      
      return {
        Date: e.date_ecriture,
        'N° Pièce': e.numero_piece,
        Libellé: e.libelle,
        'Compte Débit': e.compte_debit,
        'Compte Crédit': e.compte_credit,
        Débit: hasDebit ? e.montant : 0,
        Crédit: hasCredit ? e.montant : 0
      };
    });
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Journal_${code}_${month}_${year}.csv`);
    link.click();
  };

  const getSourceTypeBadge = (sourceType: string) => {
    if (!sourceType) return null;
    
    switch (sourceType) {
      case 'RESERVATION':
        return <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded-full">Réservation</span>;
      case 'REDDITION':
        return <span className="px-2 py-0.5 text-[10px] font-medium bg-rose-100 text-rose-700 rounded-full">Reddition</span>;
      case 'FACTURE':
        return <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">Facture</span>;
      case 'OPERATION_DIVERSE':
        return <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-full">OD</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-full">{sourceType}</span>;
    }
  };

  if (!journal) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{journal.nom} ({code})</h1>
            <p className="text-slate-500 text-sm">Période : {format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Débits</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totals.debit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Crédits</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totals.credit)}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          "border-slate-200",
          Math.abs(totals.debit - totals.credit) < 0.01 ? "bg-emerald-50" : "bg-rose-50"
        )}>
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Écart</p>
            <p className={cn(
              "text-xl font-bold",
              Math.abs(totals.debit - totals.credit) < 0.01 ? "text-emerald-700" : "text-rose-700"
            )}>
              {formatCurrency(totals.debit - totals.credit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher par libellé, pièce, compte..." 
              className="pl-9 h-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-28">Date</th>
                  <th className="px-4 py-3 w-32">N° Pièce</th>
                  <th className="px-4 py-3 min-w-[200px]">Libellé</th>
                  <th className="px-4 py-3 w-28">Compte Débit</th>
                  <th className="px-4 py-3 w-28">Compte Crédit</th>
                  <th className="px-4 py-3 text-right w-28">Débit</th>
                  <th className="px-4 py-3 text-right w-28">Crédit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                      <p className="text-slate-500">Chargement des écritures...</p>
                    </td>
                  </tr>
                ) : groupedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center text-slate-400 italic">
                      Aucune écriture trouvée pour cette période.
                    </td>
                  </tr>
                ) : (
                  groupedEntries.map(([date, dayEntries]) => {
                    const dayTotal = dayEntries.reduce((acc, curr) => acc + Number(curr.montant), 0);
                    return (
                      <React.Fragment key={date}>
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-y border-slate-100">
                            <div className="flex justify-between items-center">
                              <span>{format(new Date(date), 'dd MMMM yyyy', { locale: fr })} | {dayEntries.length} écritures</span>
                              <span>Total Journée : {formatCurrency(dayTotal)}</span>
                            </div>
                          </td>
                        </tr>
                        {dayEntries.map((entry) => {
                          const hasDebit = entry.compte_debit && entry.compte_debit !== '';
                          const hasCredit = entry.compte_credit && entry.compte_credit !== '';
                          
                          return (
                          <tr 
                            key={entry.id} 
                            className="hover:bg-slate-50 transition-colors group cursor-pointer"
                            onClick={() => {
                              if (entry.piece_comptable_id) navigate(`/accounting/piece/${entry.piece_comptable_id}`);
                              else if (entry.reservation_id) navigate(`/reservations/${entry.reservation_id}`);
                              else if (entry.operation_diverse_id) navigate(`/accounting/grand-livre?od=${entry.operation_diverse_id}`);
                            }}
                          >
                            <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(entry.date_ecriture), 'dd/MM/yyyy')}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              <div className="flex flex-col gap-1">
                                <span>{entry.numero_piece || '-'}</span>
                                {code === 'BQ' && getSourceTypeBadge(entry.source_type)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-900">{entry.libelle}</span>
                                {(entry.reservation_id || entry.operation_diverse_id) && (
                                  <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-blue-600">{entry.compte_debit}</td>
                            <td className="px-4 py-3 font-mono text-xs text-indigo-600">{entry.compte_credit}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900">
                              {hasDebit ? formatCurrency(entry.montant) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900">
                              {hasCredit ? formatCurrency(entry.montant) : '-'}
                            </td>
                          </tr>
                        )})}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
