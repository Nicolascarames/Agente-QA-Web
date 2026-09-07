import { describe, expect, it } from "vitest";
import { buscarFicha } from "./catalogo";
import { ejesConOpcion } from "./ejesConOpcion";

// `record` es la ficha que motiva este módulo: conductor humano/coste cero por defecto, pero
// `--auto` los cambia a claude-code/suscripción sin tocar agente ni estado (spec Bloque 4,
// "la pieza que resuelve la confusión histórica de record / record --auto").
const record = buscarFicha(["record"]);
if (!record) throw new Error('Fixture del test rota: no existe la ficha "record".');

describe("ejesConOpcion", () => {
  it("sin opción enfocada, devuelve los ejes de la ficha tal cual", () => {
    expect(ejesConOpcion(record, null)).toEqual(record.ejes);
  });

  it("una opción sin ejes propios (--raw) devuelve también los ejes de la ficha", () => {
    expect(ejesConOpcion(record, record.opciones["--raw"])).toEqual(record.ejes);
  });

  it("--auto cambia conductor y coste, y conserva agente y estado (merge parcial)", () => {
    const efectivos = ejesConOpcion(record, record.opciones["--auto"]);
    expect(efectivos).toEqual({
      conductor: "claude-code",
      coste: "suscripcion",
      agente: record.ejes.agente,
      estado: record.ejes.estado,
    });
  });
});
