import { calcularPatron } from "./texturas-calculo.js?v=13";

self.onmessage = ({ data }) => {
  const r = calcularPatron(data.patron, data.cuero);
  const buffers = [r.normal.buffer, r.sombra.buffer, r.rugosidad.buffer];
  if (r.hilo) buffers.push(r.hilo.buffer);
  self.postMessage(r, buffers);
};
