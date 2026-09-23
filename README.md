# Calculadora Extras — apenas no dispositivo

Esta versão não usa token, Supabase nem ligação à API do GitHub. Os registos ficam guardados automaticamente no navegador do telemóvel ou computador. O GitHub Pages serve apenas os ficheiros da aplicação.

## Funcionalidades mantidas

- Registo de dias extra e valores anuais;
- Deteção automática de sábados, domingos e feriados nacionais portugueses;
- Opção manual para marcar um feriado;
- Períodos salariais de 21 a 20;
- Prémios e observações mensais;
- Relatório mensal vertical adaptado ao telemóvel, com botão Voltar, scroll apenas para baixo e PDF limitado a uma página;
- Partilha nativa do PDF para WhatsApp, email e outras aplicações instaladas, além da opção Guardar PDF;
- Instalação no ecrã principal com o logótipo fornecido;
- Importação e exportação manual do `Disco.xlsx`;
- Menu hambúrguer no canto superior direito com Meses, seleção/criação/eliminação do ano e exportação do `Disco.xlsx`;
- Secção **Vista** com interruptores para mostrar ou ocultar a carta de dados locais, as definições de valores e os valores monetários;
- Cabeçalho compacto apenas com o nome, tema claro/escuro e menu.

## Como publicar

1. Substitua o conteúdo do repositório pelos ficheiros desta pasta.
2. O ficheiro `index.html` deve ficar diretamente na raiz do repositório.
3. Faça **Commit changes**.
4. Em **Settings → Pages**, selecione **Deploy from a branch**, branch `main` e pasta `/(root)`.
5. Aguarde a publicação e abra novamente o endereço da aplicação.

Não é necessário criar ou introduzir qualquer token. Esta versão remove do navegador o token que possa ter ficado guardado pela versão anterior, sem apagar os dados da calculadora.

## Guardar uma cópia no Excel

1. Abra a aplicação.
2. Carregue em **Exportar Disco.xlsx**.
3. O ficheiro será descarregado para a pasta de transferências do dispositivo.
4. Guarde esse ficheiro num local seguro. A exportação cria as folhas:
   - `Estado App`: cópia completa usada para restaurar a aplicação;
   - `Resumo`: resumo mensal, períodos, prémios e observações;
   - `Dias Extra`: detalhe dos dias registados.

O navegador não pode substituir automaticamente um Excel já existente. Uma nova transferência pode aparecer como `Disco (1).xlsx`; pode apagar a cópia antiga e mudar o nome da nova para `Disco.xlsx`.

## Restaurar ou passar os dados para outro dispositivo

1. Abra a aplicação no dispositivo de destino.
2. Carregue em **Importar Disco.xlsx**.
3. Escolha um Excel anteriormente exportado por esta aplicação.
4. Confirme a substituição dos dados locais.

A importação substitui todos os dados atuais do dispositivo pelos dados da folha `Estado App`. Exporte primeiro uma cópia de segurança se quiser conservar os dados atuais.

## Onde ficam os dados

Os dados principais ficam no armazenamento local do navegador. Por isso:

- Não limpe os dados do site/browser sem exportar primeiro o Excel;
- A aplicação instalada e o browser devem usar o mesmo endereço do GitHub Pages;
- Outro browser ou dispositivo não recebe os dados automaticamente;
- Faça exportações regulares do `Disco.xlsx` como cópia de segurança.

Depois da primeira abertura completa, os ficheiros necessários ficam disponíveis para utilização offline. A importação e a exportação do Excel também funcionam sem ligação à internet.
