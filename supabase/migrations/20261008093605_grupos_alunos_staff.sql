-- Professores e admins também treinam (e alguns pagam mensalidade):
-- entram no grupo padrão para que os filtros por grupo os incluam.
UPDATE profiles
   SET grupo_id = (SELECT id FROM grupos_alunos WHERE padrao)
 WHERE perfil IN ('professor', 'admin')
   AND grupo_id IS NULL;
