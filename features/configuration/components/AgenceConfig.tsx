import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Label } from '@/components/Label';
import { Loader2, Save, Building, ShieldCheck, CreditCard } from 'lucide-react';

export default function AgenceConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    nom: '',
    adresse: '',
    siret: '',
    carte_professionnelle: '',
    prefecture_carte: '',
    garant_nom: '',
    garant_montant: '',
    iban_sequestre: '',
    bic_sequestre: '',
    banque_sequestre: '',
    iban_fonctionnement: '',
    bic_fonctionnement: '',
    taux_tva_defaut: 20
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuration_agence')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData({
          id: data.id,
          nom: data.nom || '',
          adresse: data.adresse || '',
          siret: data.siret || '',
          carte_professionnelle: data.carte_professionnelle || '',
          prefecture_carte: data.prefecture_carte || '',
          garant_nom: data.garant_nom || '',
          garant_montant: data.garant_montant || '',
          iban_sequestre: data.iban_sequestre || '',
          bic_sequestre: data.bic_sequestre || '',
          banque_sequestre: data.banque_sequestre || '',
          iban_fonctionnement: data.iban_fonctionnement || '',
          bic_fonctionnement: data.bic_fonctionnement || '',
          taux_tva_defaut: data.taux_tva_defaut || 20
        });
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = { ...formData };
      if (!payload.id) {
        delete (payload as any).id;
      }

      const { error } = await supabase
        .from('configuration_agence')
        .upsert(payload)
        .select();

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Configuration sauvegardée avec succès.' });
      if (!formData.id) {
        loadConfig(); // Reload to get the new ID
      }
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde:', err);
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuration de l'Agence</h1>
        <p className="text-slate-500">Paramètres légaux et financiers de votre agence immobilière.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="w-5 h-5 text-blue-500" />
              Informations Générales
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom de l'agence</Label>
              <Input id="nom" name="nom" value={formData.nom} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input id="siret" name="siret" value={formData.siret} onChange={handleChange} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="adresse">Adresse complète</Label>
              <Input id="adresse" name="adresse" value={formData.adresse} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taux_tva_defaut">Taux de TVA par défaut (%)</Label>
              <Input id="taux_tva_defaut" name="taux_tva_defaut" type="number" step="0.1" value={formData.taux_tva_defaut} onChange={handleChange} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Loi Hoguet & Garantie Financière
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carte_professionnelle">N° Carte Professionnelle</Label>
              <Input id="carte_professionnelle" name="carte_professionnelle" value={formData.carte_professionnelle} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefecture_carte">Préfecture de délivrance</Label>
              <Input id="prefecture_carte" name="prefecture_carte" value={formData.prefecture_carte} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garant_nom">Nom du Garant Financier</Label>
              <Input id="garant_nom" name="garant_nom" value={formData.garant_nom} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garant_montant">Montant de la garantie (€)</Label>
              <Input id="garant_montant" name="garant_montant" type="number" value={formData.garant_montant} onChange={handleChange} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="w-5 h-5 text-violet-500" />
              Coordonnées Bancaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 border-b pb-2">Compte Séquestre (Loi Hoguet)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banque_sequestre">Nom de la banque</Label>
                  <Input id="banque_sequestre" name="banque_sequestre" value={formData.banque_sequestre} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bic_sequestre">BIC</Label>
                  <Input id="bic_sequestre" name="bic_sequestre" value={formData.bic_sequestre} onChange={handleChange} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="iban_sequestre">IBAN</Label>
                  <Input id="iban_sequestre" name="iban_sequestre" value={formData.iban_sequestre} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 border-b pb-2">Compte de Fonctionnement</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iban_fonctionnement">IBAN</Label>
                  <Input id="iban_fonctionnement" name="iban_fonctionnement" value={formData.iban_fonctionnement} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bic_fonctionnement">BIC</Label>
                  <Input id="bic_fonctionnement" name="bic_fonctionnement" value={formData.bic_fonctionnement} onChange={handleChange} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer la configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
