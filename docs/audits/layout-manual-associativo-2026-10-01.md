# Associativo: layout compacto e manual

Data: 01/10/2026. Branch: `codex/associativo-layout-manual`.
Status: validacao local e matriz funcional autenticada aprovadas;
referencias revisadas, CI final e publicacao pendentes.

## Escopo

- Tela inicial: margens menores, filtros sem contorno duplicado e rodape compacto.
- Dez unidades visiveis, mantendo todo o estoque na rolagem interna virtualizada.
- Ouro metalizado com texto escuro em hover, foco e selecao persistente.
- Guia com largura do texto mais 12px de padding lateral; 32px em ponteiro
  preciso e 44px em toque. Sem pulso decorativo continuo.
- Contornos de 6/8px, superficies dos tokens existentes e sombras reduzidas.
- FAQ em coluna unica: 43 perguntas do anexo, cinco contextuais e guia de
  27 campos. Fontes e divergencias em [auditoria do FAQ](faq-associativo-2026-10-01.md).
- Nao altera calculos, regras comerciais, autenticacao, banco ou n8n.

## Criterios e evidencias

- Viewport inicial 1280x580: sem rolagem global e sem `overflow:hidden` para
  ocultar conteudo. Em mobile e zoom restrito a rolagem permanece acessivel.
- QA de navegacao exige a geometria inicial nos tres temas antes de selecionar
  a unidade. Selecionar e limpar filtros conserva a proposta, tambem nos tres temas.
- QA do manual: 30 capturas, cinco viewports, tres temas, teclado, foco,
  ancoras e axe aprovados em previa isolada com estoque sintetico.
- A previa usa componentes reais e stubs de Next; nao comprova autenticacao.
  A matriz autenticada deve passar na CI antes de promover referencias ou publicar.
- Revisao independente encontrou superficies transparentes e conflito de raio
  na aprovacao; corrigidos com cores solidas dos tokens e seletor especifico.
- Lint, tipos, formatacao e testes financeiros/visuais sao gates separados.
  Falhas POSIX no Windows nao sao ignoradas; exigir CI Linux verde.

## Matriz autenticada

- PR #122; CI 36915441302, captura limpa
  `97af50e34c8b877488fff044ea39186350561e10`, mesma arvore do candidato.
- Linux: 82 arquivos, 1.006 testes aprovados, quatro skips condicionais;
  oito testes Node adicionais aprovados. Lint, tipos, formatacao e build verdes.
- Banco, advisors, restore isolado e E2E de autorizacao aprovados.
- Matriz funcional canonica aprovada: 40 navegacoes, 193 auditorias axe,
  zoom, teclado e manual em 30 capturas, cinco viewports e tres temas.
- Onze diferencas esperadas em capturas do Associativo, revisadas em desktop,
  tablet e mobile. As demais 182 referencias permanecem sem alteracao.
- Promocao pela rotina canonica transacional, verificando hashes de candidato
  e baseline, captura limpa e gate funcional. Limiares mantidos em 1%/16.
- Windows local: 1.003 aprovados, um skip e seis falhas POSIX/symlink;
  a semantica correspondente foi validada em Linux, sem ignorar testes.
- QA local: 40/40 navegacoes e 30 capturas do manual. Build final aprovado.

## Publicacao

Pendente. Exige PR, CI no SHA candidato, revisao visual das diferencas esperadas,
imagem imutavel, checksum, prova dos perfis, backup, CAS e verificacao pos-deploy.
Nenhuma captura de estoque real, dado de cliente ou anexo privado foi versionado.
