#!/usr/bin/env node
// TS5055 ("would overwrite input file") si dist-server/ ya existe de un build anterior: el build
// compuesto de tsc puede recalcular su rootDir y tratar un .d.ts viejo como fichero de entrada.
// No es un bug del código servidor, solo falta borrar el directorio antes de compilar de nuevo.
import { rmSync } from "node:fs";

rmSync("dist-server", { recursive: true, force: true });
