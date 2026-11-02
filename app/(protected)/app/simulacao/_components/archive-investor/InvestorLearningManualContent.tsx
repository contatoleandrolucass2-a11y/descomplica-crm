"use client";
import { useEffect, useRef } from "react";
import { AssociativeLearningManual } from "./AssociativeLearningManual";
import {
  ASSOCIATIVE_FIELD_GUIDE_SECTION,
  ASSOCIATIVE_POLICY_TOPICS,
  ASSOCIATIVE_PROFILE_HELP,
} from "./associative-learning-content";
import {
  ASSOCIATIVE_FAQ_REFERENCE,
  ASSOCIATIVE_FAQ_SECTIONS,
  type AssociativeFaqSection,
} from "./associative-faq-content";

const INVESTOR_MANUAL_SECTIONS = [
  {
    title: "Entenda a modalidade",
    questions: [
      {
        question: "O que é a Tabela Investidor?",
        answer:
          "É uma modalidade para parcelar o valor do imóvel durante o período de obra, conforme a política comercial interna. O simulador reúne estoque, planos prontos, proposta personalizada, resultado e validação em um único fluxo.",
      },
      {
        question: "Qual é a principal vantagem para o cliente?",
        answer:
          "A principal vantagem informada nesta modalidade é a não incidência de correção sobre o fluxo apresentado. Antes de formalizar, confirme a condição no processo comercial oficial.",
      },
      {
        question: "É feita análise de crédito?",
        answer:
          "Para vendas na modalidade Tabela Investidor, a orientação exibida no simulador informa que não é feita análise de crédito. Ainda assim, confira a documentação indicada para pessoa física ou jurídica antes de formalizar a proposta.",
      },
    ],
  },
  {
    title: "Encontre o imóvel e compare os planos",
    questions: [
      {
        question: "Como localizar a unidade correta?",
        answer:
          "Combine os filtros de Incorporadora, Empreendimento, Região, Planta e Valor do Imóvel. Depois, confira produto, metragem, data de entrega e valor antes de selecionar a unidade.",
      },
      {
        question: "Posso vender vaga de garagem avulsa nesta modalidade?",
        answer:
          "Não. Vagas de garagem avulsas são retiradas do estoque elegível da Tabela Investidor. Apartamentos que possuem vaga continuam disponíveis normalmente.",
      },
      {
        question: "Por que existem 8 propostas prontas?",
        answer:
          "São 4 combinações em 18 parcelas e 4 em 24 parcelas. Em cada prazo, você pode comparar propostas com ou sem sinais e com ou sem intermediárias antes de personalizar o fluxo.",
      },
      {
        question: "Quando devo usar uma proposta pronta?",
        answer:
          "Comece sempre pelos planos prontos. Eles ajudam a explicar as diferenças de entrada, pagamentos adicionais, saldo, valor das mensais e início do parcelamento. Personalize somente quando a condição do cliente exigir.",
      },
    ],
  },
  {
    title: "Regras para montar a proposta",
    questions: [
      {
        question: "Qual é a entrada mínima?",
        answer:
          "O ato deve representar pelo menos 6% do valor real. A entrada total, formada pelo ato mais os sinais aprovados, precisa atingir 10% para liberar o fluxo de até 18 parcelas e 20% para liberar até 24 parcelas, sempre limitada pelo prazo da obra.",
      },
      {
        question: "Como funcionam os sinais?",
        answer:
          "Podem ser usados até 3 sinais. Cada sinal ativo deve ser de pelo menos R$ 150,00. O Sinal 2 não pode ser maior que o Sinal 1, o Sinal 3 não pode ser maior que o Sinal 2 e não é permitido pular o sinal anterior.",
      },
      {
        question: "Como funcionam as intermediárias?",
        answer:
          "São permitidas até 3 intermediárias no fluxo de 18 parcelas e até 4 no fluxo de 24 parcelas. Cada uma pode representar no máximo 5% do valor real, deve coincidir com uma mensal e ocorrer até 3 meses antes do término da obra.",
      },
      {
        question: "Quando devo aplicar desconto?",
        answer:
          "Use o desconto somente quando solicitado pelo cliente e autorizado. Enquanto estiver desativado, ele não altera o cálculo da proposta.",
      },
    ],
  },
  {
    title: "Datas, parcelas e validação",
    questions: [
      {
        question: "Como são definidas as datas dos pagamentos?",
        answer:
          "O simulador trabalha com dias comerciais 5, 10 ou 15. Os sinais começam após a entrada e a primeira mensal é deslocada para depois do último sinal aprovado. As intermediárias seguem a cadência do plano e precisam coincidir com uma mensal.",
      },
      {
        question: "Por que o limite de parcelas pode ser menor que 18 ou 24?",
        answer:
          "18 e 24 são limites comerciais máximos. A quantidade realmente disponível também considera a entrada total, os sinais usados e o tempo restante até a data de entrega da obra.",
      },
      {
        question: "Como saber onde a proposta está errada?",
        answer:
          "Campos fora da regra recebem destaque e explicam o motivo do ajuste. Abra a Auditoria do cálculo para conferir entrada, sinais, intermediárias, prazo, saldo e parcela. Corrija todos os itens reprovados antes de apresentar a proposta.",
      },
      {
        question: "O que devo conferir no resultado?",
        answer:
          "Reconcilie valor do imóvel, entrada, sinais válidos, intermediárias válidas, saldo parcelado, quantidade de parcelas, valor mensal e datas inicial e final. O selo deve indicar que a proposta está dentro da regra.",
      },
    ],
  },
  {
    title: "Documentação e condução comercial",
    questions: [
      {
        question: "Onde encontro a documentação do cliente?",
        answer:
          "No cabeçalho do resultado, use Doc Pessoa Física ou Doc Pessoa Jurídica. Abra a lista correta, confira todos os itens e valide eventuais dúvidas com o gerente ou a área responsável.",
      },
      {
        question: "Quando posso imprimir a proposta?",
        answer:
          "Imprima somente depois de confirmar a unidade, os valores, todas as datas, a documentação e a auditoria sem reprovações. Se a opção pronta estiver fechada, abra-a antes de imprimir para garantir que o plano desejado esteja visível.",
      },
      {
        question: "Qual é a melhor forma de apresentar as opções ao cliente?",
        answer:
          "Compare as alternativas disponíveis com o cliente e explique a diferença entre entrada imediata, sinais, intermediárias e mensais. Evite prometer condições que não estejam aprovadas no simulador e no fluxo oficial.",
      },
      {
        question: "O simulador substitui a validação oficial?",
        answer:
          "Não. Ele é uma ferramenta de apoio comercial. Confirme os dados da unidade, o resultado e a documentação no fluxo oficial antes de formalizar a proposta.",
      },
    ],
  },
] as const;

const ASSOCIATIVE_MANUAL_SECTIONS: readonly AssociativeFaqSection[] = [
  ...ASSOCIATIVE_FAQ_SECTIONS,
  {
    title: "Contexto de preenchimento nesta página",
    questions: [
      {
        question: "Por que a renda é importante nesta simulação?",
        answer: ASSOCIATIVE_PROFILE_HELP.income.description,
      },
      {
        question: "Como a modalidade é selecionada?",
        answer: ASSOCIATIVE_PROFILE_HELP.modality.description,
      },
      {
        question: "Por que os campos aparecem somente quando adicionados?",
        answer:
          "Sinais e anuais começam resumidos para manter a leitura compacta. Inserir Sinal e Inserir Anual adicionam uma linha por vez. Ocultar uma anual zera seu valor; ocultar um sinal também pode zerar os sinais seguintes para preservar a sequência. Confira o aviso do botão antes de remover.",
      },
      {
        question: "Qual é a ordem correta de preenchimento?",
        answer:
          "Siga o destaque dourado: Financiamento, Subsídio, FGTS, Cheque Moradia, Entrada, quantidade de parcelas e Ranking. Cada resposta válida libera a etapa seguinte; use zero nos recursos que não existirem.",
      },
      {
        question: "Onde consultar parcelas e remuneração?",
        answer:
          "Em Resumo financeiro, Exibir parcelas abre somente número, vencimento e valor da documentação. Depois de selecionar o Ranking, o ícone $ no canto inferior direito abre a remuneração comercial.",
      },
    ],
  },
  ASSOCIATIVE_FIELD_GUIDE_SECTION,
];

const ASSOCIATIVE_LEARNING_SOURCES = [
  {
    label: "Ministério das Cidades: finalidade do MCMV",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/sobre-o-minha-casa-minha-vida-1",
  },
  {
    label: "Ministério das Cidades: MCMV, linha financiada",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts",
  },
  {
    label: "Banco Central: finalidade e recursos do SBPE",
    href: "https://normativos.bcb.gov.br/Lists/Normativos/Attachments/50628/Res_4676_v17_P.pdf",
  },
  {
    label: "CAIXA: imóvel, avaliação e documentação",
    href: "https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx",
  },
  {
    label: "Prefeitura de São Paulo: condições de isenção do ITBI",
    href: "https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517",
  },
  {
    label: "Ministério das Cidades — regras e faixas do MCMV",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/perguntas-frequentes/habitacao",
  },
  {
    label: "Ministério das Cidades — MCMV Classe Média",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/minha-casa-minha-vida-classe-media/minha-casa-minha-vida-classe-media-1",
  },
  {
    label: "Banco Central — Sistema Brasileiro de Poupança e Empréstimo",
    href: "https://www.bcb.gov.br/estabilidadefinanceira/associacaopoupancaemprestimo",
  },
] as const;

const DIRECT_TABLE_POLICY_TOPICS = [
  {
    title: "Modalidade e validação",
    items: [
      "A Tabela Direta é o financiamento da construtora. Atende, em geral, clientes que comportam parcelas maiores, querem quitar o imóvel em menos tempo, têm restrição para financiamento CAIXA ou preferem outra instituição financeira.",
      "Toda venda exige análise de crédito interna. O simulador apoia o atendimento, mas não substitui a aprovação e o fluxo comercial oficiais.",
      "Existem quatro opções: sem sinal e sem intermediária; com sinal e sem intermediária; sem sinal e com intermediária; com sinal e com intermediária.",
      "A unidade, o valor e as datas precisam estar válidos. Desconto somente altera a base real da proposta quando estiver autorizado; deve ser maior ou igual a zero e menor que o valor do imóvel.",
    ],
  },
  {
    title: "Distribuição, ato e sinais",
    items: [
      "Regra geral: 10% de entrada, 30% durante a obra e 60% pós-chaves em 120 parcelas. Se o nome da planta contiver “Vaga”: 10% de entrada, 40% durante a obra e 50% pós-chaves em até 66 parcelas.",
      "Sem sinais, a proposta pronta usa 10% no ato. Com sinais, distribui 6% no ato e 4% em três sinais: 1,34%, 1,33% e 1,33%, com ajuste final de centavos para fechar os 10%.",
      "Os sinais são consecutivos: não existe Sinal 2 sem Sinal 1 nem Sinal 3 sem Sinal 2. O Sinal 1 não pode superar o ato; o Sinal 2 não pode superar o Sinal 1; e o Sinal 3 não pode superar o Sinal 2.",
      "O ato usa a data da simulação. Cada pagamento seguinte usa o último dia comercial disponível entre 5, 10 e 15, sempre depois do anterior, dentro da janela de 31 dias e sem ultrapassar a entrega.",
    ],
  },
  {
    title: "Obra e intermediárias",
    items: [
      "As mensais pré-chaves começam depois do último pagamento da entrada, seguem mês a mês e incluem o mês da entrega. Não possuem juros, MIP ou DFI.",
      "O saldo pré-chaves parte de 30% na regra geral ou 40% para planta contendo Vaga. A entrada que ultrapassa 10% e as intermediárias válidas são descontadas desse saldo; o restante é dividido pela quantidade de mensais até a entrega. Se o saldo zerar, essas mensais são dispensadas.",
      "Cada intermediária é opcional e limitada a 5% do valor real. Precisa respeitar a entrada total de 10%, ocorrer a partir da primeira mensal, coincidir com uma mensal e ficar, no máximo, até três meses-calendário antes da entrega.",
      "Há até oito posições semestrais, mas a quantidade liberada depende da data de entrega e do saldo da obra. Na regra geral, o teto financeiro é seis intermediárias de 5%; em planta contendo Vaga, pode chegar a oito.",
      "Sinais e intermediárias com valor zero são neutros e não entram na composição apresentada.",
    ],
  },
  {
    title: "Pós-chaves e resultado",
    items: [
      "O pós-chaves começa após a última mensal pré-chaves. O saldo é 60% em 120 parcelas na regra geral ou 50% em até 66 parcelas quando a planta contém Vaga.",
      "A parcela usa o sistema PRICE com juros equivalentes a 12% ao ano, seguro MIP de 0,021% e seguro DFI de 0,007%.",
      "A renda mensal positiva é obrigatória. Com todas as regras operacionais válidas, o comprometimento corresponde à parcela pós-chaves dividida pela renda: até e incluindo 40% resulta em APROVADO; acima de 40% resulta em REPROVADO. Sem renda, o resultado é PENDENTE; qualquer outra falha do fluxo resulta em AJUSTE NECESSÁRIO.",
      "A idade máxima informada para o participante é 79 anos, 11 meses e 29 dias. A elegibilidade final deve ser confirmada na análise interna.",
    ],
  },
  {
    title: "Correção, banco e registro",
    items: [
      "A política informa correção pelo INCC durante a obra e por IPCA + 1% após o Habite-se. Depois de seis meses do Habite-se, o cliente pode optar por financiar o saldo com o banco de sua preferência; confirme as condições no fluxo oficial.",
      "O registro começa após a averbação do Habite-se e a disponibilidade da matrícula individualizada, IPTU e certificação da conclusão. O cliente deve estar adimplente.",
      "O registro pode ser conduzido pelo cliente ou por despachante, com conferência prévia das taxas cartoriais. O prazo médio informado é de 50 dias.",
      "Antes de apresentar ou imprimir, confirme unidade, valores, datas, composição dos pagamentos, renda, auditoria e a documentação disponível nos botões Pessoa Física e Pessoa Jurídica.",
    ],
  },
] as const;

const DIRECT_TABLE_FAQ = [
  {
    question: "Para quem serve a Tabela Direta?",
    answer:
      "Para clientes que comportam parcelas maiores, querem quitar o imóvel em menos tempo, possuem restrição para financiamento CAIXA ou preferem financiar em outra instituição. A modalidade continua sujeita à análise interna.",
  },
  {
    question: "Qual das quatro opções devo usar?",
    answer:
      "Escolha conforme a forma de entrada desejada: ato único ou ato com três sinais; e com ou sem intermediárias. Cada opção monta a composição completa. Revise o fluxo e só apresente a alternativa que respeitar a renda e a auditoria.",
  },
  {
    question: "O que muda quando a planta contém “Vaga”?",
    answer:
      "A entrada permanece em 10%. O bloco da obra passa de 30% para 40%, e o pós-chaves passa de 60% em 120 parcelas para 50% em até 66 parcelas.",
  },
  {
    question: "Posso pular ou aumentar um sinal?",
    answer:
      "Não pode haver lacunas: o Sinal 2 depende do Sinal 1, e o Sinal 3 depende do Sinal 2. Cada sinal também precisa ser igual ou menor que o pagamento anterior.",
  },
  {
    question: "Como as datas 5, 10 e 15 são escolhidas?",
    answer:
      "A partir do pagamento anterior, o simulador procura o último dia válido entre 5, 10 e 15 que seja posterior, esteja dentro de 31 dias e não ultrapasse a entrega. Essa cascata define sinais e o início das mensais; qualquer sinal posterior à entrega exige ajuste.",
  },
  {
    question: "Como o pré-chaves é calculado?",
    answer:
      "O saldo da obra parte de 30% ou 40%, é reduzido pela entrada acima de 10% e pelas intermediárias válidas e, quando positivo, é dividido pelas mensais desde o fim da entrada até o mês da entrega. Se zerar, as mensais são dispensadas. Elas não têm juros ou seguros.",
  },
  {
    question: "Por que a quantidade de intermediárias muda?",
    answer:
      "Porque cada uma precisa coincidir com uma mensal, respeitar o intervalo semestral e terminar até três meses-calendário antes da entrega. O prazo da obra e o teto de 30% ou 40% determinam quantas podem ser usadas.",
  },
  {
    question: "Como o pós-chaves é calculado?",
    answer:
      "O saldo de 60% ou 50% é parcelado pelo sistema PRICE, com juros de 12% ao ano, MIP de 0,021% e DFI de 0,007%. A memória de cálculo mostra parcela, juros, seguros e saldo devedor.",
  },
  {
    question: "O que significa APROVADO ou REPROVADO?",
    answer:
      "Com o fluxo operacional válido, comprometimento de renda até 40% é APROVADO e acima de 40% é REPROVADO. Sem renda, aparece PENDENTE. Se outra regra falhar, aparece AJUSTE NECESSÁRIO. Em todos os casos, a análise de crédito interna continua obrigatória.",
  },
  {
    question: "Quando o desconto pode ser usado?",
    answer:
      "Somente quando estiver autorizado. Ele reduz a base real usada em todos os percentuais e deve ser menor que o valor do imóvel.",
  },
  {
    question: "O que acontece com campos zerados?",
    answer:
      "Sinais e intermediárias zerados são tratados como não utilizados. Eles não somam, não alteram o saldo e não aparecem na composição final.",
  },
  {
    question: "Onde consulto os documentos do cliente?",
    answer:
      "Use os botões Doc Pessoa Física e Doc Pessoa Jurídica no fim da página. Para cliente no exterior, consulte a seção específica dentro da documentação de Pessoa Física.",
  },
  {
    question: "O cliente pode migrar o saldo para um banco?",
    answer:
      "A política permite optar por financiamento bancário após seis meses do Habite-se. As condições precisam ser confirmadas no fluxo oficial antes de qualquer compromisso com o cliente.",
  },
  {
    question: "Quando o registro pode começar?",
    answer:
      "Após a averbação do Habite-se e a disponibilidade dos documentos do imóvel. O cliente deve estar adimplente e pode conduzir o processo ou contratar despachante; o prazo médio informado é de 50 dias.",
  },
] as const;

export function InvestorLearningManualContent({
  directTable = false,
  associative = false,
  initialOpen = false,
}: {
  directTable?: boolean;
  associative?: boolean;
  initialOpen?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (initialOpen && !associative) {
      triggerRef.current?.focus({ preventScroll: true });
      dialogRef.current?.showModal();
    }
  }, [initialOpen, associative]);
  const modality = directTable
    ? "Tabela Direta"
    : associative
      ? "Associativo"
      : "Tabela Investidor";

  if (associative && !directTable)
    return (
      <AssociativeLearningManual
        initialOpen={initialOpen}
        policy={
          <section
            className="investor-direct-learning-policy"
            aria-labelledby="investor-associative-learning-policy-title"
          >
            <div className="investor-direct-learning-section-heading">
              <span aria-hidden="true">01</span>
              <h3 id="investor-associative-learning-policy-title">Política</h3>
            </div>
            <div>
              <section>
                <h4>Resumo da simulação</h4>
                <ul className="investor-associative-learning-summary" aria-label="Resumo do manual">
                  <li>
                    <strong>2</strong>
                    <span>fluxos comparados</span>
                  </li>
                  <li>
                    <strong>3</strong>
                    <span>sinais no máximo</span>
                  </li>
                  <li>
                    <strong>Até 84</strong>
                    <span>parcelas máximas</span>
                  </li>
                  <li>
                    <strong>PF</strong>
                    <span>documentação do cliente</span>
                  </li>
                </ul>
              </section>
              {ASSOCIATIVE_POLICY_TOPICS.map((topic) => (
                <section key={topic.title}>
                  <h4>{topic.title}</h4>
                  <ul>
                    {topic.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <section>
                <h4>Checklist antes de apresentar</h4>
                <ul>
                  <li>Unidade, valor e data de entrega confirmados.</li>
                  <li>Renda comprovável, modalidade e histórico de primeiro imóvel conferidos.</li>
                  <li>Entrada, sinais, anuais e mensais reconciliados.</li>
                  <li>Parâmetros de aprovação e memória comparativa conferidos.</li>
                  <li>
                    Avaliação bancária, documentação e despesas do banco consideradas no orçamento.
                  </li>
                  <li>Resultado validado no fluxo comercial oficial.</li>
                </ul>
              </section>
              <section>
                <h4>Fontes oficiais</h4>
                <ul className="investor-associative-learning-sources">
                  {ASSOCIATIVE_LEARNING_SOURCES.map((source) => (
                    <li key={source.href}>
                      <a href={source.href} target="_blank" rel="noopener noreferrer">
                        {source.label}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </section>
        }
        questions={
          <section
            className="investor-direct-learning-faq investor-associative-learning-faq"
            aria-labelledby="investor-associative-learning-faq-title"
          >
            <div className="investor-direct-learning-section-heading">
              <span aria-hidden="true">02</span>
              <h3 id="investor-associative-learning-faq-title">Perguntas</h3>
            </div>
            <p>{ASSOCIATIVE_FAQ_REFERENCE}</p>
            <div className="investor-associative-learning-faq-groups">
              {ASSOCIATIVE_MANUAL_SECTIONS.map((section, sectionIndex) => (
                <section
                  key={section.title}
                  aria-labelledby={`investor-associative-learning-faq-group-${sectionIndex}`}
                >
                  <h4 id={`investor-associative-learning-faq-group-${sectionIndex}`}>
                    {section.title}
                  </h4>
                  <div>
                    {section.questions.map((item) => (
                      <details key={item.question}>
                        <summary>
                          {item.id ? `${item.id}. ` : ""}
                          {item.question}
                        </summary>
                        {(typeof item.answer === "string" ? [item.answer] : item.answer).map(
                          (paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ),
                        )}
                        {item.sources?.length ? (
                          <ul
                            className="investor-associative-learning-sources"
                            aria-label="Fontes desta resposta"
                          >
                            {item.sources.map((source) => (
                              <li key={source.href}>
                                <a href={source.href} target="_blank" rel="noopener noreferrer">
                                  {source.label}
                                  <span aria-hidden="true">↗</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        }
      />
    );

  return (
    <section className="investor-learning-manual" aria-label={`Manual da ${modality}`}>
      <button
        type="button"
        className="investor-learning-link"
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-controls="investor-learning-dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        Aprenda <span aria-hidden="true">+</span>
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => triggerRef.current?.focus({ preventScroll: true })}
        id="investor-learning-dialog"
        className="investor-documentation-dialog investor-learning-dialog"
        aria-labelledby="investor-learning-title"
        aria-describedby="investor-learning-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <article>
          <header>
            <div>
              <span>{directTable ? "Guia de consulta" : "Manual do corretor"}</span>
              <h2 id="investor-learning-title">
                {directTable ? "Aprenda Tabela Direta" : `Aprenda ${modality}`}
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label={`Fechar manual da ${modality}`}>
                ×
              </button>
            </form>
          </header>
          <p id="investor-learning-description" className="investor-learning-intro">
            Consulte a política completa e as respostas objetivas para conduzir a simulação com
            segurança.
          </p>
          {directTable ? (
            <div className="investor-direct-learning-content">
              <nav aria-label="Navegação do guia">
                <a href="#investor-direct-learning-policy">Política</a>
                <a href="#investor-direct-learning-faq">Perguntas</a>
              </nav>
              <section
                id="investor-direct-learning-policy"
                className="investor-direct-learning-policy"
                aria-labelledby="investor-direct-learning-policy-title"
              >
                <div className="investor-direct-learning-section-heading">
                  <span aria-hidden="true">01</span>
                  <h3 id="investor-direct-learning-policy-title">Política</h3>
                </div>
                <div>
                  {DIRECT_TABLE_POLICY_TOPICS.map((topic) => (
                    <section key={topic.title}>
                      <h4>{topic.title}</h4>
                      <ul>
                        {topic.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>
              <section
                id="investor-direct-learning-faq"
                className="investor-direct-learning-faq"
                aria-labelledby="investor-direct-learning-faq-title"
              >
                <div className="investor-direct-learning-section-heading">
                  <span aria-hidden="true">02</span>
                  <h3 id="investor-direct-learning-faq-title">Perguntas</h3>
                </div>
                <div>
                  {DIRECT_TABLE_FAQ.map((item) => (
                    <details key={item.question}>
                      <summary>{item.question}</summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <>
              <ul className="investor-learning-highlights" aria-label="Resumo do manual">
                <li>
                  <strong>{associative ? "2" : "8"}</strong>
                  <span>{associative ? "fluxos comparados" : "propostas prontas"}</span>
                </li>
                <li>
                  <strong>3</strong>
                  <span>sinais no máximo</span>
                </li>
                <li>
                  <strong>{associative ? "Até 84" : "18 ou 24"}</strong>
                  <span>parcelas máximas</span>
                </li>
                <li>
                  <strong>{associative ? "PF" : "PF e PJ"}</strong>
                  <span>{associative ? "documentação do cliente" : "listas de documentos"}</span>
                </li>
              </ul>
              <div className="investor-learning-sections">
                {(associative ? ASSOCIATIVE_MANUAL_SECTIONS : INVESTOR_MANUAL_SECTIONS).map(
                  (section) => (
                    <section key={section.title}>
                      <h3>{section.title}</h3>
                      <div>
                        {section.questions.map((item) => (
                          <details key={item.question}>
                            <summary>{item.question}</summary>
                            <p>{item.answer}</p>
                          </details>
                        ))}
                      </div>
                    </section>
                  ),
                )}
              </div>
              <aside className="investor-learning-checklist">
                <strong>Checklist antes de apresentar</strong>
                <ul>
                  <li>Unidade, valor e data de entrega confirmados.</li>
                  <li>
                    Entrada, sinais, {associative ? "anuais" : "intermediárias"} e mensais
                    reconciliados.
                  </li>
                  <li>
                    {associative
                      ? "Parâmetros de aprovação e memória comparativa conferidos."
                      : "Auditoria sem reprovações e documentação conferida."}
                  </li>
                  <li>Resultado validado no fluxo comercial oficial.</li>
                </ul>
              </aside>
            </>
          )}
          <footer>
            <form method="dialog">
              <button type="submit">Fechar manual</button>
            </form>
          </footer>
        </article>
      </dialog>
    </section>
  );
}
