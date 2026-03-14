import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseReservationsCSV, ParsedReservation } from './csvParser';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Upload, AlertCircle, CheckCircle, XCircle, FileUp, UserPlus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { voyageurMatcher, VoyageurMatch } from '../voyageurMatcher';

type ImportStatus = 'idle' | 'parsing' | 'validating' | 'importing' | 'success' | 'error';

type EnrichedReservation = ParsedReservation & {
  logement_id?: string;
  logement_nom?: string;
  voyageur_id?: string;
  voyageur_status?: 'existing' | 'new';
  isDuplicate?: boolean;
  importStatus?: 'ready' | 'duplicate' | 'error';
};

export default function ImportReservationsCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [reservations, setReservations] = useState<EnrichedReservation[]>([]);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stats, setStats] = useState({ new: 0, duplicates: 0, errors: 0, newVoyageurs: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      handleParse(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  } as any);

  const handleParse = async (csvFile: File) => {
    setStatus('parsing');
    try {
      const parsed = await parseReservationsCSV(csvFile);
      await validateReservations(parsed);
    } catch (error) {
      console.error('Parse error:', error);
      setStatus('error');
    }
  };

  const validateReservations = async (parsed: ParsedReservation[]) => {
    setStatus('validating');
    
    // 1. Get all Listing IDs from CSV
    const listingIds = [...new Set(parsed.map(r => r.listing_id).filter(Boolean))];
    
    // 2. Fetch corresponding Logements
    const { data: logements } = await supabase
      .from('logements')
      .select('id, nom, listing_id')
      .in('listing_id', listingIds);
      
    const logementMap = new Map(logements?.map(l => [l.listing_id, l]));

    // 3. Check for duplicates in DB (Confirmation Codes)
    const confirmationCodes = parsed.map(r => r.confirmation_code).filter(Boolean);
    const { data: existingRes } = await supabase
      .from('reservations')
      .select('confirmation_code')
      .in('confirmation_code', confirmationCodes);
      
    const existingCodes = new Set(existingRes?.map(r => r.confirmation_code));

    // 4. Match Voyageurs (Preview mode)
    const guestNames = parsed.map(r => r.guest_name);
    const voyageurMatches = await voyageurMatcher.matchOrCreateVoyageurs(guestNames, false);

    // 5. Enrich data
    let newCount = 0;
    let dupCount = 0;
    let errCount = 0;
    let newVoyCount = 0;

    const enriched = parsed.map(r => {
      const logement = logementMap.get(r.listing_id);
      const isDuplicate = existingCodes.has(r.confirmation_code);
      const hasLogement = !!logement;
      
      const voyageurMatch = voyageurMatches.get(r.guest_name);
      const isNewVoyageur = voyageurMatch?.isNew;
      
      let importStatus: 'ready' | 'duplicate' | 'error' = 'ready';
      
      if (!r.isValid || !hasLogement) {
        importStatus = 'error';
        errCount++;
        if (!hasLogement && r.isValid) r.errors.push(`Logement introuvable (ID: ${r.listing_id})`);
      } else if (isDuplicate) {
        importStatus = 'duplicate';
        dupCount++;
      } else {
        newCount++;
        if (isNewVoyageur) newVoyCount++;
      }

      return {
        ...r,
        logement_id: logement?.id,
        logement_nom: logement?.nom,
        voyageur_id: voyageurMatch?.id,
        voyageur_status: isNewVoyageur ? 'new' : 'existing',
        isDuplicate,
        importStatus
      } as EnrichedReservation;
    });

    setReservations(enriched);
    setStats({ new: newCount, duplicates: dupCount, errors: errCount, newVoyageurs: newVoyCount });
    setStatus('idle');
  };

  const handleImport = async () => {
    setStatus('importing');
    const toImport = reservations.filter(r => r.importStatus === 'ready');
    
    if (toImport.length === 0) {
      setStatus('idle');
      return;
    }

    try {
      // 1. Create/Match Voyageurs in Batch
      const guestNames = toImport.map(r => r.guest_name);
      const voyageurMatches = await voyageurMatcher.matchOrCreateVoyageurs(guestNames);
      
      setProgress({ current: 0, total: toImport.length });

      // 2. Process Reservations
      let successCount = 0;
      let createdVoyCount = 0;
      
      // Count how many were actually new
      voyageurMatches.forEach(v => { if (v.isNew) createdVoyCount++; });

      for (const res of toImport) {
        const voyageur = voyageurMatches.get(res.guest_name);
        
        const { error: insertError } = await supabase
          .from('reservations')
          .insert({
            logement_id: res.logement_id,
            listing_id: res.listing_id,
            voyageur_id: voyageur?.id,
            source: res.source,
            confirmation_code: res.confirmation_code,
            guest_name: res.guest_name,
            check_in: res.check_in,
            check_out: res.check_out,
            nb_nuits: res.nb_nuits,
            payout_net: res.payout_net,
            commission_ota: res.commission_ota,
            frais_traitement_ota: res.frais_traitement_ota,
            statut_workflow: 'BROUILLON',
            nickname: res.nickname
          });

        if (insertError) {
          console.error(`Failed to insert reservation ${res.confirmation_code}`, insertError);
          continue;
        }

        successCount++;
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      setStatus('success');
      setStats(prev => ({ ...prev, new: successCount, newVoyageurs: createdVoyCount }));
    } catch (err) {
      console.error('Import error:', err);
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Import Réservations</h1>
        <p className="text-slate-500">Importez vos fichiers CSV Airbnb ou Booking.com avec création automatique des voyageurs.</p>
      </div>

      {/* Upload Area */}
      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
          isDragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-slate-400 bg-slate-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto text-slate-400 mb-4" />
        {isDragActive ? (
          <p className="text-emerald-600 font-medium">Déposez le fichier ici...</p>
        ) : (
          <div>
            <p className="text-slate-700 font-medium">Glissez votre fichier CSV ici, ou cliquez pour parcourir</p>
            <p className="text-sm text-slate-500 mt-2">Supporte les formats Airbnb et Booking.com</p>
          </div>
        )}
      </div>

      {/* Stats & Actions */}
      {reservations.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="font-medium">{stats.new} Nouveaux</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="font-medium">{stats.newVoyageurs} Nouveaux Voyageurs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="font-medium">{stats.duplicates} Doublons</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="font-medium">{stats.errors} Erreurs</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setReservations([]); setFile(null); setStatus('idle'); }}>
              Annuler
            </Button>
            <Button onClick={handleImport} disabled={stats.new === 0 || status === 'importing' || status === 'success'}>
              {status === 'importing' ? `Import en cours... (${progress.current}/${progress.total})` : 
               status === 'success' ? 'Import Réussi !' : 
               `Importer ${stats.new} réservations`}
            </Button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {status === 'success' && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-md flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          <div>
            <p className="font-bold">Import terminé avec succès !</p>
            <p className="text-sm">
              {stats.new} réservations ajoutées. {stats.newVoyageurs} nouveaux voyageurs créés dans le répertoire.
            </p>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {reservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prévisualisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-200 overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Logement</th>
                    <th className="px-4 py-3">Voyageur</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3 text-right">Montant Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {reservations.map((r, idx) => (
                    <tr key={idx} className={cn(
                      "hover:bg-slate-50",
                      r.importStatus === 'error' && "bg-red-50 hover:bg-red-100",
                      r.importStatus === 'duplicate' && "bg-amber-50 hover:bg-amber-100"
                    )}>
                      <td className="px-4 py-3">
                        {r.importStatus === 'ready' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        {r.importStatus === 'duplicate' && <AlertCircle className="h-4 w-4 text-amber-500" />}
                        {r.importStatus === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                      </td>
                      <td className="px-4 py-3">{r.source}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.confirmation_code}</td>
                      <td className="px-4 py-3">
                        {r.logement_nom ? (
                          <span className="font-medium text-slate-900">{r.logement_nom}</span>
                        ) : (
                          <span className="text-red-600 font-medium">Inconnu ({r.listing_id})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{r.guest_name}</span>
                          {r.voyageur_status === 'new' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase">
                              <UserPlus className="h-2.5 w-2.5" /> Nouveau
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase">
                              <UserCheck className="h-2.5 w-2.5" /> Existant
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.check_in ? format(r.check_in, 'dd/MM/yy') : '?'} → {r.check_out ? format(r.check_out, 'dd/MM/yy') : '?'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(r.payout_net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
