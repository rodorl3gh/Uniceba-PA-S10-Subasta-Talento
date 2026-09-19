/**
 * Simulacion headless del motor. Juega muchas partidas con jugadores
 * automaticos y verifica las invariantes del reglamento.
 */
const { Sala } = require('../server/juego');
const { ECONOMIA, REGLAS_ROL } = require('../data/catalogo');

const ioFalso = { to: () => ({ emit: () => {} }) };

function nuevaSala(n) {
  const sala = new Sala(ioFalso, 'T' + Math.random().toString(36).slice(2, 6).toUpperCase(), 'HOST');
  for (let i = 0; i < n; i++) sala.agregarJugador('sock' + i, 'Jugador' + (i + 1));
  return sala;
}

function pujaAleatoria(dinero) {
  if (Math.random() < 0.25) return 0;
  const max = Math.min(dinero, ECONOMIA.pujasRapidas[ECONOMIA.pujasRapidas.length - 1]);
  if (max < 1) return 0;
  return 1 + Math.floor(Math.random() * max);
}

function jugarPartida(n) {
  const sala = nuevaSala(n);
  sala.iniciar();
  let guard = 0;

  while (sala.fase !== 'fin' && guard++ < 20000) {
    if (sala.fase === 'puja' || sala.fase === 'desempate') {
      const elegibles = sala.jugadoresQuePujan()
        .filter((j) => !Object.prototype.hasOwnProperty.call(sala.pujas, j.id));
      if (elegibles.length === 0) { sala.resolver(); continue; }
      for (const j of elegibles) {
        const m = pujaAleatoria(j.dinero);
        if (m <= 0) sala.registrarPase(j); else sala.registrarPuja(j, m);
      }
    } else if (sala.fase === 'adjudicado') {
      sala.limpiarTemporizador();
      sala.sacarCarta();
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
      const c = j.cartas.filter((x) => x.rol === rol).length;
      if (c > REGLAS_ROL[rol].max) errores.push(`${j.nombre} excede max de ${rol} (${c})`);
    }
    if (j.cartas.length > ECONOMIA.tamanoPlantilla) errores.push(`${j.nombre} con mas de 5 cartas`);
    const cid = new Set(j.cartas.map((c) => c.id));
    if (cid.size !== j.cartas.length) errores.push(`${j.nombre} tiene cartas duplicadas`);
  }
  return { sala, errores, guard };
}

let partidas = 0, fallos = 0, sinCompletar = 0, guardMax = 0;
const puntajes = [];

for (let n = 2; n <= 15; n++) {
  for (let r = 0; r < 30; r++) {
    const { sala, errores, guard } = jugarPartida(n);
    partidas++;
    guardMax = Math.max(guardMax, guard);
    if (errores.length) { fallos++; if (fallos <= 5) console.log('ERROR:', errores); }
    const incompletos = sala.jugadores.filter((j) => j.cartas.length < ECONOMIA.tamanoPlantilla).length;
    if (incompletos > 0) { sinCompletar++; if (sinCompletar <= 3) console.log(`Aviso: ${incompletos}/${n} incompletos en partida de ${n}`); }
    if (sala.resultadosFinales) puntajes.push(...sala.resultadosFinales.map((x) => x.total));
  }
}

console.log(`\nPartidas: ${partidas}`);
console.log(`Partidas con errores de reglas: ${fallos}`);
console.log(`Partidas con jugadores incompletos: ${sinCompletar}`);
console.log(`Iteraciones maximas en una partida: ${guardMax}`);
if (puntajes.length) console.log(`Puntaje min/prom/max: ${Math.min(...puntajes)} / ${(puntajes.reduce((a, b) => a + b, 0) / puntajes.length).toFixed(1)} / ${Math.max(...puntajes)}`);
console.log(fallos === 0 && sinCompletar === 0 ? '\nOK: todas las partidas completas y sin errores.' : '\nREVISAR.');
