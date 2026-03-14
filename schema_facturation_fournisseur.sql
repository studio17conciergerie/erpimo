-- 1. Table des factures fournisseurs (regroupement logique)
CREATE TABLE factures_fournisseurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fournisseur_id UUID NOT NULL REFERENCES tiers(id),
    reference TEXT NOT NULL,
    date_creation DATE NOT NULL DEFAULT CURRENT_DATE,
    montant_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    statut TEXT NOT NULL CHECK (statut IN ('A_PAYER', 'PAYEE')) DEFAULT 'A_PAYER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des lignes de facture (liaison avec les réservations)
CREATE TABLE facture_fournisseur_lignes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facture_id UUID NOT NULL REFERENCES factures_fournisseurs(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    montant_ligne DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ajout de la colonne de liaison dans le journal des écritures
ALTER TABLE journal_ecritures ADD COLUMN facture_fournisseur_id UUID REFERENCES factures_fournisseurs(id);

-- Index pour la performance
CREATE INDEX idx_factures_fournisseurs_fournisseur ON factures_fournisseurs(fournisseur_id);
CREATE INDEX idx_facture_fournisseur_lignes_facture ON facture_fournisseur_lignes(facture_id);
CREATE INDEX idx_facture_fournisseur_lignes_reservation ON facture_fournisseur_lignes(reservation_id);
CREATE INDEX idx_journal_ecritures_facture_fournisseur ON journal_ecritures(facture_fournisseur_id);

-- 4. Trigger de sécurité comptable (Immuabilité)
CREATE OR REPLACE FUNCTION fn_check_facture_verrouillee()
RETURNS TRIGGER AS $$
DECLARE
    v_statut TEXT;
BEGIN
    IF OLD.facture_fournisseur_id IS NOT NULL THEN
        SELECT statut INTO v_statut FROM factures_fournisseurs WHERE id = OLD.facture_fournisseur_id;
        IF v_statut = 'PAYEE' THEN
            RAISE EXCEPTION 'Impossible de modifier une écriture liée à une facture déjà payée et rapprochée.';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.facture_fournisseur_id IS NOT NULL AND (OLD.facture_fournisseur_id IS NULL OR OLD.facture_fournisseur_id <> NEW.facture_fournisseur_id) THEN
        SELECT statut INTO v_statut FROM factures_fournisseurs WHERE id = NEW.facture_fournisseur_id;
        IF v_statut = 'PAYEE' THEN
            RAISE EXCEPTION 'Impossible de lier une écriture à une facture déjà payée.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_facture_verrouillee ON journal_ecritures;
CREATE TRIGGER trg_check_facture_verrouillee
BEFORE UPDATE OR DELETE ON journal_ecritures
FOR EACH ROW EXECUTE FUNCTION fn_check_facture_verrouillee();

-- 5. RLS et Politiques
ALTER TABLE factures_fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_fournisseur_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON factures_fournisseurs;
CREATE POLICY "Enable all access for all users" ON factures_fournisseurs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON facture_fournisseur_lignes;
CREATE POLICY "Enable all access for all users" ON facture_fournisseur_lignes FOR ALL USING (true) WITH CHECK (true);
