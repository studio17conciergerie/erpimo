import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reservation, reservationsService } from '../reservationsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Filter, Calendar as CalendarIcon, RefreshCw, Calculator, CheckSquare, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReservationsList() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  
  // Filters
  const [selectedProperty, setSelectedProperty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showArchives, setShowArchives] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProperties();
    fetchReservations();
  }, []);

  // Refetch when filters change (could be debounced or on button click)
  useEffect(() => {
    fetchReservations();
  }, [selectedProperty, startDate, endDate]);

  const fetchProperties = async () => {
    try {
      const data = await reservationsService.getProperties();
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const data = await reservationsService.getReservations({
        logementId: selectedProperty || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setReservations(data || []);
      setSelectedIds(new Set()); // Clear selection on refresh
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Only select drafts that have already checked in
      const today = new Date().toISOString().split('T')[0];
      const readyIds = filteredReservations
        .filter(r => r.statut_workflow === 'BROUILLON' && r.check_in <= today)
        .map(r => r.id);
      setSelectedIds(new Set(readyIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleGenerateAccounting = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    try {
      const count = await reservationsService.generateAccountingForReservations(Array.from(selectedIds));
      alert(`${count} écritures comptables générées avec succès.`);
      fetchReservations(); // Refresh to see status updates
    } catch (error: any) {
      console.error('Error generating accounting:', error);
      alert(`Erreur: ${error.message || 'Une erreur est survenue'}`);
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  // Client-side filtering
  const today = new Date().toISOString().split('T')[0];
  const filteredReservations = reservations.filter(r => {
    // 1. Archive Filter (Hide REDDITION by default)
    if (!showArchives && r.statut_workflow === 'REDDITION') return false;

    // 2. Search Term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesGuest = r.guest_name.toLowerCase().includes(searchLower);
      const matchesCode = r.confirmation_code.toLowerCase().includes(searchLower);
      if (!matchesGuest && !matchesCode) return false;
    }

    return true;
  });

  const draftCount = filteredReservations.filter(r => r.statut_workflow === 'BROUILLON').length;
  const readyToAccountCount = filteredReservations.filter(r => r.statut_workflow === 'BROUILLON' && r.check_in <= today).length;
  const waitingCheckInCount = filteredReservations.filter(r => r.statut_workflow === 'BROUILLON' && r.check_in > today).length;

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/4 space-y-2">
              <label className="text-sm font-medium text-slate-700">Recherche</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Voyageur, Code..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="w-full md:w-1/4 space-y-2">
              <label className="text-sm font-medium text-slate-700">Logement</label>
              <Select 
                value={selectedProperty} 
                onChange={(e) => setSelectedProperty(e.target.value)}
              >
                <option value="">Tous les logements</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </Select>
            </div>
            
            <div className="w-full md:w-1/4 space-y-2">
              <label className="text-sm font-medium text-slate-700">Arrivée (Début)</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>

            <div className="w-full md:w-1/4 space-y-2">
              <label className="text-sm font-medium text-slate-700">Arrivée (Fin)</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowArchives(!showArchives)}
                className={cn("text-xs", showArchives ? "text-slate-900 bg-slate-100" : "text-slate-500")}
              >
                {showArchives ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {showArchives ? 'Masquer les archives (Reddition)' : 'Voir les archives'}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={fetchReservations} title="Actualiser" className="gap-2">
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white p-4 rounded-lg flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2 sticky bottom-4 z-20">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-400" />
            <span className="font-medium">{selectedIds.size} sélectionné(s)</span>
          </div>
          <Button 
            onClick={handleGenerateAccounting} 
            disabled={generating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Générer les écritures
              </>
            )}
          </Button>
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-slate-500 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>{filteredReservations.length} réservation{filteredReservations.length > 1 ? 's' : ''} affichée{filteredReservations.length > 1 ? 's' : ''}</span>
              {readyToAccountCount > 0 && (
                <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-700 font-bold uppercase">
                  {readyToAccountCount} à comptabiliser
                </span>
              )}
              {waitingCheckInCount > 0 && (
                <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded text-amber-700 font-bold uppercase">
                  {waitingCheckInCount} en attente de check-in
                </span>
              )}
            </div>
            {draftCount > 0 && <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{draftCount} brouillons</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3 w-[40px]">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300"
                      onChange={handleSelectAll}
                      checked={readyToAccountCount > 0 && selectedIds.size === readyToAccountCount}
                      disabled={readyToAccountCount === 0}
                    />
                  </th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Logement</th>
                  <th className="px-4 py-3">Voyageur</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-center">Nuits</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Montant Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Chargement...</td>
                  </tr>
                ) : filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucune réservation ne correspond aux critères.</td>
                  </tr>
                ) : (
                  filteredReservations.map((res) => (
                    <tr 
                      key={res.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={(e) => {
                        // Don't navigate if clicking checkbox
                        if ((e.target as HTMLElement).tagName === 'INPUT') return;
                        navigate(`/reservations/${res.id}`);
                      }}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedIds.has(res.id)}
                          onChange={(e) => handleSelectOne(res.id, e.target.checked)}
                          disabled={res.statut_workflow !== 'BROUILLON' || res.check_in > today}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] uppercase font-bold border",
                          res.statut_workflow === 'BROUILLON' && "bg-slate-100 text-slate-500 border-slate-200",
                          res.statut_workflow === 'ATTENTE_PAIEMENT' && "bg-amber-50 text-amber-700 border-amber-200",
                          res.statut_workflow === 'ENCAISSE' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          res.statut_workflow === 'REDDITION' && "bg-slate-900 text-white border-slate-900",
                        )}>
                          {res.statut_workflow}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {res.logement?.nom || <span className="text-red-500 italic">Inconnu ({res.listing_id})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{res.guest_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{res.confirmation_code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(res.check_in)} <span className="text-slate-400">→</span> {formatDate(res.check_out)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {res.nb_nuits}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded",
                          res.source.toLowerCase().includes('airbnb') ? "bg-rose-50 text-rose-600" :
                          res.source.toLowerCase().includes('booking') ? "bg-blue-50 text-blue-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {res.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-700">
                        {formatCurrency(res.payout_net)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
