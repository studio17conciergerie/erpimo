import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { odApi, OperationDiverse, OperationDiverseLigne, StatutOD } from '../odApi';
import { journauxApi } from '../journauxApi';
import { accountingEngine } from '../accountingEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Printer, 
  AlertCircle,
  Loader2,
  Pencil,
  XCircle,
  History,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import CompteSearchSelect from './CompteSearchSelect';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register a font for better look and consistency
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 700 },
  ],
});

// --- PDF Template ---
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Inter' },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1 },
  tableRow: { margin: 'auto', flexDirection: 'row' },
  tableColHeader: { width: '16.6%', borderStyle: 'solid', borderWidth: 1, backgroundColor: '#f1f5f9', padding: 5, fontWeight: 'bold' },
  tableCol: { width: '16.6%', borderStyle: 'solid', borderWidth: 1, padding: 5 },
  footer: { marginTop: 30, textAlign: 'center', fontSize: 8, color: '#64748b' },
  totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#000', borderTopStyle: 'solid', paddingTop: 5, marginTop: 5, fontWeight: 'bold' }
});

const ODPdf = ({ od, lines }: { od: any, lines: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>PIÈCE COMPTABLE - {od.numero_od}</Text>
        <Text>Agence Paris 17 - Gestion Immobilière</Text>
      </View>
      <View style={styles.meta}>
        <View>
          <Text>Journal: {od.journal_code}</Text>
          <Text>Date: {format(new Date(od.date_ecriture), 'dd/MM/yyyy')}</Text>
        </View>
        <View style={{ width: '60%' }}>
          <Text>Libellé: {od.libelle}</Text>
        </View>
      </View>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={styles.tableColHeader}>Compte</Text>
          <Text style={styles.tableColHeader}>Auxiliaire</Text>
          <Text style={styles.tableColHeader}>Libellé Compte</Text>
          <Text style={styles.tableColHeader}>Libellé Ligne</Text>
          <Text style={styles.tableColHeader}>Débit</Text>
          <Text style={styles.tableColHeader}>Crédit</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCol}>{l.compte_general}</Text>
            <Text style={styles.tableCol}>{l.compte_auxiliaire || '-'}</Text>
            <Text style={styles.tableCol}>{l.libelle_compte}</Text>
            <Text style={styles.tableCol}>{l.libelle}</Text>
            <Text style={styles.tableCol}>{l.montant_debit > 0 ? l.montant_debit.toFixed(2) : ''}</Text>
            <Text style={styles.tableCol}>{l.montant_credit > 0 ? l.montant_credit.toFixed(2) : ''}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text>Document généré le {format(new Date(), 'dd/MM/yyyy HH:mm')}</Text>
      </View>
    </Page>
  </Document>
);

// --- Main Component ---
export default function SaisieEcritureComptable() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'nouvelle';

  // Header State
  const [journal, setJournal] = useState('OD');
  const [dateEcriture, setDateEcriture] = useState(new Date().toISOString().split('T')[0]);
  const [libelleGeneral, setLibelleGeneral] = useState('');
  const [lastLineLibelle, setLastLineLibelle] = useState('');
  const [statut, setStatut] = useState<StatutOD>('BROUILLON');
  const [numeroOd, setNumeroOd] = useState('');
  const [journalSuggestion, setJournalSuggestion] = useState<string | null>(null);

  // Line Form State (Simplified Double-Entry)
  const [entryForm, setEntryForm] = useState({
    libelle: '',
    compte_debit: null as any,
    compte_credit: null as any,
    tiers_debit: null as string | null,
    tiers_credit: null as string | null,
    montant: 0
  });
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Table State
  const [lines, setLines] = useState<OperationDiverseLigne[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [processing, setProcessing] = useState(false);

  const accountInputRef = useRef<any>(null);

  useEffect(() => {
    if (isEdit) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await odApi.getODById(id!);
      setNumeroOd(data.numero_od);
      setStatut(data.statut);
      
      setJournal(data.journal_code);
      setDateEcriture(data.date_ecriture);
      setLibelleGeneral(data.libelle);
      setLines(data.lignes || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }

  const handleAddLine = () => {
    const errors: string[] = [];
    if (!entryForm.compte_debit || !entryForm.compte_credit) errors.push('Veuillez renseigner les deux comptes');
    if (entryForm.montant <= 0) errors.push('Le montant doit être supérieur à 0');
    if (entryForm.compte_debit?.compte_auxiliaire === entryForm.compte_credit?.compte_auxiliaire) errors.push('Le compte débit doit être différent du compte crédit');
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    const lineLibelle = entryForm.libelle || lastLineLibelle || libelleGeneral;

    // Déterminer le tiers_id : on prend celui du compte de tiers (401, 404, 411)
    let tiersId: string | undefined = undefined;
    const isTiersDebit = ['401', '404', '411', '419'].some(prefix => entryForm.compte_debit.compte_general.startsWith(prefix));
    const isTiersCredit = ['401', '404', '411', '419'].some(prefix => entryForm.compte_credit.compte_general.startsWith(prefix));

    if (isTiersDebit) tiersId = entryForm.tiers_debit || undefined;
    else if (isTiersCredit) tiersId = entryForm.tiers_credit || undefined;

    const newOperation: OperationDiverseLigne = {
      libelle: lineLibelle,
      compte_debit: entryForm.compte_debit.compte_auxiliaire || entryForm.compte_debit.compte_general,
      compte_credit: entryForm.compte_credit.compte_auxiliaire || entryForm.compte_credit.compte_general,
      montant: entryForm.montant,
      tiers_id: tiersId,
      ordre: lines.length
    };

    setLines([...lines, newOperation]);
    setLastLineLibelle(lineLibelle);
    resetLineForm();
    
    // Focus back to debit account search
    setTimeout(() => {
      accountInputRef.current?.focus();
    }, 0);
  };

  const resetLineForm = () => {
    setEntryForm({
      libelle: '',
      compte_debit: null,
      compte_credit: null,
      tiers_debit: null,
      tiers_credit: null,
      montant: 0
    });
    setEditingLineIndex(null);
  };

  const handleEditLine = (index: number) => {
    const op = lines[index];
    setEntryForm({
      libelle: op.libelle,
      compte_debit: { compte_general: op.compte_debit.substring(0, 3), compte_auxiliaire: op.compte_debit, libelle_compte: '', tiers_id: op.tiers_id, type: 'GENERAL' },
      compte_credit: { compte_general: op.compte_credit.substring(0, 3), compte_auxiliaire: op.compte_credit, libelle_compte: '', tiers_id: op.tiers_id, type: 'GENERAL' },
      tiers_debit: op.tiers_id || null,
      tiers_credit: op.tiers_id || null,
      montant: op.montant
    });
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleRemoveLine = (index: number) => {
    if (confirm('Supprimer cette ligne ?')) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalMontant = lines.reduce((sum, op) => sum + op.montant, 0);
  
  // isBalanced : somme débits == somme crédits (toujours vrai par ligne en mode simplifié)
  const isBalanced = lines.length > 0 && lines.every(l => l.montant > 0);

  const handleSave = async (isDraft: boolean) => {
    if (!libelleGeneral || !dateEcriture) {
      alert('Veuillez renseigner le libellé et la date');
      return;
    }

    setProcessing(true);
    try {
      // Standard OD flow
      const payload: Partial<OperationDiverse> = {
        id: isEdit ? id : undefined,
        journal_code: journal,
        date_ecriture: dateEcriture,
        libelle: libelleGeneral,
        statut: 'BROUILLON',
        numero_od: isEdit ? numeroOd : undefined
      };

      const saved = await odApi.saveOD(payload, lines);
      
      if (!isDraft) {
        const errors = await odApi.validerOD(saved.id);
        if (errors.length > 0) {
          setValidationErrors(errors);
          setProcessing(false);
          return;
        }
        alert('Écriture validée et insérée au journal');
      } else {
        alert('Brouillon sauvegardé');
      }
      
      if (!isEdit) {
        navigate(`/accounting/od/${saved.id}`);
      } else {
        loadData();
      }
    } catch (error: any) {
      console.error('Error saving OD:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleAnnuler = async () => {
    if (!confirm('Annuler cette pièce ? Des contre-écritures seront générées.')) return;
    setProcessing(true);
    try {
      await odApi.annulerOD(id!);
      loadData();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteOD = async () => {
    if (!confirm('Supprimer définitivement ce brouillon ?')) return;
    try {
      await odApi.deleteOD(id!);
      navigate('/accounting/od');
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-blue-600" /></div>;

  const isReadOnly = statut !== 'BROUILLON';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly || processing) return;
      
      // Ctrl+S to save draft
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave(true);
      }
      // Ctrl+Enter to validate
      if (e.ctrlKey && e.key === 'Enter') {
        if (isBalanced && libelleGeneral) {
          e.preventDefault();
          handleSave(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadOnly, processing, isBalanced, libelleGeneral, journal, dateEcriture]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/accounting/od')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEdit ? `Écriture ${numeroOd}` : 'Nouvelle Écriture Comptable'}
          </h1>
          {isEdit && (
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
              statut === 'BROUILLON' ? "bg-slate-100 text-slate-600 border-slate-200" :
              statut === 'VALIDEE' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
              "bg-rose-100 text-rose-700 border-rose-200 opacity-60"
            )}>
              {statut}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEdit && (
            <PDFDownloadLink 
              key={`${numeroOd}-${lines.length}`}
              document={<ODPdf od={{ numero_od: numeroOd, journal_code: journal, date_ecriture: dateEcriture, libelle: libelleGeneral }} lines={lines} />} 
              fileName={`${numeroOd}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" disabled={loading}>
                  <Printer className="w-4 h-4 mr-2" /> Impression
                </Button>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* ZONE 1: Header Piece */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Journal</label>
              <div className="relative">
                <Select value={journal} onChange={(e) => setJournal(e.target.value)} disabled={isReadOnly}>
                  <option value="OD">OD - Opérations Diverses</option>
                  <option value="BQ">BQ - Banque</option>
                  <option value="JR">JR - Journal de Recettes</option>
                  <option value="EX">EX - Exploitation</option>
                  <option value="AN">AN - À Nouveaux</option>
                </Select>
                {journalSuggestion && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md shadow-lg z-30 animate-in fade-in slide-in-from-top-1">
                    <p className="text-[10px] text-blue-700 font-medium mb-1">Compte 512 détecté. Passer au journal BQ ?</p>
                    <div className="flex gap-2">
                      <Button size="xs" className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700" onClick={() => { setJournal('BQ'); setJournalSuggestion(null); }}>Oui</Button>
                      <Button size="xs" variant="ghost" className="h-6 text-[10px] text-slate-500" onClick={() => setJournalSuggestion(null)}>Non</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date d'écriture</label>
              <Input 
                type="date" 
                value={dateEcriture} 
                onChange={(e) => setDateEcriture(e.target.value)} 
                max={new Date().toISOString().split('T')[0]}
                disabled={isReadOnly}
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Libellé Général</label>
              <Input 
                placeholder="Ex: Facture Plomberie - Le Mozart" 
                value={libelleGeneral} 
                onChange={(e) => setLibelleGeneral(e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ZONE 2: Simplified Double-Entry Form */}
      {!isReadOnly && (
        <Card className="border-slate-200 shadow-sm bg-slate-50/50">
          <CardHeader className="py-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Saisie Simplifiée (Débit / Crédit)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Libellé de ligne</label>
                <Input 
                  placeholder={lastLineLibelle || libelleGeneral || "Libellé de la ligne"} 
                  value={entryForm.libelle} 
                  onChange={(e) => setEntryForm({ ...entryForm, libelle: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLine()}
                />
              </div>
              
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Compte Débit
                </label>
                <CompteSearchSelect 
                  ref={accountInputRef}
                  value={entryForm.compte_debit?.compte_auxiliaire || entryForm.compte_debit?.compte_general || ''} 
                  onChange={(acc) => {
                    if (acc.compte_general.startsWith('512') && journal !== 'BQ') setJournalSuggestion('BQ');
                    setEntryForm({ ...entryForm, compte_debit: acc, tiers_debit: acc.tiers_id });
                  }}
                  placeholder="Compte à débiter..."
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Compte Crédit
                </label>
                <CompteSearchSelect 
                  value={entryForm.compte_credit?.compte_auxiliaire || entryForm.compte_credit?.compte_general || ''} 
                  onChange={(acc) => {
                    if (acc.compte_general.startsWith('512') && journal !== 'BQ') setJournalSuggestion('BQ');
                    setEntryForm({ ...entryForm, compte_credit: acc, tiers_credit: acc.tiers_id });
                  }}
                  placeholder="Compte à créditer..."
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Montant (€)</label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    step="0.01"
                    value={entryForm.montant || ''} 
                    onChange={(e) => setEntryForm({ ...entryForm, montant: parseFloat(e.target.value) || 0 })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLine()}
                    className="font-bold text-lg"
                  />
                  <Button onClick={handleAddLine} className="bg-slate-900 text-white px-8">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter l'opération
                  </Button>
                </div>
              </div>
            </div>

            {/* Validation Errors Box */}
            {validationErrors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-xs mb-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Erreurs de validation
                </div>
                <ul className="list-disc list-inside text-[10px] text-rose-600 space-y-0.5">
                  {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ZONE 3: Operations Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Compte Débit</th>
                <th className="px-4 py-3">Compte Crédit</th>
                <th className="px-4 py-3 text-right">Montant</th>
                {!isReadOnly && <th className="px-4 py-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 4 : 5} className="px-4 py-10 text-center text-slate-400 italic">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Aucune opération saisie
                  </td>
                </tr>
              ) : (
                lines.map((op, idx) => (
                  <tr key={idx} className={cn(
                    "hover:bg-slate-50 transition-colors",
                    statut === 'ANNULEE' && "line-through opacity-50"
                  )}>
                    <td className="px-4 py-3 font-medium text-slate-700">{op.libelle}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-blue-600 font-bold">{op.compte_debit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-rose-600 font-bold">{op.compte_credit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 text-lg">
                      {op.montant.toFixed(2)} €
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditLine(idx)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleRemoveLine(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {/* ZONE 4: Footer Totals */}
            <tfoot className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-4 py-4 text-right uppercase tracking-wider text-[10px] text-slate-500 font-bold">Total des opérations :</td>
                <td className="px-4 py-4 text-right text-xl font-black text-slate-900">
                  {lines.reduce((sum, op) => sum + op.montant, 0).toFixed(2)} €
                </td>
                {!isReadOnly && <td></td>}
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* ZONE 5: Action Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-slate-200 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="flex items-center gap-2">
          {statut === 'BROUILLON' && (
            <Button variant="outline" onClick={handleDeleteOD} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
            </Button>
          )}
          {statut === 'VALIDEE' && (
            <Button variant="outline" onClick={handleAnnuler} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <XCircle className="w-4 h-4 mr-2" /> Annuler cette pièce
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {statut === 'BROUILLON' && (
            <>
              <Button variant="outline" onClick={() => handleSave(true)} disabled={processing}>
                {processing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Sauvegarder Brouillon
              </Button>
              <Button 
                onClick={() => handleSave(false)} 
                disabled={processing || !isBalanced || !libelleGeneral}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {processing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Valider l'Écriture
              </Button>
            </>
          )}
          {statut === 'ANNULEE' && (
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-4 h-4" /> Pièce Annulée
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
