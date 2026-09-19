/**
 * Simulacion headless del motor de subasta en tiempo real.
 * Jugadores y bots pujan de forma ascendente; valida invariantes del reglamento.
 */
const { Sala, puedeAceptar } = require('../server/juego');
const { ECONOMIA, REGLAS_ROL } = require('../data/catalogo');

const ioFalso = { to: () => ({ emit: () => {} }) };

function nuevaSala(n, bots) {
  const sala = new Sala(ioFalso, 'T' + Math.random().toString(36).slice(2, 6).toUpperCase(), 'HOST');
  for (let i = 0; i < n; i++) sala.agregarJugador('sock' + i, 'Jugador' + (i + 1));
  for (let i = 0; i < (bots || 0); i++) sala.agregarBot();
  return sala;
}

// Valoracion de un jugador humano simulado (parecida a la de los bots).
function valoracion(j, carta) {
  const faltan = ECONOMIA.tamanoPlantilla - j.cartas.length;
  const porCarta = Math.floor(j.dinero / Math.max(1, faltan));
  const v = (carta.media / 100) * 11 + (j.cartas.filter((c) => c.rol === carta.rol).length === 0 ? 2 : 0);
  return Math.max(1, Math.min(j.dinero, Math.round(v), porCarta + 2));
}

function jugarPartida(n, bots) {
  const sala = nuevaSala(n, bots);
  sala.iniciar();
  let guard = 0;

  while (sala.fase !== 'fin' && guard++ < 50000) {
    if (sala.fase === 'puja') {
      // Ronda de pujas ascendentes
      let k = 0;
      while (sala.fase === 'puja' && k++ < 300) {
        const elegibles = sala.jugadores.filter((j) =>
          j.dinero >= 1 && puedeAceptar(j, sala.cartaActual) &&
          !(sala.pujaActual && sala.pujaActual.jugadorId === j.id));
        if (elegibles.length === 0) break;
        const j = elegibles[Math.floor(Math.random() * elegibles.length)];
        const base = sala.pujaActual ? sala.pujaActual.monto : 0;
        const monto = base + 1;
        if (monto > j.dinero || monto > valoracion(j, sala.cartaActual)) { sala.resolver(); break; }
        sala.registrarPuja(j, monto);
        if (Math.random() < 0.35) { sala.resolver(); break; }
      }
      if (sala.fase === 'puja') sala.resolver();
    } else if (sala.fase === 'adjudicado') {
      sala.siguiente();
    } else {
      break;
    }
  }

  const errores = [];
  const ids = new Set();
  for (const j of sala.jugadores) {
    if (ids.has(j.id)) errores.push(`ID duplicado ${j.id}`);
    ids.add(j.id);
    if (j.dinero < 0) errores.push(`${j.nombre} con dinero negativo (${j.dinero})`);
    for (const rol of Object.keys(REGLAS_ROL)) {
      if (j.cartas.filter((x) => x.rol === rol).length > REGLAS_ROL[rol].max) errores.push(`${j.nombre} excede max de ${rol}`);
    }
    if (j.cartas.length > ECONOMIA.tamanoPlantilla) errores.push(`${j.nombre} con mas de 5 cartas`);
    if (new Set(j.cartas.map((c) => c.id)).size !== j.cartas.length) errores.push(`${j.nombre} tiene cartas duplicadas`);
  }
  const incompletos = sala.jugadores.filter((j) => j.cartas.length < ECONOMIA.tamanoPlantilla).length;
  return { sala, errores, incompletos, guard };
}

let partidas = 0, fallos = 0, conIncompletos = 0, totalIncompletos = 0;
const puntajes = [];

for (let n = 2; n <= 10; n++) {
  for (let r = 0; r < 20; r++) {
    const bots = r % 2 === 0 ? Math.min(3, n) : 0;
    const { sala, errores, incompletos } = jugarPartida(n, bots);
    partidas++;
    if (errores.length) { fallos++; if (fallos <= 5) console.log('ERROR:', errores); }
    if (incompletos > 0) { conIncompletos++; totalIncompletos += incompletos; }
    if (sala.resultadosFinales) puntajes.push(...sala.resultadosFinales.map((x) => x.total));
  }
}

console.log(`\nPartidas: ${partidas}`);
console.log(`Partidas con errores de reglas: ${fallos}`);
console.log(`Partidas con algun jugador incompleto: ${conIncompletos} (${totalIncompletos} jugadores en total)`);
if (puntajes.length) console.log(`Puntaje min/prom/max: ${Math.min(...puntajes)} / ${(puntajes.reduce((a, b) => a + b, 0) / puntajes.length).toFixed(1)} / ${Math.max(...puntajes)}`);
console.log(fallos === 0 ? '\nOK: invariantes respetadas.' : '\nREVISAR: hay errores.');
