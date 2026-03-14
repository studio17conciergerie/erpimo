import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mtrService, BailMtr, StatutBailMtr, TypeBailMtr, SourceBailMtr } from '../mtrService';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Card, CardContent } from '@/components/Card';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Home, 
  ChevronRight, 
  MoreVertical,
  ArrowUpDown,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import MtrWizard from './MtrWizard';
import { Modal } from '@/components/Modal';

export default function MtrList() {
  const navigate = useNavigate();
  const [baux, setBaux] = useState<BailMtr[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatutBailMtr[]>(['BROUILLON', 'ACTIF']);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

  useEffect(() => {
    fetchBaux();
  }, [statusFilter]);

  const fetchBaux = async () => {
    setLoading(true);
    try {
      const data = await mtrService.getBaux({ statut: statusFilter });
      setBaux(data);
    } catch (error) {
      console.error('Error fetching baux:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBaux = useMemo(() => {
    return baux.filter(b => {
      const matchesSearch = 
        b.numero_bail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.locataire?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.locataire?.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.logement?.nom.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = !typeFilter || b.type_bail === typeFilter;
      const matchesSource = !sourceFilter || b.source === sourceFilter;

      return matchesSearch && matchesType && matchesSource;
    });
  }, [baux, searchTerm, typeFilter, sourceFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Baux Moyenne Durée (MTR)</h1>
          <p className="text-slate-500">Gestion des contrats de location de 1 à 10 mois.</p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="bg-slate-900 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nouveau Bail
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Rechercher locataire, bail..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tous les types</option>
              <option value="MOBILITE">Bail Mobilité</option>
              <option value="ETUDIANT">Bail Étudiant</option>
              <option value="CIVIL">Bail Civil</option>
            </Select>
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">Toutes les sources</option>
              <option value="DIRECT">Direct</option>
              <option value="AIRBNB">Airbnb</option>
            </Select>
            <div className="flex gap-2">
              {['BROUILLON', 'ACTIF', 'TERMINE', 'RESILIE'].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    if (statusFilter.includes(s as StatutBailMtr)) {
                      setStatusFilter(statusFilter.filter(item => item !== s));
                    } else {
                      setStatusFilter([...statusFilter, s as StatutBailMtr]);
                    }
                  }}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold border transition-all",
                    statusFilter.includes(s as StatutBailMtr) 
                      ? "bg-slate-900 text-white border-slate-900" 
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Bail / Locataire</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Logement</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type / Source</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Période</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Loyer CC</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Caution</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">Chargement des baux...</td></tr>
            ) : filteredBaux.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400">Aucun bail trouvé.</td></tr>
            ) : (
              filteredBaux.map((b) => (
                <tr 
                  key={b.id} 
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/mtr/${b.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{b.numero_bail}</span>
                      <span className="text-xs text-slate-500">{b.locataire?.nom} {b.locataire?.prenom}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Home className="w-3 h-3 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{b.logement?.nom}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        b.type_bail === 'MOBILITE' && "bg-amber-50 text-amber-700",
                        b.type_bail === 'ETUDIANT' && "bg-blue-50 text-blue-700",
                        b.type_bail === 'CIVIL' && "bg-purple-50 text-purple-700",
                      )}>
                        {b.type_bail}
                      </span>
                      <span className={cn(
                        "w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        b.source === 'DIRECT' && "bg-slate-100 text-slate-600",
                        b.source === 'AIRBNB' && "bg-rose-50 text-rose-600",
                      )}>
                        {b.source}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(b.date_debut), 'dd/MM/yy')} - {format(new Date(b.date_fin), 'dd/MM/yy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-slate-900">{formatCurrency(b.loyer_cc)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={cn(
                        "w-3 h-3",
                        b.statut_caution === 'ENCAISSEE' ? "text-emerald-500" : "text-slate-300"
                      )} />
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        b.statut_caution === 'NON_VERSEE' && "text-amber-600",
                        b.statut_caution === 'ENCAISSEE' && "text-emerald-600",
                        b.statut_caution === 'RESTITUEE' && "text-slate-400",
                        b.statut_caution === 'NON_APPLICABLE' && "text-slate-300",
                      )}>
                        {b.statut_caution}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      b.statut === 'BROUILLON' && "bg-slate-100 text-slate-500",
                      b.statut === 'ACTIF' && "bg-emerald-100 text-emerald-700",
                      b.statut === 'TERMINE' && "bg-blue-100 text-blue-700",
                      b.statut === 'RESILIE' && "bg-rose-100 text-rose-700",
                    )}>
                      {b.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors inline" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Wizard Modal */}
      <Modal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        title="Création de Bail MTR"
        maxWidth="max-w-4xl"
      >
        <MtrWizard 
          onSuccess={() => {
            setShowWizard(false);
            fetchBaux();
          }}
          onCancel={() => setShowWizard(false)}
        />
      </Modal>
    </div>
  );
}
