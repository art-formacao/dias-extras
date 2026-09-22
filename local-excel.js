/* Armazenamento local e importação/exportação manual do Disco.xlsx. */
(function () {
  'use strict';

  const PANEL_HIDDEN_KEY = 'local_excel_panel_hidden';
  const isCalcKey = key => typeof key === 'string' && key.indexOf('calc_') === 0;

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

  function workbookRows() {
    const state = collectState();
    const estado = [['Chave', 'Valor JSON']];
    Object.keys(state).sort().forEach(key => estado.push([key, JSON.stringify(state[key]) || 'null']));

    const registrosAtual = typeof registros !== 'undefined' ? registros : {};
    const premiosAtual = typeof prizes !== 'undefined' ? prizes : {};
    const observacoesAtual = typeof observacoes !== 'undefined' ? observacoes : {};
    const configs = typeof configAnual !== 'undefined' ? configAnual : {};
    const anos = typeof listaAnos !== 'undefined' && Array.isArray(listaAnos) ? listaAnos : Object.keys(configs);
    const meses = new Set([...Object.keys(registrosAtual), ...Object.keys(premiosAtual), ...Object.keys(observacoesAtual)]);
    anos.forEach(ano => { for (let mes = 1; mes <= 12; mes += 1) meses.add(`${ano}-${String(mes).padStart(2, '0')}`); });

    const resumo = [];
    const diasExtra = [];
    const euro = valor => Number(valor || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

    Array.from(meses).sort().forEach(chave => {
      const dias = (registrosAtual[chave] || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const ano = chave.split('-')[0];
      const cfg = configs[ano] || (typeof VALORES_PADRAO !== 'undefined' ? VALORES_PADRAO : {});
      const extras = dias.reduce((total, dia) => total + Number(dia.valor || 0), 0);
      const premio = Number(premiosAtual[chave] || 0);
      resumo.push({
        'Mês': typeof formatarMesChave === 'function' ? formatarMesChave(chave) : chave,
        'Ano': ano,
        'Período (21–20)': typeof formatarPeriodoChave === 'function' ? formatarPeriodoChave(chave) : chave,
        'Ordenado Base (€)': Number(cfg.ordenado || 0),
        'Extras (€)': extras,
        'Prémio (€)': premio,
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
    if (!window.XLSX) throw new Error('A biblioteca Excel não está disponível.');
    const linhas = workbookRows();
    const workbook = XLSX.utils.book_new();
    const wsEstado = XLSX.utils.aoa_to_sheet(linhas.estado);
    const wsResumo = XLSX.utils.json_to_sheet(linhas.resumo.length ? linhas.resumo : [{ 'Mês': 'Sem registos', 'Ano': '', 'Período (21–20)': '', 'Ordenado Base (€)': 0, 'Extras (€)': 0, 'Prémio (€)': 0, 'Total Bruto (€)': 0, 'Observações': '' }]);
    const wsDias = XLSX.utils.json_to_sheet(linhas.diasExtra.length ? linhas.diasExtra : [{ 'Mês': 'Sem dias extra', 'Período (21–20)': '', 'Data': '', 'Tipo': '', 'Cálculo': '', 'Valor Extra (€)': 0 }]);
    wsEstado['!cols'] = [{ wch: 28 }, { wch: 90 }];
    wsResumo['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 26 }, { wch: 17 }, { wch: 13 }, { wch: 13 }, { wch: 17 }, { wch: 34 }];
    wsDias['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 13 }, { wch: 28 }, { wch: 56 }, { wch: 17 }];
    XLSX.utils.book_append_sheet(workbook, wsEstado, 'Estado App');
    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(workbook, wsDias, 'Dias Extra');
    return workbook;
  }

  function exportExcel() {
    try {
      XLSX.writeFile(makeWorkbook(), 'Disco.xlsx');
      setStatus('success', 'Excel exportado', 'O ficheiro Disco.xlsx foi guardado na pasta de transferências.');
    } catch (error) {
      setStatus('error', 'Erro', error.message || 'Não foi possível exportar o Excel.');
    }
  }

  function extractState(workbook) {
    const folha = workbook && workbook.Sheets && workbook.Sheets['Estado App'];
    if (!folha) throw new Error('Este Excel não contém a folha “Estado App”. Importe um Disco.xlsx anteriormente exportado por esta aplicação.');
    const linhas = XLSX.utils.sheet_to_json(folha, { header: 1, defval: '' });
    const cabecalho = (linhas[0] || []).map(valor => String(valor).trim());
    const indiceChave = cabecalho.indexOf('Chave');
    const indiceValor = cabecalho.indexOf('Valor JSON');
    if (indiceChave < 0 || indiceValor < 0) throw new Error('A folha “Estado App” não tem o formato esperado.');
    const state = {};
    linhas.slice(1).forEach(linha => {
      const key = String(linha[indiceChave] || '').trim();
      if (!isCalcKey(key)) return;
      try { state[key] = JSON.parse(String(linha[indiceValor] || 'null')); }
      catch (_) { state[key] = linha[indiceValor]; }
    });
    if (!Object.keys(state).length) throw new Error('O Excel não contém dados da aplicação para importar.');
    return state;
  }

  function applyState(state) {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (isCalcKey(key)) localStorage.removeItem(key);
    }
    Object.keys(state).forEach(key => {
      if (!isCalcKey(key)) return;
      localStorage.setItem(key, typeof state[key] === 'string' ? state[key] : JSON.stringify(state[key]));
    });
  }

  async function importExcel(file) {
    if (!file) return;
    try {
      const dados = await file.arrayBuffer();
      const workbook = XLSX.read(dados, { type: 'array' });
      const state = extractState(workbook);
      if (!confirm('Importar este Disco.xlsx e substituir todos os dados atuais deste dispositivo? Esta ação não pode ser desfeita.')) return;
      applyState(state);
      alert('Disco.xlsx importado com sucesso. A aplicação será atualizada.');
      window.location.reload();
    } catch (error) {
      setStatus('error', 'Erro ao importar', error.message || 'Não foi possível ler o ficheiro Excel.');
    }
  }

  function setStatus(kind, title, detail) {
    const badge = document.getElementById('localExcelStatus');
    const text = document.getElementById('localExcelDetail');
    if (badge) {
      badge.className = 'sync-status ' + (kind === 'success' ? 'synced' : kind === 'error' ? 'error' : 'local');
      badge.textContent = title;
    }
    if (text) text.textContent = detail;
  }

  function installPanel() {
    const header = document.querySelector('.header');
    if (!header || document.getElementById('localExcelPanel')) return;

    // Elimina do browser qualquer token antigo da versão GitHub. Os dados calc_* são preservados.
    ['github_contents_pat', 'github_sync_changed_at', 'github_sync_synced_sha', 'github_sync_panel_hidden'].forEach(key => localStorage.removeItem(key));

    const panel = document.createElement('section');
    panel.id = 'localExcelPanel';
    panel.className = 'card';
    panel.innerHTML = `
      <div class="sync-panel-head">
        <span class="sync-title">📱 Dados guardados neste dispositivo</span>
        <span id="localExcelStatus" class="sync-status local">Local</span>
      </div>
      <div id="localExcelDetail" class="sync-account">As alterações são guardadas automaticamente neste telemóvel ou computador.</div>
      <div class="sync-controls local-excel-controls">
        <button id="localExcelImport" type="button" class="secondary">📥 Importar Disco.xlsx</button>
        <input id="localExcelFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      </div>
      <div class="sync-help">Para criar uma cópia de segurança, use no menu ☰ a opção “Exportar todos os dados”. Para restaurar os dados, selecione esse mesmo Disco.xlsx em “Importar”.</div>`;
    header.insertAdjacentElement('afterend', panel);

    const viewSwitch = document.getElementById('menuMostrarDados');
    const setPanelVisible = visible => {
      panel.hidden = !visible;
      if (viewSwitch) viewSwitch.checked = visible;
      localStorage.setItem(PANEL_HIDDEN_KEY, visible ? '0' : '1');
    };
    if (viewSwitch) {
      viewSwitch.addEventListener('change', () => setPanelVisible(viewSwitch.checked));
    }
    setPanelVisible(localStorage.getItem(PANEL_HIDDEN_KEY) !== '1');

    const input = document.getElementById('localExcelFile');
    document.getElementById('localExcelImport').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      await importExcel(input.files && input.files[0]);
      input.value = '';
    });

    const menuExportButton = document.getElementById('menuExportExcel');
    if (menuExportButton) menuExportButton.addEventListener('click', () => {
      exportExcel();
      if (typeof fecharMenu === 'function') fecharMenu();
    });
  }

  window.addEventListener('load', () => {
    installPanel();
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  });
})();
