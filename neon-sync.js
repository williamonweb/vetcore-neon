(function(){
  const SYNC_URL = '/api/sync';
  const SYNC_STATUS_ID = 'vetcoreCloudStatus';
  const LAST_HASH_KEY = '__vetcore_neon_hash__';
  const SESSION_LOADED_KEY = '__vetcore_neon_loaded_once__';
  const EXCLUDED_KEYS = new Set([
    'usuarioLogado',
    'usuarioAtual',
    'clinicaSelecionada',
    LAST_HASH_KEY,
    SESSION_LOADED_KEY
  ]);

  let applyingRemote = false;
  let saveTimer = null;

  function isVetCoreKey(key){
    if(!key) return false;
    if(EXCLUDED_KEYS.has(key)) return false;
    return (
      key.startsWith('vetcore') ||
      key.startsWith('vc') ||
      key.includes('Agendamento') ||
      key.includes('Agendamentos') ||
      key.includes('agendamento') ||
      key.includes('agendamentos') ||
      key.includes('Veterinario') ||
      key.includes('veterinario') ||
      key.includes('diasLiberados') ||
      key.includes('usuariosSistema') ||
      key.includes('configuracoesSistema') ||
      key.includes('confirmacoes') ||
      key.includes('bloqueios') ||
      key.includes('profissionais') ||
      key.includes('servicos') ||
      key.includes('unidades') ||
      key.includes('clientes') ||
      key.includes('pets')
    );
  }

  function snapshot(){
    const data = {};
    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      if(isVetCoreKey(key)) data[key] = localStorage.getItem(key);
    }
    return data;
  }

  function hash(obj){
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 50000); }
    catch(e){ return String(Date.now()); }
  }

  function setStatus(text, kind='info'){
    let el = document.getElementById(SYNC_STATUS_ID);
    if(!el){
      el = document.createElement('div');
      el.id = SYNC_STATUS_ID;
      el.style.position = 'fixed';
      el.style.right = '16px';
      el.style.bottom = '16px';
      el.style.zIndex = '999999';
      el.style.padding = '9px 12px';
      el.style.borderRadius = '999px';
      el.style.font = '600 12px Arial, sans-serif';
      el.style.boxShadow = '0 10px 30px rgba(15,23,42,.18)';
      el.style.transition = 'opacity .25s ease';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.background = kind === 'error' ? '#fee2e2' : kind === 'ok' ? '#dcfce7' : '#e0f2fe';
    el.style.color = kind === 'error' ? '#991b1b' : kind === 'ok' ? '#166534' : '#075985';
    el.style.opacity = '1';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(()=>{ el.style.opacity='0'; }, 3500);
  }

  async function saveNow(){
    if(applyingRemote) return;
    const data = snapshot();
    const currentHash = hash(data);
    if(localStorage.getItem(LAST_HASH_KEY) === currentHash) return;

    try{
      await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      localStorage.setItem(LAST_HASH_KEY, currentHash);
      setStatus('Salvo na nuvem', 'ok');
    }catch(e){
      console.warn('VetCore Neon sync save failed:', e);
      setStatus('Sem sincronizar com Neon', 'error');
    }
  }

  function scheduleSave(){
    if(applyingRemote) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
  }

  async function loadRemote(options = {}){
    try{
      const resp = await fetch(SYNC_URL, { method: 'GET', cache: 'no-store' });
      const json = await resp.json();
      if(!json.ok) throw new Error(json.error || 'Falha ao carregar dados do Neon.');
      const remote = json.data || {};
      const remoteKeys = Object.keys(remote);
      const local = snapshot();

      // Se o Neon ainda está vazio, envia a base local limpa com admin padrão.
      if(remoteKeys.length === 0){
        await saveNow();
        setStatus('Base inicial enviada ao Neon', 'ok');
        return;
      }

      const localHash = hash(local);
      const remoteHash = hash(remote);
      if(localHash !== remoteHash){
        applyingRemote = true;
        Object.keys(local).forEach(k => { if(isVetCoreKey(k) && !(k in remote)) localStorage.removeItem(k); });
        Object.entries(remote).forEach(([k,v]) => { if(isVetCoreKey(k)) localStorage.setItem(k, v); });
        localStorage.setItem(LAST_HASH_KEY, remoteHash);
        applyingRemote = false;
        setStatus('Dados carregados do Neon', 'ok');

        // Recarrega uma vez para o sistema antigo ler o localStorage já sincronizado.
        const deveRecarregar = options.reload !== false;
        if(deveRecarregar && sessionStorage.getItem(SESSION_LOADED_KEY) !== '1'){
          sessionStorage.setItem(SESSION_LOADED_KEY, '1');
          setTimeout(()=>location.reload(), 350);
        }
      } else {
        setStatus('Conectado ao Neon', 'ok');
      }
    }catch(e){
      console.warn('VetCore Neon sync load failed:', e);
      setStatus('Neon não conectado', 'error');
    }
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const originalClear = localStorage.clear.bind(localStorage);

  localStorage.setItem = function(key, value){
    originalSetItem(key, value);
    if(isVetCoreKey(key)) scheduleSave();
  };

  localStorage.removeItem = function(key){
    originalRemoveItem(key);
    if(isVetCoreKey(key)) scheduleSave();
  };

  localStorage.clear = function(){
    originalClear();
    scheduleSave();
  };

  window.vetcoreSalvarNaNuvem = saveNow;
  window.vetcoreCarregarDaNuvem = loadRemote;
  window.vetcoreAguardarNuvem = async function(){ return loadRemote({ reload: false }); };
  window.vetcoreCloudSnapshot = snapshot;

  window.addEventListener('beforeunload', () => {
    try{
      const data = snapshot();
      const payload = JSON.stringify({ data });
      if(navigator.sendBeacon){
        navigator.sendBeacon(SYNC_URL, new Blob([payload], { type: 'application/json' }));
      }
    }catch(e){}
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(()=>loadRemote({ reload: true }), 300);
    setInterval(saveNow, 30000);
  });
})();
