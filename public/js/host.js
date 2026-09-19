/* Pantalla del anfitrion */
const socket = io();

// --- Efectos de sonido (Web Audio, sin archivos) ---
let ac = null;
function audioInit() {
  try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tono(freq, dur = 0.14, tipo = 'sine', vol = 0.07) {
  if (!ac) return;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = tipo; o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.start(); o.stop(ac.currentTime + dur);
}
function fanfarria() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono(f, 0.2, 'triangle', 0.1), i * 120)); }

const $ = (id) => document.getElementById(id);
let estado = null;
let timerRAF = null;

$('instruccionesAdmin').innerHTML = instruccionesHTML();

function crearSala() {
  socket.emit('host:crearSala', {}, (r) => {
    if (!r || r.error) return alert((r && r.error) || 'No se pudo crear la sala.');
    $('codigoSala').textContent = r.code;
    $('qr').src = r.qr;
    $('urlJoin').textContent = r.joinUrl;
    estado = r.estado;
    render();
  });
}

socket.on('connect', crearSala);
socket.on('sala:estado', (e) => { estado = e; render(); });
socket.on('subasta:nuevaCarta', () => { tono(480, 0.1, 'triangle', 0.05); });
socket.on('subasta:puja', () => { tono(620, 0.06, 'sine', 0.05); });
socket.on('subasta:adjudicada', (e) => tono(e && e.ultimoGanador && !e.ultimoGanador.basura ? 720 : 220, 0.16, 'sine', 0.06));
socket.on('juego:fin', ({ resultados, estado: e }) => { if (e) estado = e; render(); fanfarria(); mostrarFin(resultados); });

$('btnIniciar').addEventListener('click', () => { audioInit(); socket.emit('host:iniciar', {}, (r) => { if (r && r.error) alert(r.error); }); });
$('btnSiguiente').addEventListener('click', () => socket.emit('host:siguiente', {}, (r) => { if (r && r.error) alert(r.error); }));
$('btnTerminar').addEventListener('click', () => socket.emit('host:terminarSubasta', {}, (r) => { if (r && r.error) alert(r.error); }));
$('btnAgregarBot').addEventListener('click', () => socket.emit('host:agregarBot', {}, (r) => { if (r && r.error) alert(r.error); }));
$('btnQuitarBot').addEventListener('click', () => socket.emit('host:quitarBot', {}, (r) => { if (r && r.error) alert(r.error); }));

function render() {
  if (!estado) return;
  const enLobby = estado.fase === 'lobby';
  const enPuja = estado.fase === 'puja';
  const enAdjudicado = estado.fase === 'adjudicado';
  $('vistaLobby').classList.toggle('oculto', !enLobby);
  $('vistaSubasta').classList.toggle('oculto', enLobby);

  $('chipJugadores').textContent = `${estado.jugadores.length} jugador${estado.jugadores.length === 1 ? '' : 'es'}`;
  $('contadorJugadores').textContent = `(${estado.jugadores.length}/${estado.maxJugadores})`;
  $('chipRonda').textContent = enLobby ? 'Sala en espera' : (estado.fase === 'fin' ? 'Fin de la partida' : `Ronda ${estado.ronda}`);
  $('rondaLabel').textContent = `Ronda ${estado.ronda}`;
  $('btnIniciar').disabled = estado.jugadores.length < estado.minJugadores;

  const bots = estado.jugadores.filter((j) => j.esBot).length;
  $('btnAgregarBot').disabled = bots >= estado.maxBots || estado.jugadores.length >= estado.maxJugadores || !enLobby;
  $('btnQuitarBot').disabled = bots === 0 || !enLobby;

  $('listaJugadores').innerHTML = estado.jugadores.map((j) =>
    `<div class="jugador-chip ${j.conectado || j.esBot ? '' : 'off'}">${j.esBot ? '<span class="bot-tag">BOT</span>' : '<span class="punto"></span>'}${j.nombre}</div>`
  ).join('') || '<p style="color:#999;font-size:14px">Aún no se une nadie. Comparte el QR.</p>';

  $('btnTerminar').classList.toggle('oculto', !enPuja);
  $('btnSiguiente').classList.toggle('oculto', !enAdjudicado);

  if (!enLobby) renderSubasta();
}

function renderSubasta() {
  const c = estado.cartaActual;
  if (c) {
    $('cartaSubasta').innerHTML = `
      <div class="carta-subasta-cab">
        <div class="icono">${c.icon}</div>
        <div>
          <div class="puesto">${c.nombre}</div>
          <div class="meta">${ROLES[c.rol]} · ${c.area}</div>
        </div>
        <div class="media-oculta">?<small>MEDIA OCULTA</small></div>
      </div>
      <div class="atributos-caja">${barrasAtributos(c.atributos)}</div>`;
  } else {
    $('cartaSubasta').innerHTML = '<div class="puesto">Preparando siguiente carta…</div>';
  }

  const pa = estado.pujaActual;
  if (pa) {
    $('pujaActualMonto').textContent = '$' + pa.monto;
    $('pujaActualLider').textContent = (pa.nombre || '') + (pa.nombre ? '' : '');
  } else {
    $('pujaActualMonto').textContent = 'Sin pujas';
    $('pujaActualLider').textContent = '';
  }

  const ug = estado.ultimoGanador;
  if (ug) {
    let txt;
    if (ug.basura) txt = `🗑️ ${ug.puesto} se fue a la basura (nadie pujó)`;
    else if (ug.quiebra) txt = `🎁 ${ug.nombre} recibe <b>${ug.puesto}</b> por quiebra (sin costo)`;
    else txt = `🏆 ${ug.nombre} se lleva <b>${ug.puesto}</b> por $${ug.monto}`;
    $('bannerAdjudicada').innerHTML = `<div class="banner-adjudicada ${ug.basura ? 'desierta' : ''}">${txt}</div>`;
  } else {
    $('bannerAdjudicada').innerHTML = '';
  }

  $('gridJugadores').innerHTML = estado.jugadores.map((j) => {
    const slots = [];
    for (let i = 0; i < estado.tamanoPlantilla; i++) {
      slots.push(`<div class="slot-mini ${i < j.cartas ? 'on' : ''}"></div>`);
    }
    const ganador = ug && ug.jugadorId === j.id && !ug.basura;
    return `<div class="jugador-card ${j.vaGanando ? 'ganador' : ''} ${j.pujo ? 'pujo' : ''}">
      <div class="nombre">${j.esBot ? '🤖 ' : ''}${j.nombre}</div>
      <div class="dinero ${j.dinero <= 0 ? 'quiebra' : ''}">$${j.dinero}</div>
      <div style="font-size:11px;color:#888;margin-top:2px">Equipo ${j.cartas}/${estado.tamanoPlantilla} · C${j.rolConteo.ceo} A${j.rolConteo.admin} O${j.rolConteo.colaborador}</div>
      <div class="slots">${slots.join('')}</div>
    </div>`;
  }).join('');
}

// ---- Timer (se reinicia con cada puja) ----
function bucleTimer() {
  cancelAnimationFrame(timerRAF);
  if (!estado || estado.fase !== 'puja') { $('timerNum').textContent = ''; return; }
  const restante = Math.max(0, (estado.pujaFin - Date.now()) / 1000);
  $('timerNum').textContent = restante.toFixed(0);
  const pct = Math.max(0, Math.min(100, (restante / estado.segundosPuja) * 100));
  const fill = $('timerFill');
  fill.style.width = pct + '%';
  fill.className = 'timer-fill' + (pct <= 25 ? ' danger' : pct <= 50 ? ' warn' : '');
  $('timerNum').classList.toggle('urgente', pct <= 25);
  if (restante > 0) timerRAF = requestAnimationFrame(bucleTimer);
}
setInterval(() => { if (estado && estado.fase === 'puja') bucleTimer(); }, 200);

// ---- Fin ----
function mostrarFin(resultados) {
  const top = resultados.slice(0, 3);
  const orden = [top[1], top[0], top[2]].filter(Boolean);
  const alturas = { 1: 150, 2: 115, 3: 90 };
  const medallas = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const podio = `<div class="podio">${orden.map((r) => `
    <div class="lugar">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">${r.esBot ? '🤖 ' : ''}${r.nombre}</div>
      <div class="barra" style="height:${alturas[r.puesto]}px">
        <div class="medalla">${medallas[r.puesto]}</div>
        <div class="pts">${r.total}</div>
      </div>
    </div>`).join('')}</div>`;

  const filas = resultados.map((r) => `
    <tr>
      <td>${r.puesto}</td>
      <td>${r.esBot ? '🤖 ' : ''}${r.nombre}</td>
      <td class="punt">${r.total}</td>
      <td>${r.media} <span style="color:#999;font-size:12px">(base)</span></td>
      <td><span style="color:var(--correct)">+${r.bonus}</span> / <span style="color:${r.penal ? 'var(--incorrect)' : '#999'}">-${r.penal}</span></td>
      <td><div class="detalle-equipo">${r.cartas.map((c) => `<span class="mini-carta ${c.tipoRasgo === 'negativo' ? 'neg' : ''}">${c.nombre} <b>${c.media}</b></span>`).join('') || '<span style="color:#999">sin equipo</span>'}</div></td>
    </tr>`).join('');

  $('modalFin').innerHTML = `
    <div style="font-size:52px">🏆</div>
    <h2>Resultados finales</h2>
    <p>Mejores equipos de la subasta</p>
    ${podio}
    <table class="tabla-resultados">
      <thead><tr><th>#</th><th>Jugador</th><th>Puntaje</th><th>Media equipo</th><th>Bonus/Penal</th><th>Plantilla</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <button class="btn btn-primary btn-block" style="margin-top:20px" onclick="location.reload()">Nueva partida</button>`;
  $('overlayFin').classList.remove('oculto');
}
