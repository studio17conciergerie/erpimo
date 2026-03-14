import React, { useEffect, useState, useMemo } from 'react';
import { 
  rapprochementService, 
  BankMovement, 
  PointableItem,
  ReconciliationType
} from '../rapprochementService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  CreditCard, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Filter,
  PlusCircle,
  X,
  ChevronRight,
  Landmark,
  User,
  Receipt,
  ShieldCheck,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ManualEntry = {
  active: boolean;
  type: 'FRAIS_BANCAIRES' | 'DIVERS';
  compteContrepartie: string;
  libelleManuel: string;
  montant: number;
};

export default function RapprochementBancaire() {
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [pointableItems, setPointableItems] = useState<PointableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ENCAISSEMENTS' | 'DECAISSEMENTS' | 'CAUTIONS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [bankSearchTerm, setBankSearchTerm] = useState('');

  // Selection state
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  // Manual entry state
  const [manualEntry, setManualEntry] = useState<ManualEntry>({
    active: false,
    type: 'FRAIS_BANCAIRES',
    compteContrepartie: '',
    libelleManuel: '',
    montant: 0
  });

  // Totals
  const selectedMovement = useMemo(() => movements.find(m => m.id === selectedMovementId), [movements, selectedMovementId]);
  const bankAmount = selectedMovement ? selectedMovement.montant : 0;
  
  const filteredMovements = useMemo(() => {
    if (!bankSearchTerm) return movements;
    const search = bankSearchTerm.toLowerCase();
    return movements.filter(m => 
      m.libelle_banque.toLowerCase().includes(search) ||
      m.montant.toFixed(2).includes(search) ||
      Math.abs(m.montant).toFixed(2).includes(search) ||
      m.date_operation.includes(search)
    );
  }, [movements, bankSearchTerm]);

  const selectedItems = useMemo(() => pointableItems.filter(item => selectedItemIds.includes(item.id)), [pointableItems, selectedItemIds]);
  const comptaTotal = useMemo(() => {
    const itemsTotal = selectedItems.reduce((sum, item) => sum + Number(item.montant), 0);
    return manualEntry.active ? itemsTotal + manualEntry.montant : itemsTotal;
  }, [selectedItems, manualEntry]);
  
  const ecart = Math.abs(bankAmount) - Math.abs(comptaTotal);
  const isBalanced = Math.abs(ecart) < 0.01 && selectedMovementId !== null && (selectedItemIds.length > 0 || manualEntry.active);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-suggestion when movement changes
  useEffect(() => {
    if (selectedMovementId && movements.length > 0) {
      const mov = movements.find(m => m.id === selectedMovementId);
      if (mov) {
        const suggestions = rapprochementService.suggestMatches(mov, pointableItems);
        if (suggestions.length > 0) {
          setSelectedItemIds(suggestions.map(s => s.id));
          // If we found suggestions, deactivate manual entry
          setManualEntry(prev => ({ ...prev, active: false }));
        } else {
          setSelectedItemIds([]);
        }
      }
    }
  }, [selectedMovementId, pointableItems, movements]);

  async function loadData() {
    setLoading(true);
    try {
      const [movs, items] = await Promise.all([
        rapprochementService.getUnreconciledMovements(),
        rapprochementService.getAllPointableItems()
      ]);
      setMovements(movs);
      setPointableItems(items);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleValidate = async () => {
    if (!selectedMovementId || !isBalanced) return;

    // Détecter le type principal
    let type: ReconciliationType = 'DIVERS';
    if (manualEntry.active) {
      type = manualEntry.type;
    } else if (selectedItems.length > 0) {
      type = selectedItems[0].type;
    }

    try {
      await rapprochementService.validateReconciliation(
        selectedMovementId,
        type,
        selectedItems,
        manualEntry.active ? {
          compteContrepartie: manualEntry.compteContrepartie,
          libelleManuel: manualEntry.libelleManuel
        } : undefined
      );
      
      // Reset selection and reload
      setSelectedMovementId(null);
      setSelectedItemIds([]);
      setManualEntry({ active: false, type: 'FRAIS_BANCAIRES', compteContrepartie: '', libelleManuel: '', montant: 0 });
      loadData();
      alert('Rapprochement validé avec succès !');
    } catch (error: any) {
      console.error('Validation error:', error);
      alert(`Erreur lors de la validation : ${error.message}`);
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    if (manualEntry.active) setManualEntry(prev => ({ ...prev, active: false }));
  };

  const filteredItems = useMemo(() => {
    return pointableItems.filter(item => {
      const matchesFilter = 
        activeFilter === 'ALL' || 
        (activeFilter === 'ENCAISSEMENTS' && (item.type === 'ENCAISSEMENT_OTA' || item.type === 'ENCAISSEMENT_DIR')) ||
        (activeFilter === 'DECAISSEMENTS' && (item.type === 'PAIEMENT_FOURNR' || item.type === 'REDDITION_PROPRIO' || item.type === 'TRANSFERT_HONOR')) ||
        (activeFilter === 'CAUTIONS' && (item.type === 'CAUTION_ENCAISS' || item.type === 'CAUTION_RESTIT'));
      
      const matchesSearch = 
        item.libelle.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.tiers_nom?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesFilter && matchesSearch;
    });
  }, [pointableItems, activeFilter, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups = {
      encaissements: filteredItems.filter(i => i.type === 'ENCAISSEMENT_OTA' || i.type === 'ENCAISSEMENT_DIR'),
      decaissements: filteredItems.filter(i => i.type === 'PAIEMENT_FOURNR' || i.type === 'REDDITION_PROPRIO' || i.type === 'TRANSFERT_HONOR'),
      cautions: filteredItems.filter(i => i.type === 'CAUTION_ENCAISS' || i.type === 'CAUTION_RESTIT')
    };
    return groups;
  }, [filteredItems]);

  const openManualEntry = (type: 'FRAIS_BANCAIRES' | 'DIVERS') => {
    setSelectedItemIds([]);
    setManualEntry({
      active: true,
      type,
      compteContrepartie: type === 'FRAIS_BANCAIRES' ? '627000' : '',
      libelleManuel: selectedMovement?.libelle_banque || '',
      montant: selectedMovement?.montant || 0
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Chargement des flux bancaires...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] relative">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden pb-24">
        
        {/* Colonne Gauche: La Banque */}
        <Card className="flex flex-col overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 py-4">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <CreditCard className="w-5 h-5 text-blue-600" />
                La Banque
              </CardTitle>
              <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full uppercase tracking-wider">
                {movements.length} à rapprocher
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="text"
                placeholder="Rechercher montant, libellé..."
                className="pl-9 h-9 text-sm border-slate-200"
                value={bankSearchTerm}
                onChange={(e) => setBankSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b z-10">
                <tr className="text-left text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                  <th className="p-4 font-bold">Compte</th>
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold">Libellé</th>
                  <th className="p-4 font-bold text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((m) => (
                  <tr 
                    key={m.id}
                    onClick={() => setSelectedMovementId(m.id)}
                    className={cn(
                      "cursor-pointer transition-all hover:bg-slate-50 group",
                      selectedMovementId === m.id ? "bg-blue-50/80 hover:bg-blue-50" : ""
                    )}
                  >
                    <td className="p-4">
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                        {m.compte_banque}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-slate-600">
                      {format(new Date(m.date_operation), 'dd/MM/yy')}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {m.libelle_banque}
                      </div>
                    </td>
                    <td className={cn(
                      "p-4 text-right font-mono font-bold text-base",
                      m.montant > 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {m.montant > 0 ? '+' : ''}{m.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                  </tr>
                ))}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <CheckCircle2 className="w-8 h-8 opacity-20" />
                        <p className="italic">Tous les mouvements sont rapprochés</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Colonne Droite: La Comptabilité */}
        <Card className="flex flex-col overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Landmark className="w-5 h-5 text-slate-500" />
                  La Comptabilité
                </CardTitle>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    type="text"
                    placeholder="Rechercher tiers, code..."
                    className="pl-9 h-9 text-sm border-slate-200 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {[
                    { id: 'ALL', label: 'Tout' },
                    { id: 'ENCAISSEMENTS', label: 'Encais.' },
                    { id: 'DECAISSEMENTS', label: 'Décais.' },
                    { id: 'CAUTIONS', label: 'Cautions' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id as any)}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border transition-all",
                        activeFilter === f.id 
                          ? "bg-slate-800 text-white border-slate-800 shadow-sm" 
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-1.5 border-slate-200 text-slate-600"
                    onClick={() => openManualEntry('FRAIS_BANCAIRES')}
                    disabled={!selectedMovementId}
                  >
                    <Receipt className="w-3 h-3" />
                    Frais
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-1.5 border-slate-200 text-slate-600"
                    onClick={() => openManualEntry('DIVERS')}
                    disabled={!selectedMovementId}
                  >
                    <PlusCircle className="w-3 h-3" />
                    Divers
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0 bg-slate-50/30">
            
            {manualEntry.active && (
              <div className="p-4 bg-blue-50 border-b border-blue-100 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                    {manualEntry.type === 'FRAIS_BANCAIRES' ? <Receipt className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                    Saisie Manuelle : {manualEntry.type === 'FRAIS_BANCAIRES' ? 'Frais Bancaires' : 'Mouvement Divers'}
                  </h4>
                  <button onClick={() => setManualEntry(prev => ({ ...prev, active: false }))} className="text-blue-400 hover:text-blue-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-700 uppercase">Compte Contrepartie</label>
                    <Input 
                      value={manualEntry.compteContrepartie}
                      onChange={(e) => setManualEntry(prev => ({ ...prev, compteContrepartie: e.target.value }))}
                      className="h-8 text-sm bg-white border-blue-200"
                      placeholder="Ex: 627000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-700 uppercase">Libellé Manuel</label>
                    <Input 
                      value={manualEntry.libelleManuel}
                      onChange={(e) => setManualEntry(prev => ({ ...prev, libelleManuel: e.target.value }))}
                      className="h-8 text-sm bg-white border-blue-200"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {/* Groupe: Encaissements */}
              {groupedItems.encaissements.length > 0 && (
                <div className="bg-white">
                  <div className="px-4 py-2 bg-slate-50/80 border-y border-slate-100 flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Encaissements attendus</span>
                  </div>
                  {groupedItems.encaissements.map(item => (
                    <ItemRow 
                      key={item.id} 
                      item={item} 
                      isSelected={selectedItemIds.includes(item.id)} 
                      onToggle={() => toggleItem(item.id)} 
                    />
                  ))}
                </div>
              )}

              {/* Groupe: Décaissements */}
              {groupedItems.decaissements.length > 0 && (
                <div className="bg-white">
                  <div className="px-4 py-2 bg-slate-50/80 border-y border-slate-100 flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Décaissements attendus</span>
                  </div>
                  {groupedItems.decaissements.map(item => (
                    <ItemRow 
                      key={item.id} 
                      item={item} 
                      isSelected={selectedItemIds.includes(item.id)} 
                      onToggle={() => toggleItem(item.id)} 
                    />
                  ))}
                </div>
              )}

              {/* Groupe: Cautions */}
              {groupedItems.cautions.length > 0 && (
                <div className="bg-white">
                  <div className="px-4 py-2 bg-slate-50/80 border-y border-slate-100 flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cautions</span>
                  </div>
                  {groupedItems.cautions.map(item => (
                    <ItemRow 
                      key={item.id} 
                      item={item} 
                      isSelected={selectedItemIds.includes(item.id)} 
                      onToggle={() => toggleItem(item.id)} 
                    />
                  ))}
                </div>
              )}

              {filteredItems.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic">
                  Aucun élément comptable en attente
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de Contrôle Sticky */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-4 z-50 lg:left-64">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex flex-col">
              <span className="text-slate-400 uppercase text-[9px] font-bold tracking-[0.2em] mb-1">Banque Sélectionnée</span>
              <div className={cn(
                "font-mono text-xl font-black flex items-baseline gap-1",
                bankAmount > 0 ? "text-emerald-600" : bankAmount < 0 ? "text-rose-600" : "text-slate-300"
              )}>
                {bankAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </div>
            </div>
            
            <div className="text-slate-200 hidden md:block">
              <ArrowRight className="w-6 h-6 stroke-[3px]" />
            </div>

            <div className="flex flex-col">
              <span className="text-slate-400 uppercase text-[9px] font-bold tracking-[0.2em] mb-1">Total Comptabilité</span>
              <div className={cn(
                "font-mono text-xl font-black flex items-baseline gap-1",
                comptaTotal !== 0 ? "text-slate-900" : "text-slate-300"
              )}>
                {comptaTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </div>
            </div>

            <div className="h-10 w-px bg-slate-100 hidden md:block"></div>

            <div className="flex flex-col">
              <span className="text-slate-400 uppercase text-[9px] font-bold tracking-[0.2em] mb-1">Écart de Pointage</span>
              <div className={cn(
                "font-mono text-xl font-black flex items-baseline gap-1",
                Math.abs(ecart) < 0.01 ? "text-emerald-500" : "text-rose-500"
              )}>
                {ecart.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {isBalanced ? (
              <div className="flex items-center gap-2.5 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
                Équilibre Validé
              </div>
            ) : selectedMovementId ? (
              <div className="flex items-center gap-2.5 text-rose-500 font-bold text-sm bg-rose-50 px-4 py-2 rounded-full border border-rose-100">
                <AlertCircle className="w-5 h-5" />
                Écart à combler
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                <Info className="w-4 h-4" />
                Sélectionnez un flux
              </div>
            )}
            
            <Button 
              onClick={handleValidate}
              disabled={!isBalanced}
              className={cn(
                "h-14 px-10 text-base font-black uppercase tracking-widest transition-all shadow-lg",
                isBalanced 
                  ? "bg-slate-900 hover:bg-black text-white scale-105 active:scale-95" 
                  : "bg-slate-100 text-slate-300 cursor-not-allowed border-slate-200"
              )}
            >
              Valider le Rapprochement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ItemRow: React.FC<{ item: PointableItem, isSelected: boolean, onToggle: () => void }> = ({ item, isSelected, onToggle }) => {
  const isPositive = item.montant > 0;
  
  return (
    <div 
      onClick={onToggle}
      className={cn(
        "group flex items-center gap-4 px-4 py-3 cursor-pointer transition-all border-l-4",
        isSelected 
          ? (isPositive ? "bg-emerald-50/50 border-emerald-500" : "bg-rose-50/50 border-rose-500")
          : "border-transparent hover:bg-slate-50"
      )}
    >
      <div className="flex items-center justify-center w-5 h-5 shrink-0">
        <div className={cn(
          "w-4 h-4 rounded border transition-all flex items-center justify-center",
          isSelected 
            ? (isPositive ? "bg-emerald-500 border-emerald-500" : "bg-rose-500 border-rose-500")
            : "border-slate-300 group-hover:border-slate-400"
        )}>
          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-slate-900 truncate">{item.libelle}</span>
          <Badge type={item.type} />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            {format(new Date(item.date), 'dd MMM yyyy', { locale: fr })}
          </span>
          {item.tiers_nom && (
            <span className="flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              {item.tiers_nom}
            </span>
          )}
          {item.compte && (
            <span className="font-mono bg-slate-100 px-1 rounded text-slate-500">{item.compte}</span>
          )}
        </div>
      </div>
      
      <div className={cn(
        "font-mono font-bold text-right shrink-0",
        isPositive ? "text-emerald-600" : "text-rose-600"
      )}>
        {isPositive ? '+' : ''}{item.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
      </div>
    </div>
  );
};

function Badge({ type }: { type: ReconciliationType }) {
  const config: Record<string, { label: string, color: string }> = {
    ENCAISSEMENT_OTA: { label: 'OTA', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    ENCAISSEMENT_DIR: { label: 'DIRECT', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    PAIEMENT_FOURNR: { label: 'FOURN', color: 'bg-orange-50 text-orange-600 border-orange-100' },
    REDDITION_PROPRIO: { label: 'REDD', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    TRANSFERT_HONOR: { label: 'HONOR', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    CAUTION_ENCAISS: { label: 'CAUT', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    CAUTION_RESTIT: { label: 'RESTIT', color: 'bg-rose-50 text-rose-600 border-rose-100' },
    FRAIS_BANCAIRES: { label: 'FRAIS', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    DIVERS: { label: 'DIV', color: 'bg-slate-100 text-slate-600 border-slate-200' }
  };

  const { label, color } = config[type] || { label: type, color: 'bg-slate-100 text-slate-600' };

  return (
    <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter", color)}>
      {label}
    </span>
  );
}
