import React, { useState, useEffect } from 'react';
import { interventionsApi, Intervention } from '../interventionsApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { 
  Plus, 
  Wrench, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText, 
  CreditCard,
  Building2,
  MapPin,
  ChevronRight,
  Loader2,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import NewInterventionModal from './NewInterventionModal';

const STATUT_CONFIG = {
  PLANIFIE: { label: 'Planifié', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar },
  REALISE: { label: 'Réalisé', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: CheckCircle2 },
  FACTURE_VALIDEE: { label: 'Facture Validée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: FileText },
  PAYE: { label: 'Payé', color: 'bg-emerald-600 text-white border-emerald-700', icon: CreditCard },
};

export default function InterventionsBoard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    loadInterventions();
  }, []);

  async function loadInterventions() {
    setLoading(true);
    try {
      const data = await interventionsApi.getInterventions();
      setInterventions(data);
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredInterventions = interventions.filter(i => 
    filter === 'ALL' || i.statut === filter
  );

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Interventions & Maintenance</h1>
          <p className="text-slate-500 text-sm">Suivi des tickets techniques et facturation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
            <Button 
              variant={filter === 'ALL' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setFilter('ALL')}
              className="text-xs h-8"
            >
              Tous
            </Button>
            <Button 
              variant={filter === 'PLANIFIE' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setFilter('PLANIFIE')}
              className="text-xs h-8"
            >
              En cours
            </Button>
            <Button 
              variant={filter === 'FACTURE_VALIDEE' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setFilter('FACTURE_VALIDEE')}
              className="text-xs h-8"
            >
              Facturés
            </Button>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-slate-900 hover:bg-slate-800">
            <Plus className="w-4 h-4" />
            Nouvelle Intervention
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-slate-500">Chargement des interventions...</p>
        </div>
      ) : filteredInterventions.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <Wrench className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Aucune intervention trouvée</p>
          <Button variant="link" onClick={() => setIsModalOpen(true)}>Créer votre premier ticket</Button>
        </div>
      ) : (
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Titre / Description</th>
                  <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Logement</th>
                  <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Prestataire</th>
                  <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Date création</th>
                  <th className="px-6 py-4 text-right text-[10px] uppercase font-bold text-slate-500 tracking-wider">Montant TTC</th>
                  <th className="px-6 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInterventions.map((intervention) => {
                  const Config = STATUT_CONFIG[intervention.statut];
                  const StatusIcon = Config.icon;
                  
                  return (
                    <tr 
                      key={intervention.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/interventions/${intervention.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          Config.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {Config.label}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {intervention.titre}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            #{intervention.id.substring(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">{intervention.logement?.nom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{intervention.fournisseur?.nom || 'À définir'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {format(new Date(intervention.created_at), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-slate-900">
                          {formatCurrency(intervention.montant_ttc)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewInterventionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadInterventions} 
      />
    </div>
  );
}
