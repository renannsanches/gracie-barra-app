-- =============================================================================
-- Seed do STAGING (T2) — dados 100% fictícios para dev local, E2E e previews.
--
-- Só corre num projecto marcado como staging. A marca é um segredo do Vault
-- (o Supabase não deixa o papel postgres gravar GUCs próprios com ALTER
-- DATABASE/ROLE) e põe-se UMA vez, só no staging (gracie-barra-staging,
-- luakxrtecetdkccoctzm):
--     select vault.create_secret('staging', 'ambiente', 'Marca do projecto de staging (T2)');
-- Em qualquer outro projecto (incluindo a produção) o primeiro bloco aborta
-- antes de inserir o que quer que seja.
--
-- Idempotente: ids fixos (ou derivados por md5) + "on conflict do nothing".
-- Pode correr-se de novo a qualquer momento; não apaga nada.
-- Datas relativas a current_date: re-correr depois de meses acrescenta os
-- meses/semanas novos e mantém os antigos.
--
-- Não cria utilizadores no Auth: os perfis aqui são sem_login = true. Os
-- utilizadores com login são os do E2E (e2e/global-setup.ts).
-- Ids de grupo/modalidade = defaults da baseline (UUIDs de produção).
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets
                 where name = 'ambiente' and decrypted_secret = 'staging') then
    raise exception 'seed-staging.sql só corre no staging (segredo "ambiente" no Vault)';
  end if;
end $$;

-- Local e modalidade padrão ----------------------------------------------------
insert into public.grupos_alunos (id, nome, ativo, padrao)
values ('f1a2b776-86b0-46d0-8ea2-d5cb7b290aad', 'Academia', true, true)
on conflict do nothing;

insert into public.modalidades (id, nome, valor, valor_infantil, ativo, padrao, grupo_id)
values ('76043248-42d7-46d5-a647-cc7cdae6719b', 'Jiu-Jitsu', 62, 55, true, true,
        'f1a2b776-86b0-46d0-8ea2-d5cb7b290aad')
on conflict do nothing;

-- Pessoas (todas fictícias, sem login) -----------------------------------------
insert into public.profiles
  (id, nome_completo, perfil, categoria, faixa, graus, data_nascimento, data_inicio, status, sem_login)
values
  ('5eed0000-0000-4000-8000-000000000001', 'Prof. Rui Fictício',   'professor',   'adulto',   'preta',          2, '1985-02-14', '2015-01-05', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000010', 'Ana Exemplo',          'aluno',       'adulto',   'branca',         2, '1995-06-01', '2025-09-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000011', 'Bruno Teste',          'aluno',       'adulto',   'branca',         4, '1990-03-21', '2024-10-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000012', 'Carla Demo',           'aluno',       'adulto',   'azul',           1, '1992-11-30', '2022-02-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000013', 'Diogo Fictício',       'aluno',       'adulto',   'azul',           3, '1988-08-08', '2021-05-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000014', 'Eva Amostra',          'aluno',       'adulto',   'roxa',           0, '1987-01-17', '2019-09-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000015', 'Filipe Modelo',        'aluno',       'adulto',   'roxa',           2, '1984-04-04', '2018-01-15', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000016', 'Gil Simulado',         'aluno',       'adulto',   'marrom',         1, '1980-12-12', '2014-06-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000017', 'Helena Ensaio',        'aluno',       'adulto',   'branca',         0, '2000-07-07', '2026-06-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000020', 'Ivo Pequeno',          'aluno',       'infantil', 'cinza',          1, make_date(extract(year from current_date)::int - 9, 3, 10),  '2024-09-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000021', 'Joana Pequena',        'aluno',       'infantil', 'amarela_branca', 2, make_date(extract(year from current_date)::int - 11, 5, 2),  '2023-09-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000022', 'Kiko Mini',            'aluno',       'infantil', 'laranja',        0, make_date(extract(year from current_date)::int - 13, 9, 19), '2022-09-01', 'ativo', true),
  ('5eed0000-0000-4000-8000-000000000030', 'Luís Responsável',     'responsavel', 'adulto',   null,             0, '1979-10-10', null,         'ativo', true)
on conflict do nothing;

insert into public.dependentes (responsavel_id, dependente_id)
values ('5eed0000-0000-4000-8000-000000000030', '5eed0000-0000-4000-8000-000000000022')
on conflict do nothing;

-- Alunos que pagam (os 11 com perfil aluno) ------------------------------------
create temp table seed_alunos on commit drop as
select p.id, p.categoria,
       case when p.categoria = 'infantil' then 55 else 62 end as valor
from public.profiles p
where p.id::text like '5eed0000-%' and p.perfil = 'aluno';

insert into public.aluno_modalidades (aluno_id, modalidade_id, valor, cobrar)
select id, '76043248-42d7-46d5-a647-cc7cdae6719b', valor, true from seed_alunos
on conflict do nothing;

-- Turmas e aulas (próximas 8 semanas) --------------------------------------------
insert into public.turmas (id, nome, dia_semana, horario, recorrencia, lotacao_maxima, categoria, professor_id, ativa, modalidade_id)
values
  ('5eed0000-0000-4000-8000-000000000101', 'Adultos',  1, '19:00', 'semanal', 25, 'adulto',   '5eed0000-0000-4000-8000-000000000001', true, '76043248-42d7-46d5-a647-cc7cdae6719b'),
  ('5eed0000-0000-4000-8000-000000000102', 'Kids',     2, '18:00', 'semanal', 20, 'infantil', '5eed0000-0000-4000-8000-000000000001', true, '76043248-42d7-46d5-a647-cc7cdae6719b'),
  ('5eed0000-0000-4000-8000-000000000103', 'Open Mat', 6, '10:00', 'semanal', 30, 'adulto',   '5eed0000-0000-4000-8000-000000000001', true, '76043248-42d7-46d5-a647-cc7cdae6719b')
on conflict do nothing;

select public.gerar_aulas(t, 8) from unnest(array[
  '5eed0000-0000-4000-8000-000000000101',
  '5eed0000-0000-4000-8000-000000000102',
  '5eed0000-0000-4000-8000-000000000103']::uuid[]) as t;

-- Mensalidades: 3 meses (o actual e os 2 anteriores), vencimento dia 5 ----------
-- Pendentes: mês actual de Ana, Carla e Joana (atraso curto); Diogo com o mês
-- anterior e o actual por pagar (≥10 dias → bloqueado em QR, tablet e reservas).
insert into public.mensalidades (id, aluno_id, mes_referencia, data_vencimento, valor, status, data_pagamento, itens)
select md5('mensalidade' || a.id || m.mes)::uuid,
       a.id, m.mes, m.mes + 4, a.valor,
       case when pendente then 'pendente' else 'pago' end::status_mensalidade,
       case when pendente then null else m.mes + 3 end,
       jsonb_build_array(jsonb_build_object(
         'modalidade_id', '76043248-42d7-46d5-a647-cc7cdae6719b', 'nome', 'Jiu-Jitsu',
         'valor', a.valor, 'tipo', 'modalidade'))
from seed_alunos a
cross join lateral (
  select (date_trunc('month', current_date) - make_interval(months => k))::date as mes, k
  from generate_series(0, 2) k
) m
cross join lateral (
  select (m.k = 0 and a.id in ('5eed0000-0000-4000-8000-000000000010',
                               '5eed0000-0000-4000-8000-000000000012',
                               '5eed0000-0000-4000-8000-000000000021'))
      or (m.k <= 1 and a.id = '5eed0000-0000-4000-8000-000000000013') as pendente
) s
on conflict do nothing;

-- Presenças: semana actual e as 12 anteriores, 1 a 3 por semana (seg, qua, sáb),
-- 19:00 Lisboa, só até ontem.
-- Helena não treina há 4 semanas (aparece nos ausentes do dashboard).
insert into public.presencas (id, aluno_id, registrado_em)
select md5('presenca' || a.id || d)::uuid, a.id,
       (d + time '19:00') at time zone 'Europe/Lisbon'
from (select id, row_number() over (order by id) as n from seed_alunos) a
cross join lateral (
  select (date_trunc('week', current_date) - make_interval(weeks => w))::date + dia as d
  from generate_series(0, 12) w,
       unnest(array[0, 2, 5]) with ordinality as x(dia, ordem)
  where x.ordem <= 1 + (a.n % 3)
) dias
where d < current_date
  and not (a.id = '5eed0000-0000-4000-8000-000000000017' and d > current_date - 28)
on conflict do nothing;

-- Graduações (Carla: branca → azul, depois 1.º grau) ---------------------------
insert into public.historico_graduacoes (id, aluno_id, faixa_anterior, graus_anterior, faixa_nova, graus_nova, graduado_por, data_graduacao)
values
  (md5('grad-carla-azul')::uuid, '5eed0000-0000-4000-8000-000000000012', 'branca', 4, 'azul', 0,
   '5eed0000-0000-4000-8000-000000000001', current_date - 200),
  (md5('grad-carla-azul-1')::uuid, '5eed0000-0000-4000-8000-000000000012', 'azul', 0, 'azul', 1,
   '5eed0000-0000-4000-8000-000000000001', current_date - 60)
on conflict do nothing;

-- Aviso e álbum -----------------------------------------------------------------
insert into public.avisos (id, titulo, conteudo, autor_id, fixado, publicado)
values ('5eed0000-0000-4000-8000-000000000201', 'Ambiente de teste',
        'Isto é o staging: todos os alunos, presenças e mensalidades são fictícios.',
        '5eed0000-0000-4000-8000-000000000001', true, true)
on conflict do nothing;

insert into public.albuns (id, titulo, descricao, autor_id)
values ('5eed0000-0000-4000-8000-000000000301', 'Treino de exemplo', 'Álbum fictício, sem fotos.',
        '5eed0000-0000-4000-8000-000000000001')
on conflict do nothing;

commit;
