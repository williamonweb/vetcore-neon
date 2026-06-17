VETCORE + NEON + VERCEL

Esta versão mantém o sistema funcionando como antes, mas adiciona sincronização com Neon usando API do Vercel.

ARQUIVOS NOVOS:
- package.json
- api/sync.js
- api/health.js
- neon-sync.js

COMO SUBIR:
1. Suba estes arquivos no GitHub.
2. No Vercel, abra o projeto vetcore-agenda.
3. Vá em Settings > Environment Variables.
4. Crie a variável:
   DATABASE_URL = sua connection string do Neon
5. Faça Redeploy.
6. Abra /api/health no domínio do Vercel para testar conexão.
   Exemplo: https://seu-projeto.vercel.app/api/health

LOGIN INICIAL:
Usuário: admin
Senha: admin123

IMPORTANTE:
- Não coloque a DATABASE_URL no index.html, script.js ou neon-sync.js.
- A senha do Neon fica apenas no Vercel em Environment Variables.
- Esta primeira versão usa uma tabela JSONB única para sincronizar os dados do localStorage.
- Depois podemos migrar para tabelas separadas: usuarios, veterinarios, agendamentos etc.
