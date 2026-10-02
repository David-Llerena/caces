// Parser CSV mínimo: soporta comillas, comas/; dentro de comillas y saltos de línea.
export function parseCsv(texto: string): Record<string, string>[] {
  texto = texto.replace(/^﻿/, '');
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';

  const filas: string[][] = [];
  let fila: string[] = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += ch;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  const [cab, ...datos] = filas.filter((f) => f.some((c) => c.trim() !== ''));
  if (!cab) return [];
  const claves = cab.map((c) => c.trim().toLowerCase());
  return datos.map((f) => Object.fromEntries(claves.map((k, i) => [k, (f[i] ?? '').trim()])));
}
