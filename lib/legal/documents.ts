import legalDocumentVersions from "./versions.json";

export const LEGAL_REVIEW = {
  status: "pending" as const,
  label: "Pendente de revisão jurídica",
  statusDate: "2026-08-24",
};

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: legalDocumentVersions.terms,
  privacy: legalDocumentVersions.privacy,
  cookies: legalDocumentVersions.cookies,
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENT_VERSIONS;

export type LegalDocumentSection = {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type LegalDocumentDefinition = {
  key: LegalDocumentKey;
  title: string;
  summary: string;
  version: (typeof LEGAL_DOCUMENT_VERSIONS)[LegalDocumentKey];
  lastUpdated: string;
  review: typeof LEGAL_REVIEW;
  sections: readonly LegalDocumentSection[];
};

export const LEGAL_DOCUMENT_LINKS = [
  { key: "terms", href: "/termos-de-uso", label: "Termos de Uso" },
  { key: "privacy", href: "/politica-de-privacidade", label: "Política de Privacidade" },
  { key: "cookies", href: "/politica-de-cookies", label: "Política de Cookies" },
] as const satisfies ReadonlyArray<{
  key: LegalDocumentKey;
  href: string;
  label: string;
}>;

export const LEGAL_DOCUMENTS = {
  terms: {
    key: "terms",
    title: "Termos de Uso",
    summary:
      "Regras para acesso e uso responsável do Descomplica CRM. Esta versão técnica permanece pendente de revisão jurídica.",
    version: LEGAL_DOCUMENT_VERSIONS.terms,
    lastUpdated: "2026-08-24",
    review: LEGAL_REVIEW,
    sections: [
      {
        id: "identificacao",
        title: "Identificação do serviço",
        paragraphs: [
          "O Descomplica CRM oferece recursos autenticados de apoio à operação comercial, sujeitos às permissões atribuídas a cada perfil.",
        ],
        items: [
          "Razão social responsável: pendente de revisão jurídica.",
          "Endereço e dados cadastrais: pendentes de revisão jurídica.",
          "Contato legal: pendente de revisão jurídica.",
        ],
      },
      {
        id: "acesso",
        title: "Conta, acesso e segurança",
        items: [
          "A conta é pessoal e deve ser usada somente por seu titular.",
          "Credenciais, códigos de recuperação e fatores de verificação não devem ser compartilhados.",
          "O acesso depende de autenticação, situação da conta, papel, permissões e controles de segurança aplicáveis.",
          "Atividades podem ser registradas para segurança, auditoria e prevenção de uso indevido.",
        ],
      },
      {
        id: "uso-adequado",
        title: "Uso adequado",
        items: [
          "Use dados e funcionalidades apenas para finalidades profissionais autorizadas.",
          "Não tente contornar autenticação, verificação em duas etapas, permissões, limites, bloqueios ou isolamento de dados.",
          "Não envie conteúdo ilegal, malicioso ou incompatível com as políticas internas aplicáveis.",
          "Não trate informações indisponíveis, estimativas ou simulações bloqueadas como resultados comerciais oficiais.",
        ],
      },
      {
        id: "disponibilidade",
        title: "Disponibilidade e alterações",
        paragraphs: [
          "Recursos podem ficar indisponíveis por segurança, manutenção, ausência de fonte validada ou falta de autorização. Mudanças relevantes devem gerar nova versão identificável deste documento.",
        ],
      },
      {
        id: "responsabilidades",
        title: "Responsabilidades e limites",
        paragraphs: [
          "Critérios finais sobre responsabilidades, garantias, limitações, suspensão, encerramento, legislação aplicável e solução de conflitos permanecem pendentes de revisão jurídica. Nenhuma condição específica foi presumida nesta versão.",
        ],
      },
      {
        id: "aceite",
        title: "Aceite versionado",
        paragraphs: [
          "Quando solicitado no cadastro, o aceite destes Termos e da Política de Privacidade é obrigatório, versionado e registrado separadamente do consentimento para cookies opcionais.",
        ],
      },
    ],
  },
  privacy: {
    key: "privacy",
    title: "Política de Privacidade",
    summary:
      "Descrição transparente do tratamento de dados pessoais no Descomplica CRM, com definições jurídicas ainda pendentes.",
    version: LEGAL_DOCUMENT_VERSIONS.privacy,
    lastUpdated: "2026-08-24",
    review: LEGAL_REVIEW,
    sections: [
      {
        id: "agentes",
        title: "Agentes e contatos de privacidade",
        items: [
          "Controlador dos dados: pendente de revisão jurídica.",
          "Encarregado ou DPO: pendente de revisão jurídica.",
          "Canal para solicitações de titulares: pendente de revisão jurídica.",
          "Dados cadastrais e endereço do controlador: pendentes de revisão jurídica.",
        ],
      },
      {
        id: "dados",
        title: "Dados tratados",
        items: [
          "Dados de conta e identidade, como nome, e-mail e identificadores internos.",
          "Dados de autenticação e segurança, sem exibir senhas, tokens ou códigos em texto legível.",
          "Papel, permissões, escopos e registros necessários para controlar o acesso.",
          "Registros técnicos, de auditoria e de uso necessários para segurança e operação.",
          "Dados comerciais acessíveis ao perfil, somente quando houver fonte e autorização válidas.",
          "Versões e datas dos aceites legais, além das preferências separadas de cookies.",
        ],
      },
      {
        id: "finalidades",
        title: "Finalidades",
        items: [
          "Autenticar usuários e proteger sessões.",
          "Aplicar permissões e isolamento de dados.",
          "Disponibilizar funcionalidades autorizadas e prestar suporte.",
          "Prevenir abuso, investigar falhas e manter trilhas de auditoria.",
          "Cumprir obrigações aplicáveis após validação jurídica.",
        ],
      },
      {
        id: "bases-legais",
        title: "Bases legais",
        paragraphs: [
          "A definição das bases legais por finalidade permanece pendente de revisão jurídica. Consentimento de cookies opcionais não deve ser usado como base automática para tratamentos necessários à autenticação, segurança ou execução do serviço.",
        ],
      },
      {
        id: "compartilhamento",
        title: "Operadores e compartilhamento",
        paragraphs: [
          "Dados podem ser processados por fornecedores técnicos estritamente necessários à operação e segurança. A identificação dos operadores, transferências internacionais, contratos e hipóteses de compartilhamento permanece pendente de revisão jurídica.",
        ],
      },
      {
        id: "retencao",
        title: "Retenção e eliminação",
        paragraphs: [
          "Prazos de retenção, critérios de descarte e exceções de conservação permanecem pendentes de revisão jurídica. Dados não devem ser mantidos além do necessário para finalidades autorizadas e obrigações aplicáveis.",
        ],
      },
      {
        id: "direitos",
        title: "Direitos dos titulares",
        paragraphs: [
          "Procedimentos para confirmação, acesso, correção, portabilidade, oposição, revisão, anonimização ou eliminação serão definidos após revisão jurídica. O canal oficial para solicitações também permanece pendente.",
        ],
      },
      {
        id: "seguranca",
        title: "Segurança",
        paragraphs: [
          "O sistema aplica controles de autenticação, verificação adicional, sessão, autorização, auditoria e restrição de acesso. Nenhum controle elimina integralmente riscos; eventos devem seguir o processo de resposta e comunicação juridicamente aprovado.",
        ],
      },
    ],
  },
  cookies: {
    key: "cookies",
    title: "Política de Cookies",
    summary:
      "Categorias, escolhas e limites para cookies e tecnologias semelhantes usados pelo Descomplica CRM.",
    version: LEGAL_DOCUMENT_VERSIONS.cookies,
    lastUpdated: "2026-08-24",
    review: LEGAL_REVIEW,
    sections: [
      {
        id: "conceito",
        title: "O que são cookies",
        paragraphs: [
          "Cookies são pequenos registros armazenados pelo navegador para manter sessões, preferências e controles técnicos. Tecnologias equivalentes devem seguir as mesmas escolhas descritas aqui.",
        ],
      },
      {
        id: "categorias",
        title: "Categorias",
        items: [
          "Essenciais: necessários para funcionamento básico, navegação e manutenção da sessão; não podem ser desativados pelo painel de preferências.",
          "Segurança: ajudam a autenticar, proteger sessões, prevenir abuso e aplicar controles de acesso; não podem ser desativados quando necessários à proteção do serviço.",
          "Funcionais: guardam escolhas não essenciais, como preferências de interface; opcionais e desmarcados por padrão.",
          "Desempenho: medem estabilidade e desempenho sem serem necessários ao acesso; opcionais e desmarcados por padrão.",
          "Análise: ajudam a compreender uso e navegação; opcionais e desmarcados por padrão.",
        ],
      },
      {
        id: "escolhas",
        title: "Suas escolhas",
        paragraphs: [
          "É possível aceitar todos, manter somente essenciais ou personalizar categorias. Funcionais, desempenho e análise começam desmarcados e só podem ser ativados após escolha afirmativa. A preferência pode ser revista posteriormente.",
        ],
      },
      {
        id: "separacao",
        title: "Consentimento separado",
        paragraphs: [
          "A escolha de cookies opcionais é separada do aceite obrigatório e versionado dos Termos de Uso e da Política de Privacidade. Recusar cookies opcionais não deve impedir autenticação nem acesso às funções essenciais autorizadas.",
        ],
      },
      {
        id: "inventario",
        title: "Inventário e duração",
        paragraphs: [
          "Nomes, fornecedores, finalidades específicas e durações de cada cookie permanecem pendentes de inventário técnico final e revisão jurídica. Nenhum cookie opcional deve ser ativado sem constar desse inventário e respeitar a preferência vigente.",
        ],
      },
      {
        id: "contato",
        title: "Contato",
        paragraphs: [
          "O responsável e o canal oficial para dúvidas sobre cookies permanecem pendentes de revisão jurídica.",
        ],
      },
    ],
  },
} as const satisfies Record<LegalDocumentKey, LegalDocumentDefinition>;

export function getLegalDocument(key: LegalDocumentKey): LegalDocumentDefinition {
  return LEGAL_DOCUMENTS[key];
}
