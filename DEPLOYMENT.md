# Implantação

## Alvo

VPS Hostinger KVM 1, Linux suportado, Node.js 24 LTS, aplicação Next.js `standalone`, PM2 e Nginx com HTTPS. A preparação local não altera VPS, DNS ou produção.

## Pré-requisitos da VPS

- Usuário de deploy sem login direto como root.
- Firewall permitindo somente SSH restrito, HTTP e HTTPS.
- Node 24.19.x, pnpm 11.20.x e PM2.
- Nginx, certificado TLS e rotação de logs.
- Variáveis de ambiente em arquivo com permissão restrita ou gerenciador de segredos.
- Backup validado antes de cada alteração de banco.

## Artefato

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Copiar `.next/standalone`, `.next/static` e `public` para uma release imutável. Não copiar `.env.local`, código-fonte desnecessário, caches ou lockfiles de outros gerenciadores.

## Homologação

1. Criar diretório versionado de release.
2. Instalar/configurar variáveis do ambiente de homologação.
3. Aplicar migrations somente após backup e revisão.
4. Iniciar `server.js` no PM2, escutando em loopback.
5. Apontar Nginx para o processo e validar HTTPS.
6. Executar smoke tests de login, autorização, páginas, APIs e integrações.
7. Monitorar logs, memória, CPU e erros.

## Rollback

- Aplicação: alterar o symlink `current` para a release anterior e recarregar PM2/Nginx.
- Banco: preferir migrations aditivas e backward-compatible. Uma migration destrutiva exige backup, janela e rollback específico testado.
- Segredos: restaurar por gerenciador, nunca por Git.

## Produção

Produção não será publicada automaticamente. Exige autorização explícita após homologação e relatório de testes.
