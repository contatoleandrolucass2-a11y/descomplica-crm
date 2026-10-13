import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const receive = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: {
    name: 'Receber Snapshot Normalizado',
    parameters: {
  "httpMethod": "POST",
  "path": "descomplica-crm-salesforce-candidate",
  "responseMode": "responseNode",
  "options": {},
  "authentication": "headerAuth"
},
    credentials: { httpHeaderAuth: newCredential('CRM VPS - Snapshot entrada') }
  },
  output: [{ json: { body: { schemaVersion: 2 } } }]
});

const validate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Contrato e PII',
    parameters: {
  "mode": "runOnceForAllItems",
  "language": "javaScript",
  "jsCode": "const envelope = $input.first().json;\nconst payload = envelope.body ?? envelope;\nif (!payload || payload.schemaVersion !== 2 || !payload.dashboard) {\n  throw new Error('invalid snapshot envelope');\n}\nif (typeof payload.dashboard.goalsAvailable !== 'boolean') {\n  throw new Error('invalid goals availability');\n}\nif (!Array.isArray(payload.dashboard.views) || payload.dashboard.views.length !== 3) {\n  throw new Error('invalid dashboard views');\n}\nif (!Array.isArray(payload.dashboard.metrics) || payload.dashboard.metrics.length !== 15) {\n  throw new Error('invalid dashboard metrics');\n}\nif (!payload.dashboard.goalsAvailable && payload.dashboard.metrics.some((metric) => metric.goalMonth !== 0 || metric.goalWeek !== 0 || metric.goalToday !== 0)) {\n  throw new Error('unavailable goals must be zero');\n}\nif (payload.ranking && (typeof payload.ranking.rouletteAvailable !== 'boolean' || !Array.isArray(payload.ranking.participants) || payload.ranking.participants.length > 2000)) {\n  throw new Error('invalid ranking participants');\n}\nif (payload.ranking && !payload.ranking.rouletteAvailable && payload.ranking.participants.some((participant) => participant.roulette !== 0 || participant.rouletteSaturday !== 0 || participant.rouletteSunday !== 0)) {\n  throw new Error('unavailable roulette must be zero');\n}\nconst serialized = JSON.stringify(payload).toLowerCase();\nconst forbidden = ['cpf', 'cnpj', 'password', 'senha', 'bank', 'banco', 'agência bancária', 'conta bancária', 'telefone', 'phone', 'email', 'logradouro', 'cep'];\nif (forbidden.some((field) => serialized.includes(`\\\"${field}\\\"`))) {\n  throw new Error('forbidden source field');\n}\nreturn [{ json: { payload, accepted: true } }];"
}
  },
  output: [{ json: { accepted: true } }]
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Responder Validacao Candidata',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { ok: false, status: "candidate_validated_not_published" } }}'),
      options: { responseCode: 202 }
    }
  },
  output: [{ json: { ok: false, status: 'candidate_validated_not_published' } }]
});

export default workflow('crm-vps-salesforce-candidate', 'CRM VPS - Salesforce - Validacao candidata (INATIVO)')
  .add(receive).to(validate).to(respond);
