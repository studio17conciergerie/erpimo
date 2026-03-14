import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Upload, FileText, CheckCircle, Trash2, AlertCircle } from 'lucide-react';
import { BankMovement, banqueService } from '../banqueService';
import { nettoyerLigneBancaire } from '../banqueParser';
import { cn } from '@/lib/utils';

export default function ImportBanqueCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ date: '', libelle: '', montant: '' });
  const [preview, setPreview] = useState<BankMovement[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedCompte, setSelectedCompte] = useState('512000');
  const [result, setResult] = useState<{ success: number, total: number, compte: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
      
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvData(results.data);
            setHeaders(Object.keys(results.data[0] || {}));
          } else {
            setError("Le fichier CSV semble vide ou mal formaté.");
            setFile(null);
          }
        },
        error: (err) => {
          setError(`Erreur lors de la lecture du fichier: ${err.message}`);
          setFile(null);
        }
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  } as any);

  const updatePreview = (newMapping: typeof mapping) => {
    const cleaned = csvData
      .slice(0, 5)
      .map(row => nettoyerLigneBancaire(row, newMapping))
      .filter(Boolean) as BankMovement[];
    setPreview(cleaned);
  };

  const handleMappingChange = (field: keyof typeof mapping, value: string) => {
    const newMapping = { ...mapping, [field]: value };
    setMapping(newMapping);
    if (newMapping.date && newMapping.libelle && newMapping.montant) {
      updatePreview(newMapping);
    }
  };

  const handleImport = async () => {
    if (!mapping.date || !mapping.libelle || !mapping.montant) return;
    
    setIsImporting(true);
    setError(null);
    try {
      const allCleaned = csvData
        .map(row => nettoyerLigneBancaire(row, mapping))
        .filter(Boolean) as BankMovement[];
      
      if (allCleaned.length === 0) {
        setError("Aucune ligne valide n'a pu être extraite avec ce mapping.");
        return;
      }

      await banqueService.importMovements(allCleaned, selectedCompte);
      
      setResult({ success: allCleaned.length, total: csvData.length, compte: selectedCompte });
      setFile(null);
      setCsvData([]);
      setPreview([]);
      setMapping({ date: '', libelle: '', montant: '' });
    } catch (err: any) {
      console.error('Import error:', err);
      setError(`Erreur lors de l'importation: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            Importer un relevé bancaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200",
                isDragActive ? "border-emerald-500 bg-emerald-50 scale-[1.01]" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Glissez votre fichier CSV ici</p>
              <p className="text-slate-400 text-sm mt-1">Ou cliquez pour parcourir vos fichiers</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                      <FileText className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB • {csvData.length} lignes détectées</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compte de destination</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-sm"
                    value={selectedCompte}
                    onChange={(e) => setSelectedCompte(e.target.value)}
                  >
                    <option value="512000">512000 — Compte Séquestre (fonds mandants)</option>
                    <option value="512100">512100 — Compte Fonctionnement (agence)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Colonne Date</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    value={mapping.date}
                    onChange={(e) => handleMappingChange('date', e.target.value)}
                  >
                    <option value="">Sélectionner...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Colonne Libellé</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    value={mapping.libelle}
                    onChange={(e) => handleMappingChange('libelle', e.target.value)}
                  >
                    <option value="">Sélectionner...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Colonne Montant</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    value={mapping.montant}
                    onChange={(e) => handleMappingChange('montant', e.target.value)}
                  >
                    <option value="">Sélectionner...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {preview.length > 0 && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-emerald-500" />
                    Aperçu du nettoyage
                  </h4>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/50">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-tighter">
                        <tr>
                          <th className="px-4 py-3">Date ISO</th>
                          <th className="px-4 py-3">Libellé Nettoyé</th>
                          <th className="px-4 py-3 text-right">Montant Float</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.map((p, i) => (
                          <tr key={i} className="hover:bg-white transition-colors">
                            <td className="px-4 py-3 font-mono text-slate-600">{p.date_operation}</td>
                            <td className="px-4 py-3 truncate max-w-[250px] text-slate-900 font-medium">{p.libelle_banque}</td>
                            <td className={cn(
                              "px-4 py-3 text-right font-mono font-bold",
                              p.montant > 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {p.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button
                className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-bold transition-all disabled:opacity-50"
                disabled={!mapping.date || !mapping.libelle || !mapping.montant || isImporting}
                onClick={handleImport}
              >
                {isImporting ? 'Importation en cours...' : 'Confirmer l\'importation'}
              </Button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-in shake duration-300">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-4 animate-in zoom-in duration-300">
              <div className="bg-emerald-600 rounded-full p-2">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-lg">Importation terminée</p>
                <p className="text-sm text-emerald-700">
                  <span className="font-bold">{result.success}</span> mouvements ont été importés avec succès sur le compte <span className="font-bold">{result.compte}</span>. 
                  Les doublons basés sur le hash unique ont été automatiquement ignorés.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
