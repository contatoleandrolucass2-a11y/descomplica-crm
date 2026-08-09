# Plano de conta QA sintética

## Ambiente local/isolado

Criar UUIDs e e-mails `example.test` efêmeros pela Auth Admin API da stack
local. Nunca reutilizar conta Master/Admin pessoal e nunca persistir senha,
token ou sessão em arquivo versionado.

Matriz mínima:

- 1 Master global;
- 1 Admin por organização A/B;
- 1 Coordenador por carteira/equipe;
- 1 Gerente por equipe;
- 1 Corretor por pessoa;
- 1 Imobiliária, 1 House e 1 Canal de Parcerias;
- 1 usuário pending;
- 1 grant expirado.

Dados sintéticos: organizações A/B, equipes A1/A2/B1, carteiras geral e
partnership, pessoas sem nomes reais e identidades externas fictícias. Cada
teste roda em transaction/rollback ou remove o usuário pela mesma Admin API.

## Fluxo

1. validar que o endpoint é localhost/homologação autorizado;
2. criar usuário pending e confirmar zero acesso;
3. aprovar por RPC com papel, scope e reason;
4. testar banco, REST/API e interface por papel;
5. testar IDs adulterados, acesso horizontal, grant expirado e JWT sem claim;
6. remover sessões, usuários e dados sintéticos;
7. verificar que não restou credencial nem artefato de usuário.

## QA futura de produção

Exige autorização separada, conta QA dedicada e organização/carteira sintética
isolada. Criação em produção não faz parte deste PR. A conta deve ter owner,
expiração, MFA quando disponível, rotação e runbook de remoção. Até esse gate,
comparação autenticada de produção permanece bloqueada.
