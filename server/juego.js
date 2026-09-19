/**
 * Motor del juego "Subasta de Talento UNICEBA".
 * Mantiene el estado de las salas, la subasta en tiempo real y el puntaje.
 */
const { ECONOMIA, REGLAS_ROL, PUNTAJE, construirCatalogo } = require('../data/catalogo');

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
    this.fase = 'lobby'; // lobby | puja | desempate | adjudicado | fin
    this.mazo = mezclar(CATALOGO);
    this.cartaActual = null;
    this.pujas = {};
    this.temporizador = null;
    this.pujaFin = 0;
    this.ronda = 0;
    this.quiebraCola = [];
    this.ultimoGanador = null;
    this.empatados = [];
    this.vuelta = 0;
    this.desiertasConsecutivas = 0;
    this.log = [];
  }

  // --- serializacion ---------------------------------------------------
  jugadorPublico(j) {
    return {
      id: j.id,
      nombre: j.nombre,
      dinero: j.dinero,
      cartas: j.cartas.length,
      rolConteo: {
        ceo: contarRol(j.cartas, 'ceo'),
        admin: contarRol(j.cartas, 'admin'),
        colaborador: contarRol(j.cartas, 'colaborador')
      },
      conectado: j.conectado,
      yaPujo: Object.prototype.hasOwnProperty.call(this.pujas, j.id)
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
      pujasRapidas: ECONOMIA.pujasRapidas,
      pujaFin: this.pujaFin,
      segundosPuja: ECONOMIA.segundosPuja,
      segundosDesempate: ECONOMIA.segundosDesempate,
      cartaActual: this.cartaActual
        ? {
            id: this.cartaActual.id,
            nombre: this.cartaActual.nombre,
            rol: this.cartaActual.rol,
            area: this.cartaActual.area,
            icon: this.cartaActual.icon
          }
        : null,
      jugadores: this.jugadores.map((j) => this.jugadorPublico(j)),
      ultimoGanador: this.ultimoGanador
    };
  }

  jugadorPrivado(j) {
    return {
      id: j.id,
      nombre: j.nombre,
      dinero: j.dinero,
      cartas: j.cartas,
      puedePujar: this.cartaActual ? puedeAceptar(j, this.cartaActual) && j.dinero >= 1 : false
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
      socketId, nombre: nombreLimpio,
      dinero: ECONOMIA.presupuestoInicial,
      cartas: [], conectado: true
    };
    this.jugadores.push(jugador);
    return { jugador };
  }

  desconectar(socketId) {
    const j = this.jugadores.find((x) => x.socketId === socketId);
    if (j) { j.conectado = false; j.socketId = null; }
  }

  // --- subasta ---------------------------------------------------------
  iniciar() {
    if (this.jugadores.length < ECONOMIA.minJugadores) return { error: 'Se necesitan al menos 2 jugadores.' };
    this.log = [];
    this.quiebraCola = [];
    this.ronda = 0;
    this.sacarCarta();
    return { ok: true };
  }

  jugadoresActivos() {
    return this.jugadores.filter((j) => j.cartas.length < ECONOMIA.tamanoPlantilla);
  }

  sacarCarta() {
    this.limpiarTemporizador();
    this.pujas = {};
    this.ultimoGanador = null;
    // Si no quedan jugadores con espacio, terminamos.
    if (this.jugadoresActivos().length === 0) return this.terminar();

    // Reponemos el mazo con una nueva "generación" de candidatos si se agota.
    if (this.mazo.length === 0) {
      this.vuelta += 1;
      this.mazo = mezclar(CATALOGO.map((c) => ({ ...c, id: c.id + '-V' + this.vuelta })));
    }
    const carta = this.mazo.shift();
    if (!carta) return this.resolverSinCartas();

    this.cartaActual = carta;
    this.ronda += 1;
    this.fase = 'puja';
    this.pujaFin = Date.now() + ECONOMIA.segundosPuja * 1000;
    this.emitirEstado();
    this.toHost('subasta:nuevaCarta', this.estadoPublico());
    this.iniciarTemporizador(ECONOMIA.segundosPuja, () => this.resolver());
  }

  iniciarTemporizador(segundos, cb) {
    this.limpiarTemporizador();
    this.temporizador = setTimeout(() => { this.temporizador = null; cb(); }, segundos * 1000);
  }

  limpiarTemporizador() {
    if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
  }

  registrarPuja(jugador, monto) {
    if (this.fase !== 'puja' && this.fase !== 'desempate') return { error: 'No hay subasta activa.' };
    const carta = this.cartaActual;
    if (!carta) return { error: 'Sin carta activa.' };
    if (!puedeAceptar(jugador, carta)) return { error: 'No puedes sumar ese rol a tu plantilla.' };
    if (this.fase === 'desempate' && !this.empatados.includes(jugador.id)) {
      return { error: 'Solo participan los jugadores empatados.' };
    }
    const m = Math.floor(Number(monto));
    if (!Number.isFinite(m) || m < 1) return { error: 'Puja invalida.' };
    if (m > jugador.dinero) return { error: 'No tienes suficiente dinero.' };
    this.pujas[jugador.id] = m;
    this.emitirEstado();
    this.verificarTodosListos();
    return { ok: true, monto: m };
  }

  registrarPase(jugador) {
    if (this.fase !== 'puja' && this.fase !== 'desempate') return { error: 'No hay subasta activa.' };
    this.pujas[jugador.id] = 0;
    this.emitirEstado();
    this.verificarTodosListos();
    return { ok: true };
  }

  jugadoresQuePujan() {
    if (!this.cartaActual) return [];
    let elegibles = this.jugadores.filter((j) => j.dinero >= 1 && puedeAceptar(j, this.cartaActual));
    if (this.fase === 'desempate') elegibles = elegibles.filter((j) => this.empatados.includes(j.id));
    return elegibles;
  }

  verificarTodosListos() {
    const elegibles = this.jugadoresQuePujan();
    if (elegibles.length === 0) return this.resolver();
    const todosListos = elegibles.every((j) => Object.prototype.hasOwnProperty.call(this.pujas, j.id));
    if (todosListos) { this.limpiarTemporizador(); this.resolver(); }
  }

  resolver() {
    this.limpiarTemporizador();
    if (this.fase === 'adjudicado' || this.fase === 'fin') return;
    const carta = this.cartaActual;
    if (!carta) return;
    const pujas = this.pujas;
    const validas = Object.entries(pujas).filter(([, m]) => m > 0);

    // Nadie pujo: ver si un jugador en quiebra puede recibirlo gratis.
    if (validas.length === 0) {
      const asignado = this.asignarPorQuiebra(carta);
      if (asignado) return;
      return this.declararDesierta(carta);
    }

    const maxMonto = Math.max(...validas.map(([, m]) => m));
    const ganadores = validas.filter(([, m]) => m === maxMonto).map(([id]) => id);

    if (ganadores.length > 1 && this.fase !== 'desempate') {
      // Empate: segunda vuelta sellada solo entre empatados.
      this.empatados = ganadores;
      this.pujas = {};
      this.fase = 'desempate';
      this.pujaFin = Date.now() + ECONOMIA.segundosDesempate * 1000;
      this.emitirEstado();
      this.toHost('subasta:desempate', { empatados: ganadores, estado: this.estadoPublico() });
      this.iniciarTemporizador(ECONOMIA.segundosDesempate, () => this.resolverDesempate());
      return;
    }

    if (ganadores.length > 1) return this.resolverDesempate();
    this.adjudicar(ganadores[0], maxMonto);
  }

  resolverDesempate() {
    this.limpiarTemporizador();
    if (this.fase === 'adjudicado' || this.fase === 'fin') return;
    const validas = Object.entries(this.pujas).filter(([, m]) => m > 0);
    if (validas.length === 0) return this.declararDesierta(this.cartaActual);
    const maxMonto = Math.max(...validas.map(([, m]) => m));
    const ganadores = validas.filter(([, m]) => m === maxMonto).map(([id]) => id);
    if (ganadores.length > 1) {
      // Persiste el empate: se rompe al azar entre los empatados para no frenar la partida.
      const elegido = ganadores[Math.floor(Math.random() * ganadores.length)];
      this.log.push({ carta: this.cartaActual.nombre, resultado: 'desempate al azar', a: elegido });
      return this.adjudicar(elegido, maxMonto);
    }
    this.adjudicar(ganadores[0], maxMonto);
  }

  declararDesierta(carta) {
    this.desiertasConsecutivas += 1;
    if (this.desiertasConsecutivas >= 3) {
      const forzado = this.asignacionForzosa(carta);
      if (forzado) return;
    }
    this.log.push({ carta: carta.nombre, resultado: 'desierta' });
    this.ultimoGanador = { jugadorId: null, nombre: null, puesto: carta.nombre, rol: carta.rol, media: null, monto: 0, desierta: true };
    this.fase = 'adjudicado';
    this.emitirEstado();
    this.toHost('subasta:adjudicada', this.estadoPublico());
    return this.siguienteAutomatico();
  }

  // Valvula de seguridad: si nadie puja repetidamente, se asigna gratis al
  // jugador activo con menos cartas (evita que una partida nunca termine).
  asignacionForzosa(carta) {
    const candidatos = this.jugadores
      .filter((j) => puedeAceptar(j, carta))
      .sort((a, b) => a.cartas.length - b.cartas.length || a.dinero - b.dinero);
    const j = candidatos[0];
    if (!j) return false;
    j.cartas.push(carta);
    this.desiertasConsecutivas = 0;
    this.log.push({ carta: carta.nombre, resultado: 'asignacion forzosa', a: j.nombre, monto: 0 });
    this.ultimoGanador = { jugadorId: j.id, nombre: j.nombre, puesto: carta.nombre, rol: carta.rol, media: null, monto: 0, desierta: false, forzada: true };
    this.fase = 'adjudicado';
    if (j.socketId) this.io.to(j.socketId).emit('jugador:cartaGanada', { carta, dinero: j.dinero, forzada: true });
    this.emitirEstado();
    this.toHost('subasta:adjudicada', this.estadoPublico());
    this.siguienteAutomatico();
    return true;
  }

  adjudicar(jugadorId, monto) {
    const j = this.jugadores.find((x) => x.id === jugadorId);
    const carta = this.cartaActual;
    if (!j || !carta) return;
    j.dinero -= monto;
    j.cartas.push(carta);
    if (j.dinero <= 0 && !this.quiebraCola.includes(j.id)) this.quiebraCola.push(j.id);
    this.desiertasConsecutivas = 0;
    this.log.push({ carta: carta.nombre, resultado: 'adjudicada', a: j.nombre, monto });
    this.ultimoGanador = { jugadorId: j.id, nombre: j.nombre, puesto: carta.nombre, rol: carta.rol, media: carta.media, monto, desierta: false };
    this.fase = 'adjudicado';
    // La carta completa se revela SOLO al ganador.
    if (j.socketId) this.io.to(j.socketId).emit('jugador:cartaGanada', { carta, dinero: j.dinero });
    this.emitirEstado();
    this.toHost('subasta:adjudicada', this.estadoPublico());
    this.siguienteAutomatico();
  }

  asignarPorQuiebra(carta) {
    for (const id of this.quiebraCola) {
      const j = this.jugadores.find((x) => x.id === id);
      if (!j) continue;
      if (!puedeAceptar(j, carta)) continue;
      j.cartas.push(carta);
      this.desiertasConsecutivas = 0;
      this.log.push({ carta: carta.nombre, resultado: 'asignada por quiebra', a: j.nombre, monto: 0 });
      this.ultimoGanador = { jugadorId: j.id, nombre: j.nombre, puesto: carta.nombre, rol: carta.rol, media: null, monto: 0, desierta: false, quiebra: true };
      this.fase = 'adjudicado';
      if (j.socketId) this.io.to(j.socketId).emit('jugador:cartaGanada', { carta, dinero: j.dinero, porQuiebra: true });
      this.emitirEstado();
      this.toHost('subasta:adjudicada', this.estadoPublico());
      this.siguienteAutomatico();
      return true;
    }
    return false;
  }

  siguienteAutomatico() {
    this.limpiarTemporizador();
    this.ultimoGanador = this.ultimoGanador; // se conserva para el proximo render
    this.temporizador = setTimeout(() => { this.temporizador = null; this.sacarCarta(); }, ECONOMIA.pausaAdjudicada);
  }

  // --- cierre ----------------------------------------------------------
  resolverSinCartas() {
    // Se acabo el mazo: intenta completar plantillas con lo que quede en la cola de quiebra.
    this.terminar();
  }

  terminar() {
    this.limpiarTemporizador();
    this.fase = 'fin';
    const resultados = this.jugadores.map((j) => {
      const p = calcularPuntaje(j);
      return {
        jugadorId: j.id,
        nombre: j.nombre,
        cartas: j.cartas,
        dinero: j.dinero,
        media: p.base,
        bonus: p.bonus,
        penal: p.penal,
        total: p.total
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
