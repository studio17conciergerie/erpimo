import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  Calendar, 
  FileEdit, 
  Landmark, 
  RotateCcw, 
  Send, 
  ChevronRight, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileSearch
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { JOURNAUX, getJournalByCode } from '@/lib/journauxComptables';
import { journauxApi, JournalStats } from '../journauxApi';
import { cn } from '@/lib/utils';
import JournalDetail from './JournalDetail';
import ControleJournaux from './ControleJournaux';

export default function JournauxComptables() {
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<JournalStats[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<string | null>(null);
  const [showControle, setShowControle] = useState(false);

  useEffect(() => {
    loadStats();
  }, [month, year]);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await journauxApi.getJournauxStats(month, year);
      setStats(data);
    } catch (error) {
      console.error('Error loading journal stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (selectedJournal) {
    return (
      <JournalDetail 
        code={selectedJournal} 
        month={month} 
        year={year} 
        onBack={() => setSelectedJournal(null)} 
      />
    );
  }

  if (showControle) {
    return (
      <ControleJournaux 
        month={month} 
        year={year} 
        onBack={() => setShowControle(false)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Journaux Comptables</h1>
          <p className="text-slate-500 text-sm">Consultation des écritures par nature d'opération</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
            <select 
              value={month} 
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="text-sm border-none focus:ring-0 bg-transparent px-2"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2024, i, 1), 'MMMM', { locale: fr })}
                </option>
              ))}
            </select>
            <select 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="text-sm border-none focus:ring-0 bg-transparent px-2"
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowControle(true)} className="gap-2">
            <FileSearch className="w-4 h-4" />
            Vérifier la cohérence
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {JOURNAUX.map((journal) => {
          const s = stats.find(st => st.code === journal.code);
          const Icon = journal.icone;
          
          return (
            <Card key={journal.code} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${journal.couleur}15` }}>
                    <Icon className="w-5 h-5" style={{ color: journal.couleur }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{journal.code}</span>
                </div>
                <CardTitle className="text-lg mt-3">{journal.nom}</CardTitle>
                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{journal.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Écritures</p>
                    <p className="text-lg font-bold text-slate-900">{s?.count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(s?.totalDebit || 0)}</p>
                  </div>
                </div>

                {s?.lastEntry && (
                  <div className="p-2 bg-slate-50 rounded-md">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dernière écriture</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 truncate mr-2">{s.lastEntry.libelle}</span>
                      <span className="text-slate-400 whitespace-nowrap">{format(new Date(s.lastEntry.date), 'dd/MM')}</span>
                    </div>
                  </div>
                )}

                <Button 
                  variant="ghost" 
                  className="w-full justify-between group-hover:bg-slate-100"
                  onClick={() => setSelectedJournal(journal.code)}
                >
                  Ouvrir le journal
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
