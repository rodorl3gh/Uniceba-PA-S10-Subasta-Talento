/**
 * Motor del juego "Subasta de Talento UNICEBA".
 * Subasta en tiempo real: el reloj de 20s se reinicia con cada puja y la
 * adjudicacion ocurre cuando el reloj llega a cero (o el anfitrion termina).
 */
const { ECONOMIA, REGLAS_ROL, PUNTAJE, NOMBRES_BOT, construirCatalogo } = require('../data/catalogo');

const CATALOGO = construirCatalogo();
let contadorJugador = 0;

function mezclar(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function contarRol(cartas, rol) {
  return cartas.filter((c) => c.rol === rol).length;
}

function puedeAceptar(jugador, carta) {
  if (jugador.cartas.length >= ECONOMIA.tamanoPlantilla) return false;
  const regla = REGLAS_ROL[carta.rol];
  if (contarRol(jugador.cartas, carta.rol) >= regla.max) return false;
  return true;
}

function composicionValida(cartas) {
  return contarRol(cartas, 'ceo') >= 1
    && contarRol(cartas, 'admin') >= 1
    && contarRol(cartas, 'colaborador') >= 2
    && cartas.length === ECONOMIA.tamanoPlantilla;
}

function calcularPuntaje(jugador) {
  const cartas = jugador.cartas;
  if (!cartas.length) return { base: 0, bonus: 0, penal: 0, total: 0 };
  const base = Math.round(cartas.reduce((s, c) => s + c.media, 0) / cartas.length);
  let bonus = 0;
  const penal = cartas.filter((c) => c.tipoRasgo === 'negativo').length * PUNTAJE.penalPorConflicto;
  if (composicionValida(cartas)) bonus += PUNTAJE.bonusComposicion;
  const ceo = cartas.find((c) => c.rol === 'ceo');
  if (ceo && ceo.media >= 85) bonus += PUNTAJE.bonusCeoEstrella;
  if (penal === 0) bonus += PUNTAJE.bonusSinConflictos;
  return { base, bonus, penal, total: base + bonus - penal };
}

function codigoSala() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

class Sala {
  constructor(io, code, hostSocketId) {
    this.io = io;
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.jugadores = [];
    this.fase = 'lobby'; // lobby | puja | adjudicado | fin
    this.mazo = mezclar(CATALOGO);
    this.cartaActual = null;
    this.pujaActual = null;      // { jugadorId, monto }
    this.pujadores = {};         // jugadorId -> ultima puja
    this.temporizador = null;
    this.pujaFin = 0;
    this.ronda = 0;
    this.quiebraCola = [];
    this.ultimoGanador = null;
    this.desiertasSeguidas = 0;
    this.vuelta = 0;
    this.log = [];
  }

  // --- serializacion ---------------------------------------------------
  jugadorPublico(j) {
    return {
      id: j.id,
      nombre: j.nombre,
      esBot: !!j.esBot,
      dinero: j.dinero,
      cartas: j.cartas.length,
      rolConteo: {
        ceo: contarRol(j.cartas, 'ceo'),
        admin: contarRol(j.cartas, 'admin'),
        colaborador: contarRol(j.cartas, 'colaborador')
      },
      conectado: j.conectado,
      pujo: Object.prototype.hasOwnProperty.call(this.pujadores, j.id),
      vaGanando: !!this.pujaActual && this.pujaActual.jugadorId === j.id
    };
  }

  estadoPublico() {
    return {
      code: this.code,
      fase: this.fase,
      ronda: this.ronda,
      presupuestoInicial: ECONOMIA.presupuestoInicial,
      tamanoPlantilla: ECONOMIA.tamanoPlantilla,
      minJugadores: ECONOMIA.minJugadores,
      maxJugadores: ECONOMIA.maxJugadores,
      maxBots: ECONOMIA.maxBots,
      incrementosRapidos: ECONOMIA.incrementosRapidos,
      segundosPuja: ECONOMIA.segundosPuja,
      pujaFin: this.pujaFin,
      pujaActual: this.pujaActual
        ? { jugadorId: this.pujaActual.jugadorId, nombre: (this.jugadores.find((j) => j.id === this.pujaActual.jugadorId) || {}).nombre, monto: this.pujaActual.monto }
        : null,
      cartaActual: this.cartaActual
        ? {
            id: this.cartaActual.id,
            nombre: this.cartaActual.nombre,
            rol: this.cartaActual.rol,
            area: this.cartaActual.area,
            icon: this.cartaActual.icon,
            atributos: this.cartaActual.atributos // valores, el color lo decide el cliente
          }
        : null,
      jugadores: this.jugadores.map((j) => this.jugadorPublico(j)),
      ultimoGanador: this.ultimoGanador
    };
  }

  jugadorPrivado(j) {
    const carta = this.cartaActual;
    const minimo = this.pujaActual ? this.pujaActual.monto + 1 : 1;
    return {
      id: j.id,
      nombre: j.nombre,
      dinero: j.dinero,
      cartas: j.cartas,
      puedePujar: !!(carta && j.dinero >= minimo && puedeAceptar(j, carta) && !(this.pujaActual && this.pujaActual.jugadorId === j.id)),
      pujaMinima: Math.min(minimo, j.dinero),
      vaGanando: !!this.pujaActual && this.pujaActual.jugadorId === j.id,
      fase: this.fase
    };
  }

  emitirEstado() {
    this.io.to(this.code).emit('sala:estado', this.estadoPublico());
    for (const j of this.jugadores) {
      if (j.socketId) this.io.to(j.socketId).emit('jugador:estado', this.jugadorPrivado(j));
    }
  }

  toHost(evento, data) {
    if (this.hostSocketId) this.io.to(this.hostSocketId).emit(evento, data);
  }

  // --- jugadores -------------------------------------------------------
  agregarJugador(socketId, nombre, idExistente) {
    if (this.fase !== 'lobby') {
      const previo = idExistente && this.jugadores.find((j) => j.id === idExistente);
      if (!previo) return { error: 'La partida ya comenzo.' };
      previo.socketId = socketId;
      previo.conectado = true;
      return { jugador: previo };
    }
    let jugador = idExistente && this.jugadores.find((j) => j.id === idExistente);
    if (jugador) {
      jugador.socketId = socketId;
      jugador.conectado = true;
      return { jugador };
    }
    if (this.jugadores.length >= ECONOMIA.maxJugadores) return { error: 'La sala esta llena (max 15).' };
    const nombreLimpio = String(nombre || '').trim().slice(0, 18) || 'Jugador';
    jugador = {
      id: 'J' + (++contadorJugador) + '-' + Math.random().toString(36).slice(2, 8),
      socketId, nombre: nombreLimpio, esBot: false,
      dinero: ECONOMIA.presupuestoInicial,
      cartas: [], conectado: true
    };
    this.jugadores.push(jugador);
    return { jugador };
  }

  agregarBot() {
    if (this.fase !== 'lobby') return { error: 'Solo se pueden agregar bots antes de iniciar.' };
    const bots = this.jugadores.filter((j) => j.esBot).length;
    if (bots >= ECONOMIA.maxBots) return { error: `Maximo ${ECONOMIA.maxBots} bots.` };
    if (this.jugadores.length >= ECONOMIA.maxJugadores) return { error: 'La sala esta llena.' };
    const usados = new Set(this.jugadores.map((j) => j.nombre));
    const nombre = NOMBRES_BOT.find((n) => !usados.has(n)) || ('Bot ' + (bots + 1));
    const bot = {
      id: 'B' + (++contadorJugador) + '-' + Math.random().toString(36).slice(2, 8),
      socketId: null, nombre, esBot: true,
      dinero: ECONOMIA.presupuestoInicial,
      cartas: [], conectado: true, botTimer: null
    };
    this.jugadores.push(bot);
    return { bot };
  }

  quitarBot() {
    if (this.fase !== 'lobby') return { error: 'Solo antes de iniciar.' };
    for (let i = this.jugadores.length - 1; i >= 0; i--) {
      if (this.jugadores[i].esBot) { this.jugadores.splice(i, 1); return { ok: true }; }
    }
    return { error: 'No hay bots.' };
  }

  desconectar(socketId) {
    const j = this.jugadores.find((x) => x.socketId === socketId);
    if (j) { j.conectado = false; j.socketId = null; }
  }

  // --- flujo de la subasta --------------------------------------------
  iniciar() {
    if (this.jugadores.length < ECONOMIA.minJugadores) return { error: 'Se necesitan al menos 2 jugadores o bots.' };
    this.log = [];
    this.quiebraCola = [];
    this.ronda = 0;
    this.desiertasSeguidas = 0;
    this.sacarCarta();
    return { ok: true };
  }

  jugadoresActivos() {
    return this.jugadores.filter((j) => j.cartas.length < ECONOMIA.tamanoPlantilla);
  }

  sacarCarta() {
    this.limpiarTemporizadores();
    this.pujadores = {};
    this.ultimoGanador = null;
    this.pujaActual = null;

    if (this.jugadoresActivos().length === 0) return this.terminar();
    if (this.desiertasSeguidas >= ECONOMIA.maxEnviosSeguidos) return this.terminar();

    if (this.mazo.length === 0) {
      this.vuelta += 1;
      this.mazo = mezclar(CATALOGO.map((c) => ({ ...c, id: c.id + '-V' + this.vuelta })));
    }
    const carta = this.mazo.shift();
    if (!carta) return this.terminar();

    this.cartaActual = carta;
    this.ronda += 1;
    this.fase = 'puja';
    this.reiniciarReloj();
    this.emitirEstado();
    this.toHost('subasta:nuevaCarta', this.estadoPublico());
    this.programarBots();
  }

  reiniciarReloj() {
    if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
    this.pujaFin = Date.now() + ECONOMIA.segundosPuja * 1000;
    this.temporizador = setTimeout(() => { this.temporizador = null; this.resolver(); }, ECONOMIA.segundosPuja * 1000);
  }

  limpiarTemporizadores() {
    if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
    for (const j of this.jugadores) {
      if (j.botTimer) { clearTimeout(j.botTimer); j.botTimer = null; }
    }
  }

  registrarPuja(jugador, monto) {
    if (this.fase !== 'puja' || !this.cartaActual) return { error: 'No hay subasta activa.' };
    if (!puedeAceptar(jugador, this.cartaActual)) return { error: 'No puedes sumar ese rol a tu plantilla.' };
    const m = Math.floor(Number(monto));
    if (!Number.isFinite(m) || m < 1) return { error: 'Puja invalida.' };
    if (m > jugador.dinero) return { error: 'No tienes suficiente dinero.' };
    if (this.pujaActual && m <= this.pujaActual.monto) return { error: 'Debes superar la puja actual.' };
    this.pujaActual = { jugadorId: jugador.id, monto: m };
    this.pujadores[jugador.id] = m;
    this.reiniciarReloj();
    this.emitirEstado();
    this.toHost('subasta:puja', this.estadoPublico());
    this.programarBots();
    return { ok: true, monto: m };
  }

  resolver() {
    if (this.fase !== 'puja') return;
    this.limpiarTemporizadores();
    const carta = this.cartaActual;
    if (!carta) return;

    if (this.pujaActual) {
      const ganador = this.jugadores.find((j) => j.id === this.pujaActual.jugadorId);
      if (ganador) return this.adjudicar(ganador, this.pujaActual.monto);
    }
    // Nadie pujo: se asigna gratis a un jugador en quiebra que lo necesite; si no, a la basura.
    const asignado = this.asignarPorQuiebra(carta);
    if (asignado) return;
    this.tirarBasura(carta);
  }

  adjudicar(j, monto) {
    const carta = this.cartaActual;
    if (!j || !carta) return;
    j.dinero -= monto;
    j.cartas.push(carta);
    if (j.dinero <= 0 && !this.quiebraCola.includes(j.id)) this.quiebraCola.push(j.id);
    this.desiertasSeguidas = 0;
    this.log.push({ carta: carta.nombre, resultado: 'adjudicada', a: j.nombre, monto });
    this.ultimoGanador = { jugadorId: j.id, nombre: j.nombre, puesto: carta.nombre, rol: carta.rol, media: carta.media, monto, esBot: !!j.esBot };
    this.fase = 'adjudicado';
    if (j.socketId) this.io.to(j.socketId).emit('jugador:cartaGanada', { carta, dinero: j.dinero });
    this.emitirEstado();
    this.toHost('subasta:adjudicada', this.estadoPublico());
    this.verificarFin();
  }

  asignarPorQuiebra(carta) {
    for (const id of this.quiebraCola) {
      const j = this.jugadores.find((x) => x.id === id);
      if (!j || !puedeAceptar(j, carta)) continue;
      j.cartas.push(carta);
      this.desiertasSeguidas = 0;
      this.log.push({ carta: carta.nombre, resultado: 'asignada por quiebra', a: j.nombre, monto: 0 });
      this.ultimoGanador = { jugadorId: j.id, nombre: j.nombre, puesto: carta.nombre, rol: carta.rol, media: null, monto: 0, quiebra: true, esBot: !!j.esBot };
      this.fase = 'adjudicado';
      if (j.socketId) this.io.to(j.socketId).emit('jugador:cartaGanada', { carta, dinero: j.dinero, porQuiebra: true });
      this.emitirEstado();
      this.toHost('subasta:adjudicada', this.estadoPublico());
      this.verificarFin();
      return true;
    }
    return false;
  }

  tirarBasura(carta) {
    this.desiertasSeguidas += 1;
    this.log.push({ carta: carta.nombre, resultado: 'a la basura' });
    this.ultimoGanador = { jugadorId: null, nombre: null, puesto: carta.nombre, rol: carta.rol, media: null, monto: 0, basura: true };
    this.fase = 'adjudicado';
    this.emitirEstado();
    this.toHost('subasta:adjudicada', this.estadoPublico());
    this.verificarFin();
  }

  siguiente() {
    if (this.fase === 'fin') return { error: 'La partida termino.' };
    this.sacarCarta();
    return { ok: true };
  }

  verificarFin() {
    if (this.jugadoresActivos().length === 0) return this.terminar();
    if (this.desiertasSeguidas >= ECONOMIA.maxEnviosSeguidos) return this.terminar();
    return false;
  }

  // --- bots ------------------------------------------------------------
  programarBots() {
    if (this.fase !== 'puja') return;
    for (const bot of this.jugadores.filter((j) => j.esBot)) {
      if (!this.cartaActual || !puedeAceptar(bot, this.cartaActual)) continue;
      if (this.pujaActual && this.pujaActual.jugadorId === bot.id) continue;
      if (bot.botTimer) clearTimeout(bot.botTimer);
      const ms = ECONOMIA.botDelayMin + Math.random() * (ECONOMIA.botDelayMax - ECONOMIA.botDelayMin);
      bot.botTimer = setTimeout(() => { bot.botTimer = null; this.intentoBidBot(bot); }, ms);
    }
  }

  valoracionBot(bot, carta) {
    let v = (carta.media / 100) * 11;                 // base por calidad
    const faltan = ECONOMIA.tamanoPlantilla - bot.cartas.length;
    if (carta.rol === 'ceo' && contarRol(bot.cartas, 'ceo') === 0) v += 3;
    if (carta.rol === 'admin' && contarRol(bot.cartas, 'admin') === 0) v += 2;
    if (faltan <= 2) v += 1;                          // urgencia por cerrar plantilla
    v += Math.random() * 2 - 1;
    // reserva de presupuesto para completar los lugares restantes
    const porCarta = Math.floor(bot.dinero / Math.max(1, faltan));
    let tope = Math.max(1, Math.min(Math.round(v), porCarta + (carta.media >= 85 ? 2 : 0)));
    return Math.min(tope, bot.dinero);
  }

  intentoBidBot(bot) {
    if (this.fase !== 'puja' || !this.cartaActual) return;
    if (!puedeAceptar(bot, this.cartaActual)) return;
    if (this.pujaActual && this.pujaActual.jugadorId === bot.id) return;
    const actual = this.pujaActual ? this.pujaActual.monto : 0;
    const siguiente = actual + 1;
    if (siguiente > bot.dinero) return;
    const valor = this.valoracionBot(bot, this.cartaActual);
    if (siguiente > valor) return;
    this.registrarPuja(bot, siguiente);
  }

  // --- cierre ----------------------------------------------------------
  terminar() {
    this.limpiarTemporizadores();
    this.fase = 'fin';
    const resultados = this.jugadores.map((j) => {
      const p = calcularPuntaje(j);
      return {
        jugadorId: j.id, nombre: j.nombre, esBot: !!j.esBot,
        cartas: j.cartas, dinero: j.dinero,
        media: p.base, bonus: p.bonus, penal: p.penal, total: p.total
      };
    }).sort((a, b) => b.total - a.total || b.media - a.media);
    resultados.forEach((r, i) => { r.puesto = i + 1; });
    this.resultadosFinales = resultados;
    this.emitirEstado();
    this.io.to(this.code).emit('juego:fin', { resultados });
    this.toHost('juego:fin', { resultados, estado: this.estadoPublico() });
  }
}

// --- gestor de salas ---------------------------------------------------
const salas = new Map();

function crearSala(io, hostSocketId) {
  let code;
  do { code = codigoSala(); } while (salas.has(code));
  const sala = new Sala(io, code, hostSocketId);
  salas.set(code, sala);
  return sala;
}

module.exports = {
  Sala, salas, crearSala, CATALOGO,
  calcularPuntaje, composicionValida, puedeAceptar, contarRol
};
