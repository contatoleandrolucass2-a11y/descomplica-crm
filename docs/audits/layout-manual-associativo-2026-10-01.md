# Associativo: layout compacto e manual

Data: 01/10/2026. Branch: `codex/associativo-layout-manual`.
Status: publicado e verificado em producao;
runtime `f1d71da81a21cf139acc26b95a6cacc218b79325`.

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

- PR #122 integrado. CI final do PR `36919448507` e da main `36923454213`
  integralmente verdes, incluindo a matriz autenticada contra as referencias revisadas.
- Release `f1d71da81a21cf139acc26b95a6cacc218b79325`;
  anterior `5878c3bce83990496d886c3311527724beb7d9f9`.
- Arquivo da imagem SHA-256
  `901f2a1d5ad06782dbf623ee4c4d746be17743df8452b3f6de80eea4736dacf8`.
- Configuracao da imagem da CI
  `sha256:912ca908f37a158303a161fac1bab3653b9767524c7094bc2ff2d5240c01aff6`;
  manifesto carregado
  `sha256:33bd2f02b431ee5d49800aa78a2261e2cfa281ed51fe0593b4b690ddcac9ac54`.
  Onze camadas equivalentes, sem rebuild; dois perfis de runtime aprovados.
- Backup privado de configuracao e imagem anterior em
  `/var/backups/descomplica-crm/releases/f1d71da81a21cf139acc26b95a6cacc218b79325.0KRX4M`.
  CAS da versao anterior conferido; rollback preparado; nao foi necessario aciona-lo.
- Health local/publico confirma a release. Nginx permaneceu identico e valido.
  Estoque e snapshot anonimos retornam 401.
- Smoke observacional: doze GETs, concorrencia quatro, zero erros, 141–543ms.
  Nao executa carga no banco de producao e nao comprova capacidade multiusuario.
- Navegador autenticado: 1280x580 nos tres temas, overflow global zero e rodape
  termina em 537,11px. Dez linhas visiveis, botao 32px, folga horizontal total
  25,33px, contorno externo 8px. Gradiente dourado e texto escuro conferidos.
- Abaixo da altura desktop validada, a rolagem e preservada: 1280x529 apresentou
  16px de overflow, sem esconder ou recortar o conteudo. Mobile/zoom seguem acessiveis.
- Guia abre e fecha por Escape com retorno de foco ao acionador. Nenhum erro ou
  aviso de console. Nenhuma unidade real selecionada ou proposta alterada.
- Viewport temporario removido, tema original restaurado e pagina atualizada aberta.
- Nenhuma captura de estoque real, dado de cliente ou anexo privado foi versionado.
  A atualizacao deste registro e apenas documental: Git/Obsidian, sem novo restart.
