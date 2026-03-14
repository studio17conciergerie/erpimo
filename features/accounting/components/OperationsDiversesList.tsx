import React, { useState, useEffect } from 'react';
import { odApi, OperationDiverse } from '../odApi';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  Plus, 
  FileText, 
  ChevronRight,
  Loader2,
  Filter,
  History,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const STATUT_CONFIG = {
  BROUILLON: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  VALIDEE: { label: 'Validée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ANNULEE: { label: 'Annulée', color: 'bg-rose-100 text-rose-700 border-rose-200 line-through opacity-60' },
};

export default function OperationsDiversesList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ods, setOds] = useState<OperationDiverse[]>([]);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    statut: 'ALL',
    journal_code: ''
  });

  useEffect(() => {
    loadODs();
  }, [filters]);

  async function loadODs() {
    setLoading(true);
    try {
      const data = await odApi.getODs(filters);
      setOds(data);
    } catch (error) {
      console.error('Error loading ODs:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Écritures Comptables (OD/BQ/JR)</h1>
          <p className="text-slate-500 text-sm">Saisie manuelle d'écritures et journaux comptables</p>
        </div>
        <Button onClick={() => navigate('/accounting/od/nouvelle')} className="gap-2 bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4" />
          Nouvelle Écriture
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="text-sm border-slate-200 rounded-md h-9 px-3"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2024, i, 1), 'MMMM', { locale: fr })}
                </option>
              ))}
            </select>
            <select 
              className="text-sm border-slate-200 rounded-md h-9 px-3"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Journal</span>
            <select 
              className="text-sm border-slate-200 rounded-md h-9 px-3"
              value={filters.journal_code}
              onChange={(e) => setFilters({ ...filters, journal_code: e.target.value })}
            >
              <option value="">Tous les journaux</option>
              <option value="OD">OD - Opérations Diverses</option>
              <option value="BQ">BQ - Banque</option>
              <option value="JR">JR - Journal de Recettes</option>
              <option value="EX">EX - Exploitation</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Statut</span>
            <select 
              className="text-sm border-slate-200 rounded-md h-9 px-3"
              value={filters.statut}
              onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="VALIDEE">Validée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-slate-500">Chargement des opérations...</p>
        </div>
      ) : ods.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Aucune opération pour cette période</p>
          <Button variant="link" onClick={() => navigate('/accounting/od/nouvelle')}>Saisir votre première écriture</Button>
        </div>
      ) : (
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">N° Pièce</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Journal</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3 text-center">Lignes</th>
                  <th className="px-4 py-3 text-right">Total Débit</th>
                  <th className="px-4 py-3 text-right">Total Crédit</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ods.map((od) => {
                  const Statut = STATUT_CONFIG[od.statut];
                  const totalDebit = od.lignes?.reduce((sum, l) => sum + Number(l.montant_debit), 0) || 0;
                  const totalCredit = od.lignes?.reduce((sum, l) => sum + Number(l.montant_credit), 0) || 0;

                  return (
                    <tr 
                      key={od.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/accounting/od/${od.id}`)}
                    >
                      <td className="px-4 py-4 font-mono text-[10px] text-slate-500">{od.numero_od}</td>
                      <td className="px-4 py-4 text-slate-600">{format(new Date(od.date_ecriture), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">
                          {od.journal_code}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-50 rounded text-blue-500">
                            <BookOpen className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{od.libelle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-500 font-mono text-xs">
                        {od.lignes?.length || 0}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600">{formatCurrency(totalDebit)}</td>
                      <td className="px-4 py-4 text-right font-bold text-rose-600">{formatCurrency(totalCredit)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", Statut.color)}>
                          {Statut.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-all ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
