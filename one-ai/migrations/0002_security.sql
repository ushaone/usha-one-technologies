-- Additive migration. Dedicated ONE AI database only; never apply to a CRM database.
CREATE TABLE one_ai_instance (singleton INTEGER PRIMARY KEY CHECK(singleton=1), product TEXT NOT NULL CHECK(product IN ('usha-one','neo-school-india')));
CREATE TABLE one_ai_principals (
 tenant_id TEXT NOT NULL, actor_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('staff','manager','admin','viewer')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), auth_version INTEGER NOT NULL DEFAULT 1 CHECK(auth_version>=1),
 PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE one_ai_rate_limits (
 tenant_id TEXT NOT NULL, actor_id TEXT NOT NULL, kind TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,actor_id,kind)
);
ALTER TABLE one_ai_drafts ADD COLUMN reviewed_by TEXT;
ALTER TABLE one_ai_drafts ADD COLUMN last_edited_by TEXT;
ALTER TABLE one_ai_drafts ADD COLUMN last_actor TEXT;
ALTER TABLE one_ai_drafts ADD COLUMN last_action TEXT;
ALTER TABLE one_ai_drafts ADD COLUMN request_key TEXT;
ALTER TABLE one_ai_drafts ADD COLUMN request_hash TEXT;
ALTER TABLE one_ai_drafts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE one_ai_events ADD COLUMN version INTEGER;
CREATE UNIQUE INDEX one_ai_request_key ON one_ai_drafts(tenant_id,created_by,request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX one_ai_event_version ON one_ai_events(tenant_id,draft_id,version) WHERE version IS NOT NULL;
CREATE TRIGGER one_ai_product_insert BEFORE INSERT ON one_ai_drafts BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM one_ai_instance WHERE singleton=1 AND product=NEW.product) THEN RAISE(ABORT,'Product isolation violation') END;
 SELECT CASE WHEN NEW.last_actor IS NULL OR NEW.last_action!='create' OR NEW.state!='draft' OR NEW.version!=1 THEN RAISE(ABORT,'Invalid creation') END;
END;
CREATE TRIGGER one_ai_draft_update_guard BEFORE UPDATE ON one_ai_drafts BEGIN
 SELECT CASE WHEN NEW.id!=OLD.id OR NEW.tenant_id!=OLD.tenant_id OR NEW.product!=OLD.product OR NEW.lead_id!=OLD.lead_id OR NEW.created_by!=OLD.created_by OR NEW.language!=OLD.language OR NEW.created_at!=OLD.created_at OR NEW.source!=OLD.source OR NEW.request_key IS NOT OLD.request_key OR NEW.request_hash IS NOT OLD.request_hash THEN RAISE(ABORT,'Immutable draft identity') END;
 SELECT CASE WHEN NEW.version!=OLD.version+1 OR NEW.last_actor IS NULL OR NEW.last_action IS NULL OR NEW.last_action NOT IN ('edit','submit','approve','reject') THEN RAISE(ABORT,'Invalid transition') END;
END;
CREATE TRIGGER one_ai_audit_create AFTER INSERT ON one_ai_drafts BEGIN
 INSERT INTO one_ai_events(id,draft_id,tenant_id,actor_id,action,at,version)
 VALUES(lower(hex(randomblob(16))),NEW.id,NEW.tenant_id,NEW.last_actor,'create',NEW.updated_at,NEW.version);
END;
CREATE TRIGGER one_ai_audit_transition AFTER UPDATE ON one_ai_drafts BEGIN
 INSERT INTO one_ai_events(id,draft_id,tenant_id,actor_id,action,at,version)
 VALUES(lower(hex(randomblob(16))),NEW.id,NEW.tenant_id,NEW.last_actor,NEW.last_action,NEW.updated_at,NEW.version);
END;
CREATE TRIGGER one_ai_audit_no_update BEFORE UPDATE ON one_ai_events BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER one_ai_audit_no_delete BEFORE DELETE ON one_ai_events BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
