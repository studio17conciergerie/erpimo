import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { redditionApi, DecaissementSynthese } from '../redditionApi';
import { buildCRGData } from '../crgBuilder';
import { sepaGenerator } from '../sepaGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Search, 
  Filter, 
  RefreshCw, 
  Wallet, 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  FileArchive, 
  CheckSquare, 
  AlertCircle,
  Info,
  ExternalLink,
  Send,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { pdf } from '@react-pdf/renderer';
import { CRGPdfTemplate } from '@/features/accounting/components/CRGPdfTemplate';
import JSZip from 'jszip';

export default function DecaissementDashboard() {
  const [data, setData] = useState<DecaissementSynthese[]>([]);
  const [agenceConfig, setAgenceConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateCible, setDateCible] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof DecaissementSynthese, direction: 'asc' | 'desc' }>({ key: 'nom', direction: 'asc' });

  // Modals state
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState<{ ok: boolean, warnings: string[], blockers: string[] } | null>(null);

  useEffect(() => {
    fetchAgenceConfig();
    fetchData();
  }, [dateCible]);

  const fetchAgenceConfig = async () => {
    try {
      const { data, error } = await supabase.from('configuration_agence').select('*').single();
      if (error) throw error;
      setAgenceConfig(data);
    } catch (error) {
      console.error('Error fetching agence config:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await redditionApi.getDecaissementsEnAttente(dateCible);
      setData(result);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching decaissements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof DecaissementSynthese) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter(item => 
      item.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.includes(searchTerm)
    );

    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortConfig]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredAndSortedData.map(d => d.proprietaireId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const selectedData = filteredAndSortedData.filter(d => selectedIds.has(d.proprietaireId));
  const totalVirement = selectedData.reduce((sum, d) => sum + d.soldeACeJour, 0);

  const handleGenerateSEPA = () => {
    if (selectedData.length === 0) return;

    const missingIban = selectedData.filter(d => !d.ibanPresent);
    if (missingIban.length > 0) {
      alert(`Impossible de générer le SEPA. IBAN manquant pour : ${missingIban.map(m => m.nom).join(', ')}`);
      return;
    }

    if (!agenceConfig) {
      alert("Configuration de l'agence non chargée.");
      return;
    }

    const xml = sepaGenerator.generateSCT(selectedData, dateCible, agenceConfig);
    sepaGenerator.downloadXML(xml, `SEPA_REDDITION_${format(new Date(dateCible), 'yyyyMMdd')}.xml`);
  };

  const handleGeneratePDFs = async (releveIds?: string[]) => {
    // Guard: si appelé directement par le bouton (sans releveIds valide)
    if (!releveIds || !Array.isArray(releveIds) || releveIds.length === 0) {
      alert("Veuillez d'abord valider la reddition pour générer les CRG.");
      return;
    }
    
    setProcessing(true);
    try {
      const zip = new JSZip();
      
      // FIX: Corriger la jointure Supabase
      const { data: rels, error: relsError } = await supabase
        .from('releves_gestion')
        .select('id, proprietaire_id, proprietaire:proprietaire_id(code_auxiliaire)')
        .in('id', releveIds);
      
      if (relsError) {
        console.error('Error fetching releves:', relsError);
        alert('Erreur lors de la récupération des relevés.');
        setProcessing(false);
        return;
      }

      const targets = rels?.map((rel: any) => ({
        id: rel.id,
        proprietaireId: rel.proprietaire_id,
        code: rel.proprietaire?.code_auxiliaire || ''
      })).filter(t => t.code !== '') || [];

      if (targets.length === 0) {
        alert("Aucun relevé trouvé. Vérifiez que la validation s'est bien terminée.");
        setProcessing(false);
        return;
      }

      for (const target of targets) {
        try {
          const crgData = await buildCRGData(target.proprietaireId, target.code, target.id);
          
          const pdfBlob = await pdf(
            <CRGPdfTemplate data={crgData} />
          ).toBlob();
          
          zip.file(
            `CRG_${crgData.proprietaire.nom.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMM')}.pdf`, 
            pdfBlob
          );
        } catch (pdfError) {
          console.error(`Error generating PDF for ${target.code}:`, pdfError);
          // Continue avec les autres au lieu de tout planter
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CRGs_${format(new Date(dateCible), 'yyyyMM')}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Erreur lors de la génération du ZIP');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenValidation = async () => {
    if (selectedData.length === 0) return;
    setProcessing(true);
    try {
      const result = await redditionApi.preValidationChecks(selectedData);
      setValidationResult(result);
      setShowValidationModal(true);
    } catch (error) {
      console.error('Error in pre-validation:', error);
      alert('Erreur lors des vérifications de pré-validation');
    } finally {
      setProcessing(false);
    }
  };

  const handleValidateReddition = async () => {
    if (selectedData.length === 0 || (validationResult && !validationResult.ok)) return;
    setProcessing(true);
    try {
      const releveIds = await redditionApi.validerDecaissementBatch(selectedData, dateCible);
      
      setShowValidationModal(false);
      
      // Générer les PDFs directement (pas de alert+confirm en cascade)
      await handleGeneratePDFs(releveIds);
      
      alert('Reddition validée ! Les écritures ont été générées et les CRG téléchargés.');
      fetchData();
    } catch (error) {
      console.error('Error validating reddition:', error);
      alert(`Erreur lors de la validation : ${(error as any)?.message || 'Erreur inconnue'}`);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard de Décaissement</h1>
          <p className="text-slate-500">Validation des virements propriétaires et clôture de période</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date de Reddition</label>
            <Input 
              type="date" 
              value={dateCible} 
              onChange={(e) => setDateCible(e.target.value)}
              className="w-40 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-9">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total à décaisser</p>
                <h3 className="text-2xl font-bold mt-1">
                  {formatCurrency(data.reduce((sum, d) => sum + d.soldeACeJour, 0))}
                </h3>
              </div>
              <div className="bg-slate-800 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Propriétaires</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-900">{data.length}</h3>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Sélectionné</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-900">{selectedIds.size}</h3>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <CheckSquare className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Montant Sélection</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(totalVirement)}</h3>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Rechercher un propriétaire..." 
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 text-xs">
                <Filter className="w-3.5 h-3.5 mr-2" />
                Filtres
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-[40px]">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300"
                      onChange={handleSelectAll}
                      checked={filteredAndSortedData.length > 0 && selectedIds.size === filteredAndSortedData.length}
                    />
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('nom')}>
                    Propriétaire {sortConfig.key === 'nom' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                  </th>
                  <th className="px-4 py-3 text-right">Honoraires HT</th>
                  <th className="px-4 py-3 text-right">Honoraires TTC</th>
                  <th className="px-4 py-3 text-right">Montant Dû</th>
                  <th className="px-4 py-3 text-right">Solde Comptable</th>
                  <th className="px-4 py-3 text-right">Dettes Loc.</th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('soldeACeJour')}>
                    Solde à Virer {sortConfig.key === 'soldeACeJour' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                  </th>
                  <th className="px-4 py-3 text-center">IBAN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                      Chargement des données...
                    </td>
                  </tr>
                ) : filteredAndSortedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 italic">
                      Aucun décaissement en attente pour cette période.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((item) => (
                    <tr key={item.proprietaireId} className={cn(
                      "hover:bg-slate-50 transition-colors",
                      selectedIds.has(item.proprietaireId) && "bg-blue-50/30"
                    )}>
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedIds.has(item.proprietaireId)}
                          onChange={(e) => handleSelectOne(item.proprietaireId, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.nom} {item.prenom}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.code} • {item.nbReservations} rés.</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {formatCurrency(item.montantHonorairesHT)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-600">
                        -{formatCurrency(item.montantHonorairesTTC)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900 font-bold">
                        {formatCurrency(item.montantDu)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          Math.abs(item.montantDu - item.soldeComptable404) < 0.01 
                            ? "bg-emerald-50 text-emerald-600" 
                            : "bg-amber-50 text-amber-600"
                        )}>
                          {formatCurrency(item.soldeComptable404)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">
                        -{formatCurrency(item.dettesLocataires)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-lg font-black text-emerald-700">
                          {formatCurrency(item.soldeACeJour)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.ibanPresent ? (
                          <div className="flex items-center justify-center text-emerald-600" title={item.iban || ''}>
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-red-500" title="IBAN manquant">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Panel */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-30">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-2 rounded-xl">
                <Wallet className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sélection active</div>
                <div className="text-xl font-black">
                  {selectedIds.size} propriétaires • <span className="text-emerald-400">{formatCurrency(totalVirement)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                className="text-slate-300 hover:text-white hover:bg-slate-800"
                onClick={() => setShowRecapModal(true)}
              >
                <Info className="w-4 h-4 mr-2" />
                Récap
              </Button>
              
              <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={handleGenerateSEPA}
                >
                  <Download className="w-4 h-4 mr-2" />
                  SEPA
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => handleGeneratePDFs()}
                  disabled={processing}
                >
                  {processing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileArchive className="w-4 h-4 mr-2" />}
                  PDFs (ZIP)
                </Button>
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none px-6"
                  onClick={handleOpenValidation}
                  disabled={processing}
                >
                  {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Valider la Reddition'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recap Modal */}
      <Modal
        isOpen={showRecapModal}
        onClose={() => setShowRecapModal(false)}
        title="Récapitulatif de la sélection"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Montant Dû</p>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(selectedData.reduce((sum, d) => sum + d.montantDu, 0))}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Total Dettes Locataires</p>
              <p className="text-2xl font-black text-amber-600">-{formatCurrency(selectedData.reduce((sum, d) => sum + d.dettesLocataires, 0))}</p>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left">Propriétaire</th>
                  <th className="px-4 py-2 text-right">Virement</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedData.map(d => (
                  <tr key={d.proprietaireId}>
                    <td className="px-4 py-2">{d.nom} {d.prenom}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold">{formatCurrency(d.soldeACeJour)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Validation Modal */}
      <Modal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="Confirmation de Reddition"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowValidationModal(false)}>Annuler</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleValidateReddition}
              disabled={processing || (validationResult && !validationResult.ok)}
            >
              {processing ? 'Traitement en cours...' : 'Confirmer & Générer les écritures'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {validationResult && (
            <div className="space-y-3">
              {validationResult.blockers.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Blocages détectés ({validationResult.blockers.length})
                  </div>
                  <ul className="text-xs text-red-600 list-disc pl-5 space-y-1">
                    {validationResult.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Avertissements ({validationResult.warnings.length})
                  </div>
                  <ul className="text-xs text-amber-600 list-disc pl-5 space-y-1">
                    {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {validationResult.ok && validationResult.warnings.length === 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2 text-emerald-700 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Toutes les vérifications sont conformes.
                </div>
              )}
            </div>
          )}

          <div className="text-center space-y-4 pt-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Prêt pour le décaissement ?</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Cette action va générer les écritures comptables de virement (Débit 404 / Crédit 512000) pour les <strong>{selectedIds.size} propriétaires</strong> sélectionnés.
            </p>
            <div className="p-4 bg-slate-900 text-white rounded-xl inline-block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Montant Total à décaisser</p>
              <p className="text-2xl font-black">{formatCurrency(totalVirement)}</p>
            </div>
            <div className="flex items-center gap-2 justify-center text-amber-600 text-xs mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Les réservations passeront au statut <strong>REDDITION_EMISE</strong>.</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
