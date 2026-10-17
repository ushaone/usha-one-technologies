-- ONE AI Master preview only. Apply to isolated D1 staging database.
CREATE TABLE IF NOT EXISTS one_ai_drafts (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 product TEXT NOT NULL CHECK (product IN ('usha-one','neo-school-india')),
 lead_id TEXT NOT NULL,
 language TEXT NOT NULL CHECK (language IN ('en','te','hi')),
 message TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN ('draft','pending_approval','approved','rejected','sent')),
 created_by TEXT NOT NULL,
 approved_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 sent_at TEXT,
 version INTEGER NOT NULL CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS one_ai_drafts_tenant_lead ON one_ai_drafts(tenant_id,lead_id);
CREATE TABLE IF NOT EXISTS one_ai_events (
 id TEXT PRIMARY KEY,
 draft_id TEXT NOT NULL REFERENCES one_ai_drafts(id),
 tenant_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL,
 at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS one_ai_events_tenant_draft ON one_ai_events(tenant_id,draft_id);
