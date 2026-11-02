-- Apply only to the isolated LEAD+ database, never through the CRM/Auth migration chain.
BEGIN;
DO $$ BEGIN
  IF to_regclass('c2s_app.leads') IS NULL OR to_regclass('c2s_app.contacts') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'c2s_backend_scope') THEN
    RAISE EXCEPTION 'Existing private LEAD+ schema and backend role are required';
  END IF;
END $$;

CREATE TABLE c2s_app.wa_accounts (
  id uuid PRIMARY KEY,
  organization_id text NOT NULL CHECK (length(organization_id) BETWEEN 1 AND 120),
  app_id text NOT NULL CHECK (app_id ~ '^[0-9]{5,30}$'),
  waba_id text NOT NULL CHECK (waba_id ~ '^[0-9]{5,30}$'),
  phone_number_id text NOT NULL UNIQUE CHECK (phone_number_id ~ '^[0-9]{5,30}$'),
  display_phone_number text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  graph_version text NOT NULL CHECK (graph_version ~ '^v[0-9]+\.[0-9]+$'),
  secret_ciphertext text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'unverified',
  team text NOT NULL DEFAULT '',
  distribution_mode text NOT NULL DEFAULT 'shared' CHECK (distribution_mode IN ('shared','automatic','manual')),
  max_conversations integer NOT NULL DEFAULT 10 CHECK (max_conversations BETWEEN 1 AND 1000),
  next_index bigint NOT NULL DEFAULT 0,
  retention_days integer NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 1 AND 3650),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE TABLE c2s_app.wa_contacts (
  organization_id text NOT NULL, account_id uuid NOT NULL, wa_id text NOT NULL CHECK (wa_id ~ '^[0-9]{7,20}$'),
  contact_id uuid NOT NULL REFERENCES c2s_app.contacts(id),
  PRIMARY KEY (organization_id,account_id,wa_id),
  FOREIGN KEY (organization_id,account_id) REFERENCES c2s_app.wa_accounts(organization_id,id)
);
CREATE INDEX wa_contacts_contact_idx ON c2s_app.wa_contacts(contact_id);
CREATE TABLE c2s_app.wa_conversations (
  id uuid PRIMARY KEY, organization_id text NOT NULL, account_id uuid NOT NULL, wa_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES c2s_app.contacts(id), lead_id uuid NOT NULL UNIQUE REFERENCES c2s_app.leads(id),
  assigned_user_id text, assigned_user_kind text GENERATED ALWAYS AS ('users') STORED,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','closed')),
  team text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'whatsapp',
  source_campaign_id text, source_campaign_name text, referral jsonb NOT NULL DEFAULT '{}',
  interest text NOT NULL DEFAULT '', tags text[] NOT NULL DEFAULT '{}',
  last_customer_message_at timestamptz, last_message_at timestamptz, last_message_preview text NOT NULL DEFAULT '',
  first_human_response_at timestamptz, assigned_at timestamptz, closed_at timestamptz,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,account_id,wa_id) REFERENCES c2s_app.wa_contacts(organization_id,account_id,wa_id),
  FOREIGN KEY (assigned_user_kind,assigned_user_id) REFERENCES c2s_app.resources(kind,id),
  CHECK ((status='active') = (assigned_user_id IS NOT NULL) OR status='closed')
);
CREATE UNIQUE INDEX wa_conversations_active_contact_idx ON c2s_app.wa_conversations(organization_id,account_id,wa_id) WHERE status <> 'closed';
CREATE INDEX wa_conversations_queue_idx ON c2s_app.wa_conversations(organization_id,team,status,last_message_at DESC,id);
CREATE INDEX wa_conversations_owner_idx ON c2s_app.wa_conversations(organization_id,assigned_user_id,status);
CREATE INDEX wa_conversations_contact_idx ON c2s_app.wa_conversations(contact_id);
CREATE TABLE c2s_app.wa_messages (
  id uuid PRIMARY KEY, organization_id text NOT NULL, account_id uuid NOT NULL, conversation_id uuid NOT NULL,
  provider_id text, client_message_id uuid, direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  type text NOT NULL CHECK (type IN ('text','image','document','audio','video','sticker','location','contacts','interactive','template','unsupported')),
  content jsonb NOT NULL DEFAULT '{}', media_reference jsonb,
  delivery_status text NOT NULL CHECK (delivery_status IN ('received','queued','sending','sent','delivered','read','failed','uncertain')),
  status_at timestamptz, error_code text, attempts integer NOT NULL DEFAULT 0,
  lease_token uuid, lease_until timestamptz, next_at timestamptz NOT NULL DEFAULT now(),
  sent_by text, sent_by_kind text GENERATED ALWAYS AS ('users') STORED,
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, received_at timestamptz,
  FOREIGN KEY (organization_id,account_id) REFERENCES c2s_app.wa_accounts(organization_id,id),
  FOREIGN KEY (organization_id,conversation_id) REFERENCES c2s_app.wa_conversations(organization_id,id),
  FOREIGN KEY (sent_by_kind,sent_by) REFERENCES c2s_app.resources(kind,id),
  UNIQUE (organization_id,account_id,provider_id), UNIQUE (organization_id,client_message_id)
);
CREATE INDEX wa_messages_conversation_idx ON c2s_app.wa_messages(organization_id,conversation_id,created_at DESC,id);
CREATE INDEX wa_messages_account_idx ON c2s_app.wa_messages(organization_id,account_id);
CREATE INDEX wa_messages_sender_idx ON c2s_app.wa_messages(sent_by);
CREATE INDEX wa_messages_outbox_idx ON c2s_app.wa_messages(next_at) WHERE delivery_status IN ('queued','sending');
CREATE TABLE c2s_app.wa_webhook_events (
  id uuid PRIMARY KEY, organization_id text NOT NULL, account_id uuid NOT NULL,
  provider_event_key text NOT NULL, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','retry','failed')),
  attempts integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_until timestamptz, error_code text,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  FOREIGN KEY (organization_id,account_id) REFERENCES c2s_app.wa_accounts(organization_id,id),
  UNIQUE (organization_id,account_id,provider_event_key)
);
CREATE INDEX wa_webhook_pending_idx ON c2s_app.wa_webhook_events(next_at) WHERE status IN ('pending','retry','processing');
CREATE INDEX wa_webhook_account_idx ON c2s_app.wa_webhook_events(organization_id,account_id,received_at DESC);
CREATE TABLE c2s_app.wa_assignment_history (
  id uuid PRIMARY KEY, organization_id text NOT NULL, conversation_id uuid NOT NULL,
  previous_user_id text, new_user_id text, action text NOT NULL, performed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,conversation_id) REFERENCES c2s_app.wa_conversations(organization_id,id)
);
CREATE INDEX wa_assignment_conversation_idx ON c2s_app.wa_assignment_history(organization_id,conversation_id,created_at DESC);
CREATE TABLE c2s_app.wa_internal_notes (
  id uuid PRIMARY KEY, organization_id text NOT NULL, conversation_id uuid NOT NULL,
  user_id text NOT NULL, body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,conversation_id) REFERENCES c2s_app.wa_conversations(organization_id,id)
);
CREATE INDEX wa_notes_conversation_idx ON c2s_app.wa_internal_notes(organization_id,conversation_id,created_at DESC);
CREATE TABLE c2s_app.wa_availability (
  organization_id text NOT NULL, user_id text NOT NULL, user_kind text GENERATED ALWAYS AS ('users') STORED,
  available boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id), FOREIGN KEY (user_kind,user_id) REFERENCES c2s_app.resources(kind,id)
);
CREATE INDEX wa_availability_user_idx ON c2s_app.wa_availability(user_id);
CREATE TABLE c2s_app.wa_reads (
  organization_id text NOT NULL, conversation_id uuid NOT NULL, user_id text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,conversation_id,user_id),
  FOREIGN KEY (organization_id,conversation_id) REFERENCES c2s_app.wa_conversations(organization_id,id)
);
CREATE TABLE c2s_app.wa_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id text NOT NULL,
  conversation_id uuid, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,conversation_id) REFERENCES c2s_app.wa_conversations(organization_id,id)
);
CREATE INDEX wa_changes_scope_idx ON c2s_app.wa_changes(organization_id,id);
CREATE INDEX wa_changes_conversation_idx ON c2s_app.wa_changes(organization_id,conversation_id);
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['wa_accounts','wa_contacts','wa_conversations','wa_messages','wa_webhook_events','wa_assignment_history','wa_internal_notes','wa_availability','wa_reads','wa_changes'] LOOP
    EXECUTE format('ALTER TABLE c2s_app.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON c2s_app.%I FROM PUBLIC,anon,authenticated,service_role',table_name);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON c2s_app.%I TO c2s_backend_scope',table_name);
    EXECUTE format('CREATE POLICY %I ON c2s_app.%I TO c2s_backend_scope USING (true) WITH CHECK (true)',table_name||'_backend',table_name);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE c2s_app.wa_changes_id_seq FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE,SELECT ON SEQUENCE c2s_app.wa_changes_id_seq TO c2s_backend_scope;
COMMIT;
