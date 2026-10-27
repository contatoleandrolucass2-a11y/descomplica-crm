export type UsefulLinksSection = {
  title: string;
  paragraphs?: string[];
  items?: { label: string; href?: string; description?: string }[];
  table?: { headers: string[]; rows: string[][] };
};

export type UsefulLinksPage = {
  slug: string;
  title: string;
  description: string;
  sourcePage: string;
  sections: UsefulLinksSection[];
};

// Transcrição da referência Data Studio consultada em 27/10/2026.
// Estes dados são informativos e não alteram as regras dos simuladores.
export const usefulLinksPages: UsefulLinksPage[] = [
  {
    slug: "grupos-whatsapp",
    title: "Grupos WhatsApp",
    description: "Contatos do time, assessorias de crédito e grupos de apoio comercial.",
    sourcePage: "p_2w57690rrd",
    sections: [
      {
        title: "Superintendente",
        items: [{ label: "Leandro — (11) 91715-3404", href: "https://wa.me/5511917153404" }],
      },
      {
        title: "Supervisores",
        paragraphs: ["Os contatos disponíveis dão acesso direto ao WhatsApp."],
        items: [
          { label: "July — (11) 98485-7817", href: "https://wa.me/5511984857817" },
          { label: "Álvaro — (11) 97572-9327", href: "https://wa.me/5511975729327" },
          { label: "Richard — (11) 98989-0555", href: "https://wa.me/5511989890555" },
          {
            label: "Lucas — (11) 98396-2016",
            description:
              "O número exibido para Lucas difere do destino do ícone na referência, que aponta para o contato de Richard. Confirme o contato com a coordenação.",
          },
        ],
      },
      {
        title: "Coordenador",
        items: [{ label: "Fabricio — (11) 91981-2845", href: "https://wa.me/5511919812845" }],
      },
      {
        title: "Acessar os grupos das CCAs",
        paragraphs: [
          "Toda e qualquer solicitação que envolva a CCA, deverá procurar pelo FID.",
          "Esses links dão acesso aos grupos das assessorias de crédito, onde você poderá acompanhar de forma prática e em tempo real o andamento da aprovação do financiamento do seu cliente por meio do sistema FID.",
        ],
        items: [
          { label: "H2", href: "https://chat.whatsapp.com/FDmHE48G46N4ivGYzq95Cb" },
          {
            label: "Assino Crédito Imobiliário",
            href: "https://chat.whatsapp.com/Ex0vRmCIObP1rjr1dSZX8f",
          },
          { label: "Aprove", href: "https://chat.whatsapp.com/BbH4U9WNGP2Amsm9SfKbBB" },
          { label: "MAP", href: "https://chat.whatsapp.com/Eo3rYwAy7t9BDbeYVSGqJ3" },
          { label: "iPrime Consultoria", href: "https://chat.whatsapp.com/DgW0MUVjvHX6Fbgz8WhlB3" },
        ],
      },
      {
        title: "Comunidade Direcional",
        paragraphs: [
          "Esse é o canal oficial para quem quer estar por dentro de tudo o que movimenta a Direcional e a Riva: novidades, lançamentos, campanhas e materiais exclusivos. Faça parte e acompanhe de perto os próximos passos dos nossos projetos.",
        ],
        items: [
          {
            label: "Acessar a comunidade Direcional",
            href: "https://chat.whatsapp.com/DM28jcGFlXU1sr9M0ZB7ni",
          },
        ],
      },
      {
        title: "Grupo de propostas — unidades Direcional",
        paragraphs: [
          "Este grupo é exclusivo para o envio das cotações que serão utilizadas na geração dos contratos.",
        ],
        items: [
          {
            label: "Acessar o grupo de propostas",
            href: "https://chat.whatsapp.com/Ljyisj8jzxiGeF4IND7DzH",
          },
        ],
      },
      {
        title: "Grupo de apoio",
        paragraphs: [
          "Este grupo é feito para sanar suas dúvidas em caso de indisponibilidade do seu coordenador ou supervisor.",
        ],
        items: [
          {
            label: "Grupo de apoio indisponível",
            description:
              "O botão da referência aponta para a página inicial do Data Studio, sem um convite de WhatsApp. Solicite o link à coordenação.",
          },
        ],
      },
    ],
  },
  {
    slug: "lojas-horarios",
    title: "Lojas Horários",
    description: "Horários de atendimento e endereços das lojas por região.",
    sourcePage: "p_rrastvpqtd",
    sections: [
      {
        title: "Horário das lojas",
        paragraphs: [
          "Aberto de segunda a sábado das 9:00 às 20:00.",
          "Domingo das 9:00 às 18:00.",
          "Aberto todos os dias, exceto dia 25/12 e dia 01/01.",
        ],
      },
      {
        title: "Zona Leste",
        items: [
          {
            label: "Reserva Jd Sapopemba · Reserva São Mateus · Residencial Despertar",
            description: "Av. Sapopemba, 11.186 — Sapopemba.",
          },
          {
            label: "Conquista Clube Itaim Paulista",
            description: "Avenida Marechal Tito, 1533.",
          },
        ],
      },
      {
        title: "Zona Norte",
        items: [
          {
            label: "Reserva Direcional Limão · Reserva Urban Clube · Raiz Home Clube — Limão",
            description: "Avenida Voluntários da Pátria, 2236.",
          },
        ],
      },
      {
        title: "Zona Sul",
        items: [
          {
            label: "Pátio Central — Matiz · Pátio Central — Galeria",
            description: "Rua Lavapés, 463 — Cambuci.",
          },
          { label: "Conquista Clube Sacomã", description: "Av. do Cursino, 1355." },
        ],
      },
      {
        title: "Zona Oeste",
        items: [
          { label: "Conquista Clube Butantã", description: "Raposo Shopping." },
          {
            label: "Linha do It · Line Barra Funda · Holistic Residence · Concept Barra Funda",
            description: "Rua Robert Bosch, 322.",
          },
        ],
      },
    ],
  },
  {
    slug: "relacionamento",
    title: "Relacionamento",
    description: "Canais de atendimento após a assinatura e guias do aplicativo Pode Morar.",
    sourcePage: "p_rtnxziqxtd",
    sections: [
      {
        title: "Atenção — relacionamento após a assinatura",
        paragraphs: [
          "Devido à Lei Geral de Proteção de Dados Pessoais, ou Lei nº 13.709/2018 “LGPD”, após a data de assinatura do contrato com a Direcional/Riva, toda e qualquer solicitação necessária deverá ser realizada pelos canais de relacionamento.",
        ],
        items: [
          { label: "Site Pode Morar", href: "https://www.podemorar.com.br/" },
          { label: "Telefone — +55 31 4002-2600", href: "tel:+553140022600" },
          { label: "WhatsApp — +55 31 4002-2600", href: "https://wa.me/553140022600" },
        ],
      },
      {
        title: "Acesse o Pode Morar",
        items: [
          {
            label: "Acesse através de um computador",
            href: "https://boravender.app.br/login",
            description:
              "Destino informado pela referência: login do Bora Vender. Para o site Pode Morar, use o canal de relacionamento acima.",
          },
          {
            label: "Acesse através de um dispositivo iOS",
            href: "https://apps.apple.com/br/app/pode-morar/id1569813219",
          },
          {
            label: "Acesse através de um dispositivo Android",
            href: "https://play.google.com/store/apps/details?id=br.com.direcional.boravender",
            description:
              "Destino informado pela referência: aplicativo Bora Vender no Google Play.",
          },
        ],
      },
      {
        title: "Guia de como utilizar o aplicativo",
        items: [
          {
            label: "Conheça o aplicativo Pode Morar",
            href: "https://youtu.be/Ml0h7EhvEyk?si=Xv03YtDDjEwS50wV",
          },
          {
            label: "Aplicativo Pode Morar — Financeiro",
            href: "https://youtu.be/NYswNGNzpbU?si=oqfnmnujN516FoBE",
          },
          {
            label: "Aplicativo Pode Morar — Solicitações",
            href: "https://youtu.be/MuTLvygEsP4?si=UwjoiBRi12TpCZYc",
          },
          {
            label: "Pode Morar — Skill para Alexa Direcional",
            href: "https://youtu.be/opiEo7MDtSs?si=0GytzCG2uKHDW6He",
          },
        ],
      },
    ],
  },
  {
    slug: "regras-comerciais",
    title: "Regras Comerciais",
    description:
      "Conteúdo da referência consultada em 27/10/2026. Valide as condições do mês antes de negociar.",
    sourcePage: "p_85thpu1ttd",
    sections: [
      {
        title: "Regras Associativo",
        table: {
          headers: ["Parâmetro", "Renda a partir de R$ 3.700,00", "Renda abaixo de R$ 3.700,00"],
          rows: [
            ["Máximo da renda mensal", "50%", "48%"],
            ["Comprometimento de renda da parcela", "20%", "18%"],
            ["Percentual pró-soluto", "18%", "18%"],
          ],
        },
        paragraphs: [
          "Se algum desses 3 parâmetros não estiver dentro da regra, a proposta é reprovada automaticamente, sem margem para negociar.",
          "Dica para diminuir o máximo da renda mensal e o comprometimento de renda da parcela: aumentar o valor do ato e dos sinais ou aumentar a quantidade de mensais.",
          "Dica para diminuir o percentual pró-soluto: aumentar o valor do ato e dos sinais.",
        ],
      },
      {
        title: "Premiação Volta ao Caixa",
        paragraphs: [
          "O Bônus Volta ao Caixa é um incentivo oferecido pela construtora. Ele pode ser como DESCONTO ou como PREMIAÇÃO. Se você optar por não conceder como desconto ao cliente, o que for PRESERVADO de acordo com os parâmetros definidos será repassado a você juntamente com a sua comissão.",
          "Além disso, ele também é uma excelente ferramenta nas negociações: caso o cliente precise de um desconto para fechar o negócio ou melhorar o fluxo de pagamento, esse recurso pode viabilizar condições mais favoráveis e aumentar as chances de concretizar a venda.",
        ],
      },
      {
        title: "Direcional — todos os projetos",
        table: {
          headers: ["Número de parcelas", "Premiação que volta para a imobiliária"],
          rows: [
            ["00–48", "54% V.C"],
            ["49–52", "45% V.C"],
            ["53–60", "31,5% V.C"],
            ["61–65", "22,5% V.C"],
          ],
        },
      },
      {
        title: "Riva — maioria dos projetos",
        paragraphs: ["Consultar os demais projetos."],
        table: {
          headers: ["Número de parcelas", "Premiação que volta para a imobiliária"],
          rows: [
            ["00–46", "54% V.C"],
            ["47–52", "45% V.C"],
            ["53–57", "31,5% V.C"],
            ["58–62", "22,5% V.C"],
          ],
        },
      },
      {
        title: "Comissionamento — imobiliárias chave",
        paragraphs: [
          "Sistema de comissões para apartamentos até R$ 300 mil. A comissão é ajustada conforme o número de parcelas que o cliente escolher: mais parcelas, comissão mais baixa; menos parcelas, comissão mais alta.",
        ],
        table: {
          headers: ["Parcelamento", "Comissão"],
          rows: [
            ["Sem pró-soluto", "5,00%"],
            ["1 até 36x", "4,50%"],
            ["37 até 48x", "4,25%"],
            ["49 até 52x", "4,00%"],
            ["53 até 60x", "3,75%"],
            ["61 até 65x", "3,50%"],
          ],
        },
      },
      {
        title: "Comissionamento — imobiliária padrão",
        paragraphs: [
          "Sistema de comissões para apartamentos até R$ 300 mil. A comissão é ajustada conforme o número de parcelas que o cliente escolher: mais parcelas, comissão mais baixa; menos parcelas, comissão mais alta.",
        ],
        table: {
          headers: ["Parcelamento", "Comissão"],
          rows: [
            ["Sem pró-soluto", "4,75%"],
            ["1 até 36x", "4,25%"],
            ["37 até 48x", "4,00%"],
            ["49 até 52x", "3,75%"],
            ["53 até 60x", "3,50%"],
            ["61 até 65x", "3,25%"],
          ],
        },
      },
      {
        title: "Regra Tabela Direta",
        paragraphs: [
          "Ato: 10%.",
          "Obras: 30%.",
          "Pós-obras: 60%.",
          "Até 120x.",
          "Sempre validar as regras do mês na tabela direta.",
        ],
      },
      {
        title: "Regra Tabela Investidor",
        paragraphs: [
          "Parcelamento em período de obras. Essa modalidade não possui juros na tabela.",
          "Sempre validar as regras do mês na tabela investidor.",
        ],
      },
    ],
  },
  {
    slug: "campanha-do-mes",
    title: "Campanha do Mês",
    description:
      "Materiais históricos de julho disponibilizados na referência. Eles não comprovam uma campanha vigente em outubro de 2026.",
    sourcePage: "p_1su328fxtd",
    sections: [
      {
        title: "Campanha do mês",
        paragraphs: [
          "Acesse os materiais para consultar as informações da campanha. A referência apresenta condições comerciais da Direcional para julho, sem informar o ano, e a campanha e política comercial Riva SP de julho de 2025.",
          "Esses materiais são históricos. Confirme as condições vigentes com a coordenação antes de utilizá-los em uma negociação.",
        ],
        items: [
          {
            label: "Direcional — Condições comerciais de julho",
            href: "https://drive.google.com/file/d/15A7nPdHPH8J2YofcwqYab7GlEIKg9f5I/view?usp=sharing",
            description: "A imagem da referência não informa o ano.",
          },
          {
            label: "Riva SP — Campanha + Política Comercial Julho/25",
            href: "https://drive.google.com/file/d/1JYXi1ddgihZL7NK-1dvSxVS9tbISvgdz/view?usp=sharing",
            description: "Material de julho de 2025.",
          },
        ],
      },
    ],
  },
  {
    slug: "app-bora-vender",
    title: "App Bora Vender",
    description: "Acesso à plataforma, cadastro de imobiliárias e tutoriais de utilização.",
    sourcePage: "p_ofohq6zrrd",
    sections: [
      {
        title: "Sobre o App Bora Vender",
        paragraphs: [
          "O Bora Vender é uma plataforma desenvolvida pelo grupo Direcional com o objetivo de otimizar o processo de vendas e facilitar a gestão comercial de forma prática e eficiente.",
          "Com ela, é possível fazer simulações de propostas; cadastrar e gerenciar clientes; realizar análise de crédito; controlar e acompanhar negociações; gerar propostas personalizadas; consultar contratos firmados; visualizar o estoque e suas avaliações; e emitir notas de comissionamento.",
          "Tudo isso em um só lugar, proporcionando mais agilidade, organização e controle para os times de vendas.",
        ],
      },
      {
        title: "Acesse o Bora Vender",
        items: [
          { label: "Computador", href: "https://boravender.app.br/login" },
          {
            label: "Dispositivo iOS",
            href: "https://apps.apple.com/br/app/bora-vender-grupo-direcional/id6449042919",
          },
          {
            label: "Dispositivo Android",
            href: "https://play.google.com/store/apps/details?id=br.com.direcional.boravender",
          },
        ],
      },
      {
        title: "Cadastre sua imobiliária conosco",
        paragraphs: [
          "Se você ainda não cadastrou sua imobiliária no Bora Vender, não fique de fora dessa oportunidade. Ser um parceiro Direcional/Riva é simples e traz inúmeros benefícios.",
          "Para realizar o cadastro, envie CRECI PJ, contrato social, cartão CNPJ atualizado nos últimos 30 dias, dados bancários (nome, CNPJ, banco, agência e conta), RG e CPF dos sócios.",
          "Todos os documentos devem ser reunidos em um único PDF e encaminhados para leandro.santos@direcionalvendas.com.br.",
          "Assunto do e-mail: Cadastro Imobiliária [Nome da sua imobiliária].",
          "Corpo do e-mail: Prezados, segue as informações para o cadastro da imobiliária parceira. Nome do Responsável: [Seu nome]. Telefone: (XX) XXXXX-XXXX. E-mail: XXX@XXXXXX. Nome da Empresa: [Nome da sua imobiliária]. CNPJ: XX.XXX.XXX/XXXX-XX. Nº CRECI PJ: XXXXXXX-J.",
        ],
        items: [
          {
            label: "Parcerias — Coordenação Leandro Lucas — (11) 91715-3404",
            href: "https://wa.me/5511917153404",
          },
        ],
      },
      {
        title: "Como eu sei que fui cadastrado?",
        paragraphs: [
          "Prazo de cadastro: o processo de cadastro leva até 48 horas após o envio dos documentos, considerando apenas dias úteis.",
          "Importante: após a conclusão do cadastro, será necessário participar de um treinamento sobre os processos internos do grupo Direcional. Esse treinamento garante que todas as dúvidas sejam esclarecidas, proporcionando mais segurança e eficiência na realização das atividades.",
          "Ficamos à disposição para qualquer dúvida!",
        ],
      },
      {
        title: "Guia em vídeo — Descomplica",
        paragraphs: [
          "O Descomplica é uma plataforma onde você encontra vídeos tutoriais explicando como utilizar o sistema Bora Vender. Para acessar, basta clicar nos vídeos e assistir. Em caso de dúvidas, entre em contato com o coordenador ou um dos supervisores disponíveis na aba WhatsApp.",
        ],
        items: [
          {
            label: "1 — Como fazer login no Bora e cadastrar o cliente",
            href: "https://drive.google.com/file/d/11IwmamLw6t0G94nHCC_06Z_F_b18b17L/view?usp=sharing",
          },
          {
            label: "2 — Como cadastrar um proponente e anexar documentação",
            href: "https://drive.google.com/file/d/1Hcsecss1dndmL7XOQ6LnrO5BU2YB3u8w/view?usp=sharing",
          },
          {
            label: "3 — Como enviar para análise de crédito e acompanhar a aprovação",
            href: "https://drive.google.com/file/d/1DimS_2eZwsqPGRdeEjAbAv2vOSfmcXix/view?usp=sharing",
          },
          {
            label: "4 — Como fazer uma proposta e criar uma cotação",
            href: "https://drive.google.com/file/d/1QNbhuPFnqnjG9I92NV_HaHE67kuxmUVo/view?usp=sharing",
          },
          {
            label: "5 — Como visualizar avaliação, estoque, BA e VC",
            href: "https://drive.google.com/file/d/1gpKCbb9YAisai_0fRxlghFQQrp2S5lgv/view?usp=sharing",
          },
          {
            label: "PDF — Passo a passo das comissões no App Bora Vender",
            href: "https://drive.google.com/file/d/1zs9YNmE2SN3d3J5pxDUHDMndQ-k9o4IV/view?usp=sharing",
          },
        ],
      },
    ],
  },
  {
    slug: "linktree-liveprint",
    title: "Linktree e Liveprint",
    description: "Materiais de divulgação e personalização para empreendimentos Direcional e Riva.",
    sourcePage: "p_numizmxjtd",
    sections: [
      {
        title: "Acesse o Linktree",
        paragraphs: [
          "Neste espaço, você pode acessar o material de diversos empreendimentos da Direcional e da Riva, incluindo PDFs para download, mídias de eventos, logos institucionais e muito mais.",
        ],
        items: [
          { label: "Linktree Direcional", href: "https://linktr.ee/direcionalsp" },
          { label: "Linktree Riva", href: "https://linktr.ee/rivaincorporadorasp" },
        ],
      },
      {
        title: "Acesse o Live Print",
        paragraphs: [
          "Aqui você pode acessar os materiais e personalizá-los com seu nome e número de telefone, proporcionando uma experiência mais personalizada para o seu cliente. Uma excelente ferramenta para despertar ainda mais o interesse do mesmo. Acesse e aproveite!",
        ],
        items: [
          { label: "Live Print Direcional", href: "https://direcional-sp.liveprint.com.br/" },
          { label: "Live Print Riva", href: "https://riva-sp.liveprint.com.br/" },
        ],
      },
    ],
  },
];
