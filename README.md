# Modula CLI

Uma interface de linha de comando (CLI) poderosa para gerenciar módulos programáticos no sistema Modula. Com a `modula`, você pode registrar, fazer login, listar, visualizar, baixar, enviar e excluir módulos em um servidor centralizado, otimizando o reaproveitamento de código em projetos Angular, NestJS e outras tecnologias.

## Funcionalidades

- **Autenticação**: Registre-se e faça login com um token seguro armazenado localmente.
- **Gerenciamento de Módulos**:
  - Liste todos os módulos registrados.
  - Visualize detalhes de um módulo específico.
  - Baixe módulos e reconstrua a estrutura de arquivos localmente.
  - Envie módulos a partir de diretórios locais.
  - Exclua módulos do servidor com confirmação.
- **Configuração Flexível**: Defina a URL do servidor via variável de ambiente (`MODULA_API_URL`).
- **Interatividade**: Prompts intuitivos com suporte a máscaras para senhas.

## Pré-requisitos

- **Node.js**: Versão 18.x ou superior (testado com v22.18.0).
- **npm**: Incluído com o Node.js.
- **Servidor Modula**: Um servidor Modula rodando (padrão: `http://10.8.0.2:3031`).

## Instalação

Instale o Modula CLI globalmente via npm:

```bash
npm install -g @bethecozmo/modula
```

Isso registra o comando `modula` para uso em qualquer diretório.

## Configuração

A CLI se conecta ao servidor Modula. Por padrão, usa `http://10.8.0.2:3031`. Para configurar uma URL diferente:

- **Usando variável de ambiente** (Linux/Mac):
  ```bash
  export MODULA_API_URL=https://api.modula.com
  ```
  Para tornar permanente, adicione ao `~/.bashrc` ou `~/.zshrc`:
  ```bash
  echo 'export MODULA_API_URL=https://api.modula.com' >> ~/.bashrc
  source ~/.bashrc
  ```

- **Windows (CMD)**:
  ```cmd
  set MODULA_API_URL=https://api.modula.com
  ```
  Para persistência:
  ```cmd
  setx MODULA_API_URL https://api.modula.com
  ```

- **Usando `.env` (opcional)**:
  1. Instale o `dotenv`:
     ```bash
     npm install dotenv
     ```
  2. Crie um arquivo `.env` no diretório onde você executa os comandos:
     ```env
     MODULA_API_URL=https://api.modula.com
     ```
  3. Adicione no início do `modula.js` (se você tiver acesso ao código-fonte):
     ```javascript
     require('dotenv').config();
     ```

## Comandos

```bash
modula [comando]
```

| Comando                  | Descrição                                                                 |
|--------------------------|---------------------------------------------------------------------------|
| `modula register`        | Registra um novo usuário (nome, nickname, email, senha).                   |
| `modula login`           | Faz login e armazena o token em `~/.modula/config.json`.                  |
| `modula logout`          | Remove o token armazenado.                                                |
| `modula list`            | Lista todos os módulos registrados no servidor.                            |
| `modula view <id>`       | Exibe detalhes de um módulo específico pelo ID.                            |
| `modula download <id>` | Baixa o conteúdo de um módulo e o reconstrói localmente (padrão: diretório atual). |
| `modula upload <localPath>` | Envia um diretório local como novo módulo, com nome, descrição e ferramenta. |
| `modula delete <id>`     | Exclui um módulo do servidor (com confirmação).                            |

Use `modula help` ou `modula [comando] --help` para mais detalhes.

## Exemplos

1. **Registrar um usuário**:
   ```bash
   modula register
   ```
   - Digite nome, nickname, email e senha quando solicitado.

2. **Fazer login**:
   ```bash
   modula login
   ```
   - Insira email e senha. O token será salvo em `~/.modula/config.json`.

3. **Listar módulos**:
   ```bash
   modula list
   ```
   - Exibe IDs, nomes, descrições e ferramentas dos módulos.

4. **Visualizar um módulo**:
   ```bash
   modula view 68ba9832f3b5029aed2ea274
   ```

5. **Baixar um módulo**:
   ```bash
   modula download 68ba9832f3b5029aed2ea274
   ```
   - Reconstrói a estrutura do módulo no diretório atual com o nome registrado do módulo.

6. **Enviar um módulo**:
   ```bash
   modula upload ./src/app/test-module
   ```
   - Captura a estrutura de diretórios em `./src/app/test-module` e solicita nome, descrição e ferramenta (ex.: `angular`, `nestjs`).

7. **Excluir um módulo**:
   ```bash
   modula delete 68ba9832f3b5029aed2ea274
   ```
   - Confirma antes de excluir.

## Estrutura do Módulo

Os módulos enviados ou baixados seguem o formato:
```json
{
  "name": "Test Module",
  "description": "This is a description for Test Module",
  "path": "src/app/test-module",
  "tool": "angular",
  "nodes": [
    {
      "type": "file",
      "name": "main.txt",
      "content": "Hello, world!"
    },
    {
      "type": "directory",
      "name": "segredos",
      "children": [
        {
          "type": "file",
          "name": "elogios.txt",
          "content": "você é muito cheiroso(a)"
        }
      ]
    }
  ]
}
```

## Notas (Desconsidere se não fará manutenção)

- **Autenticação**: Todos os comandos, exceto `register` e `login`, requerem um token válido (obtido via `login`).
- **Servidor**: Certifique-se de que o servidor Modula está rodando e acessível na URL configurada.
- **Erro na rota DELETE**: O comando `delete` usa `DELETE /module/:id`. Confirme com o backend se a rota está correta.
- **Token**: O login assume que a rota `/auth/login` retorna `{ access_token: '...' }`. Ajuste o código se o formato for diferente.

## Solução de Problemas

- **Erro: "command not found: modula"**:
  - Verifique se instalou globalmente com `npm install -g @bethecozmo/modula`.
  - Confirme que o npm global está no PATH: `npm bin -g`.
- **Erro: "Você precisa logar primeiro"**:
  - Execute `modula login` antes de usar outros comandos.
- **Erro de conexão com o servidor**:
  - Verifique se o servidor está rodando e se `MODULA_API_URL` está correto.

## Publicação no npm (para mantenedores)

1. Crie uma conta no [npmjs.com](https://www.npmjs.com).
2. No diretório do projeto, faça login:
   ```bash
   npm login
   ```
3. Publique o pacote:
   ```bash
   npm publish --access public
   ```
   - Nota: O nome `modula` no `package.json` deve ser único. Se já estiver em uso, escolha outro nome ou use um escopo (ex.: `@seu-nome/modula`).

## Contribuindo

Sinta-se à vontade para abrir issues ou pull requests no repositório oficial (se disponível). Para feedback, entre em contato com a equipe de desenvolvimento.

## Licença

MIT License. Veja [LICENSE](LICENSE) para detalhes.