import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { 
  X, 
  Wrench, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Building2,
  MapPin
} from 'lucide-react';
import { interventionsApi } from '../interventionsApi';

interface NewInterventionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewInterventionModal({ isOpen, onClose, onSuccess }: NewInterventionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logements, setLogements] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    logement_id: '',
    fournisseur_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  async function loadOptions() {
    try {
      const [lData, fData] = await Promise.all([
        supabase.from('logements').select('id, nom'),
        supabase.from('tiers').select('id, nom').eq('type_tiers', 'FOURNISSEUR')
      ]);
      setLogements(lData.data || []);
      setFournisseurs(fData.data || []);
    } catch (err) {
      console.error('Error loading options:', err);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.logement_id) {
      setError('Veuillez sélectionner un logement');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await interventionsApi.createIntervention({
        titre: formData.titre,
        description: formData.description,
        logement_id: formData.logement_id,
        fournisseur_id: formData.fournisseur_id || undefined,
        statut: 'PLANIFIE'
      });

      onSuccess();
      onClose();
      setFormData({ titre: '', description: '', logement_id: '', fournisseur_id: '' });
    } catch (err: any) {
      console.error('Error creating intervention:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Wrench className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Nouvelle Intervention</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Titre de l'intervention *</label>
              <Input 
                required 
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex: Réparation fuite évier"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Logement *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    required
                    value={formData.logement_id}
                    onChange={(e) => setFormData({ ...formData, logement_id: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    {logements.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Prestataire</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    value={formData.fournisseur_id}
                    onChange={(e) => setFormData({ ...formData, fournisseur_id: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Non assigné</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Description / Notes</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Détails de l'intervention..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-slate-900 hover:bg-slate-800 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Créer l'intervention
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
