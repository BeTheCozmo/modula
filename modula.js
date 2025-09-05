#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const commander = require('commander');
const { input, password, select, confirm } = require('@inquirer/prompts'); // Nova importação
const axios = require('axios');

const program = new commander.Command();
const BASE_URL = process.env.MODULA_API_URL || 'http://localhost:3031';
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
    console.error('Erro: Você precisa logar primeiro com "modula login".');
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
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

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
      console.log('Registro bem-sucedido:', response.data);
    } catch (error) {
      console.error('Erro ao registrar:', error.response ? error.response.data : error.message);
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
      console.log('Login bem-sucedido. Token armazenado.');
    } catch (error) {
      console.error('Erro ao logar:', error.response ? error.response.data : error.message);
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
    console.log('Logout realizado. Token removido.');
  });

// Comando: list
program
  .command('list')
  .description('Lista todos os módulos registrados')
  .action(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/module`, { headers: getAuthHeaders() });
      console.log('Módulos registrados:');
      response.data.forEach(mod => {
        console.log(`- ID: ${mod._id}, Nome: ${mod.name}, Descrição: ${mod.description}, Tool: ${mod.tool}`);
      });
    } catch (error) {
      console.error('Erro ao listar módulos:', error.response ? error.response.data : error.message);
    }
  });

// Comando: view <id>
program
  .command('view <id>')
  .description('Mostra detalhes de um módulo específico')
  .action(async (id) => {
    try {
      const response = await axios.get(`${BASE_URL}/module/${id}`, { headers: getAuthHeaders() });
      console.log('Detalhes do módulo:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Erro ao visualizar módulo:', error.response ? error.response.data : error.message);
    }
  });

// Comando: download <id>
program
  .command('download <id>')
  .description('Baixa o conteúdo de um módulo e constrói na pasta atual')
  .action(async (id) => {
    const buildPath = process.cwd() + '/'  ;
    try {
      const response = await axios.get(`${BASE_URL}/module/${id}/content`, { headers: getAuthHeaders() });
      const nodes = response.data;
      const buildPath = process.cwd() + '/' + nodes.name;
      createFromNodes(nodes.content, buildPath);
      console.log(`Módulo baixado e construído em: ${buildPath}`);
    } catch (error) {
      console.error('Erro ao baixar módulo:', error.response ? error.response.data : error.message);
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
      console.log('Módulo enviado com sucesso:', response.data);
    } catch (error) {
      console.error('Erro ao enviar módulo:', error.response ? error.response.data : error.message);
    }
  });

// Comando: delete <id>
program
  .command('delete <id>')
  .description('Exclui um módulo')
  .action(async (id) => {
    const sure = await confirm({ message: `Tem certeza que deseja excluir o módulo ${id}?` });
    if (!sure) {
      console.log('Exclusão cancelada.');
      return;
    }
    try {
      await axios.delete(`${BASE_URL}/module/${id}`, { headers: getAuthHeaders() });
      console.log(`Módulo ${id} excluído com sucesso.`);
    } catch (error) {
      console.error('Erro ao excluir módulo:', error.response ? error.response.data : error.message);
    }
  });

program.parse(process.argv);