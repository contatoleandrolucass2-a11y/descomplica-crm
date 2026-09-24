# Ambiente local do Descomplica CRM no Windows

O script `scripts/windows/bootstrap-local.ps1` sincroniza a branch de transporte
do servidor com o projeto local, preserva alterações locais existentes em um
`git stash`, seleciona o melhor modelo disponível no catálogo autenticado do
Codex, instala e verifica o Node 24.19.0 oficial quando necessário, prepara pnpm,
cria `.env.local` a partir do exemplo e executa o gate completo do repositório.

A distribuição portátil do Node é baixada de `nodejs.org`, conferida com o
SHA-256 oficial, instalada em `%LOCALAPPDATA%\DescomplicaCRM\tools` e adicionada
ao PATH do usuário. O processo não depende do Windows Installer.

Se a pasta já for um repositório Git sem remote `origin`, o bootstrap adiciona
o remote oficial automaticamente. Um `origin` existente com outra URL continua
falhando fechado para evitar sincronizar o projeto errado.

Se esse repositório ainda não tiver commit e contiver arquivos, a pasta inteira
é renomeada com o sufixo `backup-AAAAMMDD-HHMMSS` antes de um clone limpo. Nada
é descartado.

O bootstrap configura o checkout local com finais de linha LF e regrava apenas
os arquivos versionados depois de preservar mudanças locais. Isso mantém os
testes textuais idênticos entre Windows e Linux.

Execute no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\bootstrap-local.ps1
```

A Astra só é gravada quando aparece no catálogo autenticado, pelo identificador
ou pelo nome exibido. Configuração local não concede acesso a um modelo
indisponível. Enquanto a Astra não estiver liberada, o bootstrap seleciona o
melhor fallback conhecido; se o cliente não informar nenhum deles, deixa o
Codex usar automaticamente o modelo padrão disponível para a conta.

Segredos do servidor não são copiados. O `.env.local` nasce apenas do
`.env.example` e deve receber credenciais próprias do ambiente local.
