/**
 * Modo escuro das páginas do aluno.
 *
 * A classe `dark` vai para o <html> só nas rotas do grupo (app). Admin e tablet
 * ficam sempre claros (o tablet é Safari 15). A preferência é por dispositivo,
 * em localStorage; sem preferência segue o sistema.
 */

export type Tema = "claro" | "escuro";

export const CHAVE_TEMA = "tema";

/** Disparado em window quando a preferência muda (ver TemaScope). */
export const EVENTO_TEMA = "tema-mudou";

export const ROTAS_COM_TEMA: readonly string[] = [
  "/perfil",
  "/conta",
  "/presenca",
  "/presencas",
  "/aulas",
  "/turmas",
  "/avisos",
  "/galeria",
  "/ranking",
  "/conquistas",
];

export const THEME_COLOR: Record<Tema, string> = {
  claro: "#ED1C24",
  escuro: "#0A0A0A",
};

export function rotaTemTema(pathname: string): boolean {
  return ROTAS_COM_TEMA.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function resolverTema(preferencia: Tema | null, sistemaEscuro: boolean): Tema {
  return preferencia ?? (sistemaEscuro ? "escuro" : "claro");
}

export function lerPreferencia(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return v === "claro" || v === "escuro" ? v : null;
  } catch {
    return null;
  }
}

export function gravarPreferencia(tema: Tema): void {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // modo privado: fica só nesta visita
  }
  aplicarTema(tema);
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: tema }));
}

export function sistemaEscuro(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function aplicarTema(tema: Tema): void {
  const html = document.documentElement;
  if (tema === "escuro") html.classList.add("dark");
  else html.classList.remove("dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[tema]);
}

/**
 * Script para o <head>: decide o tema antes da primeira pintura (sem flash).
 * Não importa nada — as constantes vão serializadas na string.
 */
export function scriptTema(): string {
  return `(function(){try{
var rotas=${JSON.stringify(ROTAS_COM_TEMA)};
var p=location.pathname;
if(!rotas.some(function(r){return p===r||p.indexOf(r+"/")===0;}))return;
var t=null;
try{var v=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});if(v==="claro"||v==="escuro")t=v;}catch(e){}
if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";
if(t!=="escuro")return;
document.documentElement.classList.add("dark");
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.content=${JSON.stringify(THEME_COLOR.escuro)};
}catch(e){}})();`;
}
