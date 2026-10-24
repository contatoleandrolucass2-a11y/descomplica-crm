begin;
set local lock_timeout='5s'; set local statement_timeout='30s';
create extension if not exists pg_cron with schema pg_catalog;

insert into public.permissions(key,description,min_level) values
('crm.leads.distribution.view','Consulta filas, regras, presenca e historico de distribuicao.',80),
('crm.leads.reports.view','Consulta relatorios agregados de leads.',80),
('crm.leads.settings.view','Consulta configuracoes organizacionais de leads.',80),
('crm.leads.audit.view','Consulta auditoria operacional de leads sem PII.',80),
('crm.leads.import.view','Consulta historico e resultados de importacoes de leads.',80),
('crm.leads.distribution.manage','Configura filas, regras e membros de distribuicao de leads.',80),
('crm.leads.distribution.assign','Executa atribuicao autorizada e auditada de leads.',80),
('crm.leads.reports.export','Exporta relatorios agregados de leads.',80),
('crm.leads.import.manage','Pre-visualiza e aplica importacoes de leads.',80),
('crm.leads.export','Exporta leads autorizados em formato seguro.',80),
('crm.leads.settings.manage','Altera configuracoes organizacionais de leads.',80)
on conflict(key) do update set description=excluded.description,min_level=excluded.min_level;
insert into public.role_permissions(role_key,permission_key)
select role_key,permission_key from (values('master'),('admin')) r(role_key)
cross join (values('crm.leads.distribution.view'),('crm.leads.reports.view'),('crm.leads.settings.view'),('crm.leads.audit.view'),('crm.leads.import.view'),('crm.leads.distribution.manage'),('crm.leads.distribution.assign'),('crm.leads.reports.export'),('crm.leads.import.manage'),('crm.leads.export'),('crm.leads.settings.manage')) p(permission_key) on conflict do nothing;

create table public.crm_lead_distribution_queues(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.crm_organizations(id) on delete cascade,
 key text not null,name text not null check(char_length(btrim(name)) between 1 and 120),algorithm text not null default 'weighted_round_robin' check(algorithm='weighted_round_robin'),
 is_active boolean not null default true,revision bigint not null default 1 check(revision>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,key));
create table public.crm_lead_distribution_members(
 queue_id uuid not null references public.crm_lead_distribution_queues(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 capacity integer not null default 20 check(capacity between 1 and 10000),weight integer not null default 1 check(weight between 1 and 1000),is_active boolean not null default true,is_available boolean not null default false,
 checked_in_at timestamptz,checked_out_at timestamptz,assigned_count bigint not null default 0 check(assigned_count>=0),last_assigned_at timestamptz,updated_at timestamptz not null default now(),primary key(queue_id,user_id));
create table public.crm_lead_distribution_memory(
 organization_id uuid not null references public.crm_organizations(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 assigned_count bigint not null default 0 check(assigned_count>=0),last_assigned_at timestamptz,primary key(organization_id,user_id));
create table public.crm_lead_distribution_rules(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.crm_organizations(id) on delete cascade,queue_id uuid not null references public.crm_lead_distribution_queues(id) on delete cascade,
 fallback_queue_id uuid references public.crm_lead_distribution_queues(id) on delete set null,name text not null check(char_length(btrim(name)) between 1 and 120),priority integer not null check(priority between 0 and 10000),
 criteria jsonb not null default '{}' check(jsonb_typeof(criteria)='object'),is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,priority));
create table public.crm_lead_distribution_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.crm_organizations(id) on delete restrict,lead_id uuid not null references public.crm_leads(id) on delete cascade,
 queue_id uuid references public.crm_lead_distribution_queues(id) on delete set null,rule_id uuid references public.crm_lead_distribution_rules(id) on delete set null,assigned_user_id uuid references auth.users(id) on delete set null,
 actor_id uuid not null references auth.users(id) on delete restrict,outcome text not null check(outcome in('assigned','fallback','unassigned')),explanation jsonb not null check(jsonb_typeof(explanation)='object'),idempotency_key text not null,
 command_digest text not null check(command_digest~'^[0-9a-f]{64}$'),created_at timestamptz not null default now(),unique(organization_id,actor_id,idempotency_key));
create table public.crm_lead_operation_settings(
 organization_id uuid primary key references public.crm_organizations(id) on delete cascade,document jsonb not null check(jsonb_typeof(document)='object'),revision bigint not null default 1 check(revision>0),
 reason text not null check(char_length(btrim(reason)) between 8 and 500),updated_by uuid not null references auth.users(id) on delete restrict,updated_at timestamptz not null default now());
create table public.crm_lead_import_batches(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.crm_organizations(id) on delete cascade,file_hash text not null check(file_hash~'^[0-9a-f]{64}$'),mapping jsonb not null check(jsonb_typeof(mapping)='object'),
 plan_hash text not null check(plan_hash~'^[0-9a-f]{64}$'),status text not null check(status in('previewed','applied','expired')),total_rows integer not null check(total_rows between 1 and 5000),valid_rows integer not null,duplicate_rows integer not null,invalid_rows integer not null,
 created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),expires_at timestamptz not null,applied_by uuid references auth.users(id),applied_at timestamptz,unique(organization_id,file_hash));
create table public.crm_lead_import_rows(
 batch_id uuid not null references public.crm_lead_import_batches(id) on delete cascade,row_number integer not null check(row_number between 1 and 5000),normalized jsonb not null check(jsonb_typeof(normalized)='object'),
 dedupe_key text not null,row_status text not null check(row_status in('valid','duplicate','invalid')),error_codes text[] not null default '{}',primary key(batch_id,row_number));
create table public.crm_lead_operations_audit(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.crm_organizations(id) on delete restrict,actor_id uuid not null references auth.users(id) on delete restrict,
 action text not null,entity_type text not null,entity_id uuid,revision bigint,reason text,metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),created_at timestamptz not null default now());
create index crm_lead_distribution_rules_match_idx on public.crm_lead_distribution_rules(organization_id,is_active,priority);
create index crm_lead_distribution_members_pick_idx on public.crm_lead_distribution_members(queue_id,is_active,is_available,assigned_count,last_assigned_at);
create index crm_lead_import_expiry_idx on public.crm_lead_import_batches(expires_at) where status='previewed';
create index crm_lead_operations_audit_idx on public.crm_lead_operations_audit(organization_id,created_at desc);

create or replace function private.crm_lead_ops_actor(p_permission text,p_organization_id uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());begin
 if v_actor is null then raise exception 'unauthorized: authenticated user required' using errcode='28000';end if;perform public._internal_assert_actor_active(v_actor);
 if not public._internal_has_permission(v_actor,p_permission) then raise exception 'forbidden: missing lead operations permission' using errcode='42501';end if;
 if p_organization_id is null or not private.can_read_organization(p_organization_id) then raise exception 'forbidden: organization unavailable' using errcode='42501';end if;return v_actor;
end$$;

create or replace function public.get_crm_lead_report_v1(p_organization_id uuid,p_report text,p_from date,p_to date,p_filters jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;begin perform private.crm_lead_ops_actor('crm.leads.reports.view',p_organization_id);
 if p_report not in('general','visits','closed','performance','origin','nature') or jsonb_typeof(coalesce(p_filters,'{}'))<>'object' or p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'invalid_argument: invalid report selection' using errcode='22023';end if;
 if p_report='visits' then
  select coalesce(sum(metric_count),0),coalesce(jsonb_agg(jsonb_build_object('date',report_day,'count',metric_count) order by report_day),'[]') into v_total,v_items from (select a.created_at::date as report_day,count(*) as metric_count from public.crm_lead_activities a join public.crm_leads l on l.id=a.lead_id where l.organization_id=p_organization_id and a.activity_type='visit' and a.created_at::date between p_from and p_to and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid) and (p_filters->>'sourceId' is null or l.source_id=(p_filters->>'sourceId')::uuid) group by 1)x;
 elsif p_report='closed' then
  select coalesce(sum(metric_count),0),coalesce(jsonb_agg(jsonb_build_object('key',lead_status,'count',metric_count) order by lead_status),'[]') into v_total,v_items from (select l.status as lead_status,count(*) as metric_count from public.crm_leads l where l.organization_id=p_organization_id and l.closed_at::date between p_from and p_to and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid) and (p_filters->>'sourceId' is null or l.source_id=(p_filters->>'sourceId')::uuid) group by l.status)x;
 elsif p_report='performance' then
  select coalesce(sum(metric_count),0),coalesce(jsonb_agg(jsonb_build_object('key',coalesce(responsible_email,'unassigned'),'count',metric_count,'won',won_count) order by metric_count desc),'[]') into v_total,v_items from (select p.email as responsible_email,count(*) as metric_count,count(*) filter(where l.status='won') as won_count from public.crm_leads l left join public.profiles p on p.user_id=l.responsible_user_id where l.organization_id=p_organization_id and l.created_at::date between p_from and p_to and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid) and (p_filters->>'sourceId' is null or l.source_id=(p_filters->>'sourceId')::uuid) group by p.email)x;
 elsif p_report='origin' then
  select coalesce(sum(metric_count),0),coalesce(jsonb_agg(jsonb_build_object('key',coalesce(source_name,'Sem origem'),'count',metric_count) order by metric_count desc),'[]') into v_total,v_items from (select s.name as source_name,count(*) as metric_count from public.crm_leads l left join public.crm_lead_sources s on s.id=l.source_id where l.organization_id=p_organization_id and l.created_at::date between p_from and p_to and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid) and (p_filters->>'sourceId' is null or l.source_id=(p_filters->>'sourceId')::uuid) group by s.name)x;
 elsif p_report='nature' then
  select coalesce(sum(metric_count),0),coalesce(jsonb_agg(jsonb_build_object('key',coalesce(transaction_kind,'Nao informada'),'count',metric_count) order by metric_count desc),'[]') into v_total,v_items from (select i.transaction_kind,count(*) as metric_count from public.crm_leads l left join public.crm_lead_interests i on i.id=l.interest_id where l.organization_id=p_organization_id and l.created_at::date between p_from and p_to and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid) and (p_filters->>'sourceId' is null or l.source_id=(p_filters->>'sourceId')::uuid) group by i.transaction_kind)x;
 else
  select coalesce(sum(metric_count),0),coalesce(jsonb_agg(jsonb_build_object('key',lead_status,'count',metric_count) order by lead_status),'[]') into v_total,v_items from (select l.status as lead_status,count(*) as metric_count from public.crm_leads l where l.organization_id=p_organization_id and l.created_at::date between p_from and p_to and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid) and (p_filters->>'sourceId' is null or l.source_id=(p_filters->>'sourceId')::uuid) group by l.status)x;
 end if;
 return jsonb_build_object('available',true,'report',p_report,'period',jsonb_build_object('from',p_from,'to',p_to),'filters',coalesce(p_filters,'{}'),'summary',jsonb_build_object('total',v_total),'items',v_items);exception when invalid_text_representation then raise exception 'invalid_argument: invalid report filter' using errcode='22023';end$$;

create or replace function private.crm_lead_csv_safe(p_value text) returns text language sql immutable security invoker set search_path='' as $$select case when p_value~'^[[:space:]]*[=+@-]' then ''''||p_value else p_value end$$;
revoke all privileges on function private.crm_lead_csv_safe(text) from public,anon,authenticated,service_role;
create or replace function public.export_crm_leads_v1(p_organization_id uuid,p_filters jsonb default '{}',p_limit integer default 5000) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;begin perform private.crm_lead_ops_actor('crm.leads.export',p_organization_id);if p_limit not between 1 and 10000 then raise exception 'invalid_argument: invalid export limit' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',private.crm_lead_csv_safe(c.full_name),'email',private.crm_lead_csv_safe(c.email),'phone',private.crm_lead_csv_safe(c.phone),'status',l.status,'priority',l.priority,'stage',private.crm_lead_csv_safe(s.name),'source',private.crm_lead_csv_safe(o.name),'createdAt',l.created_at) order by l.created_at desc),'[]') into v_rows
 from (select * from public.crm_leads where organization_id=p_organization_id and (coalesce((p_filters->>'includeArchived')::boolean,false) or archived_at is null) order by created_at desc limit p_limit)l join public.crm_lead_customers c on c.id=l.customer_id join public.crm_lead_stages s on s.id=l.stage_id left join public.crm_lead_sources o on o.id=l.source_id;
 return jsonb_build_object('rows',v_rows,'limit',p_limit,'truncated',jsonb_array_length(v_rows)=p_limit);end$$;

create or replace function public.get_crm_lead_settings_v1(p_organization_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_row public.crm_lead_operation_settings%rowtype;begin perform private.crm_lead_ops_actor('crm.leads.settings.view',p_organization_id);select * into v_row from public.crm_lead_operation_settings where organization_id=p_organization_id;
 return jsonb_build_object('revision',coalesce(v_row.revision,0),'document',coalesce(v_row.document,'{"sources":[],"channels":[],"stages":[],"lostReasons":[],"tags":[],"alerts":{},"adjustments":{}}'::jsonb),'updatedAt',v_row.updated_at);end$$;
create or replace function public.save_crm_lead_settings_v1(p_organization_id uuid,p_expected_revision bigint,p_document jsonb,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_current bigint;v_saved public.crm_lead_operation_settings%rowtype;begin v_actor:=private.crm_lead_ops_actor('crm.leads.settings.manage',p_organization_id);perform 1 from public.crm_organizations where id=p_organization_id for update;
 if jsonb_typeof(p_document)<>'object' or jsonb_typeof(p_document->'sources')<>'array' or jsonb_typeof(p_document->'channels')<>'array' or jsonb_typeof(p_document->'stages')<>'array' or jsonb_typeof(p_document->'lostReasons')<>'array' or jsonb_typeof(p_document->'tags')<>'array' or jsonb_typeof(p_document->'alerts')<>'object' or jsonb_typeof(p_document->'adjustments')<>'object' or char_length(btrim(coalesce(p_reason,''))) not between 8 and 500 or jsonb_array_length(p_document->'tags')>200 then raise exception 'invalid_argument: invalid settings' using errcode='22023';end if;
 select coalesce(revision,0) into v_current from public.crm_lead_operation_settings where organization_id=p_organization_id for update;if p_expected_revision<>coalesce(v_current,0) then raise exception 'conflict: settings revision changed' using errcode='40001';end if;
 insert into public.crm_lead_operation_settings(organization_id,document,revision,reason,updated_by) values(p_organization_id,p_document,p_expected_revision+1,btrim(p_reason),v_actor) on conflict(organization_id) do update set document=excluded.document,revision=excluded.revision,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now() returning * into v_saved;
 insert into public.crm_lead_tags(organization_id,name,color,created_by) select p_organization_id,btrim(x->>'name'),x->>'color',v_actor from jsonb_array_elements(p_document->'tags')x on conflict(organization_id,name) do update set color=excluded.color;
 insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,revision,reason,metadata) values(p_organization_id,v_actor,'settings.saved','settings',v_saved.revision,btrim(p_reason),jsonb_build_object('tagCount',jsonb_array_length(p_document->'tags')));return jsonb_build_object('revision',v_saved.revision,'updatedAt',v_saved.updated_at);end$$;

create or replace function public.preview_crm_lead_import_v1(p_organization_id uuid,p_file_hash text,p_mapping jsonb,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_batch public.crm_lead_import_batches%rowtype;v_row jsonb;v_number integer:=0;v_norm jsonb;v_key text;v_errors text[];v_plan text;v_valid integer;v_dup integer;v_invalid integer;begin
 v_actor:=private.crm_lead_ops_actor('crm.leads.import.manage',p_organization_id);perform 1 from public.crm_organizations where id=p_organization_id for update;
 delete from public.crm_lead_import_batches where organization_id=p_organization_id and status='previewed' and expires_at<=now();
 if p_file_hash!~'^[0-9a-f]{64}$' or jsonb_typeof(p_mapping)<>'object' or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 5000 then raise exception 'invalid_argument: invalid import preview' using errcode='22023';end if;
 select * into v_batch from public.crm_lead_import_batches where organization_id=p_organization_id and file_hash=p_file_hash;
 if v_batch.id is not null then return jsonb_build_object('batchId',v_batch.id,'planHash',v_batch.plan_hash,'status',v_batch.status,'counts',jsonb_build_object('total',v_batch.total_rows,'valid',v_batch.valid_rows,'duplicate',v_batch.duplicate_rows,'invalid',v_batch.invalid_rows),'replayed',true);end if;
 v_plan:=encode(extensions.digest(convert_to(jsonb_build_object('organizationId',p_organization_id,'fileHash',p_file_hash,'mapping',p_mapping,'rows',p_rows)::text,'UTF8'),'sha256'),'hex');
 insert into public.crm_lead_import_batches(organization_id,file_hash,mapping,plan_hash,status,total_rows,valid_rows,duplicate_rows,invalid_rows,created_by,expires_at) values(p_organization_id,p_file_hash,p_mapping,v_plan,'previewed',jsonb_array_length(p_rows),0,0,0,v_actor,now()+interval '24 hours') returning * into v_batch;
 for v_row in select value from jsonb_array_elements(p_rows) loop v_number:=v_number+1;v_errors:='{}';
  v_norm:=jsonb_strip_nulls(jsonb_build_object('name',nullif(btrim(v_row->>'name'),''),'email',nullif(lower(btrim(v_row->>'email')),''),'phone',nullif(regexp_replace(v_row->>'phone','\D','','g'),''),'interest',nullif(btrim(v_row->>'interest'),''),'sourceKey',nullif(v_row->>'sourceKey',''),'channelKey',nullif(v_row->>'channelKey','')));
  if char_length(coalesce(v_norm->>'name','')) not between 2 and 180 then v_errors:=array_append(v_errors,'invalid_name');end if;if char_length(coalesce(v_norm->>'email',''))>320 then v_errors:=array_append(v_errors,'invalid_email');end if;
  v_key:=encode(extensions.digest(convert_to(coalesce(v_norm->>'email','')||'|'||coalesce(v_norm->>'phone','')||'|'||lower(coalesce(v_norm->>'name','')),'UTF8'),'sha256'),'hex');
  insert into public.crm_lead_import_rows(batch_id,row_number,normalized,dedupe_key,row_status,error_codes) values(v_batch.id,v_number,v_norm,v_key,case when cardinality(v_errors)>0 then 'invalid' else 'valid' end,v_errors);
 end loop;
 update public.crm_lead_import_rows r set row_status='duplicate',error_codes=array_append(error_codes,'duplicate_in_file') where r.batch_id=v_batch.id and r.row_status='valid' and exists(select 1 from public.crm_lead_import_rows prior where prior.batch_id=r.batch_id and prior.dedupe_key=r.dedupe_key and prior.row_number<r.row_number);
 update public.crm_lead_import_rows r set row_status='duplicate',error_codes=array_append(error_codes,'duplicate_existing') where r.batch_id=v_batch.id and r.row_status='valid' and exists(select 1 from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where l.organization_id=p_organization_id and ((r.normalized->>'email' is not null and lower(c.email)=r.normalized->>'email') or (r.normalized->>'phone' is not null and regexp_replace(c.phone,'\D','','g')=r.normalized->>'phone')));
 select count(*) filter(where row_status='valid'),count(*) filter(where row_status='duplicate'),count(*) filter(where row_status='invalid') into v_valid,v_dup,v_invalid from public.crm_lead_import_rows where batch_id=v_batch.id;
 update public.crm_lead_import_batches set valid_rows=v_valid,duplicate_rows=v_dup,invalid_rows=v_invalid where id=v_batch.id;
 insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p_organization_id,v_actor,'import.previewed','import',v_batch.id,jsonb_build_object('total',v_number,'valid',v_valid,'duplicate',v_dup,'invalid',v_invalid,'fileHash',p_file_hash));
 return jsonb_build_object('batchId',v_batch.id,'planHash',v_plan,'status','previewed','counts',jsonb_build_object('total',v_number,'valid',v_valid,'duplicate',v_dup,'invalid',v_invalid),'expiresAt',v_batch.expires_at,'replayed',false);end$$;

create or replace function public.apply_crm_lead_import_v1(p_batch_id uuid,p_expected_plan_hash text) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare v_batch public.crm_lead_import_batches%rowtype;v_actor uuid;v_row public.crm_lead_import_rows%rowtype;v_customer uuid;v_interest uuid;v_stage uuid;v_source uuid;v_channel uuid;v_created integer:=0;v_skipped integer:=0;begin
 select * into v_batch from public.crm_lead_import_batches where id=p_batch_id for update;if v_batch.id is null then raise exception 'not_found: import batch unavailable' using errcode='P0002';end if;v_actor:=private.crm_lead_ops_actor('crm.leads.import.manage',v_batch.organization_id);
 if v_batch.status='applied' then return jsonb_build_object('batchId',v_batch.id,'status','applied','created',0,'skipped',v_batch.duplicate_rows,'replayed',true);end if;
 if v_batch.status<>'previewed' or v_batch.expires_at<=now() then delete from public.crm_lead_import_batches where id=v_batch.id;insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_batch.organization_id,v_actor,'import.expired','import',v_batch.id,jsonb_build_object('expiredAt',v_batch.expires_at,'purged',true));return jsonb_build_object('batchId',v_batch.id,'status','expired','created',0,'skipped',v_batch.duplicate_rows,'invalid',v_batch.invalid_rows,'replayed',false);end if;if p_expected_plan_hash<>v_batch.plan_hash then raise exception 'conflict: import plan changed' using errcode='40001';end if;
 select id into v_stage from public.crm_lead_stages where key='new' and is_active;select id into v_source from public.crm_lead_sources where key='manual' and is_active;select id into v_channel from public.crm_lead_channels where key='other' and is_active;
 for v_row in select * from public.crm_lead_import_rows where batch_id=v_batch.id and row_status='valid' order by row_number loop
  if exists(select 1 from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id where l.organization_id=v_batch.organization_id and ((v_row.normalized->>'email' is not null and lower(c.email)=v_row.normalized->>'email') or (v_row.normalized->>'phone' is not null and regexp_replace(c.phone,'\D','','g')=v_row.normalized->>'phone'))) then v_skipped:=v_skipped+1;continue;end if;
  insert into public.crm_lead_customers(organization_id,full_name,email,phone) values(v_batch.organization_id,v_row.normalized->>'name',v_row.normalized->>'email',v_row.normalized->>'phone') returning id into v_customer;
  if v_row.normalized->>'interest' is not null then insert into public.crm_lead_interests(organization_id,title) values(v_batch.organization_id,v_row.normalized->>'interest') returning id into v_interest;else v_interest:=null;end if;
  insert into public.crm_leads(organization_id,customer_id,interest_id,stage_id,source_id,channel_id,source_system,source_record_id,created_idempotency_key,created_payload_hash,created_by,updated_by) values(v_batch.organization_id,v_customer,v_interest,v_stage,v_source,v_channel,'csv_import',v_batch.id||':'||v_row.row_number,'import:'||v_batch.id||':'||v_row.row_number,encode(extensions.digest(convert_to(v_row.normalized::text,'UTF8'),'sha256'),'hex'),v_actor,v_actor);
  v_created:=v_created+1;
 end loop;
 update public.crm_lead_import_batches set status='applied',applied_by=v_actor,applied_at=now() where id=v_batch.id;delete from public.crm_lead_import_rows where batch_id=v_batch.id;
 insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_batch.organization_id,v_actor,'import.applied','import',v_batch.id,jsonb_build_object('created',v_created,'skipped',v_skipped+v_batch.duplicate_rows,'invalid',v_batch.invalid_rows,'planHash',v_batch.plan_hash));
 return jsonb_build_object('batchId',v_batch.id,'status','applied','created',v_created,'skipped',v_skipped+v_batch.duplicate_rows,'invalid',v_batch.invalid_rows,'replayed',false);end$$;

create or replace function public.list_crm_lead_operations_audit_v1(p_organization_id uuid,p_filters jsonb default '{}',p_limit integer default 50,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;begin perform private.crm_lead_ops_actor('crm.leads.audit.view',p_organization_id);if jsonb_typeof(coalesce(p_filters,'{}'))<>'object' or p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_argument: invalid audit pagination' using errcode='22023';end if;
 select count(*) into v_total from public.crm_lead_operations_audit a where a.organization_id=p_organization_id and (p_filters->>'action' is null or a.action=p_filters->>'action') and (p_filters->>'actorId' is null or a.actor_id=(p_filters->>'actorId')::uuid) and (p_filters->>'entityId' is null or a.entity_id=(p_filters->>'entityId')::uuid) and (p_filters->>'from' is null or a.created_at>=(p_filters->>'from')::timestamptz) and (p_filters->>'to' is null or a.created_at<(p_filters->>'to')::timestamptz+interval '1 day');
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'actorId',actor_id,'action',action,'entityType',entity_type,'entityId',entity_id,'revision',revision,'reason',reason,'metadata',metadata,'createdAt',created_at) order by created_at desc),'[]') into v_items from (select * from public.crm_lead_operations_audit a where a.organization_id=p_organization_id and (p_filters->>'action' is null or a.action=p_filters->>'action') and (p_filters->>'actorId' is null or a.actor_id=(p_filters->>'actorId')::uuid) and (p_filters->>'entityId' is null or a.entity_id=(p_filters->>'entityId')::uuid) and (p_filters->>'from' is null or a.created_at>=(p_filters->>'from')::timestamptz) and (p_filters->>'to' is null or a.created_at<(p_filters->>'to')::timestamptz+interval '1 day') order by a.created_at desc limit p_limit offset p_offset)x;return jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset);exception when invalid_text_representation then raise exception 'invalid_argument: invalid audit filters' using errcode='22023';end$$;

create or replace function public.list_crm_lead_imports_v1(p_organization_id uuid,p_limit integer default 50,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;begin perform private.crm_lead_ops_actor('crm.leads.import.view',p_organization_id);if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_argument: invalid import pagination' using errcode='22023';end if;
 select count(*) into v_total from public.crm_lead_import_batches where organization_id=p_organization_id and (status='applied' or (status='previewed' and expires_at>now()));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'fileHash',file_hash,'planHash',plan_hash,'status',status,'counts',jsonb_build_object('total',total_rows,'valid',valid_rows,'duplicate',duplicate_rows,'invalid',invalid_rows),'errors',errors,'createdBy',created_by,'createdAt',created_at,'expiresAt',expires_at,'appliedAt',applied_at) order by created_at desc),'[]') into v_items from (select b.*,coalesce((select jsonb_object_agg(code,count) from (select code,count(*) count from public.crm_lead_import_rows r cross join unnest(r.error_codes) code where r.batch_id=b.id group by code)e),'{}') errors from public.crm_lead_import_batches b where b.organization_id=p_organization_id and (b.status='applied' or (b.status='previewed' and b.expires_at>now())) order by b.created_at desc limit p_limit offset p_offset)x;
 return jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset);end$$;

create or replace function public.purge_crm_lead_import_staging_v1(p_organization_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_purged integer;begin v_actor:=private.crm_lead_ops_actor('crm.leads.import.manage',p_organization_id);perform 1 from public.crm_organizations where id=p_organization_id for update;delete from public.crm_lead_import_batches where organization_id=p_organization_id and status='previewed' and expires_at<=now();get diagnostics v_purged=row_count;if v_purged>0 then insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,metadata) values(p_organization_id,v_actor,'import.staging.purged','import',jsonb_build_object('purgedBatches',v_purged));end if;return jsonb_build_object('purgedBatches',v_purged);end$$;

create or replace function public.save_crm_lead_distribution_v1(p_organization_id uuid,p_expected_revision bigint,p_document jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare v_actor uuid;v_current bigint;v_revision bigint;v_q jsonb;v_m jsonb;v_r jsonb;v_qid uuid;v_map jsonb:='{}';begin
 v_actor:=private.crm_lead_ops_actor('crm.leads.distribution.manage',p_organization_id);
 if jsonb_typeof(p_document)<>'object' or jsonb_typeof(p_document->'queues')<>'array' or jsonb_typeof(p_document->'rules')<>'array' or jsonb_array_length(p_document->'queues')>50 or jsonb_array_length(p_document->'rules')>200 or char_length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'invalid_argument: invalid distribution document' using errcode='22023';end if;
 perform 1 from public.crm_organizations where id=p_organization_id for update;select coalesce(max(revision),0) into v_current from public.crm_lead_distribution_queues where organization_id=p_organization_id;
 if p_expected_revision<>v_current then raise exception 'conflict: distribution revision changed' using errcode='40001';end if;v_revision:=v_current+1;
 delete from public.crm_lead_distribution_queues where organization_id=p_organization_id;
 for v_q in select value from jsonb_array_elements(p_document->'queues') loop
  if coalesce(v_q->>'key','')!~'^[a-z0-9][a-z0-9_-]{0,63}$' or char_length(btrim(coalesce(v_q->>'name',''))) not between 1 and 120 or jsonb_array_length(coalesce(v_q->'members','[]'))>200 then raise exception 'invalid_argument: invalid queue' using errcode='22023';end if;
  insert into public.crm_lead_distribution_queues(organization_id,key,name,is_active,revision) values(p_organization_id,v_q->>'key',btrim(v_q->>'name'),coalesce((v_q->>'active')::boolean,true),v_revision) returning id into v_qid;v_map:=v_map||jsonb_build_object(v_q->>'key',v_qid);
  for v_m in select value from jsonb_array_elements(coalesce(v_q->'members','[]')) loop
   if not private.crm_lead_user_can_access_organization((v_m->>'userId')::uuid,p_organization_id) then raise exception 'invalid_argument: queue member unavailable' using errcode='22023';end if;
   insert into public.crm_lead_distribution_members(queue_id,user_id,capacity,weight,is_active) values(v_qid,(v_m->>'userId')::uuid,coalesce((v_m->>'capacity')::int,20),coalesce((v_m->>'weight')::int,1),coalesce((v_m->>'active')::boolean,true));
  end loop;
 end loop;
 for v_r in select value from jsonb_array_elements(p_document->'rules') loop
  insert into public.crm_lead_distribution_rules(organization_id,queue_id,fallback_queue_id,name,priority,criteria,is_active) values(p_organization_id,(v_map->>(v_r->>'queueKey'))::uuid,nullif(v_map->>(v_r->>'fallbackQueueKey'),'')::uuid,btrim(v_r->>'name'),(v_r->>'priority')::int,coalesce(v_r->'criteria','{}'),coalesce((v_r->>'active')::boolean,true));
 end loop;
 insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,revision,reason,metadata) values(p_organization_id,v_actor,'distribution.saved','distribution',v_revision,btrim(p_reason),jsonb_build_object('queueCount',jsonb_array_length(p_document->'queues'),'ruleCount',jsonb_array_length(p_document->'rules')));
 return jsonb_build_object('revision',v_revision);
exception when invalid_text_representation or check_violation or not_null_violation or unique_violation then raise exception 'invalid_argument: invalid distribution document' using errcode='22023';end$$;

create or replace function public.set_crm_lead_presence_v1(p_organization_id uuid,p_available boolean,p_capacity integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_count integer;begin v_actor:=private.crm_lead_ops_actor('crm.leads.distribution.assign',p_organization_id);
 if p_available is null or p_capacity not between 1 and 10000 then raise exception 'invalid_argument: invalid presence' using errcode='22023';end if;
 update public.crm_lead_distribution_members m set is_available=p_available,capacity=p_capacity,checked_in_at=case when p_available then now() else checked_in_at end,checked_out_at=case when not p_available then now() else null end,updated_at=now() from public.crm_lead_distribution_queues q where q.id=m.queue_id and q.organization_id=p_organization_id and m.user_id=v_actor and m.is_active;
 get diagnostics v_count=row_count;if v_count=0 then raise exception 'not_found: distribution membership unavailable' using errcode='P0002';end if;insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,metadata) values(p_organization_id,v_actor,'distribution.presence','presence',jsonb_build_object('available',p_available,'capacity',p_capacity,'queueCount',v_count));return jsonb_build_object('updatedQueues',v_count,'available',p_available,'capacity',p_capacity);end$$;

create or replace function public.assign_crm_lead_v1(p_lead_id uuid,p_queue_id uuid,p_idempotency_key text) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare v_actor uuid;v_lead public.crm_leads%rowtype;v_rule public.crm_lead_distribution_rules%rowtype;v_queue uuid;v_member uuid;v_outcome text:='assigned';v_existing public.crm_lead_distribution_events%rowtype;v_digest text;begin
 select * into v_lead from public.crm_leads where id=p_lead_id for update;if v_lead.id is null then raise exception 'not_found: lead unavailable' using errcode='P0002';end if;v_actor:=private.crm_lead_ops_actor('crm.leads.distribution.assign',v_lead.organization_id);
 if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'invalid_argument: invalid idempotency key' using errcode='22023';end if;
 v_digest:=encode(extensions.digest(convert_to(jsonb_build_object('leadId',p_lead_id,'queueId',p_queue_id)::text,'UTF8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lead.organization_id::text||':'||v_actor::text||':'||p_idempotency_key,0));
 select * into v_existing from public.crm_lead_distribution_events where organization_id=v_lead.organization_id and actor_id=v_actor and idempotency_key=p_idempotency_key;if v_existing.id is not null then if v_existing.lead_id<>p_lead_id or v_existing.command_digest<>v_digest then raise exception 'conflict: assignment idempotency key reused' using errcode='40001';end if;return jsonb_build_object('leadId',v_existing.lead_id,'assignedUserId',v_existing.assigned_user_id,'queueId',v_existing.queue_id,'outcome',v_existing.outcome,'replayed',true,'explanation',v_existing.explanation);end if;
 if p_queue_id is not null then select id into v_queue from public.crm_lead_distribution_queues where id=p_queue_id and organization_id=v_lead.organization_id and is_active;else select * into v_rule from public.crm_lead_distribution_rules r where r.organization_id=v_lead.organization_id and r.is_active and (not(r.criteria?'sourceId') or r.criteria->>'sourceId'=v_lead.source_id::text) and (not(r.criteria?'channelId') or r.criteria->>'channelId'=v_lead.channel_id::text) and (not(r.criteria?'priority') or r.criteria->>'priority'=v_lead.priority) order by r.priority,r.id limit 1;v_queue:=v_rule.queue_id;end if;
 if v_queue is null then v_outcome:='unassigned';else
  select m.user_id into v_member from public.crm_lead_distribution_members m left join public.crm_lead_distribution_memory mm on mm.organization_id=v_lead.organization_id and mm.user_id=m.user_id where m.queue_id=v_queue and m.is_active and m.is_available and (select count(*) from public.crm_leads active where active.organization_id=v_lead.organization_id and active.responsible_user_id=m.user_id and active.status='open' and active.archived_at is null)<m.capacity order by (((select count(*) from public.crm_leads active where active.organization_id=v_lead.organization_id and active.responsible_user_id=m.user_id and active.status='open' and active.archived_at is null)+1)::numeric/m.weight),coalesce(mm.assigned_count,0),mm.last_assigned_at nulls first,m.user_id for update of m skip locked limit 1;
  if v_member is null and v_rule.fallback_queue_id is not null then v_queue:=v_rule.fallback_queue_id;v_outcome:='fallback';select m.user_id into v_member from public.crm_lead_distribution_members m left join public.crm_lead_distribution_memory mm on mm.organization_id=v_lead.organization_id and mm.user_id=m.user_id where m.queue_id=v_queue and m.is_active and m.is_available and (select count(*) from public.crm_leads active where active.organization_id=v_lead.organization_id and active.responsible_user_id=m.user_id and active.status='open' and active.archived_at is null)<m.capacity order by (((select count(*) from public.crm_leads active where active.organization_id=v_lead.organization_id and active.responsible_user_id=m.user_id and active.status='open' and active.archived_at is null)+1)::numeric/m.weight),coalesce(mm.assigned_count,0),mm.last_assigned_at nulls first,m.user_id for update of m skip locked limit 1;end if;
  if v_member is null then v_outcome:='unassigned';else insert into public.crm_lead_distribution_memory(organization_id,user_id,assigned_count,last_assigned_at) values(v_lead.organization_id,v_member,1,now()) on conflict(organization_id,user_id) do update set assigned_count=crm_lead_distribution_memory.assigned_count+1,last_assigned_at=now();update public.crm_lead_distribution_members set assigned_count=assigned_count+1,last_assigned_at=now(),updated_at=now() where queue_id=v_queue and user_id=v_member;update public.crm_leads set responsible_user_id=v_member,version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id;end if;
 end if;
 insert into public.crm_lead_distribution_events(organization_id,lead_id,queue_id,rule_id,assigned_user_id,actor_id,outcome,explanation,idempotency_key,command_digest) values(v_lead.organization_id,v_lead.id,v_queue,v_rule.id,v_member,v_actor,v_outcome,jsonb_build_object('algorithm','weighted_round_robin','eligible',v_member is not null,'fallbackUsed',v_outcome='fallback','rulePriority',v_rule.priority),p_idempotency_key,v_digest);
 insert into public.crm_lead_operations_audit(organization_id,actor_id,action,entity_type,entity_id,metadata) values(v_lead.organization_id,v_actor,'distribution.assigned','lead',v_lead.id,jsonb_build_object('queueId',v_queue,'ruleId',v_rule.id,'outcome',v_outcome));
 return jsonb_build_object('leadId',v_lead.id,'assignedUserId',v_member,'queueId',v_queue,'outcome',v_outcome,'replayed',false,'explanation',jsonb_build_object('algorithm','weighted_round_robin','fallbackUsed',v_outcome='fallback'));end$$;
revoke all privileges on function private.crm_lead_ops_actor(text,uuid) from public,anon,authenticated,service_role;

create or replace function public.get_crm_lead_distribution_v1(p_organization_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform private.crm_lead_ops_actor('crm.leads.distribution.view',p_organization_id);return jsonb_build_object(
 'revision',coalesce((select max(revision) from public.crm_lead_distribution_queues where organization_id=p_organization_id),0),
 'queues',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'key',q.key,'name',q.name,'active',q.is_active,'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'label',p.email,'capacity',m.capacity,'weight',m.weight,'active',m.is_active,'available',m.is_available,'assignedCount',coalesce(mm.assigned_count,0),'lastAssignedAt',mm.last_assigned_at) order by p.email) from public.crm_lead_distribution_members m join public.profiles p on p.user_id=m.user_id left join public.crm_lead_distribution_memory mm on mm.organization_id=q.organization_id and mm.user_id=m.user_id where m.queue_id=q.id),'[]')) order by q.name) from public.crm_lead_distribution_queues q where q.organization_id=p_organization_id),'[]'),
 'rules',coalesce((select jsonb_agg(jsonb_build_object('id',id,'queueId',queue_id,'fallbackQueueId',fallback_queue_id,'name',name,'priority',priority,'criteria',criteria,'active',is_active) order by priority) from public.crm_lead_distribution_rules where organization_id=p_organization_id),'[]'),
 'recentEvents',coalesce((select jsonb_agg(jsonb_build_object('id',id,'leadId',lead_id,'queueId',queue_id,'ruleId',rule_id,'assignedUserId',assigned_user_id,'outcome',outcome,'explanation',explanation,'createdAt',created_at) order by created_at desc) from (select * from public.crm_lead_distribution_events where organization_id=p_organization_id order by created_at desc limit 50)e),'[]'));
end$$;

do $schedule$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname='crm-lead-import-staging-retention' loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule(
    'crm-lead-import-staging-retention',
    '*/15 * * * *',
    $command$delete from public.crm_lead_import_batches where status='previewed' and expires_at<=now()$command$
  );
end
$schedule$;

alter table public.crm_lead_distribution_queues enable row level security;alter table public.crm_lead_distribution_queues force row level security;
alter table public.crm_lead_distribution_members enable row level security;alter table public.crm_lead_distribution_members force row level security;
alter table public.crm_lead_distribution_memory enable row level security;alter table public.crm_lead_distribution_memory force row level security;
alter table public.crm_lead_distribution_rules enable row level security;alter table public.crm_lead_distribution_rules force row level security;
alter table public.crm_lead_distribution_events enable row level security;alter table public.crm_lead_distribution_events force row level security;
alter table public.crm_lead_operation_settings enable row level security;alter table public.crm_lead_operation_settings force row level security;
alter table public.crm_lead_import_batches enable row level security;alter table public.crm_lead_import_batches force row level security;
alter table public.crm_lead_import_rows enable row level security;alter table public.crm_lead_import_rows force row level security;
alter table public.crm_lead_operations_audit enable row level security;alter table public.crm_lead_operations_audit force row level security;
revoke all privileges on table public.crm_lead_distribution_queues,public.crm_lead_distribution_members,public.crm_lead_distribution_memory,public.crm_lead_distribution_rules,public.crm_lead_distribution_events,public.crm_lead_operation_settings,public.crm_lead_import_batches,public.crm_lead_import_rows,public.crm_lead_operations_audit from public,anon,authenticated,service_role;
revoke all privileges on function public.get_crm_lead_distribution_v1(uuid),public.save_crm_lead_distribution_v1(uuid,bigint,jsonb,text),public.set_crm_lead_presence_v1(uuid,boolean,integer),public.assign_crm_lead_v1(uuid,uuid,text),public.get_crm_lead_report_v1(uuid,text,date,date,jsonb),public.export_crm_leads_v1(uuid,jsonb,integer),public.get_crm_lead_settings_v1(uuid),public.save_crm_lead_settings_v1(uuid,bigint,jsonb,text),public.preview_crm_lead_import_v1(uuid,text,jsonb,jsonb),public.apply_crm_lead_import_v1(uuid,text),public.list_crm_lead_operations_audit_v1(uuid,jsonb,integer,integer),public.list_crm_lead_imports_v1(uuid,integer,integer),public.purge_crm_lead_import_staging_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_crm_lead_distribution_v1(uuid),public.save_crm_lead_distribution_v1(uuid,bigint,jsonb,text),public.set_crm_lead_presence_v1(uuid,boolean,integer),public.assign_crm_lead_v1(uuid,uuid,text),public.get_crm_lead_report_v1(uuid,text,date,date,jsonb),public.export_crm_leads_v1(uuid,jsonb,integer),public.get_crm_lead_settings_v1(uuid),public.save_crm_lead_settings_v1(uuid,bigint,jsonb,text),public.preview_crm_lead_import_v1(uuid,text,jsonb,jsonb),public.apply_crm_lead_import_v1(uuid,text),public.list_crm_lead_operations_audit_v1(uuid,jsonb,integer,integer),public.list_crm_lead_imports_v1(uuid,integer,integer),public.purge_crm_lead_import_staging_v1(uuid) to authenticated;
commit;
