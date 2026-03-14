import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { accountingEngine } from '../accountingEngine';
import { 
  ArrowLeft, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Undo2,
  Save,
  FileText,
  History,
  Pencil,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PieceComptable {
  id: string;
  numero_piece: string;
  journal_code: string;
  date_piece: string;
  libelle_piece: string;
  source_type: 'RESERVATION' | 'OPERATION_DIVERSE' | 'RAPPROCHEMENT' | 'REDDITION' | 'CAUTION';
  source_id: string;
  created_at: string;
}

interface JournalLine {
  id: string;
  date_ecriture: string;
  libelle: string;
  compte_debit: string;
  compte_credit: string;
  montant: number;
  tiers_id?: string;
  lettrage?: string;
}

export default function PieceComptableDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [piece, setPiece] = useState<PieceComptable | null>(null);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [sourceData, setSourceData] = useState<any>(null);
  const [editedLibellePiece, setEditedLibellePiece] = useState('');
  const [editedLines, setEditedLines] = useState<Record<string, string>>({});
  const [reversing, setReversing] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch Piece
      const { data: pieceData, error: pieceError } = await supabase
        .from('pieces_comptables')
        .select('*')
        .eq('id', id)
        .single();

      if (pieceError) throw pieceError;
      setPiece(pieceData);
      setEditedLibellePiece(pieceData.libelle_piece);

      // 2. Fetch Lines
      const { data: linesData, error: linesError } = await supabase
        .from('journal_ecritures')
        .select('*')
        .eq('piece_comptable_id', id)
        .order('created_at', { ascending: true });

      if (linesError) throw linesError;
      setLines(linesData);

      // 3. Fetch Source Info
      if (pieceData.source_id) {
        let sourceTable = '';
        if (pieceData.source_type === 'RESERVATION') sourceTable = 'reservations';
        else if (pieceData.source_type === 'OPERATION_DIVERSE') sourceTable = 'operations_diverses';
        else if (pieceData.source_type === 'RAPPROCHEMENT') sourceTable = 'mouvements_bancaires';
        else if (pieceData.source_type === 'REDDITION') sourceTable = 'releves_gestion';

        if (sourceTable) {
          const { data: sData } = await supabase
            .from(sourceTable)
            .select('*')
            .eq('id', pieceData.source_id)
            .single();
          setSourceData(sData);
        }
      }
    } catch (error) {
      console.error('Error loading piece detail:', error);
      toast.error('Erreur lors du chargement de la pièce comptable');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    if (!piece) return;
    setSaving(true);
    try {
      // Update Piece Libelle
      if (editedLibellePiece !== piece.libelle_piece) {
        const { error } = await supabase
          .from('pieces_comptables')
          .update({ libelle_piece: editedLibellePiece })
          .eq('id', piece.id);
        if (error) throw error;
      }

      // Update Lines Libelles
      for (const [lineId, newLibelle] of Object.entries(editedLines)) {
        const { error } = await supabase
          .from('journal_ecritures')
          .update({ libelle: newLibelle })
          .eq('id', lineId);
        if (error) throw error;
      }

      toast.success('Modifications enregistrées');
      loadData();
      setEditedLines({});
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleContrePasser = async () => {
    if (!piece || lines.length === 0) return;
    setReversing(true);
    try {
      // Invert entries
      const reversalEntries = lines.map(line => ({
        date_ecriture: format(new Date(), 'yyyy-MM-dd'),
        libelle: `ANNULATION: ${line.libelle}`,
        compte_debit: line.compte_credit, // Inversion
        compte_credit: line.compte_debit, // Inversion
        montant: line.montant,
        tiers_id: line.tiers_id,
        lettrage: line.lettrage // Keep lettrage if any (though button hidden if lettrage exists)
      }));

      const newPiece = await accountingEngine.createPieceAndEntries(
        piece.journal_code,
        format(new Date(), 'yyyy-MM-dd'),
        `ANNULATION: ${piece.libelle_piece}`,
        'OPERATION_DIVERSE', // Reversals are usually ODs
        piece.id, // source_id is the original piece
        reversalEntries
      );

      toast.success('Pièce de contre-passation créée');
      navigate(`/accounting/piece/${newPiece.id}`);
    } catch (error: any) {
      console.error('Error reversing piece:', error);
      toast.error(`Erreur lors de la contre-passation: ${error.message}`);
    } finally {
      setReversing(false);
      setShowReversalModal(false);
    }
  };

  const totals = lines.reduce((acc, curr) => ({
    debit: acc.debit + Number(curr.montant),
    credit: acc.credit + Number(curr.montant)
  }), { debit: 0, credit: 0 });

  const diff = Math.abs(totals.debit - totals.credit);

  const getSourceUrl = () => {
    if (!piece) return '';
    if (piece.source_type === 'RESERVATION') return `/reservations/${piece.source_id}`;
    if (piece.source_type === 'OPERATION_DIVERSE') return `/accounting/od/${piece.source_id}`;
    if (piece.source_type === 'RAPPROCHEMENT') return `/bank`;
    if (piece.source_type === 'REDDITION') return `/accounting/mandant`;
    return '';
  };

  const getSourceLabel = () => {
    if (!piece) return '';
    switch (piece.source_type) {
      case 'RESERVATION': return 'Réservation';
      case 'OPERATION_DIVERSE': return 'Opération Diverse';
      case 'RAPPROCHEMENT': return 'Rapprochement Bancaire';
      case 'REDDITION': return 'Reddition de comptes';
      case 'CAUTION': return 'Gestion Caution';
      default: return piece.source_type;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500">Chargement de la pièce comptable...</p>
      </div>
    );
  }

  if (!piece) {
    return (
      <div className="text-center p-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Pièce introuvable</h2>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

  const canRegenerate = piece.source_type === 'RESERVATION' && 
    (sourceData?.statut_workflow === 'BROUILLON' || sourceData?.statut_workflow === 'ATTENTE_PAIEMENT');

  const isReconciled = lines.some(l => !!l.lettrage);
  const isEditable = !isReconciled && piece.source_type !== 'RAPPROCHEMENT';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Reversal Confirmation Modal */}
      {showReversalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-600">
                <Undo2 className="w-5 h-5" /> Confirmer la contre-passation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Vous allez créer une pièce comptable d'annulation qui inversera toutes les écritures de cette pièce ({piece.numero_piece}).
              </p>
              <p className="text-sm font-medium text-slate-900">
                Cette action est irréversible. Voulez-vous continuer ?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowReversalModal(false)} disabled={reversing}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleContrePasser} disabled={reversing}>
                  {reversing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Undo2 className="w-4 h-4 mr-2" />}
                  Confirmer l'annulation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{piece.numero_piece}</h1>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                Journal {piece.journal_code}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Créée le {format(new Date(piece.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isReconciled && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowReversalModal(true)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Contre-passer
            </Button>
          )}
          {canRegenerate && (
            <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Régénérer
            </Button>
          )}
          {isEditable && (
            <Button 
              onClick={handleSave} 
              disabled={saving || (editedLibellePiece === piece.libelle_piece && Object.keys(editedLines).length === 0)}
              className="gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Informations Générales
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Date de la pièce</label>
                  <p className="font-medium">{format(new Date(piece.date_piece), 'dd/MM/yyyy')}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Source</label>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase">
                      {getSourceLabel()}
                    </span>
                    <Link to={getSourceUrl()} className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                      Voir l'original <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Libellé Principal</label>
                <Input 
                  value={editedLibellePiece} 
                  onChange={(e) => setEditedLibellePiece(e.target.value)}
                  className="font-medium"
                  disabled={!isEditable}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Lignes d'écritures
              </CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totals.debit)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Libellé de ligne</th>
                    <th className="px-4 py-3 w-24">Débit</th>
                    <th className="px-4 py-3 w-24">Crédit</th>
                    <th className="px-4 py-3 w-20">Lettrage</th>
                    <th className="px-4 py-3 text-right w-32">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2">
                        <Input 
                          value={editedLines[line.id] ?? line.libelle}
                          onChange={(e) => setEditedLines(prev => ({ ...prev, [line.id]: e.target.value }))}
                          className="h-8 text-xs border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent"
                          disabled={!isEditable}
                        />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-blue-600">{line.compte_debit}</td>
                      <td className="px-4 py-2 font-mono text-xs text-indigo-600">{line.compte_credit}</td>
                      <td className="px-4 py-2">
                        {line.lettrage && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                            {line.lettrage}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs font-bold">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                  <tr>
                    <td className="px-4 py-3 text-right text-slate-500 uppercase text-[10px]">Total équilibré</td>
                    <td colSpan={2}></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totals.debit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={cn(
            "border-2",
            diff < 0.01 ? "border-emerald-200 bg-emerald-50/30" : "border-rose-200 bg-rose-50/30"
          )}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              {diff < 0.01 ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                  <h3 className="text-lg font-bold text-emerald-900">Pièce Équilibrée</h3>
                  <p className="text-emerald-700 text-xs mt-1">Conformité FEC respectée</p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                  <h3 className="text-lg font-bold text-rose-900">Déséquilibre Détecté</h3>
                  <p className="text-rose-700 text-xs mt-1">Écart de {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(diff)}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Actions & Historique
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <Button variant="outline" className="w-full justify-start text-slate-600" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Exporter en PDF
              </Button>
              <Button variant="outline" className="w-full justify-start text-slate-600" size="sm">
                <History className="w-4 h-4 mr-2" />
                Journal d'audit
              </Button>
              
              {!canRegenerate && piece.source_type === 'RESERVATION' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Cette pièce est verrouillée car la réservation est déjà encaissée ou en cours de reddition. 
                      Pour corriger, utilisez une contre-passation via OD.
                    </p>
                  </div>
                  <Button variant="ghost" className="w-full mt-2 text-blue-600 hover:text-blue-700 h-8 text-xs" onClick={() => navigate('/accounting/od')}>
                    <Undo2 className="w-3 h-3 mr-2" />
                    Contre-passer (OD)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
