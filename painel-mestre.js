
(function () {
  const STORAGE_CLIENTES = "vetcoreClientesMestre";

  function slugClinica(nome) {
    return (nome || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function gerarSenhaCliente() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }
  function gerarVencimentoDemoPadrao() {
    const data = new Date();
    data.setDate(data.getDate() + 2);
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function obterStatusCalculadoCliente(cliente) {
    if (!cliente) return "demo";
    const statusBase = (cliente.status || "demo").toLowerCase();
    if (["suspenso", "cancelado"].includes(statusBase)) return statusBase;
    if (statusBase === "vencido") return "vencido";
    if (cliente.plano === "demo") {
      if (cliente.vencimento && cliente.vencimento < gerarHojeIso()) return "vencido";
      return "demo";
    }
    if (cliente.vencimento && cliente.vencimento < gerarHojeIso()) return "vencido";
    return statusBase || "ativo";
  }

  function gerarHojeIso() {
    const data = new Date();
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }


  function obterUsuariosSistemaSeguro() {
    try {
      return JSON.parse(localStorage.getItem("usuariosSistema")) || [];
    } catch (e) {
      return [];
    }
  }

  function salvarUsuariosSistemaSeguro(lista) {
    localStorage.setItem("usuariosSistema", JSON.stringify(lista));
  }

  function gerarLoginAutomaticoCliente(nomeClinica) {
    const base = slugClinica(nomeClinica) || "cliente";
    const usuarios = obterUsuariosSistemaSeguro();
    let login = `${base}@vetcore.com`;
    let n = 2;
    while (usuarios.some(u => ((u.usuario || "").toLowerCase() === login.toLowerCase()))) {
      login = `${base}${n}@vetcore.com`;
      n++;
    }
    return login;
  }

  function obterLoginCliente(cliente) {
    const emailCliente = normalizarEmail(cliente?.email || "");
    if (emailCliente) return emailCliente;
    const loginExistente = normalizarEmail(cliente?.login || "");
    if (loginExistente) return loginExistente;
    return gerarLoginAutomaticoCliente(cliente?.nomeClinica || "cliente");
  }

  function criarOuAtualizarLoginCliente(cliente, senhaNovaOpcional) {
    const usuarios = obterUsuariosSistemaSeguro();
    const loginGerado = obterLoginCliente(cliente);
    let senhaGerada = senhaNovaOpcional || cliente.senha || gerarSenhaCliente();

    let idx = usuarios.findIndex(u => ((u.usuario || "").toLowerCase().trim() === loginGerado));
    if (idx < 0 && cliente?.login && normalizarEmail(cliente.login) !== loginGerado) {
      idx = usuarios.findIndex(u => ((u.usuario || "").toLowerCase().trim() === normalizarEmail(cliente.login)));
    }

    const existente = idx >= 0 ? usuarios[idx] : null;
    const deveForcarTroca = Boolean(senhaNovaOpcional) || !existente;

    const payload = {
      usuario: loginGerado,
      email: loginGerado,
      senha: senhaGerada,
      perfil: "gestao",
      clienteId: cliente.id || null,
      clinicaVinculada: (obterUnidadesCliente(cliente)[0] || ""),
      clinicasVinculadas: obterUnidadesCliente(cliente),
      primeiroAcesso: deveForcarTroca ? true : Boolean(existente.primeiroAcesso),
      senhaProvisoria: deveForcarTroca ? true : Boolean(existente.senhaProvisoria),
      permissoes: (typeof permissoesPadraoAdmin !== "undefined" ? { ...permissoesPadraoAdmin } : {})
    };

    if (idx >= 0) {
      usuarios[idx] = { ...usuarios[idx], ...payload };
    } else {
      usuarios.push(payload);
    }

    salvarUsuariosSistemaSeguro(usuarios);
    return { login: loginGerado, senha: senhaGerada };
  }

  function atualizarBlocoCredenciais(login, senha) {
    const l = document.getElementById("masterLoginGerado");
    const s = document.getElementById("masterSenhaGerada");
    if (l) l.textContent = login || "-";
    if (s) s.textContent = senha || "-";
  }

  function copiarCredenciaisCliente() {
    const login = document.getElementById("masterLoginGerado")?.textContent || "";
    const senha = document.getElementById("masterSenhaGerada")?.textContent || "";
    if (!login || login === "-") {
      alert("Nenhuma credencial gerada ainda.");
      return;
    }
    const texto = `Login: ${login}\nSenha: ${senha}`;
    navigator.clipboard.writeText(texto).then(() => {
      alert("Credenciais copiadas.");
    }).catch(() => {
      vcPrompt("Copie as credenciais abaixo:", texto, "Credenciais");
    });
  }




  function normalizarWhatsapp(numero) {
    const digits = (numero || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  }

  function montarTextoCredenciaisWhatsapp(cliente) {
    const nome = cliente?.responsavel || cliente?.nomeClinica || 'cliente';
    const login = cliente?.login || obterLoginCliente(cliente);
    const senha = cliente?.senha || '';
    return `Olá, ${nome}!

Seu acesso inicial ao VetCore foi liberado.

Login: ${login}
Senha provisória: ${senha}

No primeiro acesso, o sistema vai solicitar a troca obrigatória da senha.

Equipe VetCore.`;
  }

  function enviarWhatsappCredenciaisCliente() {
    const whatsapp = normalizarWhatsapp(document.getElementById('masterWhatsapp')?.value || '');
    const login = document.getElementById('masterLoginGerado')?.textContent || '';
    const senha = document.getElementById('masterSenhaGerada')?.textContent || '';
    const nomeClinica = (document.getElementById('masterNomeClinica')?.value || '').trim();
    const responsavel = (document.getElementById('masterResponsavel')?.value || '').trim();

    if (!whatsapp) {
      alert('Informe o WhatsApp do cliente para preparar o envio.');
      return;
    }
    if (!login || login === '-') {
      alert('Salve o cliente primeiro para gerar o acesso.');
      return;
    }

    const texto = encodeURIComponent(montarTextoCredenciaisWhatsapp({ whatsapp, login, senha, nomeClinica, responsavel }));
    window.open(`https://wa.me/${whatsapp}?text=${texto}`, '_blank');
  }

  function montarTextoCredenciaisEmail(cliente) {
    const nome = cliente?.responsavel || cliente?.nomeClinica || "cliente";
    const login = cliente?.login || obterLoginCliente(cliente);
    const senha = cliente?.senha || "";
    return `Olá, ${nome}!

Seu acesso inicial ao VetCore foi liberado.

Login: ${login}
Senha provisória: ${senha}

No primeiro acesso, o sistema vai solicitar a troca obrigatória da senha.

Equipe VetCore.`;
  }

  function enviarEmailCredenciaisCliente() {
    const email = normalizarEmail(document.getElementById("masterEmail")?.value || "");
    const login = document.getElementById("masterLoginGerado")?.textContent || "";
    const senha = document.getElementById("masterSenhaGerada")?.textContent || "";
    const nomeClinica = (document.getElementById("masterNomeClinica")?.value || "").trim();
    const responsavel = (document.getElementById("masterResponsavel")?.value || "").trim();

    if (!email) {
      alert("Informe o e-mail do cliente para preparar o envio.");
      return;
    }
    if (!login || login === "-") {
      alert("Salve o cliente primeiro para gerar o acesso.");
      return;
    }

    const assunto = encodeURIComponent(`Acesso inicial VetCore - ${nomeClinica || "Clínica"}`);
    const corpo = encodeURIComponent(montarTextoCredenciaisEmail({ email, login, senha, nomeClinica, responsavel }));
    window.location.href = `mailto:${email}?subject=${assunto}&body=${corpo}`;
  }

  function regenerarSenhaClientePainel() {
    garantirAuthMaster(() => {
      if (!clienteEditandoId) {
        alert("Abra um cliente já salvo para gerar uma nova senha.");
        return;
      }
      const lista = obterClientesMestre();
      const idx = lista.findIndex(item => item.id === clienteEditandoId);
      if (idx < 0) {
        alert("Cliente não encontrado.");
        return;
      }
      const senhaNova = gerarSenhaCliente();
      const cliente = { ...lista[idx], senha: senhaNova, login: obterLoginCliente(lista[idx]) };
      const credenciais = criarOuAtualizarLoginCliente(cliente, senhaNova);
      lista[idx] = { ...cliente, login: credenciais.login, senha: credenciais.senha };
      salvarClientesMestre(lista);
      atualizarBlocoCredenciais(credenciais.login, credenciais.senha);
      renderizarPainelMestre();
      alert("Nova senha provisória gerada com sucesso.");
    });
  }


  let clienteEditandoId = null;

  function normalizarEmail(email) {
    return (email || "").trim().toLowerCase();
  }

  function escapeHtml(valor) {
    return String(valor || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeHtmlAttr(valor) {
    return escapeHtml(valor).replace(/`/g, "&#096;");
  }

  
  function adminMasterPermitido() {
    const usuario = (typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : localStorage.getItem("usuarioLogado") || "");
    const email = (usuario || "").toLowerCase().trim();
    return email === "admin";
  }

  function adminMasterLogado() {
    return adminMasterPermitido() && sessionStorage.getItem("vetcoreMasterAuth") === "ok";
  }

  function removerModalSenhaMaster() {
    const existente = document.getElementById("vetcoreMasterPromptOverlay");
    if (existente) existente.remove();
  }

  function solicitarSenhaMaster(callback) {
    if (!adminMasterPermitido()) {
      if (typeof callback === "function") callback(false);
      return;
    }

    if (adminMasterLogado()) {
      if (typeof callback === "function") callback(true);
      return;
    }

    removerModalSenhaMaster();

    const overlay = document.createElement("div");
    overlay.id = "vetcoreMasterPromptOverlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(2,6,23,.76);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:18px;";

    const box = document.createElement("div");
    box.style.cssText = "width:min(420px,100%);background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,.25);border-radius:18px;box-shadow:0 25px 60px rgba(0,0,0,.45);padding:22px;";
    box.innerHTML = `
      <div style="font-size:20px;font-weight:800;margin-bottom:8px;">Painel mestre</div>
      <div style="font-size:14px;color:#94a3b8;margin-bottom:14px;">Acesso restrito. Digite a senha do painel mestre.</div>
      <input id="vetcoreMasterSenhaInput" type="password" placeholder="Senha do painel mestre" style="width:100%;box-sizing:border-box;padding:14px 16px;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:#020617;color:#e2e8f0;outline:none;font-size:15px;">
      <div id="vetcoreMasterSenhaErro" style="display:none;margin-top:10px;color:#fca5a5;font-size:13px;">Senha incorreta.</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button type="button" id="vetcoreMasterCancelar" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(148,163,184,.2);background:transparent;color:#e2e8f0;cursor:pointer;">Cancelar</button>
        <button type="button" id="vetcoreMasterConfirmar" style="padding:10px 16px;border:none;border-radius:12px;background:linear-gradient(135deg,#2563eb,#38bdf8);color:white;font-weight:700;cursor:pointer;">Entrar</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const input = box.querySelector("#vetcoreMasterSenhaInput");
    const erro = box.querySelector("#vetcoreMasterSenhaErro");
    const fechar = (ok) => {
      removerModalSenhaMaster();
      if (typeof callback === "function") callback(!!ok);
    };
    const confirmar = () => {
      const senha = (input?.value || "").trim();
      if (senha === "admin123") {
        sessionStorage.setItem("vetcoreMasterAuth", "ok");
        fechar(true);
      } else {
        if (erro) erro.style.display = "block";
        if (input) {
          input.value = "";
          input.focus();
        }
      }
    };

    box.querySelector("#vetcoreMasterCancelar")?.addEventListener("click", () => fechar(false));
    box.querySelector("#vetcoreMasterConfirmar")?.addEventListener("click", confirmar);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(false); });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmar();
      if (e.key === "Escape") fechar(false);
    });
    setTimeout(() => input?.focus(), 20);
  }

  function garantirAuthMaster(acao) {
    if (!adminMasterPermitido()) {
      alert("Acesso restrito ao administrador master.");
      return;
    }
    solicitarSenhaMaster((ok) => {
      if (!ok) return;
      if (typeof acao === "function") acao();
    });
  }


  function obterClientesMestre() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_CLIENTES)) || [];
    } catch (e) {
      return [];
    }
  }

  function salvarClientesMestre(lista) {
    localStorage.setItem(STORAGE_CLIENTES, JSON.stringify(lista));
  }

  function obterClientePorId(id) {
    return obterClientesMestre().find(item => item.id === id) || null;
  }

  function gerarId() {
    return Date.now();
  }

  function obterNomeClinicaExibicaoMestre(nome) {
    if (typeof obterNomeClinicaExibicao === "function") {
      return obterNomeClinicaExibicao(nome);
    }
    return nome || "-";
  }

  function sincronizarPlanoComClinica(nomeClinica, plano, vencimento, observacoes) {
    try {
      const planos = JSON.parse(localStorage.getItem("vetcorePlanosPorClinica")) || {};
      planos[nomeClinica] = {
        tipo: plano || "profissional",
        demoExpiraEm: plano === "demo" ? (vencimento || "") : "",
        observacoes: observacoes || ""
      };
      localStorage.setItem("vetcorePlanosPorClinica", JSON.stringify(planos));
      if (typeof aplicarPlanoNaInterface === "function") {
        setTimeout(aplicarPlanoNaInterface, 20);
      }
    } catch (e) {}
  }

  function garantirClinicaNoConfigSistema(nomeClinica) {
    if (!nomeClinica || typeof obterConfiguracoesSistema !== "function" || typeof salvarConfiguracoesSistemaStorage !== "function") return;
    const cfg = obterConfiguracoesSistema();
    if (!cfg.clinicas[nomeClinica]) {
      cfg.clinicas[nomeClinica] = nomeClinica;
      salvarConfiguracoesSistemaStorage(cfg);
      if (typeof renderizarClinicasConfiguracao === "function") {
        try { renderizarClinicasConfiguracao(); } catch (e) {}
      }
      if (typeof renderizarClinicasEscolha === "function") {
        try { renderizarClinicasEscolha(); } catch (e) {}
      }
    }
  }

  function obterUnidadesCliente(cliente) {
    if (!cliente) return [];
    const unidades = [];
    const adicionar = (chave) => {
      chave = (chave || "").trim();
      if (chave && !unidades.includes(chave)) unidades.push(chave);
    };
    if (Array.isArray(cliente.clinicasVinculadas)) {
      cliente.clinicasVinculadas.forEach(adicionar);
    }
    return unidades;
  }

  function atualizarVinculosUnidadesCliente(cliente) {
    if (!cliente) return;
    const unidades = obterUnidadesCliente(cliente);
    const primeiraUnidade = unidades[0] || "";
    try {
      const usuarios = obterUsuariosSistemaSeguro().map(u => {
        const mesmoLogin = ((u.usuario || "").trim().toLowerCase() === normalizarEmail(cliente.login || cliente.email || ""));
        const mesmoCliente = cliente.id && u.clienteId === cliente.id;
        if (mesmoLogin || mesmoCliente) {
          return { ...u, clinicaVinculada: primeiraUnidade, clinicasVinculadas: unidades };
        }
        return u;
      });
      salvarUsuariosSistemaSeguro(usuarios);
    } catch (e) {}

    try {
      const lista = obterClientesMestre();
      const idx = lista.findIndex(item => item.id === cliente.id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], clinicasVinculadas: unidades };
        salvarClientesMestre(lista);
      }
    } catch (e) {}
  }

  function gerarChaveUnidadeCliente(cliente, nomeUnidade) {
    const baseCliente = slugClinica(cliente?.nomeClinica || cliente?.email || "cliente") || "cliente";
    const baseUnidade = slugClinica(nomeUnidade || "unidade") || "unidade";
    let chave = `${baseCliente}-${baseUnidade}`;
    try {
      const cfg = obterConfiguracoesSistema();
      let n = 2;
      while (cfg.clinicas && cfg.clinicas[chave]) {
        chave = `${baseCliente}-${baseUnidade}-${n}`;
        n++;
      }
    } catch (e) {}
    return chave;
  }

  function renderizarUnidadesClientePainel() {
    const box = document.getElementById("masterListaUnidadesCliente");
    const campo = document.getElementById("masterNovaUnidadeNome");
    if (!box) return;

    if (!clienteEditandoId) {
      box.innerHTML = `<div class="master-vazio">Informe a primeira unidade no campo abaixo e salve o cliente. Depois você poderá editar e adicionar mais unidades.</div>`;
      if (campo) campo.disabled = false;
      return;
    }
    if (campo) campo.disabled = false;

    const cliente = obterClientePorId(clienteEditandoId);
    if (!cliente) {
      box.innerHTML = `<div class="master-vazio">Cliente não encontrado.</div>`;
      return;
    }

    const cfg = (typeof obterConfiguracoesSistema === "function" ? obterConfiguracoesSistema() : { clinicas: {} });
    const unidades = obterUnidadesCliente(cliente);
    if (!unidades.length) {
      box.innerHTML = `<div class="master-vazio">Nenhuma unidade vinculada. Digite o nome da unidade abaixo e clique em Adicionar unidade.</div>`;
      return;
    }

    box.innerHTML = unidades.map(chave => {
      const nome = (cfg.clinicas && cfg.clinicas[chave]) || chave;
      const principal = chave === unidades[0];
      return `
        <div class="config-list-row" data-unidade-chave="${escapeHtmlAttr(chave)}" data-cliente-id="${cliente.id}">
          <div>
            <strong>${escapeHtml(nome)}</strong>
            <div class="config-list-meta">${principal ? "Unidade principal" : "Unidade adicional"} • ${escapeHtml(chave)}</div>
          </div>
          <div class="linha-botoes" style="margin:0;">
            <button class="btn-secundario js-editar-unidade-master" type="button" data-cliente-id="${cliente.id}" data-unidade-chave="${escapeHtmlAttr(chave)}">Editar</button>
            ${unidades.length <= 1 ? "" : `<button class="btn-vermelho btn-excluir-agendamento js-excluir-unidade-master" type="button" data-cliente-id="${cliente.id}" data-unidade-chave="${escapeHtmlAttr(chave)}">Excluir</button>`}
          </div>
        </div>
      `;
    }).join("");
  }

  function adicionarUnidadeClientePainel() {
    garantirAuthMaster(() => {
      if (!clienteEditandoId) {
        alert("Edite ou salve um cliente antes de cadastrar unidades.");
        return;
      }
      const campo = document.getElementById("masterNovaUnidadeNome");
      const nome = (campo?.value || "").trim();
      if (!nome) {
        alert("Informe o nome da unidade.");
        return;
      }
      const lista = obterClientesMestre();
      const idx = lista.findIndex(item => item.id === clienteEditandoId);
      if (idx < 0) {
        alert("Cliente não encontrado.");
        return;
      }

      const cliente = lista[idx];
      const chave = gerarChaveUnidadeCliente(cliente, nome);
      const cfg = obterConfiguracoesSistema();
      if (!cfg.clinicas) cfg.clinicas = {};
      cfg.clinicas[chave] = nome;
      salvarConfiguracoesSistemaStorage(cfg);

      if (typeof veterinariosPorClinica !== "undefined" && !Array.isArray(veterinariosPorClinica[chave])) {
        veterinariosPorClinica[chave] = [];
        if (typeof salvarProfissionaisStorage === "function") salvarProfissionaisStorage();
      }

      const unidades = obterUnidadesCliente(cliente);
      if (!unidades.includes(chave)) unidades.push(chave);
      lista[idx] = { ...cliente, clinicasVinculadas: unidades };
      salvarClientesMestre(lista);
      atualizarVinculosUnidadesCliente(lista[idx]);

      if (campo) campo.value = "";
      renderizarUnidadesClientePainel();
      renderizarPainelMestre();
      if (typeof renderizarClinicasEscolha === "function") {
        try { renderizarClinicasEscolha(); } catch (e) {}
      }
      alert("Unidade adicionada ao cliente.");
    });
  }

  function editarUnidadeClientePainel(clienteId, chave) {
    garantirAuthMaster(async () => {
      const cliente = obterClientePorId(clienteId);
      if (!cliente) return;
      const cfg = obterConfiguracoesSistema();
      const atual = (cfg.clinicas && cfg.clinicas[chave]) || chave;
      const novoNome = await vcPrompt("Novo nome da unidade:", atual, "Editar unidade");
      if (novoNome === null) return;
      const nome = (novoNome || "").trim();
      if (!nome) {
        alert("Informe um nome válido.");
        return;
      }
      if (!cfg.clinicas) cfg.clinicas = {};
      cfg.clinicas[chave] = nome;
      salvarConfiguracoesSistemaStorage(cfg);
      renderizarUnidadesClientePainel();
      renderizarPainelMestre();
      if (typeof atualizarTopbarSistema === "function") atualizarTopbarSistema();
      alert("Unidade atualizada.");
    });
  }

  function excluirUnidadeClientePainel(clienteId, chave) {
    garantirAuthMaster(async () => {
      const lista = obterClientesMestre();
      const idx = lista.findIndex(item => item.id === clienteId);
      if (idx < 0) return;
      const cliente = lista[idx];
      if (chave === cliente.nomeClinica) {
        alert("A unidade principal não pode ser excluída aqui. Renomeie o cliente se quiser alterar o nome principal.");
        return;
      }
      if (!(await vcConfirm("Excluir esta unidade do cliente?"))) return;

      const unidades = obterUnidadesCliente(cliente).filter(u => u !== chave);
      lista[idx] = { ...cliente, clinicasVinculadas: unidades };
      salvarClientesMestre(lista);
      atualizarVinculosUnidadesCliente(lista[idx]);

      try {
        const cfg = obterConfiguracoesSistema();
        if (cfg.clinicas && cfg.clinicas[chave]) {
          delete cfg.clinicas[chave];
          salvarConfiguracoesSistemaStorage(cfg);
        }
      } catch (e) {}

      try {
        if (typeof veterinariosPorClinica !== "undefined" && veterinariosPorClinica[chave]) {
          delete veterinariosPorClinica[chave];
          if (typeof salvarProfissionaisStorage === "function") salvarProfissionaisStorage();
        }
      } catch (e) {}

      if (localStorage.getItem("clinicaSelecionada") === chave) {
        localStorage.setItem("clinicaSelecionada", cliente.nomeClinica || "");
      }

      renderizarUnidadesClientePainel();
      renderizarPainelMestre();
      if (typeof renderizarClinicasEscolha === "function") {
        try { renderizarClinicasEscolha(); } catch (e) {}
      }
      alert("Unidade excluída.");
    });
  }

  function renomearClinicaEmEstruturas(nomeAntigo, nomeNovo) {
    if (!nomeAntigo || !nomeNovo || nomeAntigo === nomeNovo) return;

    try {
      const usuarios = obterUsuariosSistemaSeguro().map(u => {
        if ((u.clinicaVinculada || "") === nomeAntigo) {
          return { ...u, clinicaVinculada: nomeNovo };
        }
        return u;
      });
      salvarUsuariosSistemaSeguro(usuarios);
    } catch (e) {}

    try {
      const cfg = typeof obterConfiguracoesSistema === "function" ? obterConfiguracoesSistema() : null;
      if (cfg && cfg.clinicas && cfg.clinicas[nomeAntigo]) {
        delete cfg.clinicas[nomeAntigo];
        cfg.clinicas[nomeNovo] = nomeNovo;
        if (typeof salvarConfiguracoesSistemaStorage === "function") {
          salvarConfiguracoesSistemaStorage(cfg);
        }
      }
    } catch (e) {}

    try {
      const planos = JSON.parse(localStorage.getItem("vetcorePlanosPorClinica")) || {};
      if (planos[nomeAntigo]) {
        planos[nomeNovo] = planos[nomeAntigo];
        delete planos[nomeAntigo];
        localStorage.setItem("vetcorePlanosPorClinica", JSON.stringify(planos));
      }
    } catch (e) {}

    try {
      if (localStorage.getItem("clinicaSelecionada") === nomeAntigo) {
        localStorage.setItem("clinicaSelecionada", nomeNovo);
      }
    } catch (e) {}
  }

  function removerEstruturasDaClinica(nomeClinica, loginCliente) {
    try {
      const usuarios = obterUsuariosSistemaSeguro().filter(u => (u.usuario || "") !== loginCliente && (u.clinicaVinculada || "") !== nomeClinica);
      salvarUsuariosSistemaSeguro(usuarios);
    } catch (e) {}

    try {
      const cfg = typeof obterConfiguracoesSistema === "function" ? obterConfiguracoesSistema() : null;
      if (cfg && cfg.clinicas && cfg.clinicas[nomeClinica]) {
        delete cfg.clinicas[nomeClinica];
        if (typeof salvarConfiguracoesSistemaStorage === "function") {
          salvarConfiguracoesSistemaStorage(cfg);
        }
      }
    } catch (e) {}

    try {
      const planos = JSON.parse(localStorage.getItem("vetcorePlanosPorClinica")) || {};
      if (planos[nomeClinica]) {
        delete planos[nomeClinica];
        localStorage.setItem("vetcorePlanosPorClinica", JSON.stringify(planos));
      }
    } catch (e) {}
  }

  function obterValoresFormulario() {
    return {
      nomeClinica: (document.getElementById("masterNomeClinica")?.value || "").trim(),
      responsavel: (document.getElementById("masterResponsavel")?.value || "").trim(),
      whatsapp: (document.getElementById("masterWhatsapp")?.value || "").trim(),
      email: normalizarEmail(document.getElementById("masterEmail")?.value || ""),
      plano: document.getElementById("masterPlano")?.value || "demo",
      status: document.getElementById("masterStatus")?.value || "demo",
      vencimento: document.getElementById("masterVencimento")?.value || "",
      observacoes: (document.getElementById("masterObservacoes")?.value || "").trim()
    };
  }

  function validarFormularioCliente(valores) {
    if (!valores.nomeClinica) {
      alert("Informe o nome da clínica.");
      return false;
    }
    if (!valores.responsavel) {
      alert("Informe o responsável.");
      return false;
    }
    if (!valores.email) {
      alert("Informe o e-mail do cliente. Ele será usado como login.");
      return false;
    }
    const unidadeInicial = (document.getElementById("masterNovaUnidadeNome")?.value || "").trim();
    if (!clienteEditandoId && !unidadeInicial) {
      alert("Informe a primeira unidade do cliente antes de salvar.");
      return false;
    }
    const lista = obterClientesMestre();
    const emailExiste = lista.some(item => item.id !== clienteEditandoId && normalizarEmail(item.email) === valores.email);
    if (emailExiste) {
      alert("Já existe outro cliente usando esse e-mail.");
      return false;
    }
    return true;
  }

  function limparFormularioPainelMestre() {
    clienteEditandoId = null;
    atualizarBlocoCredenciais("-", "-");
    const ids = ["masterNomeClinica","masterResponsavel","masterWhatsapp","masterEmail","masterVencimento","masterObservacoes"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const plano = document.getElementById("masterPlano");
    const status = document.getElementById("masterStatus");
    const vencimento = document.getElementById("masterVencimento");
    if (plano) plano.value = "demo";
    if (status) status.value = "demo";
    if (vencimento) vencimento.value = gerarVencimentoDemoPadrao();
    const unidade = document.getElementById("masterNovaUnidadeNome");
    if (unidade) unidade.value = "";
    renderizarUnidadesClientePainel();
  }

  function salvarClientePainelMestre() {
    garantirAuthMaster(() => {
      const valores = obterValoresFormulario();
      if (!validarFormularioCliente(valores)) return;

      if (valores.plano === "demo" && !valores.vencimento) {
        valores.vencimento = gerarVencimentoDemoPadrao();
      }
      if (valores.plano !== "demo" && valores.status === "demo") {
        valores.status = "ativo";
      }

      const lista = obterClientesMestre();
      let credenciais = null;
      const nomeUnidadeDigitado = (document.getElementById("masterNovaUnidadeNome")?.value || "").trim();

      if (clienteEditandoId) {
        const idx = lista.findIndex(item => item.id === clienteEditandoId);
        if (idx >= 0) {
          const atual = lista[idx];
          const precisaNovaSenha = normalizarEmail(atual.email) !== valores.email;
          const senhaBase = precisaNovaSenha ? gerarSenhaCliente() : atual.senha;
          let unidades = obterUnidadesCliente(atual);

          if (!unidades.length && nomeUnidadeDigitado) {
            const chaveNova = gerarChaveUnidadeCliente({ ...atual, ...valores }, nomeUnidadeDigitado);
            const cfg = obterConfiguracoesSistema();
            if (!cfg.clinicas) cfg.clinicas = {};
            cfg.clinicas[chaveNova] = nomeUnidadeDigitado;
            salvarConfiguracoesSistemaStorage(cfg);
            unidades = [chaveNova];

            if (typeof veterinariosPorClinica !== "undefined" && !Array.isArray(veterinariosPorClinica[chaveNova])) {
              veterinariosPorClinica[chaveNova] = [];
              if (typeof salvarProfissionaisStorage === "function") salvarProfissionaisStorage();
            }
          }

          const payloadCliente = { ...atual, ...valores, id: atual.id, senha: senhaBase, clinicasVinculadas: unidades };
          credenciais = criarOuAtualizarLoginCliente(payloadCliente, senhaBase);
          lista[idx] = { ...payloadCliente, status: obterStatusCalculadoCliente(payloadCliente), login: credenciais.login, senha: credenciais.senha };
        }
      } else {
        const novoClienteBase = {
          id: gerarId(),
          criadoEm: new Date().toISOString(),
          ...valores
        };

        const chaveUnidadeInicial = gerarChaveUnidadeCliente(novoClienteBase, nomeUnidadeDigitado);
        const cfg = obterConfiguracoesSistema();
        if (!cfg.clinicas) cfg.clinicas = {};
        cfg.clinicas[chaveUnidadeInicial] = nomeUnidadeDigitado;
        salvarConfiguracoesSistemaStorage(cfg);

        if (typeof veterinariosPorClinica !== "undefined" && !Array.isArray(veterinariosPorClinica[chaveUnidadeInicial])) {
          veterinariosPorClinica[chaveUnidadeInicial] = [];
          if (typeof salvarProfissionaisStorage === "function") salvarProfissionaisStorage();
        }

        const novoCliente = {
          ...novoClienteBase,
          clinicasVinculadas: [chaveUnidadeInicial]
        };
        credenciais = criarOuAtualizarLoginCliente(novoCliente);
        lista.unshift({
          ...novoCliente,
          status: obterStatusCalculadoCliente(novoCliente),
          login: credenciais.login,
          senha: credenciais.senha
        });
      }

      salvarClientesMestre(lista);
      try {
        const salvoAgora = obterClientesMestre().find(item => item.login === (credenciais?.login || "") || item.email === valores.email);
        if (salvoAgora) atualizarVinculosUnidadesCliente(salvoAgora);
      } catch (e) {}
      sincronizarPlanoComClinica(valores.nomeClinica, valores.plano, valores.vencimento, valores.observacoes);
      atualizarBlocoCredenciais(credenciais?.login || "-", credenciais?.senha || "-");
      const campoUnidade = document.getElementById("masterNovaUnidadeNome");
      if (campoUnidade) campoUnidade.value = "";
      renderizarUnidadesClientePainel();
      renderizarPainelMestre();
      alert("Cliente salvo com sucesso. O e-mail do cliente agora é o login de acesso.");
    });
  }

  function editarClientePainelMestre(id) {
    const cliente = obterClientePorId(id);
    if (!cliente) return;
    clienteEditandoId = id;
    document.getElementById("masterNomeClinica").value = cliente.nomeClinica || "";
    document.getElementById("masterResponsavel").value = cliente.responsavel || "";
    document.getElementById("masterWhatsapp").value = cliente.whatsapp || "";
    document.getElementById("masterEmail").value = cliente.email || "";
    document.getElementById("masterPlano").value = cliente.plano || "demo";
    document.getElementById("masterStatus").value = cliente.status || "demo";
    document.getElementById("masterVencimento").value = cliente.vencimento || "";
    document.getElementById("masterObservacoes").value = cliente.observacoes || "";
    atualizarBlocoCredenciais(cliente.login || "-", cliente.senha || "-");
    renderizarUnidadesClientePainel();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluirClientePainelMestre(id) {
    garantirAuthMaster(async () => {
      const cliente = obterClientePorId(id);
      if (!cliente) return;
      if (!(await vcConfirm(`Excluir ${cliente.nomeClinica}?`))) return;
      const lista = obterClientesMestre().filter(item => item.id !== id);
      salvarClientesMestre(lista);
      removerEstruturasDaClinica(cliente.nomeClinica, cliente.login);
      renderizarPainelMestre();
    });
  }

  function entrarNaClinicaComoMaster(nomeClinica) {
    garantirAuthMaster(() => {
      localStorage.setItem("clinicaSelecionada", nomeClinica);
      if (typeof atualizarMenu === "function") atualizarMenu();
      if (typeof mostrarTela === "function") mostrarTela("telaMenu");
    });
  }

  function montarResumo(lista) {
    const total = lista.length;
    const ativos = lista.filter(x => obterStatusCalculadoCliente(x) === "ativo").length;
    const demos = lista.filter(x => obterStatusCalculadoCliente(x) === "demo").length;
    const vencidos = lista.filter(x => obterStatusCalculadoCliente(x) === "vencido").length;

    const el = document.getElementById("resumoPainelMestre");
    if (!el) return;

    el.innerHTML = `
      <div class="card-resumo-mestre"><span>Total de clientes</span><strong>${total}</strong></div>
      <div class="card-resumo-mestre"><span>Ativos</span><strong>${ativos}</strong></div>
      <div class="card-resumo-mestre"><span>Demos</span><strong>${demos}</strong></div>
      <div class="card-resumo-mestre"><span>Vencidos</span><strong>${vencidos}</strong></div>
    `;
  }

  function renderizarPainelMestre() {
    const listaBase = obterClientesMestre();
    montarResumo(listaBase);

    const filtro = (document.getElementById("filtroPainelMestre")?.value || "").trim().toLowerCase();
    const lista = listaBase.map(item => ({ ...item, statusCalculado: obterStatusCalculadoCliente(item) })).filter(item => {
      const texto = `${item.nomeClinica} ${item.responsavel} ${item.statusCalculado} ${item.plano} ${item.email}`.toLowerCase();
      return texto.includes(filtro);
    });

    const el = document.getElementById("listaClientesPainelMestre");
    if (!el) return;

    if (!lista.length) {
      el.innerHTML = `<div class="master-vazio">Nenhum cliente cadastrado ainda.</div>`;
      return;
    }

    el.innerHTML = lista.map(item => `
      <div class="cliente-mestre-card">
        <div class="cliente-mestre-topo">
          <div>
            <div class="cliente-mestre-titulo">${item.nomeClinica || "-"}</div>
            <div>
              <span class="badge-plano">${(item.plano || "demo").toUpperCase()}</span>
              <span class="badge-status ${item.statusCalculado || "demo"}">${(item.statusCalculado || "demo").toUpperCase()}</span>
            </div>
          </div>
          <div style="font-size:13px;opacity:.8">Vence: ${item.vencimento || "-"}</div>
        </div>

        <div class="cliente-mestre-meta">
          <div><strong>Responsável:</strong> ${item.responsavel || "-"}</div>
          <div><strong>WhatsApp:</strong> ${item.whatsapp || "-"}</div>
          <div><strong>E-mail:</strong> ${item.email || "-"}</div>
          <div><strong>Plano aplicado:</strong> ${item.plano || "-"}</div>
          <div><strong>Unidades:</strong> ${obterUnidadesCliente(item).length}</div>
          <div><strong>Acesso:</strong> ${["vencido","suspenso","cancelado"].includes(item.statusCalculado) ? "Bloqueado" : "Liberado"}</div>
          <div><strong>Login:</strong> ${item.login || "-"}</div>
          <div><strong>Senha:</strong> ${item.senha || "-"}</div>
        </div>

        ${item.observacoes ? `<div style="margin-top:10px;font-size:14px;opacity:.92"><strong>Obs.:</strong> ${item.observacoes}</div>` : ""}

        <div class="cliente-mestre-acoes">
          <button class="master-btn-mini master-btn-editar" onclick="editarClientePainelMestre(${item.id})">Editar</button>
          <button class="master-btn-mini master-btn-editar" onclick="editarClientePainelMestre(${item.id}); setTimeout(renderizarUnidadesClientePainel, 50);">Unidades</button>
          <button class="master-btn-mini master-btn-entrar" onclick="entrarNaClinicaComoMaster(${JSON.stringify(item.nomeClinica)})">Entrar na clínica</button>
          <button class="master-btn-mini master-btn-excluir" onclick="excluirClientePainelMestre(${item.id})">Excluir</button>
        </div>
      </div>
    `).join("");
  }

  function atualizarVisibilidadePainelMestre() {
    const btnMenu = document.getElementById("btnMenuPainelMestre");
    const btnCfg = document.getElementById("btnAcessoPainelMestreConfig");
    const pode = adminMasterPermitido();
    if (btnMenu) btnMenu.classList.toggle("oculto", !pode);
    if (btnCfg) btnCfg.classList.toggle("oculto", !pode);
  }

  function abrirPainelMestre() {
    garantirAuthMaster(() => {
      if (typeof mostrarTelaOriginalVetCore === "function") {
        mostrarTelaOriginalVetCore("telaPainelMestre");
      } else if (typeof mostrarTela === "function") {
        mostrarTela("telaPainelMestre");
      } else {
        const tela = document.getElementById("telaPainelMestre");
        if (tela) tela.classList.remove("oculto");
      }
      atualizarVisibilidadePainelMestre();
      renderizarPainelMestre();
    });
  }

  // Patch mostrarTela to include the new screen
  if (typeof window.mostrarTela === "function" && !window.mostrarTelaOriginalVetCore) {
    window.mostrarTelaOriginalVetCore = window.mostrarTela;
    window.mostrarTela = function (idTela) {
      const extra = document.getElementById("telaPainelMestre");
      if (extra) extra.classList.add("oculto");
      const r = window.mostrarTelaOriginalVetCore(idTela);
      if (idTela === "telaPainelMestre" && extra) {
        extra.classList.remove("oculto");
      }
      atualizarVisibilidadePainelMestre();
      return r;
    };
  }

  // Patch login/menu update to refresh visibility
  const originalAtualizarMenu = window.atualizarMenu;
  if (typeof originalAtualizarMenu === "function" && !window._painelMestreHookMenu) {
    window._painelMestreHookMenu = true;
    window.atualizarMenu = function () {
      const r = originalAtualizarMenu.apply(this, arguments);
      setTimeout(atualizarVisibilidadePainelMestre, 30);
      return r;
    };
  }

  const originalFazerLogin = window.fazerLogin;
  if (typeof originalFazerLogin === "function" && !window._painelMestreHookLogin) {
    window._painelMestreHookLogin = true;
    window.fazerLogin = function () {
      const r = originalFazerLogin.apply(this, arguments);
      setTimeout(function () {
        atualizarVisibilidadePainelMestre();
        try {
          const usuario = (localStorage.getItem("usuarioLogado") || "").trim().toLowerCase();
          if (adminMasterPermitido() && ["admin"].includes(usuario)) {
            localStorage.removeItem("clinicaSelecionada");
            abrirPainelMestre();
          }
        } catch (e) {}
      }, 900);
      return r;
    };
  }

  if (!window._painelMestreEventosUnidades) {
    window._painelMestreEventosUnidades = true;
    document.addEventListener("click", function (e) {
      const botaoEditar = e.target.closest && e.target.closest(".js-editar-unidade-master");
      if (botaoEditar) {
        e.preventDefault();
        const clienteId = Number(botaoEditar.dataset.clienteId || clienteEditandoId || 0);
        const chave = botaoEditar.dataset.unidadeChave || "";
        editarUnidadeClientePainel(clienteId, chave);
        return;
      }
      const botaoExcluir = e.target.closest && e.target.closest(".js-excluir-unidade-master");
      if (botaoExcluir) {
        e.preventDefault();
        const clienteId = Number(botaoExcluir.dataset.clienteId || clienteEditandoId || 0);
        const chave = botaoExcluir.dataset.unidadeChave || "";
        excluirUnidadeClientePainel(clienteId, chave);
      }
    });
  }

  window.abrirPainelMestre = abrirPainelMestre;
  window.salvarClientePainelMestre = salvarClientePainelMestre;
  window.limparFormularioPainelMestre = limparFormularioPainelMestre;
  window.renderizarPainelMestre = renderizarPainelMestre;
  window.editarClientePainelMestre = editarClientePainelMestre;
  window.excluirClientePainelMestre = excluirClientePainelMestre;
  window.entrarNaClinicaComoMaster = entrarNaClinicaComoMaster;
  window.atualizarVisibilidadePainelMestre = atualizarVisibilidadePainelMestre;
  window.copiarCredenciaisCliente = copiarCredenciaisCliente;
  window.enviarEmailCredenciaisCliente = enviarEmailCredenciaisCliente;
  window.regenerarSenhaClientePainel = regenerarSenhaClientePainel;
  window.adicionarUnidadeClientePainel = adicionarUnidadeClientePainel;
  window.editarUnidadeClientePainel = editarUnidadeClientePainel;
  window.excluirUnidadeClientePainel = excluirUnidadeClientePainel;
  window.renderizarUnidadesClientePainel = renderizarUnidadesClientePainel;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      atualizarVisibilidadePainelMestre();
      limparFormularioPainelMestre();
    });
  } else {
    atualizarVisibilidadePainelMestre();
    limparFormularioPainelMestre();
  }
})();
