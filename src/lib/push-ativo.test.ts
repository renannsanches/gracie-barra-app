import { describe, it, expect } from "vitest";
import { pushAtivo } from "./push-ativo";

describe("pushAtivo", () => {
  it("só em produção", () => {
    expect(pushAtivo("production")).toBe(true);
    expect(pushAtivo("preview")).toBe(false);
    expect(pushAtivo("development")).toBe(false);
    expect(pushAtivo(undefined)).toBe(false);
  });
});
