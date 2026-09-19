/**
 * Servidor del juego: Express + Socket.io + generacion de QR.
 * Un solo servicio Node (compatible con Easy Panel / Nixpacks).
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { salas, crearSala } = require('./juego');
const { ECONOMIA } = require('../data/catalogo');
const { PREGUNTAS } = require('../data/cuestionario');

// Overrides opcionales (utiles para pruebas automatizadas).
if (process.env.SEGUNDOS_PUJA) ECONOMIA.segundosPuja = Number(process.env.SEGUNDOS_PUJA);
if (process.env.MAX_ENVIOS) ECONOMIA.maxEnviosSeguidos = Number(process.env.MAX_ENVIOS);
if (process.env.BOT_DELAY_MIN) ECONOMIA.botDelayMin = Number(process.env.BOT_DELAY_MIN);
if (process.env.BOT_DELAY_MAX) ECONOMIA.botDelayMax = Number(process.env.BOT_DELAY_MAX);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.get('/health', (req, res) => res.json({ ok: true, salas: salas.size }));

// ---------------- Cuestionario (10 preguntas aleatorias de 20) ----------------
function barajar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.get('/api/quiz', (req, res) => {
  const seleccion = barajar(PREGUNTAS).slice(0, 10).map((q) => ({
    id: q.id,
    pregunta: q.pregunta,
    opciones: q.opciones
  }));
  res.json({ total: seleccion.length, preguntas: seleccion });
});

app.post('/api/quiz/calificar', (req, res) => {
  const respuestas = (req.body && req.body.respuestas) || {};
  const porId = new Map(PREGUNTAS.map((q) => [q.id, q]));
  const detalle = [];
  let correctas = 0;
  for (const [idStr, elegida] of Object.entries(respuestas)) {
    const q = porId.get(Number(idStr));
    if (!q) continue;
    const acierto = Number(elegida) === q.correcta;
    if (acierto) correctas += 1;
    detalle.push({
      id: q.id, pregunta: q.pregunta, opciones: q.opciones,
      correcta: q.correcta, elegida: Number(elegida), acierto, explicacion: q.explicacion
    });
  }
  detalle.sort((a, b) => a.id - b.id);
  res.json({ correctas, total: detalle.length, calificacion: detalle.length ? Math.round((correctas / detalle.length) * 10 * 10) / 10 : 0, detalle });
});

app.get('/debug/salas', (req, res) => {
  const out = [...salas.values()].map((s) => ({
    code: s.code, fase: s.fase, ronda: s.ronda, mazo: s.mazo.length,
    desiertas: s.desiertasConsecutivas, carta: s.cartaActual && s.cartaActual.id,
    jugadores: s.jugadores.map((j) => ({ n: j.nombre, d: j.dinero, c: j.cartas.length }))
  }));
  res.json(out);
});

function baseUrl(req, socket) {
  const h = (socket && socket.handshake.headers) || req.headers;
  const proto = (h['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = h['x-forwarded-host'] || h.host;
  return `${proto}://${host}`;
}

io.on('connection', (socket) => {
  // ---------------- ANFITRION ----------------
  socket.on('host:crearSala', async (_, cb) => {
    const sala = crearSala(io, socket.id);
    socket.join(sala.code);
    socket.data = { rol: 'host', code: sala.code };
    const joinUrl = `${baseUrl(null, socket)}/play?code=${sala.code}`;
    const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 420, color: { dark: '#0b2a4a', light: '#ffffff' } });
    if (cb) cb({ ok: true, code: sala.code, joinUrl, qr, estado: sala.estadoPublico() });
  });

  socket.on('host:reconectar', ({ code }, cb) => {
    const sala = salas.get(code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    sala.hostSocketId = socket.id;
    socket.join(code);
    socket.data = { rol: 'host', code };
    cb && cb({ ok: true, code, estado: sala.estadoPublico() });
    sala.emitirEstado();
  });

  socket.on('host:iniciar', (_, cb) => {
    const sala = salas.get(socket.data && socket.data.code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    const r = sala.iniciar();
    cb && cb(r);
  });

  socket.on('host:siguiente', (_, cb) => {
    const sala = salas.get(socket.data && socket.data.code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    const r = sala.siguiente();
    cb && cb(r);
  });

  socket.on('host:terminarSubasta', (_, cb) => {
    const sala = salas.get(socket.data && socket.data.code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    sala.resolver();
    cb && cb({ ok: true });
  });

  socket.on('host:agregarBot', (_, cb) => {
    const sala = salas.get(socket.data && socket.data.code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    const r = sala.agregarBot();
    sala.emitirEstado();
    cb && cb(r);
  });

  socket.on('host:quitarBot', (_, cb) => {
    const sala = salas.get(socket.data && socket.data.code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    const r = sala.quitarBot();
    sala.emitirEstado();
    cb && cb(r);
  });

  // ---------------- JUGADOR ----------------
  socket.on('jugador:unirse', ({ code, nombre, jugadorId }, cb) => {
    const sala = salas.get(String(code || '').toUpperCase());
    if (!sala) return cb && cb({ error: 'Sala no encontrada. Revisa el codigo.' });
    const r = sala.agregarJugador(socket.id, nombre, jugadorId);
    if (r.error) return cb && cb({ error: r.error });
    socket.join(sala.code);
    socket.data = { rol: 'jugador', code: sala.code, jugadorId: r.jugador.id };
    cb && cb({ ok: true, code: sala.code, jugadorId: r.jugador.id, nombre: r.jugador.nombre });
    sala.emitirEstado();
    io.to(sala.code).emit('salon:alerta', { tipo: 'entrada', nombre: r.jugador.nombre });
  });

  socket.on('jugador:pujar', ({ monto }, cb) => {
    const sala = salas.get(socket.data && socket.data.code);
    if (!sala) return cb && cb({ error: 'Sala no encontrada.' });
    const j = sala.jugadores.find((x) => x.id === socket.data.jugadorId);
    if (!j) return cb && cb({ error: 'Jugador no encontrado.' });
    const r = sala.registrarPuja(j, monto);
    cb && cb(r);
  });

  socket.on('disconnect', () => {
    if (!socket.data) return;
    const sala = salas.get(socket.data.code);
    if (!sala) return;
    if (socket.data.rol === 'jugador') { sala.desconectar(socket.id); sala.emitirEstado(); }
  });
});

server.listen(PORT, () => {
  console.log(`Subasta de Talento UNICEBA en http://localhost:${PORT}`);
  console.log(`Presupuesto inicial: $${ECONOMIA.presupuestoInicial} | Plantilla: ${ECONOMIA.tamanoPlantilla}`);
});
