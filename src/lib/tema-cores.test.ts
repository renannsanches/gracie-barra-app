import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda do modo escuro: nos ficheiros que o aluno vê não pode haver cinzentos
 * nem brancos fixos, nem texto `ink` (o ink não muda: é o fundo dos headers) —
 * só tokens (bg-surface, text-fg, border-line…), que mudam com o tema. Uma linha que tem mesmo de ficar fixa (ex.: fundo do QR Code)
 * leva o comentário "tema: fixo" na própria linha ou na anterior.
 */
export const ALVOS_TEMA = [
  "src/app/(app)",
  "src/components/PageHeader.tsx",
  "src/components/BottomNav.tsx",
  "src/components/skeletons.tsx",
  "src/components/ConfirmDialog.tsx",
  "src/components/MensalidadeVencidaBanner.tsx",
  "src/components/MensalidadeAtrasoModal.tsx",
  "src/components/NovaConquistaModal.tsx",
  "src/components/GraduacaoAptosModal.tsx",
  "src/components/AptosGraduarCard.tsx",
  "src/components/Medalha.tsx",
  "src/components/FaixaBJJ.tsx",
  "src/components/ValorMensalidade.tsx",
  "src/components/PhoneInput.tsx",
  "src/components/PresencasCalendario.tsx",
  "src/components/InstallPrompt.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/switch.tsx",
];

const PROIBIDAS =
  /(?<![\w-])(?:[a-z-]+:)*(bg-white(?!\/)|bg-gb-gray|bg-gray-(?:50|100|200)(?!\d)|text-gray-\d+|border-gray-\d+|divide-gray-\d+|text-ink|text-gb-black)(?![\w-])/g;

function ficheiros(alvo: string): string[] {
  if (!statSync(alvo).isDirectory()) return [alvo];
  return readdirSync(alvo).flatMap((n) => ficheiros(join(alvo, n)));
}

describe("cores fixas nas páginas do aluno", () => {
  it("só usam tokens do tema", () => {
    const raiz = process.cwd();
    const erros: string[] = [];
    for (const f of ALVOS_TEMA.flatMap((a) => ficheiros(join(raiz, a)))) {
      if (!f.endsWith(".tsx")) continue;
      const linhas = readFileSync(f, "utf8").split("\n");
      linhas.forEach((linha, i) => {
        if (linha.includes("tema: fixo") || linhas[i - 1]?.includes("tema: fixo")) return;
        for (const m of linha.matchAll(PROIBIDAS)) {
          erros.push(`${relative(raiz, f)}:${i + 1} ${m[0]}`);
        }
      });
    }
    expect(erros).toEqual([]);
  });
});
