# Calculadora Extras — GitHub Pages

Aplicação estática em português para registar dias extra, calcular ciclos salariais de **21 a 20**, consultar feriados nacionais portugueses (automáticos e marcados manualmente), exportar um PDF mensal e exportar todos os dados para Excel. A versão original foi preservada sem frameworks ou processo de build.

## O que está incluído

- `index.html`: aplicação completa original, com armazenamento local, anos, valores, feriados automáticos/manuais e PDF mensal.
- `config.js`: placeholders para o URL e a **anon key pública** do Supabase. Não contém segredos.
- `supabase-sync.js` e `supabase-setup.sql`: autenticação por magic link e sincronização privada do estado completo como JSON por utilizador.
- `Disco.xlsx`: ficheiro modelo/inicial fornecido.
- Exportação `📊 Exportar todos os dados para Excel`, com folhas `Resumo` e `Dias Extra`, os 12 ciclos de cada ano configurado, períodos 21–20, dias ordenados, extras, prémios, total bruto e observações. Usa SheetJS por CDN.
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` e `apple-touch-icon.png`: PWA instalável. Os ícones foram gerados a partir de `payday_4334644.png`.
- `.nojekyll` para publicação simples no GitHub Pages.

## 1. Criar o projeto Supabase

1. Aceda a <https://supabase.com/dashboard> e crie um projeto.
2. No projeto, abra **SQL Editor** → **New query**.
3. Copie todo o conteúdo de `supabase-setup.sql`, execute-o e confirme que a tabela `public.app_state` e as políticas RLS foram criadas.
4. Abra **Project Settings → API** e copie:
   - **Project URL**;
   - a chave **anon / public**.
5. Nunca copie a `service_role` key para este repositório, browser ou `config.js`.

## 2. Configurar autenticação

1. No Supabase, abra **Authentication → Providers → Email** e ative Email.
2. Para magic links, deixe ativada a autenticação sem palavra-passe (o botão da aplicação usa `signInWithOtp`).
3. Em **Authentication → URL Configuration**, configure **Site URL** para o URL final do GitHub Pages, por exemplo:
   `https://SEU_UTILIZADOR.github.io/SEU_REPOSITORIO/`
4. Em **Redirect URLs**, acrescente exatamente o endereço final, com a barra final, e se necessário a variante sem barra:
   - `https://SEU_UTILIZADOR.github.io/SEU_REPOSITORIO/`
   - `https://SEU_UTILIZADOR.github.io/SEU_REPOSITORIO/index.html`
5. Durante desenvolvimento, também pode acrescentar `http://localhost:8000/`.

## 3. Preencher `config.js`

Abra `config.js` e substitua apenas os dois placeholders:

```js
window.SUPABASE_CONFIG = {
  url: 'https://o-seu-projeto.supabase.co',
  anonKey: 'eyJ...a-chave-anon-publica...'
};
```

A anon key é concebida para ser pública no browser. A proteção é feita pelo Supabase Auth e pelas políticas RLS (`auth.uid() = user_id`). Não adicione qualquer chave secreta.

## 4. Publicar no GitHub Pages

1. Crie um repositório GitHub e coloque **o conteúdo desta pasta na raiz** do repositório (o `index.html` deve ficar na raiz).
2. Faça commit e push de todos os ficheiros, incluindo `config.js` preenchido, `supabase-setup.sql`, `manifest.webmanifest` e os ícones.
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**, a branch (por exemplo `main`) e a pasta `/ (root)`; carregue em **Save**.
5. Aguarde o deployment e abra o URL indicado pelo GitHub. GitHub Pages precisa de HTTPS para Auth e PWA.

## 5. Entrar e testar a sincronização

1. Abra a aplicação publicada.
2. No painel **Conta e sincronização privada**, escreva o seu email e escolha **Entrar por email**.
3. Abra o link mágico recebido. O link regressa ao Redirect URL configurado.
4. Registe um dia, altere um prémio ou uma observação. O indicador passa por `Pendente` e depois `Sincronizado`.
5. Use **Sincronizar** para uma verificação manual.
6. Abra a mesma página noutro browser/telemóvel, entre com o mesmo email e confirme que o estado aparece. Sem internet, os dados continuam no `localStorage`, com estado `Pendente`, e são enviados quando a ligação voltar.
7. Para terminar sessão, escolha **Sair**. Sem sessão, nada é enviado para o Supabase.

## 6. Exportar e instalar no telemóvel

- Abra qualquer mês para o botão original **Exportar PDF (1 página)**.
- No cartão **Histórico de Meses**, escolha **Exportar todos os dados para Excel**. O download cria um XLSX novo com os dados privados atualmente disponíveis no browser. O `Disco.xlsx` incluído é apenas modelo/inicial; a exportação não altera esse ficheiro no repositório.
- Browsers não podem alterar silenciosamente um XLSX guardado num repositório GitHub. Para atualizar o ficheiro, descarregue o XLSX exportado e faça upload/commit manualmente (ou use outro fluxo GitHub autorizado).
- No telemóvel, abra o URL HTTPS publicado e use **Adicionar ao ecrã principal / Instalar aplicação** no menu do browser. O manifesto e os ícones fazem o logótipo aparecer no ecrã.

## Notas de privacidade e segurança

O browser mantém sempre uma cópia local para funcionamento offline. Quando há sessão, o Supabase guarda uma única linha por utilizador em `app_state`, com o estado da aplicação como JSON. As políticas RLS impedem que uma sessão leia ou altere o estado de outro utilizador. Não existe service-role key no projeto.

A biblioteca SheetJS e o cliente Supabase são carregados por CDN. Se o CDN SheetJS estiver indisponível, a aplicação continua a funcionar, mas o botão XLSX pede para tentar novamente; PDF e registo local não dep