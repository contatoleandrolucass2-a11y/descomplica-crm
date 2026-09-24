# Ambiente local do Descomplica CRM no Windows

O script `scripts/windows/bootstrap-local.ps1` sincroniza a branch de transporte
do servidor com o projeto local, preserva alterações locais existentes em um
`git stash`, seleciona o melhor modelo disponível no catálogo autenticado do
Codex, prepara Node/pnpm, cria `.env.local` a partir do exemplo quando necessário
e executa o gate completo do repositório.

Execute no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\bootstrap-local.ps1
```

O modelo `gpt-6-astra` só é gravado quando aparece em `codex debug models`.
Configuração local não concede acesso a um modelo indisponível. Enquanto a Astra
não estiver liberada, o bootstrap mantém `gpt-5.6-sol` como fallback funcional.

Segredos do servidor não são copiados. O `.env.local` nasce apenas do
`.env.example` e deve receber credenciais próprias do ambiente local.
