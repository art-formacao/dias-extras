/* Integração opcional Supabase + exportação XLSX. A app continua plenamente funcional offline. */
(function () {
  'use strict';

  const META = {
    changedAt: 'extras_sync_changed_at',
    syncedAt: 'extras_sync_synced_at'
  };
  const isCalcKey = key => typeof key === 'string' && key.indexOf('calc_') === 0;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;
  let muted = false;
  let syncTimer = null;
  let syncInProgress = false;
  let currentUser = null;
  let client = null;
  let configured = false;
  let panelReady = false;

  function configIsValid() {
    const config = window.SUPABASE_CONFIG || {};
    return typeof config.url === 'string' && /^https:\/\//i.test(config.url) &&
      !config.url.includes('SEU-PROJETO') && typeof config.anonKey === 'string' &&
      config.anonKey.length > 20 && !config.anonKey.includes('SUA_SUPABASE');
  }

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

  function localHasUsefulData() {
    const state = collectState();
    return Object.keys(state).some(key => {
      const value = state[key];
      if (key === 'calc_registros' || key === 'calc_premios' || key === 'calc_observacoes') {
        return value && typeof value === 'object' && Object.keys(value).length > 0;
      }
      return key === 'calc_config_anual' && value && Object.keys(value).length > 1;
    });
  }

  function setSyncStatus(kind, label, detail) {
    const badge = document.getElementById('syncStatus');
    const account = document.getElementById('syncAccount');
    if (badge) { badge.className = 'sync-status ' + kind; badge.textContent = label; }
    if (account && detail !== undefined) account.textContent = detail;
  }

  function markLocalChange() {
    setMeta(META.changedAt, new Date().toISOString());
    if (!currentUser) {
      setSyncStatus('local', 'Local', 'Guardado neste dispositivo. Configure o Supabase para sincronizar online.');
      return;
    }
    setSyncStatus('pending', 'Pendente', 'Alteração local por sincronizar.');
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => syncNow(false), 700);
  }

  // Intercepta todas as alterações calc_* feitas pela aplicação original.
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
    panelReady = true;
    const header = document.querySelector('.header');
    if (!header) return;
    const panel = document.createElement('section');
    panel.id = 'syncPanel';
    panel.className = 'card';
    panel.innerHTML = `
      <div class="sync-panel-head">
        <span class="sync-title">☁️ Conta e sincronização privada</span>
        <span id="syncStatus" class="sync-status local">Local</span>
      </div>
      <div id="syncAccount" class="sync-account">Guardado neste dispositivo.</div>
      <div class="sync-controls">
        <input id="syncEmail" type="email" autocomplete="email" placeholder="O seu email para receber o link">
        <button id="syncLogin" type="button">Entrar por email</button>
        <button id="syncLogout" type="button" class="secondary" hidden>Sair</button>
        <button id="syncManual" type="button" class="secondary">Sincronizar</button>
      </div>
      <div id="syncHelp" class="sync-help">Sem sessão, os dados ficam apenas neste navegador.</div>`;
    header.insertAdjacentElement('afterend', panel);
    document.getElementById('syncLogin').addEventListener('click', login);
    document.getElementById('syncLogout').addEventListener('click', logout);
    document.getElementById('syncManual').addEventListener('click', () => syncNow(true));
    const exportButton = document.createElement('button');
    exportButton.id = 'exportAllXlsx';
    exportButton.type = 'button';
    exportButton.className = 'btn btn-export';
    exportButton.textContent = '📊 Exportar todos os dados para Excel';
    exportButton.title = 'Descarrega um XLSX com os dados privados deste navegador';
    const historyCard = Array.from(document.querySelectorAll('.card')).find(card => card.querySelector('#listaMeses'));
    if (historyCard) historyCard.appendChild(exportButton);
    exportButton.addEventListener('click', exportAllXlsx);
    if (!configured) {
      document.getElementById('syncLogin').disabled = true;
      document.getElementById('syncManual').disabled = true;
      document.getElementById('syncHelp').textContent = 'Modo local: preencha URL e anon key públicas em config.js para ativar o login.';
    }
  }

  async function login() {
    if (!client) { setSyncStatus('error', 'Erro', 'Supabase não está configurado.'); return; }
    const emailInput = document.getElementById('syncEmail');
    const email = (emailInput.value || '').trim();
    if (!email || !emailInput.checkValidity()) {
      emailInput.focus();
      setSyncStatus('error', 'Erro', 'Introduza um email válido.');
      return;
    }
    const button = document.getElementById('syncLogin');
    button.disabled = true;
    setSyncStatus('pending', 'A enviar', 'A enviar o link mágico…');
    try {
      const redirectTo = window.location.href.split('#')[0];
      const result = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (result.error) throw result.error;
      setSyncStatus('pending', 'Email enviado', 'Abra o link recebido para concluir a entrada.');
    } catch (error) {
      setSyncStatus('error', 'Erro', error.message || 'Não foi possível enviar o email.');
    } finally { button.disabled = false; }
  }

  async function logout() {
    if (!client) return;
    const result = await client.auth.signOut();
    if (result.error) setSyncStatus('error', 'Erro', result.error.message);
  }

  function applyState(state, remoteUpdatedAt) {
    muted = true;
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (isCalcKey(key)) nativeRemove.call(localStorage, key);
      }
      Object.keys(state || {}).forEach(key => {
        if (!isCalcKey(key)) return;
        const value = state[key];
        nativeSet.call(localStorage, key, typeof value === 'string' ? value : JSON.stringify(value));
      });
      // O estado remoto torna-se a nova base local; não o reenviar após o reload.
      nativeRemove.call(localStorage, META.changedAt);
      setMeta(META.syncedAt, remoteUpdatedAt || new Date().toISOString());
    } finally { muted = false; }
    // Recarrega para que o estado em memória da aplicação original acompanhe o remoto.
    window.location.reload();
  }

  async function syncNow(manual) {
    if (!client || !currentUser) {
      if (manual) setSyncStatus('local', 'Local', 'Entre por email para sincronizar online.');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('pending', 'Pendente', 'Sem internet. Será tentado quando voltar a ligação.');
      return;
    }
    if (syncInProgress) return;
    syncInProgress = true;
    setSyncStatus('pending', 'A sincronizar', 'A verificar o estado privado…');
    try {
      const read = await client.from('app_state').select('state,updated_at').eq('user_id', currentUser.id).maybeSingle();
      if (read.error) throw read.error;
      const remote = read.data;
      const localChanged = getMeta(META.changedAt);
      if (remote && remote.state && localChanged) {
        const remoteTime = Date.parse(remote.updated_at || '') || 0;
        const localTime = Date.parse(localChanged) || 0;
        if (remoteTime > localTime + 1000) {
          applyState(remote.state);
          setMeta(META.syncedAt, remote.updated_at || new Date().toISOString());
          return;
        }
      } else if (remote && remote.state && !localChanged) {
        applyState(remote.state);
        setMeta(META.syncedAt, remote.updated_at || new Date().toISOString());
        return;
      }
      const write = await client.from('app_state').upsert({
        user_id: currentUser.id,
        state: collectState(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (write.error) throw write.error;
      const now = new Date().toISOString();
      setMeta(META.syncedAt, now);
      nativeRemove.call(localStorage, META.changedAt);
      setSyncStatus('synced', 'Sincronizado', 'Estado privado atualizado agora.');
    } catch (error) {
      setSyncStatus('error', 'Erro', error.message || 'Falha na sincronização. Os dados locais foram mantidos.');
    } finally { syncInProgress = false; }
  }

  async function initSupabase() {
    configured = configIsValid() && window.supabase && typeof window.supabase.createClient === 'function';
    if (!configured) { setSyncStatus('local', 'Local', 'Guardado neste dispositivo.'); return; }
    try {
      client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
      client.auth.onAuthStateChange((event, session) => {
        currentUser = session && session.user ? session.user : null;
        const loginButton = document.getElementById('syncLogin');
        const logoutButton = document.getElementById('syncLogout');
        const email = document.getElementById('syncEmail');
        if (currentUser) {
          if (loginButton) loginButton.hidden = true;
          if (logoutButton) logoutButton.hidden = false;
          if (email) email.value = currentUser.email || '';
          setSyncStatus('pending', 'A sincronizar', `Sessão: ${currentUser.email || 'utilizador autenticado'}`);
          if (event !== 'SIGNED_OUT') syncNow(false);
        } else {
          if (loginButton) loginButton.hidden = false;
          if (logoutButton) logoutButton.hidden = true;
          setSyncStatus('local', 'Local', 'Sem sessão. Os dados ficam neste navegador.');
        }
      });
      const sessionResult = await client.auth.getSession();
      if (sessionResult.error) throw sessionResult.error;
      currentUser = sessionResult.data.session && sessionResult.data.session.user;
      if (currentUser) syncNow(false);
    } catch (error) {
      setSyncStatus('error', 'Erro', error.message || 'Não foi possível iniciar Supabase.');
    }
  }

  function euro(value) { return Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

  function exportAllXlsx() {
    if (!window.XLSX) {
      alert('A biblioteca Excel ainda não está disponível. Verifique a ligação à internet e tente novamente.');
      return;
    }
    const registrosAtual = typeof registros !== 'undefined' ? registros : {};
    const premiosAtual = typeof prizes !== 'undefined' ? prizes : {};
    const observacoesAtual = typeof observacoes !== 'undefined' ? observacoes : {};
    const configs = typeof configAnual !== 'undefined' ? configAnual : {};
    const months = new Set([...Object.keys(registrosAtual), ...Object.keys(premiosAtual), ...Object.keys(observacoesAtual)]);
    // Inclui também os 12 ciclos de cada ano configurado, mesmo sem dias extra,
    // para que a folha Resumo seja realmente anual e não apenas do mês ativo.
    const years = typeof listaAnos !== 'undefined' && Array.isArray(listaAnos)
      ? listaAnos
      : Object.keys(configs);
    years.forEach(year => {
      for (let month = 1; month <= 12; month += 1) {
        months.add(`${year}-${String(month).padStart(2, '0')}`);
      }
    });
    const monthKeys = Array.from(months).sort();
    const resumo = [];
    const diasExtra = [];
    monthKeys.forEach(chave => {
      const dias = (registrosAtual[chave] || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const ano = chave.split('-')[0];
      const cfg = configs[ano] || (typeof VALORES_PADRAO !== 'undefined' ? VALORES_PADRAO : {});
      const extras = dias.reduce((sum, dia) => sum + Number(dia.valor || 0), 0);
      const premio = Number(premiosAtual[chave] || 0);
      resumo.push({
        'Mês': typeof formatarMesChave === 'function' ? formatarMesChave(chave) : chave,
        'Ano': ano,
        'Período (21–20)': typeof obterPeriodoCompleto === 'function' ? obterPeriodoCompleto(chave) : chave,
        'Ordenado Base (€)': Number(cfg.ordenado || 0),
        'Extras (€)': extras,
        'Prémio (€)': premio,
        'Total Bruto (€)': Number(cfg.ordenado || 0) + extras + premio,
        'Observações': observacoesAtual[chave] || ''
      });
      dias.forEach(dia => diasExtra.push({
        'Mês': typeof formatarMesChave === 'function' ? formatarMesChave(chave) : chave,
        'Período (21–20)': typeof obterPeriodoCompleto === 'function' ? obterPeriodoCompleto(chave) : chave,
        'Data': dia.data,
        'Tipo': typeof obterDescricaoDiaPDF === 'function' ? obterDescricaoDiaPDF(dia) : (dia.tipos || []).join(' · '),
        'Cálculo': (dia.parcelas || []).map(p => `${euro(p.valor)} (${p.label})`).join(' + '),
        'Valor Extra (€)': Number(dia.valor || 0)
      }));
    });
    const workbook = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.json_to_sheet(resumo.length ? resumo : [{ 'Mês': 'Sem registos', 'Período (21–20)': '', 'Ordenado Base (€)': 0, 'Extras (€)': 0, 'Prémio (€)': 0, 'Total Bruto (€)': 0, 'Observações': '' }]);
    const wsDias = XLSX.utils.json_to_sheet(diasExtra.length ? diasExtra : [{ 'Mês': 'Sem dias extra', 'Data': '', 'Tipo': '', 'Cálculo': '', 'Valor Extra (€)': 0 }]);
    wsResumo['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 26 }, { wch: 17 }, { wch: 13 }, { wch: 13 }, { wch: 17 }, { wch: 34 }];
    wsDias['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 13 }, { wch: 28 }, { wch: 56 }, { wch: 17 }];
    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(workbook, wsDias, 'Dias Extra');
    XLSX.writeFile(workbook, `Disco_Extras_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  window.addEventListener('online', () => { if (currentUser) syncNow(false); });
  window.addEventListener('load', () => {
    installPanel();
    initSupabase();
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  });
})();
