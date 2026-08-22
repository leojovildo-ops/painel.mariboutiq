# Onde o acesso é barrado

Não existe `middleware.ts`. Toda página do painel vive dentro de `src/app/(app)/`,
e o `layout.tsx` deste grupo chama `requireUser()` no servidor antes de renderizar
qualquer coisa — sem sessão, redireciona para `/login`. A tela de Administração
chama `requireAdmin()`, e cada rota de API confere o perfil com `apiUser()`.

O middleware existia só como uma segunda camada sobre essa mesma verificação, e
foi removido porque no Next 14 ele roda obrigatoriamente no runtime Edge, que os
deploys anônimos da Vercel não aceitam. A checagem que vale — a do servidor,
junto ao banco — continua igual.
