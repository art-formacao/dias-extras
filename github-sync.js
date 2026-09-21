/* Gravação opcional do Disco.xlsx através da GitHub Contents API.
 * O token é sempre mantido apenas no localStorage deste dispositivo.
 */
(function () {
  'use strict';

  const TOKEN_KEY = 'github_contents_pat';
  const PANEL_HIDDEN_KEY = 'github_sync_panel_hidden';
  const META = {
    changedAt: 'github_sync_changed_at',
    syncedSha: 'github_sync_synced_sha'
  };
  const isCalcKey = key => typeof key === 'string' && key.indexOf('calc_') === 0;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;
  let muted = false;
  let syncTimer = null;
  let syncInProgress = false;
  let panelReady = false;

  function getConfig() {
    const config = window.GITHUB_CONFIG || {};
    return {
      owner: typeof config.owner === 'string' ? config.owner.trim() : '',
      repo: typeof config.repo === 'string' ? config.repo.trim() : '',
      branch: typeof config.branch === 'string' && config.branch.trim() ? config.branch.trim() : 'main',
      path: typeof config.path === 'string' && config.path.trim() ? config.path.trim() : 'Disco.xlsx'
    };
  }

  function configIsValid() {
    const config = getConfig();
    return /^[A-Za-z0-9_.-]+$/.test(config.owner) &&
      /^[A-Za-z0-9_.-]+$/.test(config.repo) &&
      !/^SEU_UTILIZADOR$|^SEU_REPOSITORIO$/.test(config.owner) &&
      !/^SEU_UTILIZADOR$|^SEU_REPOSITORIO$/.test(config.repo) &&
      Boolean(config.branch) && Boolean(config.path);
  }

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setMeta(key, value) { nativeSet.call(localStorage, key, value); }
  function getMeta(key) { return localStorage.getItem(key); }

  function collectState() {
    const state = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!isCalcKey(key)) continue;
      const raw = localStorage.getItem(key);
      try { state[key] = JSON.parse(raw); } catch (_) { state[key] = raw; }
    }
    return state;
  }

  function stableState(state) {
    return JSON.stringify(Object.keys(state || {}).sort().reduce((out, key) => {
      out[key] = state[key];
      return out;
    }, {}));
  }

  function setSyncStatus(kind, label, detail) {
    const badge = document.getElementById('syncStatus');
    const account = document.getElementById('syncAccount');
    if (badge) { badge.className = 'sync-status ' + kind; badge.textContent = label; }
    if (account && detail !== undefined) account.textContent = detail;
  }

  function updateControls() {
    const hasToken = Boolean(getToken());
    const configured = configIsValid();
    const save = document.getElementById('githubSaveToken');
    const remove = document.getElementById('githubRemoveToken');
    const manual = document.getElementById('githubSaveNow');
    const load = document.getElementById('githubLoad');
    if (save) save.disabled = !configured;
    if (remove) remove.disabled = !hasToken;
    if (manual) manual.disabled = !configured || !hasToken;
    if (load) load.disabled = !configured || !hasToken;
  }

  function markLocalChange() {
    setMeta(META.changedAt, new Date().toISOString());
    if (!configIsValid() || !getToken()) {
      setSyncStatus('local', 'Local', 'Guardado neste dispositivo. Cole um token para ativar a sincronização.');
      updateControls();
      return;
    }
    setSyncStatus('pending', 'Pendente', 'Alteração local por guardar no Disco.xlsx.');
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => syncNow(false), 800);
  }

  // Interceta apenas as chaves da aplicação original. O token e os metadados
  // ficam fora de calc_* e nunca provocam uma gravação recursiva.
  Storage.prototype.setItem = function (key, value) {
    nativeSet.call(this, key, value);
    if (!muted && this === localStorage && isCalcKey(key)) markLocalChange();
  };
  Storage.prototype.removeItem = function (key) {
    nativeRemove.call(this, key);
    if (!muted && this === localStorage && isCalcKey(key)) markLocalChange();
  };
  Storage.prototype.clear = function () {
    const hadCalc = Object.keys(collectState()).length > 0;
    nativeClear.call(this);
    if (!muted && this === localStorage && hadCalc) markLocalChange();
  };

  function installPanel() {
    if (panelReady || !document.body) return;
    const header = document.querySelector('.header');
    if (!header) return;
    panelReady = true;
    const config = getConfig();
    const panel = document.createElement('section');
    panel.id = 'syncPanel';
    panel.className = 'card';
    panel.innerHTML = `
      <div class="sync-panel-head">
        <span class="sync-title">📁 Guardar Disco.xlsx no GitHub</span>
        <div class="sync-head-actions">
          <span id="syncStatus" class="sync-status local">Local</span>
          <button id="syncHidePanel" type="button" class="sync-close" title="Ocultar esta caixa" aria-label="Ocultar a caixa de sincronização">×</button>
        </div>
      </div>
      <div id="syncAccount" class="sync-account">Apenas neste dispositivo.</div>
      <div class="sync-controls">
        <div class="sync-token-row">
          <input id="githubToken" type="password" autocomplete="off" spellcheck="false" placeholder="Fine-grained personal access token">
          <button id="githubShowToken" type="button" class="secondary" aria-label="Mostrar ou ocultar token">Mostrar</button>
        </div>
        <button id="githubSaveToken" type="button">Guardar token</button>
        <button id="githubRemoveToken" type="button" class="danger">Apagar/desligar</button>
        <button id="githubLoad" type="button" class="secondary">Carregar do Excel</button>
        <button id="githubSaveNow" type="button" class="secondary">Guardar agora</button>
      </div>
      <div class="sync-help">Destino configurado: ${config.owner || 'SEU_UTILIZADOR'}/${config.repo || 'SEU_REPOSITORIO'} · ${config.path} · branch ${config.branch}</div>
      <div class="sync-help">Use um token fine-grained limitado a este único repositório, com <b>Contents: Read and write</b>. O token é guardado só neste browser.</div>
      <div class="sync-warning">Aviso: qualquer JavaScript ou extensão que corra neste site pode aceder a um token guardado no browser. Uso estritamente pessoal. Nunca partilhe o token.</div>`;
    header.insertAdjacentElement('afterend', panel);

    // A caixa pode ficar totalmente oculta. Um pequeno botão no cabeçalho
    // permite voltar a abri-la sem interromper a sincronização.
    const launchButton = document.createElement('button');
    launchButton.id = 'syncShowPanel';
    launchButton.type = 'button';
    launchButton.className = 'icon-btn sync-launch';
    launchButton.textContent = '☁️';
    launchButton.title = 'Mostrar opções de sincronização';
    launchButton.setAttribute('aria-label', 'Mostrar opções de sincronização');
    const headerControls = header.querySelector('.header-controls');
    if (headerControls) headerControls.insertBefore(launchButton, headerControls.firstChild);
    else header.appendChild(launchButton);

    const setPanelHidden = hidden => {
      panel.hidden = hidden;
      launchButton.hidden = !hidden;
      nativeSet.call(localStorage, PANEL_HIDDEN_KEY, hidden ? '1' : '0');
    };
    document.getElementById('syncHidePanel').addEventListener('click', () => setPanelHidden(true));
    launchButton.addEventListener('click', () => setPanelHidden(false));
    setPanelHidden(localStorage.getItem(PANEL_HIDDEN_KEY) === '1');

    const tokenInput = document.getElementById('githubToken');
    const showButton = document.getElementById('githubShowToken');
    const savedToken = getToken();
    if (savedToken) tokenInput.value = savedToken;
    showButton.addEventListener('click', () => {
      const visible = tokenInput.type === 'text';
      tokenInput.type = visible ? 'password' : 'text';
      showButton.textContent = visible ? 'Mostrar' : 'Ocultar';
    });
    document.getElementById('githubSaveToken').addEventListener('click', saveToken);
    document.getElementById('githubRemoveToken').addEventListener('click', removeToken);
    document.getElementById('githubLoad').addEventListener('click', loadFromExcel);
    document.getElementById('githubSaveNow').addEventListener('click', () => syncNow(true));
    updateControls();
    if (!configIsValid()) {
      setSyncStatus('error', 'Configuração', 'Preencha owner e repo em config.js antes de usar o GitHub.');
    } else if (savedToken) {
      setSyncStatus('pending', 'A verificar', `Token guardado para ${config.owner}/${config.repo}.`);
    }

    const exportButton = document.createElement('button');
    exportButton.id = 'exportAllXlsx';
    exportButton.type = 'button';
    exportButton.className = 'btn btn-export';
    exportButton.textContent = '📊 Exportar todos os dados para Excel (download local)';
    exportButton.title = 'Descarrega um XLSX com os dados privados deste navegador';
    const historyCard = Array.from(document.querySelectorAll('.card')).find(card => card.querySelector('#listaMeses'));
    if (historyCard) historyCard.appendChild(exportButton);
    exportButton.addEventListener('click', exportAllXlsx);
  }

  function saveToken() {
    const input = document.getElementById('githubToken');
    const token = (input && input.value || '').trim();
    if (!token) {
      setSyncStatus('error', 'Token vazio', 'Cole um fine-grained token antes de guardar.');
      input && input.focus();
      return;
    }
    if (!configIsValid()) {
      setSyncStatus('error', 'Configuração', 'Preencha owner e repo em config.js antes de guardar.');
      return;
    }
    nativeSet.call(localStorage, TOKEN_KEY, token);
    updateControls();
    setSyncStatus('pending', 'A verificar', 'Token guardado apenas neste dispositivo.');
    syncNow(false);
  }

  function removeToken() {
    if (!confirm('Apagar o token deste dispositivo e desligar a sincronização? Os dados locais não serão apagados.')) return;
    nativeRemove.call(localStorage, TOKEN_KEY);
    const input = document.getElementById('githubToken');
    if (input) input.value = '';
    window.clearTimeout(syncTimer);
    updateControls();
    setSyncStatus('local', 'Local', 'Token apagado. Os dados ficam neste dispositivo.');
  }

  function apiUrl() {
    const config = getConfig();
    return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split('/').map(encodeURIComponent).join('/')}`;
  }

  function apiHeaders() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${getToken()}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function readRemote() {
    const response = await fetch(`${apiUrl()}?ref=${encodeURIComponent(getConfig().branch)}`, {
      method: 'GET', headers: apiHeaders(), cache: 'no-store'
    });
    if (response.status === 404) return { missing: true, data: null, sha: null };
    if (!response.ok) {
      let message = `GitHub respondeu ${response.status}.`;
      try { const body = await response.json(); if (body.message) message += ` ${body.message}`; } catch (_) {}
      throw new Error(message);
    }
    const body = await response.json();
    if (!body.content) throw new Error('A resposta do GitHub não contém o conteúdo de Disco.xlsx.');
    const encoded = String(body.content).replace(/\s/g, '');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { missing: false, data: extractStateFromWorkbook(XLSX.read(bytes, { type: 'array' })), sha: body.sha || null };
  }

  function workbookRows() {
    const state = collectState();
    const estado = [['Chave', 'Valor JSON']];
    Object.keys(state).sort().forEach(key => estado.push([key, JSON.stringify(state[key]) || 'null']));

    const registrosAtual = typeof registros !== 'undefined' ? registros : {};
    const premiosAtual = typeof prizes !== 'undefined' ? prizes : {};
    const observacoesAtual = typeof observacoes !== 'undefined' ? observacoes : {};
    const configs = typeof configAnual !== 'undefined' ? configAnual : {};
    const anos = typeof listaAnos !== 'undefined' && Array.isArray(listaAnos) ? listaAnos : Object.keys(configs);
    const months = new Set([...Object.keys(registrosAtual), ...Object.keys(premiosAtual), ...Object.keys(observacoesAtual)]);
    anos.forEach(year => { for (let month = 1; month <= 12; month += 1) months.add(`${year}-${String(month).padStart(2, '0')}`); });
    const monthKeys = Array.from(months).sort();
    const resumo = [];
    const diasExtra = [];
    const euro = value => Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    monthKeys.forEach(chave => {
      const dias = (registrosAtual[chave] || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const ano = chave.split('-')[0];
      const cfg = configs[ano] || (typeof VALORES_PADRAO !== 'undefined' ? VALORES_PADRAO : {});
      const extras = dias.reduce((sum, dia) => sum + Number(dia.valor || 0), 0);
      const premio = Number(premiosAtual[chave] || 0);
      resumo.push({
        'Mês': typeof formatarMesChave === 'function' ? formatarMesChave(chave) : chave,
        'Ano': ano,
        'Período (21–20)': typeof formatarPeriodoChave === 'function' ? formatarPeriodoChave(chave) : chave,
        'Ordenado Base (€)': Number(cfg.ordenado || 0), 'Extras (€)': extras, 'Prémio (€)': premio,
        'Total Bruto (€)': Number(cfg.ordenado || 0) + extras + premio,
        'Observações': observacoesAtual[chave] || ''
      });
      dias.forEach(dia => diasExtra.push({
        'Mês': typeof formatarMesChave === 'function' ? formatarMesChave(chave) : chave,
        'Período (21–20)': typeof formatarPeriodoChave === 'function' ? formatarPeriodoChave(chave) : chave,
        'Data': dia.data,
        'Tipo': typeof obterDescricaoDiaPDF === 'function' ? obterDescricaoDiaPDF(dia) : (dia.tipos || []).join(' · '),
        'Cálculo': (dia.parcelas || []).map(p => `${euro(p.valor)} (${p.label})`).join(' + '),
        'Valor Extra (€)': Number(dia.valor || 0)
      }));
    });
    return { estado, resumo, diasExtra };
  }

  function makeWorkbook() {
    if (!window.XLSX) throw new Error('A biblioteca Excel ainda não está disponível.');
    const rows = workbookRows();
    const workbook = XLSX.utils.book_new();
    const wsEstado = XLSX.utils.aoa_to_sheet(rows.estado);
    const wsResumo = XLSX.utils.json_to_sheet(rows.resumo.length ? rows.resumo : [{ 'Mês': 'Sem registos', 'Ano': '', 'Período (21–20)': '', 'Ordenado Base (€)': 0, 'Extras (€)': 0, 'Prémio (€)': 0, 'Total Bruto (€)': 0, 'Observações': '' }]);
    const wsDias = XLSX.utils.json_to_sheet(rows.diasExtra.length ? rows.diasExtra : [{ 'Mês': 'Sem dias extra', 'Período (21–20)': '', 'Data': '', 'Tipo': '', 'Cálculo': '', 'Valor Extra (€)': 0 }]);
    wsEstado['!cols'] = [{ wch: 28 }, { wch: 90 }];
    wsResumo['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 26 }, { wch: 17 }, { wch: 13 }, { wch: 13 }, { wch: 17 }, { wch: 34 }];
    wsDias['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 13 }, { wch: 28 }, { wch: 56 }, { wch: 17 }];
    XLSX.utils.book_append_sheet(workbook, wsEstado, 'Estado App');
    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(workbook, wsDias, 'Dias Extra');
    return workbook;
  }

  function extractStateFromWorkbook(workbook) {
    if (!workbook || !workbook.Sheets || !workbook.Sheets['Estado App']) return null;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Estado App'], { header: 1, defval: '' });
    if (!rows.length) return null;
    const header = rows[0].map(value => String(value).trim());
    const keyIndex = header.indexOf('Chave');
    const valueIndex = header.indexOf('Valor JSON');
    if (keyIndex < 0 || valueIndex < 0) return null;
    const state = {};
    rows.slice(1).forEach(row => {
      const key = String(row[keyIndex] || '');
      if (!isCalcKey(key)) return;
      try { state[key] = JSON.parse(String(row[valueIndex] || 'null')); } catch (_) { state[key] = row[valueIndex]; }
    });
    return Object.keys(state).length ? state : null;
  }

  function applyState(state, sha) {
    if (!state) return false;
    if (stableState(state) === stableState(collectState())) {
      if (sha) setMeta(META.syncedSha, sha);
      nativeRemove.call(localStorage, META.changedAt);
      setSyncStatus('synced', 'Sincronizado', 'Os dados locais já correspondem ao Disco.xlsx.');
      return false;
    }
    muted = true;
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (isCalcKey(key)) nativeRemove.call(localStorage, key);
      }
      Object.keys(state).forEach(key => {
        if (isCalcKey(key)) nativeSet.call(localStorage, key, typeof state[key] === 'string' ? state[key] : JSON.stringify(state[key]));
      });
      nativeRemove.call(localStorage, META.changedAt);
      if (sha) setMeta(META.syncedSha, sha);
    } finally { muted = false; }
    // Um único reload deixa a aplicação original reconstruir o estado em memória.
    window.location.reload();
    return true;
  }

  function toBase64(binary) {
    const bytes = new Uint8Array(binary);
    let text = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) text += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    return btoa(text);
  }

  async function uploadWorkbook(existingSha, changedAtAtStart) {
    const workbook = makeWorkbook();
    const array = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const config = getConfig();
    const payload = { message: 'Atualiza Disco.xlsx pela Calculadora Extras', branch: config.branch, content: toBase64(array) };
    if (existingSha) payload.sha = existingSha;
    const response = await fetch(apiUrl(), { method: 'PUT', headers: { ...apiHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      let message = `GitHub respondeu ${response.status} ao guardar.`;
      try { const body = await response.json(); if (body.message) message += ` ${body.message}`; } catch (_) {}
      throw new Error(message);
    }
    const body = await response.json();
    const sha = body.content && body.content.sha;
    if (sha) setMeta(META.syncedSha, sha);
    if (changedAtAtStart === getMeta(META.changedAt)) nativeRemove.call(localStorage, META.changedAt);
    setSyncStatus('synced', 'Sincronizado', `Disco.xlsx atualizado em ${new Date().toLocaleTimeString('pt-PT')}.`);
    updateControls();
    return sha;
  }

  async function syncNow(manual) {
    if (!configIsValid()) {
      if (manual) setSyncStatus('error', 'Configuração', 'Preencha owner e repo em config.js.');
      return;
    }
    if (!getToken()) {
      if (manual) setSyncStatus('local', 'Local', 'Guarde um fine-grained token para sincronizar.');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('pending', 'Pendente', 'Sem internet. Será tentado quando a ligação voltar.');
      return;
    }
    if (syncInProgress) return;
    syncInProgress = true;
    const localChangedAt = getMeta(META.changedAt);
    setSyncStatus('pending', 'A sincronizar', localChangedAt ? 'A guardar alterações locais…' : 'A verificar o Disco.xlsx…');
    try {
      const remote = await readRemote();
      if (localChangedAt) {
        await uploadWorkbook(remote.sha, localChangedAt);
      } else if (remote.missing || !remote.data) {
        // O modelo inicial pode não ter a folha Estado App: inicializa-o com o estado local.
        await uploadWorkbook(remote.sha, null);
      } else {
        applyState(remote.data, remote.sha);
      }
    } catch (error) {
      setSyncStatus('error', 'Erro', error.message || 'Falha na sincronização. Os dados locais foram mantidos.');
    } finally {
      syncInProgress = false;
      if (getMeta(META.changedAt) && configIsValid() && getToken()) {
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(() => syncNow(false), 1200);
      }
    }
  }

  async function loadFromExcel() {
    if (!configIsValid() || !getToken()) {
      setSyncStatus('local', 'Local', 'Guarde um token antes de carregar o Excel.');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('pending', 'Pendente', 'Sem internet para carregar o Disco.xlsx.');
      return;
    }
    try {
      setSyncStatus('pending', 'A carregar', 'A descarregar o Disco.xlsx…');
      const remote = await readRemote();
      if (remote.missing || !remote.data) {
        setSyncStatus('error', 'Sem Estado App', 'O Disco.xlsx não contém dados da aplicação para carregar.');
        return;
      }
      if (!confirm('Substituir os dados locais pelos dados do Disco.xlsx? Esta ação não pode ser desfeita.')) return;
      applyState(remote.data, remote.sha);
    } catch (error) {
      setSyncStatus('error', 'Erro', error.message || 'Não foi possível carregar o Excel.');
    }
  }

  function exportAllXlsx() {
    try {
      const workbook = makeWorkbook();
      XLSX.writeFile(workbook, `Disco_Extras_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      alert(error.message || 'Não foi possível exportar o Excel.');
    }
  }

  window.addEventListener('online', () => { if (getToken()) syncNow(false); });
  window.addEventListener('load', () => {
    installPanel();
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    if (configIsValid() && getToken()) syncNow(false);
  });
})();
