// Text preserved from InvestorCalculator.tsx / ASSOCIATIVE_PERSON_DOCUMENTATION.
const content = {
  title: "Documentação Pessoa Física · Associativo",
  sections: [
    {
      title: "Identificação e estado civil",
      items: [
        "RG/CPF, CNH, CTPS ou Carteira Profissional com foto;",
        "Certidão de estado civil: nascimento, casamento ou casamento com averbação do divórcio/óbito;",
        "Comprovante de endereço emitido nos últimos 60 dias.",
      ],
    },
    {
      title: "Comprovação de renda",
      items: [
        "Renda formal: contracheques dos últimos 60 dias, Carteira de Trabalho com identificação e contratos, e extrato do FGTS;",
        "Renda informal: extratos completos dos últimos 3 a 6 meses e Declaração de Imposto de Renda com recibo de entrega;",
        "A análise de crédito da modalidade Associativo é realizada diretamente pela CAIXA.",
      ],
    },
    {
      title: "Dependentes e fator social",
      items: [
        "Pais, mães, sogros, filhos maiores de 18 anos e parentes de 2º ou 3º grau exigem os documentos pessoais e as comprovações aplicáveis;",
        "Filhos menores de 18 anos não exigem comprovante de residência nem declaração de parentesco, residência e ausência de rendimentos;",
        "A CAIXA pode solicitar documentos adicionais durante a análise.",
      ],
    },
  ],
  note: "União estável não substitui a Certidão de estado Civil.",
} as const;

export function CaixaUnitDocuments({ className }: { className: string }) {
  return (
    <section className={className} aria-label="Documentação Pessoa Física">
      <h4>{content.title}</h4>
      {content.sections.map((section) => (
        <section key={section.title}>
          <h5>{section.title}</h5>
          <ol>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ))}
      <p>{content.note}</p>
    </section>
  );
}
