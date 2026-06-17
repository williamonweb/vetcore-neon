VETCORE - PATCH DE PLANOS

Este pacote foi preparado para a estrutura atual do VetCore que já possui:
- tela de configurações
- permissões por usuário
- menu com botões por recurso
- armazenamento em localStorage

O patch adiciona:
1. modo demonstração
2. plano Essencial
3. plano Profissional
4. plano Premium
5. bloqueio automático de recursos por plano
6. suporte a expiração de demo
7. limitação de multiunidade no plano Essencial
8. bloqueio de gravação real no modo Demo

ARQUIVOS:
- script-planos-vetcore.js
- snippet-config-planos.html
- COMO-INTEGRAR.txt

INTEGRAÇÃO RÁPIDA:
1. Copie script-planos-vetcore.js para a pasta do seu sistema.
2. No index.html, adicione antes de </body>:
   <script src="./script-planos-vetcore.js"></script>

3. Na tela de Configurações, cole o conteúdo de snippet-config-planos.html
   dentro da área administrativa.

4. No script principal, depois de atualizarMenu() no login/seleção de clínica,
   chame:
   aplicarPlanoNaInterface();

5. Opcional:
   chame inicializarPlanoVetCore(); no carregamento inicial.

OBSERVAÇÃO:
Este patch foi feito para se encaixar no VetCore atual sem destruir a lógica
que você já tem. Ele atua por cima do sistema existente.
