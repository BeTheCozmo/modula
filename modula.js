#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const commander = require('commander');
const { input, password, select, confirm } = require('@inquirer/prompts'); // Nova importação
const axios = require('axios');
const chalk = require('chalk');

const program = new commander.Command();
const BASE_URL = process.env.MODULA_API_URL || 'http://10.8.0.2:3031';
const CONFIG_DIR = path.join(os.homedir(), '.modula');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Função para carregar/salvar config (incluindo token)
function loadConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config));
}

// Função para obter headers com auth
function getAuthHeaders() {
  const config = loadConfig();
  if (!config.token) {
    console.error(chalk.red('Erro: Você precisa logar primeiro com "modula login".'));
    process.exit(1);
  }
  return { Authorization: `Bearer ${config.token}` };
}

// Função recursiva para capturar estrutura de diretório (para upload)
function buildNodeTree(dirPath) {
  const nodes = [];
  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      nodes.push({
        type: 'directory',
        name: item,
        children: buildNodeTree(fullPath),
      });
    } else {
      nodes.push({
        type: 'file',
        name: item,
        content: fs.readFileSync(fullPath, 'utf-8'),
      });
    }
  });
  return nodes;
}

// Função recursiva para criar estrutura local a partir de nodes (para download)
function createFromNodes(nodes, basePath) {
  // Garantir que o diretório base existe
  if (!fs.existsSync(basePath)) { fs.mkdirSync(basePath, { recursive: true }); }

  nodes.forEach(node => {
    const nodePath = path.join(basePath, node.name);
    if (node.type === 'directory') {
      // Criar diretório (recursivamente, se necessário)
      fs.mkdirSync(nodePath, { recursive: true });
      if (node.children) {
        createFromNodes(node.children, nodePath);
      }
    } else if (node.type === 'file') {
      // Garantir que o diretório pai do arquivo existe
      const dirName = path.dirname(nodePath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      // Escrever o arquivo
      fs.writeFileSync(nodePath, node.content || '');
    }
  });
}

// Comando: register
program
  .command('register')
  .description('Registra um novo usuário')
  .action(async () => {
    const name = await input({ message: 'Nome:' });
    const nickname = await input({ message: 'Nickname:' });
    const email = await input({ message: 'Email:' });
    const pwd = await password({ message: 'Senha:', mask: '*' });
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, {
        name,
        nickname,
        email,
        password: pwd,
      });
      console.log(chalk.green('Registro bem-sucedido:'), response.data);
    } catch (error) {
      console.error(chalk.red('Erro ao registrar:'), error.response ? error.response.data : error.message);
    }
  });

// Comando: login
program
  .command('login')
  .description('Loga e armazena o token')
  .action(async () => {
    const email = await input({ message: 'Email:' });
    const pwd = await password({ message: 'Senha:', mask: '*' });
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, { email, password: pwd });
      const config = loadConfig();
      config.token = response.data.access_token; // Assumindo que o response tem { token: '...' }
      saveConfig(config);
      console.log(chalk.green('Login bem-sucedido. Token armazenado.'));
    } catch (error) {
      console.error(chalk.red('Erro ao logar:'), error.response ? error.response.data : error.message);
    }
  });

// Comando: logout
program
  .command('logout')
  .description('Remove o token armazenado')
  .action(() => {
    const config = loadConfig();
    delete config.token;
    saveConfig(config);
    console.log(chalk.green('Logout realizado. Token removido.'));
  });

// Comando: list
program
  .command('list')
  .description('Lista todos os módulos registrados')
  .action(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/module`, { headers: getAuthHeaders() });
      console.log(chalk.cyan.bold('\n=== Módulos Registrados ===\n'));
      response.data.forEach((mod, index) => {
        console.log(`${chalk.bold('Nome:')} ${chalk.whiteBright(mod.name)}`);
        console.log(`${chalk.bold('ID:')} ${chalk.whiteBright(mod._id)}`);
        console.log(`${chalk.bold('Publicador:')} ${chalk.whiteBright(mod.publisherId)}`);
        console.log(`${chalk.bold('Descrição:')} ${chalk.whiteBright(mod.description)}`);
        console.log(`${chalk.bold('Ferramenta:')} ${chalk.whiteBright(mod.tool)}`);
        if (index < response.data.length - 1) {
          console.log(chalk.gray('---'));
        }
      });
      console.log(chalk.cyan.bold('\n===========================\n'));
    } catch (error) {
      console.error(
        chalk.red.bold('Erro ao listar módulos:'),
        chalk.white(error.response ? JSON.stringify(error.response.data, null, 2) : error.message)
      );
    }
  });

// Comando: view <id>
program
  .command('view <id>')
  .description('Mostra detalhes de um módulo específico')
  .action(async (id) => {
    try {
      const response = await axios.get(`${BASE_URL}/module/${id}`, { headers: getAuthHeaders() });
      console.log(chalk.cyan.bold('\n=== Detalhes do Módulo ===\n'));
      console.log(JSON.stringify(response.data, null, 2));
      console.log(chalk.cyan.bold('\n===========================\n'));
    } catch (error) {
      console.error(
        chalk.red.bold('Erro ao visualizar módulo:'),
        chalk.white(error.response ? JSON.stringify(error.response.data, null, 2) : error.message)
      );
    }
  });

// Comando: download <id>
program
  .command('download <id>')
  .description('Baixa o conteúdo de um módulo e constrói na pasta atual')
  .action(async (id) => {
    try {
      const response = await axios.get(`${BASE_URL}/module/${id}/content`, { headers: getAuthHeaders() });
      const nodes = response.data;
      const buildPath = process.cwd() + '/' + nodes.name;
      createFromNodes(nodes.content, buildPath);
      console.log(chalk.green(`Módulo baixado e construído em: ${buildPath}`));
    } catch (error) {
      console.error(chalk.red('Erro ao baixar módulo:'), error.response ? error.response.data : error.message);
    }
  });

// Comando: upload <localPath>
program
  .command('upload <localPath>')
  .description('Captura estrutura de diretório local e envia como novo módulo')
  .action(async (localPath) => {
    if (!fs.existsSync(localPath)) {
      console.error('Erro: Caminho local não existe.');
      return;
    }
    const name = await input({ message: 'Nome do módulo:' });
    const description = await input({ message: 'Descrição:' });
    const tool = await select({
      message: 'Tool:',
      choices: [
        { name: 'angular', value: 'angular' },
        { name: 'nestjs', value: 'nestjs' },
        { name: 'react', value: 'react' },
        { name: 'vue', value: 'vue' },
        { name: 'bash', value: 'bash' },
        { name: 'js-scripts', value: 'js-scripts' },
        { name: 'other', value: 'other' },
      ],
    });
    const nodes = buildNodeTree(localPath);
    const payload = {
      name,
      description,
      path: localPath,
      tool,
      nodes,
    };
    try {
      const response = await axios.post(`${BASE_URL}/module`, payload, { headers: getAuthHeaders() });
      console.log(chalk.green('Módulo enviado com sucesso:'), response.data);
    } catch (error) {
      console.error(chalk.red('Erro ao enviar módulo:'), error.response ? error.response.data : error.message);
    }
  });

// Comando: delete <id>
program
  .command('delete <id>')
  .description('Exclui um módulo')
  .action(async (id) => {
    const sure = await confirm({ message: `Tem certeza que deseja excluir o módulo ${id}?` });
    if (!sure) {
      console.log(chalk.red('Exclusão cancelada.'));
      return;
    }
    try {
      await axios.delete(`${BASE_URL}/module/${id}`, { headers: getAuthHeaders() });
      console.log(chalk.green(`Módulo ${id} excluído com sucesso.`));
    } catch (error) {
      console.error(chalk.red('Erro ao excluir módulo:'), error.response ? error.response.data : error.message);
    }
  });

program.parse(process.argv);