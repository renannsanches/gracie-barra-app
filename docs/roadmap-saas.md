# Roadmap técnico: tornar o app da academia vendável

Nov 12, 2026 · @Renan Augusto Sanches de Miranda

Hoje o app é de uma academia só e não cobra mensalidade sozinho. Para vender a outras, são 7 bloqueadores (Fase 1), 8 itens de paridade com a concorrência (Fase 2) e a base de operação (Fase 3), nessa ordem, depois de validar que alguém paga (Fase 0).

> **Como executar:** o plano mestre, com a divisão em PRs e as skills a usar em cada item, está em [`superpowers/plans/2026-11-12-roadmap-saas-mestre.md`](superpowers/plans/2026-11-12-roadmap-saas-mestre.md). O estado actual do produto está no [`CLAUDE.md`](../CLAUDE.md) (§14 e §15). Quem fechar um item actualiza a coluna **Estado** abaixo.

## Resumo das fases

| Fase | Objetivo | Pronto quando | Estado |
| --- | --- | --- | --- |
| 0. Gate | Saber se alguém paga e de quem é o app | 3 de 15 donos dispostos a pagar; titularidade acordada por escrito | ✅ Concluída (confirmado pelo dono em 2026-11-12) |
| 1. Bloqueadores | Poder cobrar de uma segunda academia com segurança | 3 academias-piloto operando sem você mexer no código | Por fazer |
| 2. Paridade | Fechar o que os concorrentes já têm | Pilotos não citam falta de recurso ao cancelar | Por fazer |
| 3. Operação | Dar suporte e escalar sem apagar incêndio | Erros monitorados, backup testado, ajuda publicada | Por fazer |

## Fase 0: o gate antes de programar

Não invista em código novo até passar nestes três pontos. São os que mais pesam e custam só conversa.

**Estado:** concluída — confirmado pelo dono em 2026-11-12.

- [x] **Titularidade:** definir por escrito se o app (código e dados atuais) é seu, da GB Famalicão ou dos dois, e se pode ser licenciado a terceiros.
- [x] **Demanda:** 15 conversas com donos de academia (5 da Gracie Barra, 5 independentes em Portugal, 5 no Brasil). Peça pré-venda ou piloto pago.
- [x] **Critério de parada:** menos de 3 dos 15 dispostos a pagar significa manter como ferramenta interna e não seguir para a Fase 1.

## Pré-requisitos técnicos (antes do 1.1)

Não estavam na lista original; saíram da análise do código (ver plano mestre, secção B).

| # | Mudança | Por que | Estado |
| --- | --- | --- | --- |
| T1 | Reconciliar `supabase/migrations/` com a BD de produção (migration baseline) | As migrations não reproduziam a BD; sem isso não há ambiente de teste fiel | ✅ Feito (2026-11-12): baseline, `verificar-schema.sql`, staging 11/11 igual a produção ([spec](superpowers/specs/2026-11-12-t1-baseline-migrations-design.md)) |
| T2 | Ambiente de teste separado da produção (Supabase branch ou projecto de staging + env do Preview na Vercel) | O 1.1 reescreve a RLS de todas as tabelas; fazer isso direto em produção é o maior risco do roadmap. Antecipa o 1.º item da Fase 3 | ✅ Feito (2026-11-13): projecto de staging com seed; dev, E2E e previews no staging |

## Fase 1: bloqueadores (sem isso ninguém paga por ele)

Esforço é tamanho relativo: P pequeno, M médio, G grande.

| # | Mudança | O que fazer | Pronto quando | Esforço | Estado |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Multi-academia | Colocar o identificador da academia em todas as tabelas; isolar os dados no banco por academia; papéis (aluno, responsável, professor, admin) por academia; fluxo para criar uma academia nova | Duas academias de teste no mesmo ambiente sem ver dados uma da outra, com teste automatizado de isolamento | G | Por fazer |
| 1.2 | Cobrança automática | Stripe Connect na conta do próprio dono (cartão, débito direto SEPA, Apple e Google Pay); Pix e boleto via Asaas no Brasil; webhooks, nova tentativa em falha, baixa automática da mensalidade, reembolso. Manter o pagamento manual como alternativa (dinheiro, transferência) | Mensalidade paga sozinha em teste ponta a ponta; falha de cartão gera nova tentativa e aviso; o dinheiro cai direto na conta da academia | G | Por fazer |
| 1.3 | Configuração no lugar de valores fixos | Mover para configuração por academia: nome, logo, cores, WhatsApp de contato, moeda, fuso, idioma, preços de reserva, dia de vencimento (hoje 5), bloqueio por atraso (10 dias), avisos (2 e 5 dias), intervalos de presença (30 min e 1 h), sequência mínima (2 aulas), margem de aula (2 h), faixas e tempo exigido por faixa e grau | Busca no código não encontra o nome da academia nem o WhatsApp do Carlos escritos fixos | M | Por fazer |
| 1.4 | Entrada e migração | Assistente de configuração (academia, modalidades, turmas, preços); importar alunos, faixas e presenças por CSV; exportar tudo | Academia nova opera em até 1 hora sem ajuda sua | M | Por fazer |
| 1.5 | Cobrança do seu SaaS | Planos por número de alunos ativos, teste de 30 dias, assinatura, suspensão por falta de pagamento; painel seu com academias, receita recorrente e uso | Você vê no painel quem paga, quem está em teste e quem atrasou | M | Por fazer |
| 1.6 | Privacidade e menores | Política de privacidade e termos; contrato de tratamento de dados por academia; consentimento dos pais registrado para menores (cadastro, foto, feed); foto de menor no feed só com autorização; exportar e excluir dados do aluno; hospedagem na UE e lista de subprocessadores; barreira de idade para menores de 13 anos nos EUA | Consentimento no cadastro e exclusão de dados funcionando; textos revistos por advogado | G | Por fazer |
| 1.7 | Fiscal e marca | Portugal: o app não emite fatura nem recibo, então exportar para um software certificado pela AT; se um dia emitir, precisa de certificação. Brasil: decidir se nota fiscal fica fora da v1. Não usar "Gracie Barra" no nome nem no marketing sem autorização | Decisão fiscal registrada por país; nome comercial sem marca de terceiros | P | Por fazer |

## Fase 2: paridade com a concorrência

Faça por pedido dos pilotos, não tudo de uma vez.

| # | Mudança | Por que | Esforço | Estado |
| --- | --- | --- | --- | --- |
| 2.1 | Idiomas inglês, espanhol e português do Brasil; moeda e data por região; textos fora do código | EUA e Europa exigem; hoje só existe português de Portugal | M | Por fazer |
| 2.2 | Videoteca e currículo por faixa (Bunny Stream, já previsto) | Kanri, MatGoat e BJJLink já têm | M | Por fazer |
| 2.3 | Lembrete de cobrança por e-mail e WhatsApp | Hoje só há push, que depende de o aluno ter instalado o app | M | Por fazer |
| 2.4 | Funil de aula experimental: pedido, contato, matrícula, com acompanhamento | Hoje o pedido só fica registrado e abre o WhatsApp | M | Por fazer |
| 2.5 | Alerta automático de risco de evasão | Hoje só existe a lista de alunos ausentes no painel | P | Por fazer |
| 2.6 | Termo de responsabilidade e contrato com assinatura digital | Kanri e Martialytics já oferecem | M | Por fazer |
| 2.7 | Relatórios de negócio: receita recorrente, cancelamentos, inadimplência | Dono compara sistemas por esses números | M | Por fazer |
| 2.8 | Totem configurável em qualquer tablet ou TV | Hoje é pensado para o iPad antigo da academia | P | Por fazer |

App nas lojas (Apple e Google) fica para depois dos pilotos: só construir se os clientes pedirem.

## Fase 3: operação para vender e dar suporte

- [ ] Ambiente de teste separado da produção e testes automáticos nos fluxos críticos: presença por QR, cobrança e isolamento entre academias. (O ambiente em si foi antecipado para o T2.)
- [ ] Monitoramento de erros com alerta, backup restaurado em teste ao menos uma vez.
- [ ] E-mail transacional com SPF e DKIM configurados, para cobrança e recuperação de senha não caírem no spam.
- [ ] Limite de armazenamento de fotos por academia e custo por academia medido.
- [ ] Ambiente de demonstração com dados fictícios, para mostrar sem expor alunos reais.
- [ ] Central de ajuda, canal de suporte e termos do serviço com regras de disponibilidade.
- [ ] Páginas de venda e preços por mercado (Portugal, Brasil, inglês).

## Fora do escopo da v1

Os concorrentes têm, mas não são necessários para o primeiro cliente pagante e custam caro de construir:

- Catraca e leitor facial.
- Presença por foto da turma com reconhecimento por IA (exige consentimento biométrico).
- Loja virtual e estoque.
- Comissão de instrutores.
- Integração com plataformas de campeonato.
- Visão enterprise de várias filiais.

## Ordem de execução

1. **Fase 0.** Sem demanda e sem titularidade resolvida, o resto é risco sem retorno. *(Concluída em 2026-11-12.)*
2. **T1 e T2.** Migrations fiéis à produção e ambiente de teste, antes de mexer no isolamento de dados.
3. **1.1 Multi-academia, depois 1.3 Configuração.** Quase tudo depende deles; mexer neles depois obriga a refazer o que foi feito.
4. **1.2 Cobrança automática.** É o recurso que mais pesa na compra; só faz sentido com cada academia isolada.
5. **1.6 Privacidade e menores.** Precisa existir antes de qualquer dado de academia de terceiros entrar no sistema.
6. **1.4 Entrada e migração, depois 1.5 Cobrança do SaaS.** Primeiro o piloto consegue entrar; depois você consegue cobrar.
7. **1.7 Fiscal e marca.** Decisões rápidas, resolver antes do lançamento. O nome comercial convém decidir cedo: define domínio e textos do 1.3.
8. **Piloto com 3 academias**, de preferência uma da Gracie Barra, uma independente em Portugal e uma no Brasil.
9. **Fase 2 e Fase 3** na ordem do que os pilotos pedirem.

## Base desta lista

Os gaps vêm da comparação entre o guia de funcionalidades do app (estado de 12/11/2026) e os concorrentes. Esforço P, M e G é tamanho relativo, não prazo. Os itens legais (privacidade, menores, fatura em Portugal) vêm de resultados de busca e precisam de revisão de advogado e contador antes de valer.

Fontes abertas:

- [Kanri (Brasil): recursos e planos](https://www.kanri-app.com.br/new_landing)
- [Gymdesk para academias Gracie Barra](https://gymdesk.com/gracie-barra)
- [Comparativo de software para BJJ (MatGoat, site de concorrente)](https://matgoat-landing.pages.dev/en/blog/best-bjj-academy-management-software/)
- [Custo de software de academia (Gymdesk, site de concorrente)](https://gymdesk.com/blog/gym-management-software-cost)
