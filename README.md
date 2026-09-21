# Calculadora Extras — GitHub Pages

Aplicação estática em português para registar dias extra, calcular ciclos salariais de **21 a 20**, consultar feriados nacionais portugueses, exportar PDF mensal e guardar os dados num `Disco.xlsx` do repositório GitHub. A aplicação original foi preservada sem frameworks nem processo de build.

## Conteúdo

- `index.html`: calculadora original, armazenamento local, anos, valores, feriados automáticos/manuais e PDF.
- `config.js`: configuração pública do proprietário, repositório, branch e caminho do ficheiro. **Não contém token.**
- `github-sync.js`: sincronização opcional pela GitHub Contents API e exportação XLSX.
- `Disco.xlsx`: modelo/inicial fornecido. A sincronização acrescenta as folhas `Estado App`, `Resumo` e `Dias Extra`.
- `manifest.webmanifest`, `sw.js`, ícones e `.nojekyll`: PWA instalável e publicação simples no GitHub Pages.

A folha **Estado App** guarda cada chave `calc_*` e o respetivo valor JSON, permitindo restaurar o estado completo. `Resumo` contém os 12 ciclos dos anos configurados, períodos 21–20, ordenado base, extras, prémios, total bruto e observações. `Dias Extra` contém os registos detalhados. O botão de exportação local descarrega uma cópia XLSX sem alterar diretamente o repositório.

## 1. Criar e limitar o token GitHub

1. Abra **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Escolha **Generate new token** e dê-lhe uma expiração adequada.
3. Em **Repository access**, escolha **Only select repositories** e selecione **apenas o repositório desta aplicação**.
4. Em **Repository permissions**, abra **Contents** e escolha **Read and write**. Não atribua permissões adicionais.
5. Gere o token e copie-o apenas para a aplicação quando for pedido. O token completo só é mostrado uma vez.

O token nunca deve ser colocado em `config.js`, em qualquer ficheiro do repositório, num commit, issue, screenshot ou mensagem. Se for exposto, revogue-o imediatamente em **Settings → Developer settings → Personal access tokens → Fine-grained tokens → ... → Delete/Revoke** e gere outro.

### Aviso de segurança importante

A app guarda o token somente no `localStorage` deste dispositivo para permitir sincronização futura. Qualquer JavaScript ou extensão que corra no mesmo site pode aceder a um token guardado no browser. Use esta opção **estritamente para uso pessoal**, num dispositivo/browser de confiança; não é adequada para uma app pública multiutilizador. O botão **Apagar/desligar** remove o token deste dispositivo sem apagar os dados locais.

## 2. Configurar `config.js`

Edite apenas os valores públicos:

```js
window.GITHUB_CONFIG = {
  owner: 'SEU_UTILIZADOR',
  repo: 'SEU_REPOSITORIO',
  branch: 'main',
  path: 'Disco.xlsx'
};
```

Use o nome exato do proprietário e do repositório. `branch` e `path` podem ser alterados se o ficheiro estiver noutro local, mas o token deve continuar limitado ao único repositório. Nunca adicione o token a este ficheiro.

## 3. Publicar no GitHub Pages

1. Coloque o conteúdo desta pasta na raiz do repositório (o `index.html` deve ficar na raiz).
2. Faça commit e push de `config.js` preenchido, `Disco.xlsx`, `github-sync.js`, `sw.js`, manifesto, ícones e restantes ficheiros.
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**, a branch (normalmente `main`) e a pasta `/ (root)`; carregue em **Save**.
5. Aguarde o deployment e abra o URL HTTPS indicado pelo GitHub.

GitHub Pages precisa de HTTPS para o funcionamento normal da PWA. A primeira abertura pode servir uma versão anterior da cache; recarregue depois da publicação se necessário.

## 4. Colar o token e testar

1. Abra a aplicação publicada.
2. No painel **Guardar Disco.xlsx no GitHub**, cole o fine-grained token e use **Mostrar/Ocultar** apenas se necessário.
3. Escolha **Guardar token**. O token é guardado apenas no `localStorage` deste dispositivo e a app verifica/descarga o `Disco.xlsx`.
4. Altere um dia, prémio, observação ou definição. As chaves `calc_*` ficam **Pendente** e, após um pequeno debounce, a app faz GET para obter o SHA e PUT para criar/atualizar `Disco.xlsx`, com uma mensagem de commit.
5. **Guardar agora** força a sincronização. **Carregar do Excel** descarrega o workbook e, após confirmação, substitui os dados locais pela folha `Estado App`.
6. Se estiver sem internet, o estado fica local e **Pendente**; a tentativa é feita quando a ligação voltar. Sem token, a calculadora continua totalmente funcional offline.
7. Abra a página noutro dispositivo apenas se aceitar colar novamente o token nesse dispositivo. Depois de confirmar o carregamento remoto, o estado é restaurado.

Se o `Disco.xlsx` só tiver o modelo inicial, ou não tiver `Estado App`, a primeira sincronização envia o estado local e cria as folhas necessárias. A app evita loops: uma descarga remota só recarrega a página quando os dados realmente mudam.

## 5. Exportação local e PWA

- No cartão **Histórico de Meses**, use **Exportar todos os dados para Excel (download local)** para descarregar uma cópia com `Estado App`, `Resumo` e `Dias Extra`.
- No detalhe de qualquer mês, use **Exportar PDF (1 página)**.
- No telemóvel, abra o URL HTTPS e escolha **Adicionar ao ecrã principal / Instalar aplicação** no menu do browser.

## Privacidade e revogação

Sem token, nada é enviado para o GitHub. Com token, o conteúdo é enviado apenas para o caminho configurado através da GitHub Contents API; o próprio repositório mantém o histórico de commits. O token não é escrito no workbook. Para desligar neste dispositivo, use **Apagar/desligar**. Para invalidá-lo em todo o lado, revogue-o nas definições de **Fine-grained tokens** e, se necessário, remova ou reverta commits que tenham exposto dados sensíveis.
