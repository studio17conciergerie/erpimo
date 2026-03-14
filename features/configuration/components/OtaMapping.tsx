import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Loader2, Trash2, Plus, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OtaMapping {
  id: string;
  label_csv: string;
  plateforme_tiers_id: string;
  tiers?: {
    nom: string;
    code_auxiliaire: string;
  };
}

interface UnmappedSource {
  source: string;
  count: number;
}

export default function OtaMapping() {
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<OtaMapping[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [unmappedSources, setUnmappedSources] = useState<UnmappedSource[]>([]);
  
  const [newMapping, setNewMapping] = useState({ label_csv: '', plateforme_tiers_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load existing mappings
      const { data: mappingData, error: mappingError } = await supabase
        .from('ota_source_mapping')
        .select(`
          id,
          label_csv,
          plateforme_tiers_id,
          tiers:plateforme_tiers_id(nom, code_auxiliaire)
        `)
        .order('label_csv');

      if (mappingError) throw mappingError;
      setMappings(mappingData || []);

      // 2. Load OTA platforms
      const { data: platformData, error: platformError } = await supabase
        .from('tiers')
        .select('id, nom, code_auxiliaire')
        .eq('type_tiers', 'PLATEFORME_OTA')
        .order('nom');

      if (platformError) throw platformError;
      setPlatforms(platformData || []);

      // 3. Find unmapped sources in reservations
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('source');

      if (resError) throw resError;

      const mappedLabels = new Set((mappingData || []).map(m => m.label_csv));
      const unmappedCounts = new Map<string, number>();

      resData?.forEach(res => {
        if (res.source && !mappedLabels.has(res.source)) {
          unmappedCounts.set(res.source, (unmappedCounts.get(res.source) || 0) + 1);
        }
      });

      const unmappedArray = Array.from(unmappedCounts.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      setUnmappedSources(unmappedArray);

    } catch (err: any) {
      console.error('Error loading OTA mappings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapping.label_csv || !newMapping.plateforme_tiers_id) return;

    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('ota_source_mapping')
        .insert({
          label_csv: newMapping.label_csv,
          plateforme_tiers_id: newMapping.plateforme_tiers_id
        });

      if (error) throw error;
      
      setNewMapping({ label_csv: '', plateforme_tiers_id: '' });
      await loadData();
    } catch (err: any) {
      console.error('Error adding mapping:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce mapping ?')) return;

    try {
      const { error } = await supabase
        .from('ota_source_mapping')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error deleting mapping:', err);
      alert('Erreur lors de la suppression: ' + err.message);
    }
  };

  const handleCreateFromUnmapped = (source: string) => {
    setNewMapping({ ...newMapping, label_csv: source });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mapping des Plateformes OTA</h1>
        <p className="text-slate-500">Associez les sources des réservations importées (CSV/API) aux tiers comptables correspondants.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Add Mapping Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Nouveau Mapping
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMapping} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="label_csv">Source exacte (CSV/API)</Label>
                  <Input 
                    id="label_csv" 
                    placeholder="ex: Airbnb, Booking.com..." 
                    value={newMapping.label_csv}
                    onChange={(e) => setNewMapping({ ...newMapping, label_csv: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="plateforme_tiers_id">Plateforme Comptable (Tiers)</Label>
                  <select
                    id="plateforme_tiers_id"
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    value={newMapping.plateforme_tiers_id}
                    onChange={(e) => setNewMapping({ ...newMapping, plateforme_tiers_id: e.target.value })}
                    required
                  >
                    <option value="">Sélectionner une plateforme...</option>
                    {platforms.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} ({p.code_auxiliaire})</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing Mappings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-emerald-500" />
                Mappings Actuels
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                    <tr>
                      <th className="px-6 py-3">Source (Label)</th>
                      <th className="px-6 py-3">Plateforme Associée</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappings.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500 italic">
                          Aucun mapping configuré.
                        </td>
                      </tr>
                    ) : (
                      mappings.map((mapping) => (
                        <tr key={mapping.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {mapping.label_csv}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{mapping.tiers?.nom}</span>
                              <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                {mapping.tiers?.code_auxiliaire}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteMapping(mapping.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

        {/* Unmapped Sources Sidebar */}
        <div className="space-y-6">
          <Card className={cn("border-amber-200", unmappedSources.length > 0 ? "bg-amber-50/30" : "")}>
            <CardHeader className="pb-3 border-b border-amber-100">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-5 h-5" />
                Sources Non Mappées
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {unmappedSources.length === 0 ? (
                <div className="p-6 text-center text-emerald-600 text-sm">
                  Toutes les sources de vos réservations sont mappées !
                </div>
              ) : (
                <div className="divide-y divide-amber-100">
                  {unmappedSources.map((item) => (
                    <div key={item.source} className="p-4 flex items-center justify-between hover:bg-amber-50 transition-colors">
                      <div>
                        <p className="font-medium text-slate-900">{item.source}</p>
                        <p className="text-xs text-slate-500">{item.count} réservation{item.count > 1 ? 's' : ''}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCreateFromUnmapped(item.source)}
                        className="text-xs h-8"
                      >
                        Créer
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
