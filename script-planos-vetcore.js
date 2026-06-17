
(function () {
  const STORAGE_KEY = "vetcorePlanosPorClinica";
  const DEMO_FAKE_PREFIX = "[DEMO]";

  const PLANOS = {
    demo: {
      nome: "Demonstração",
      permiteMultiunidade: true,
      permiteConfiguracoes: true,
      permiteCadastrarUsuarios: true,
      permiteRelatorios: true,
      permiteBloqueios: true,
      permiteSalvarDadosReais: true,
      maxProfissionais: 2
    },
    essencial: {
      nome: "Essencial",
      permiteMultiunidade: false,
      permiteConfiguracoes: false,
      permiteCadastrarUsuarios: false,
      permiteRelatorios: false,
      permiteBloqueios: false,
      permiteSalvarDadosReais: true,
      maxProfissionais: null,
      maxProfissionais: null
    },
    profissional: {
      nome: "Profissional",
      permiteMultiunidade: true,
      permiteConfiguracoes: true,
      permiteCadastrarUsuarios: true,
      permiteRelatorios: true,
      permiteBloqueios: true,
      permiteSalvarDadosReais: true,
      maxProfissionais: null
    },
    premium: {
      nome: "Premium",
      permiteMultiunidade: true,
      permiteConfiguracoes: true,
      permiteCadastrarUsuarios: true,
      permiteRelatorios: true,
      permiteBloqueios: true,
      permiteSalvarDadosReais: true
    }
  };

  function hojeIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function obterClinicaAtualSeguro() {
    try {
      if (typeof obterClinicaSelecionada === "function") {
        return obterClinicaSelecionada() || "";
      }
    } catch (e) {}
    return localStorage.getItem("clinicaSelecionada") || "";
  }

  function obterPlanosSalvos() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function salvarPlanosSalvos(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  function obterChavePlanoCliente(chaveClinica) {
    try {
      if (typeof obterClinicaPrincipalDoCliente === "function") {
        return obterClinicaPrincipalDoCliente(chaveClinica) || chaveClinica;
      }
    } catch (e) {}
    return chaveClinica;
  }

  function obterPlanoClinica(chaveClinica) {
    const planos = obterPlanosSalvos();
    const chavePlano = obterChavePlanoCliente(chaveClinica);
    const padrao = {
      tipo: "profissional",
      demoExpiraEm: "",
      observacoes: ""
    };
    return { ...padrao, ...(planos[chavePlano] || planos[chaveClinica] || planos.global || {}) };
  }

  function salvarPlanoClinica(chaveClinica, config) {
    const planos = obterPlanosSalvos();
    const chavePlano = obterChavePlanoCliente(chaveClinica);
    planos[chavePlano] = {
      tipo: config.tipo || "profissional",
      demoExpiraEm: config.demoExpiraEm || "",
      observacoes: config.observacoes || ""
    };
    salvarPlanosSalvos(planos);
  }

  function obterRegrasPlanoAtual() {
    const clinica = obterClinicaAtualSeguro();
    const plano = obterPlanoClinica(clinica);
    const regras = PLANOS[plano.tipo] || PLANOS.profissional;
    return { clinica, plano, regras };
  }

  function planoDemoExpirado(plano) {
    if (!plano || plano.tipo !== "demo") return false;
    if (!plano.demoExpiraEm) return false;
    return plano.demoExpiraEm < hojeIso();
  }

  function vetcorePodeSalvarDadosReais() {
    const { plano, regras } = obterRegrasPlanoAtual();
    if (planoDemoExpirado(plano)) {
      alert("A demonstração desta clínica expirou.");
      return false;
    }
    
    return true;
  }

  function vetcorePermiteMultiunidade() {
    const { plano, regras } = obterRegrasPlanoAtual();
    if (planoDemoExpirado(plano)) return false;
    return !!regras.permiteMultiunidade;
  }

  function vetcoreDescreverPlanoAtual() {
    const { clinica, plano, regras } = obterRegrasPlanoAtual();
    const nome = (PLANOS[plano.tipo] || PLANOS.profissional).nome;
    const expira = plano.demoExpiraEm ? ` | expira em: ${plano.demoExpiraEm}` : "";
    const obs = plano.observacoes ? ` | obs: ${plano.observacoes}` : "";
    return `Cliente: ${obterChavePlanoCliente(clinica) || "-"} | Unidade: ${clinica || "-"} | Plano: ${nome}${expira}${obs}`;
  }

  function atualizarResumoPlanoNaTela() {
    const el = document.getElementById("vetcorePlanoResumo");
    if (!el) return;
    el.innerText = vetcoreDescreverPlanoAtual();
  }

  function carregarPlanoClinicaNaTela() {
    const clinica = obterClinicaAtualSeguro();
    const plano = obterPlanoClinica(clinica);
    const tipo = document.getElementById("cfgPlanoTipo");
    const exp = document.getElementById("cfgPlanoExpiraEm");
    const obs = document.getElementById("cfgPlanoObservacoes");

    if (tipo) tipo.value = plano.tipo || "profissional";
    if (exp) exp.value = plano.demoExpiraEm || "";
    if (obs) obs.value = plano.observacoes || "";

    atualizarResumoPlanoNaTela();
  }

  function salvarPlanoClinicaPelaTela() {
    const clinica = obterClinicaAtualSeguro();
    if (!clinica) {
      alert("Selecione uma clínica antes de salvar o plano.");
      return;
    }

    const tipo = document.getElementById("cfgPlanoTipo")?.value || "profissional";
    const demoExpiraEm = document.getElementById("cfgPlanoExpiraEm")?.value || "";
    const observacoes = document.getElementById("cfgPlanoObservacoes")?.value?.trim() || "";

    salvarPlanoClinica(clinica, { tipo, demoExpiraEm, observacoes });
    aplicarPlanoNaInterface();
    atualizarResumoPlanoNaTela();
    alert("Plano salvo com sucesso.");
  }

  function garantirBadgePlano() {
    let badge = document.getElementById("vetcoreBadgePlano");
    if (!badge) {
      const hostInline = document.getElementById("infoPlanoMenu");
      badge = document.createElement("div");
      badge.id = "vetcoreBadgePlano";
      badge.className = "badge-plano";

      if (hostInline) {
        hostInline.innerHTML = "";
        hostInline.appendChild(badge);
      } else {
        badge.style.cssText = [
          "display:none"
        ].join(";");
        document.body.appendChild(badge);
      }
    }

    const hostInline = document.getElementById("infoPlanoMenu");
    if (hostInline && badge.parentElement !== hostInline) {
      hostInline.innerHTML = "";
      hostInline.appendChild(badge);
    }

    return badge;
  }

  function esconderSeletorClinicaSeNaoPodeMultiunidade() {
    const telaClinica = document.getElementById("telaClinica");
    if (!telaClinica) return;

    if (!vetcorePermiteMultiunidade()) {
      const botoes = telaClinica.querySelectorAll("button");
      if (botoes.length > 1) {
        for (let i = 1; i < botoes.length; i++) {
          botoes[i].style.display = "none";
        }
      }
    } else {
      const botoes = telaClinica.querySelectorAll("button");
      botoes.forEach(btn => btn.style.display = "");
    }
  }

  function aplicarBloqueiosNosBotoesMenu() {
    const { plano, regras } = obterRegrasPlanoAtual();
    const btnRel = document.getElementById("btnMenuRelatorios");
    const btnCfg = document.getElementById("btnMenuConfiguracoes");
    const btnLib = document.getElementById("btnMenuLiberacao");
    const btnFecharData = document.getElementById("btnMenuFecharData");
    const btnFecharRec = document.getElementById("btnMenuFecharRecorrente");

    if (btnRel) btnRel.style.display = regras.permiteRelatorios ? "" : "none";
    if (btnCfg) btnCfg.style.display = regras.permiteConfiguracoes ? "" : "none";
    if (btnLib) btnLib.style.display = regras.permiteBloqueios ? "" : "none";
    if (btnFecharData) btnFecharData.style.display = regras.permiteBloqueios ? "" : "none";
    if (btnFecharRec) btnFecharRec.style.display = regras.permiteBloqueios ? "" : "none";

    if (typeof temPermissao === "function") {
      // mantém compatibilidade com permissões por usuário
    }

    const badge = garantirBadgePlano();
    const nome = (PLANOS[plano.tipo] || PLANOS.profissional).nome;
    badge.textContent = planoDemoExpirado(plano)
      ? `Plano: ${nome} expirado`
      : `Plano: ${nome}`;
    badge.style.background = "";
    badge.style.color = "";
  }

  function interceptarSalvarDemo() {
    const ids = [
      "btnSalvarGeral",
      "btnSalvarCastracao"
    ];

    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.vetcorePlanoHook === "1") return;
      btn.dataset.vetcorePlanoHook = "1";
      btn.addEventListener("click", function (ev) {
        if (!vetcorePodeSalvarDadosReais()) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        }
      }, true);
    });
  }

  function semearModoDemoSeNecessario() {
    return;
  }


  function obterProfissionaisSistemaSeguro() {
    try {
      return JSON.parse(localStorage.getItem("profissionaisAgenda")) || [];
    } catch (e) {
      return [];
    }
  }

  function contarProfissionaisDaClinicaAtual() {
    const clinica = obterClinicaAtualSeguro();
    const lista = obterProfissionaisSistemaSeguro();
    return lista.filter(item => (item && (item.clinica || item.clinicaVinculada || "")) === clinica).length;
  }

  function vetcorePodeCadastrarProfissional() {
    const { plano, regras, clinica } = obterRegrasPlanoAtual();
    if (planoDemoExpirado(plano)) {
      alert("A demonstração desta clínica expirou.");
      return false;
    }

    if (regras.maxProfissionais == null) return true;

    const total = contarProfissionaisDaClinicaAtual();
    if (total >= regras.maxProfissionais) {
      if (typeof abrirModalUpgradeVetCore === "function") {
        abrirModalUpgradeVetCore();
      } else {
        alert(`Você atingiu o limite da demonstração. Faça upgrade para continuar.`);
      }
      return false;
    }
    return true;
  }

  function interceptarCadastroProfissionalDemo() {
    const ids = [
      "btnSalvarProfissional",
      "btnCadastrarProfissional"
    ];

    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.vetcoreProfHook === "1") return;
      btn.dataset.vetcoreProfHook = "1";
      btn.addEventListener("click", function (ev) {
        const { plano, regras } = obterRegrasPlanoAtual();
        if (regras.maxProfissionais == null) return;

        // quando estiver editando um profissional existente, não bloqueia
        const nomeField = document.getElementById("profissionalNome");
        const nomeAtual = (nomeField?.value || "").trim();
        const clinica = obterClinicaAtualSeguro();
        const lista = obterProfissionaisSistemaSeguro();
        const existente = lista.find(item =>
          (item && (item.clinica || item.clinicaVinculada || "") === clinica) &&
          (item.nome || "").trim() === nomeAtual
        );
        if (existente) return;

        if (!vetcorePodeCadastrarProfissional()) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        }
      }, true);
    });
  }

  function aplicarPlanoNaInterface() {
    esconderSeletorClinicaSeNaoPodeMultiunidade();
    aplicarBloqueiosNosBotoesMenu();
    interceptarSalvarDemo();
    interceptarCadastroProfissionalDemo();
    atualizarResumoPlanoNaTela();

    const { plano } = obterRegrasPlanoAtual();
    if (plano.tipo === "demo") {
      semearModoDemoSeNecessario();
    }
  }

  function inicializarPlanoVetCore() {
    const clinica = obterClinicaAtualSeguro();
    if (clinica) {
      aplicarPlanoNaInterface();
    }

    window.addEventListener("storage", function (e) {
      if (e.key === STORAGE_KEY) {
        aplicarPlanoNaInterface();
      }
    });

    setTimeout(aplicarPlanoNaInterface, 200);
    setTimeout(aplicarPlanoNaInterface, 900);
  }

  // Hooks automáticos para o sistema atual
  const originalSelecionarClinica = window.selecionarClinica;
  if (typeof originalSelecionarClinica === "function") {
    window.selecionarClinica = function (nomeClinica) {
      const planos = obterPlanosSalvos();
      const planoDaClinica = obterPlanoClinica(nomeClinica);

      if (!planoDaClinica) {
        // segue normal
      }

      if (!vetcorePermiteMultiunidade()) {
        const jaTem = localStorage.getItem("clinicaSelecionada");
        if (jaTem && jaTem !== nomeClinica) {
          alert("Este plano não permite múltiplas unidades.");
          return;
        }
      }

      const r = originalSelecionarClinica.apply(this, arguments);
      setTimeout(aplicarPlanoNaInterface, 50);
      return r;
    };
  }

  const originalAtualizarMenu = window.atualizarMenu;
  if (typeof originalAtualizarMenu === "function") {
    window.atualizarMenu = function () {
      const r = originalAtualizarMenu.apply(this, arguments);
      setTimeout(aplicarPlanoNaInterface, 20);
      return r;
    };
  }

  window.carregarPlanoClinicaNaTela = carregarPlanoClinicaNaTela;
  window.salvarPlanoClinicaPelaTela = salvarPlanoClinicaPelaTela;
  window.aplicarPlanoNaInterface = aplicarPlanoNaInterface;
  window.inicializarPlanoVetCore = inicializarPlanoVetCore;
  window.vetcorePodeSalvarDadosReais = vetcorePodeSalvarDadosReais;
  window.vetcorePermiteMultiunidade = vetcorePermiteMultiunidade;
  window.vetcoreDescreverPlanoAtual = vetcoreDescreverPlanoAtual;
  window.vetcorePodeCadastrarProfissional = vetcorePodeCadastrarProfissional;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarPlanoVetCore);
  } else {
    inicializarPlanoVetCore();
  }
})();
