/* Pantalla del jugador */
const socket = io();
const $ = (id) => document.getElementById(id);

let miId = null;
let miNombre = null;
let estadoPub = null;
let miEstado = null;
let codigoActual = null;

$('instruccionesJugador').innerHTML = instruccionesHTML();
$('btnEntendido').addEventListener('click', () => $('overlayInstr').classList.add('oculto'));

const params = new URLSearchParams(location.search);
const codeUrl = (params.get('code') || '').toUpperCase();
if (codeUrl) $('inputCodigo').value = codeUrl;

function claveStorage(code) { return 'subasta_jugador_' + code; }

$('btnEntrar').addEventListener('click', entrar);
$('inputNombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });

function entrar() {
  const code = $('inputCodigo').value.trim().toUpperCase();
  const nombre = $('inputNombre').value.trim();
  if (code.length < 4) { $('errorUnion').textContent = 'Escribe el código de la sala.'; return; }
  if (!nombre) { $('errorUnion').textContent = 'Escribe tu nombre.'; return; }
  $('errorUnion').textContent = '';
  const guardado = localStorage.getItem(claveStorage(code));
  localStorage.setItem('subasta_nombre', nombre);
  codigoActual = code;
  miNombre = nombre;
  socket.emit('jugador:unirse', { code, nombre, jugadorId: guardado || undefined }, (r) => {
    if (!r || r.error) { $('errorUnion').textContent = (r && r.error) || 'No se pudo entrar.'; return; }
    miId = r.jugadorId;
    miNombre = r.nombre;
    localStorage.setItem(claveStorage(code), miId);
    $('chipNombre').textContent = miNombre;
    $('vistaUnirse').classList.add('oculto');
    $('vistaJuego').classList.remove('oculto');
  });
}

window.addEventListener('load', () => {
  if (!codeUrl) return;
  const guardado = localStorage.getItem(claveStorage(codeUrl));
  const nombre = localStorage.getItem('subasta_nombre');
  if (!guardado || !nombre) return;
  $('inputNombre').value = nombre;
  entrarGuardado(codeUrl, guardado, nombre);
});

function entrarGuardado(code, id, nombre) {
  codigoActual = code; miNombre = nombre;
  socket.emit('jugador:unirse', { code, nombre, jugadorId: id }, (r) => {
    if (!r || r.error) return;
    miId = r.jugadorId;
    localStorage.setItem(claveStorage(code), miId);
    $('chipNombre').textContent = miNombre;
    $('vistaUnirse').classList.add('oculto');
    $('vistaJuego').classList.remove('oculto');
  });
}

socket.on('sala:estado', (e) => { estadoPub = e; render(); });
socket.on('jugador:estado', (e) => { miEstado = e; render(); });

socket.on('jugador:cartaGanada', ({ carta, dinero, porQuiebra }) => {
  if (miEstado) miEstado.dinero = dinero;
  $('miDinero').textContent = '$' + dinero;
  mostrarCartaGanada(carta, porQuiebra);
});

socket.on('juego:fin', ({ resultados }) => mostrarFin(resultados));

socket.on('connect', () => {
  if (codigoActual && miId) {
    socket.emit('jugador:unirse', { code: codigoActual, nombre: miNombre, jugadorId: miId }, () => {});
  }
});

function render() {
  if (!miEstado || !estadoPub) return;
  $('miDinero').textContent = '$' + miEstado.dinero;
  $('miDinero').className = 'monto' + (miEstado.dinero <= 0 ? ' quiebra' : '');
  $('miRonda').textContent = estadoPub.fase === 'lobby' ? '—' : estadoPub.ronda;
  renderPlantilla();

  const fase = estadoPub.fase;
  if (fase !== 'puja') {
    $('tituloCarta').textContent = fase === 'lobby' ? 'Esperando a que el anfitrión inicie…' : 'Preparando la siguiente carta…';
    $('contenidoCarta').innerHTML = '';
    $('pujaActual').classList.add('oculto');
    $('pujaBotones').classList.add('oculto');
    if (fase === 'lobby') {
      $('estadoPuja').classList.remove('oculto');
      $('estadoPuja').className = 'estado-puja espera';
      $('estadoPuja').textContent = 'Ya estás dentro. Espera al anfitrión.';
    } else {
      $('estadoPuja').classList.add('oculto');
    }
    return;
  }

  const c = estadoPub.cartaActual;
  $('tituloCarta').textContent = `Ronda ${estadoPub.ronda} · ${ROLES_CORTO[c.rol]}`;
  $('contenidoCarta').innerHTML = `
    <div class="carta-subasta-cab" style="padding:0">
      <div class="icono" style="font-size:34px">${c.icon}</div>
      <div>
        <div class="puesto" style="font-size:20px">${c.nombre}</div>
        <div class="meta">${c.area} · media oculta</div>
      </div>
    </div>
    <div class="atributos-caja">${barrasAtributos(c.atributos)}</div>`;

  const pa = estadoPub.pujaActual;
  $('pujaActual').classList.remove('oculto');
  if (miEstado.vaGanando) {
    $('pujaActual').innerHTML = `<span class="puja-etiqueta">Vas ganando con</span> <span class="puja-monto">$${pa.monto}</span>`;
  } else if (pa) {
    $('pujaActual').innerHTML = `<span class="puja-etiqueta">Puja actual</span> <span class="puja-monto">$${pa.monto}</span> <span class="puja-lider">${pa.nombre || ''}</span>`;
  } else {
    $('pujaActual').innerHTML = '<span class="puja-etiqueta">Aún no hay pujas</span>';
  }

  const base = pa ? pa.monto : 0;
  const incs = estadoPub.incrementosRapidos;
  const puede = miEstado.puedePujar;
  $('pujaBotones').innerHTML = incs.map((inc) => {
    const val = base + inc;
    const dis = !puede || val > miEstado.dinero;
    return `<button data-monto="${val}" ${dis ? 'disabled' : ''}>$${val}</button>`;
  }).join('');
  $('pujaBotones').classList.toggle('oculto', false);
  $('pujaBotones').querySelectorAll('button').forEach((b) => {
    b.onclick = () => enviarPuja(Number(b.dataset.monto));
  });

  if (miEstado.vaGanando) {
    $('estadoPuja').classList.remove('oculto'); $('estadoPuja').className = 'estado-puja ok';
    $('estadoPuja').textContent = '✓ Vas ganando. ¡Atento, te pueden superar!';
  } else if (!puede) {
    $('estadoPuja').classList.remove('oculto'); $('estadoPuja').className = 'estado-puja espera';
    $('estadoPuja').textContent = miEstado.dinero <= 0 ? 'Sin dinero: solo puedes esperar asignaciones por quiebra.' : 'Este rol ya no cabe en tu plantilla.';
  } else {
    $('estadoPuja').classList.add('oculto');
  }
}

function enviarPuja(monto) {
  socket.emit('jugador:pujar', { monto }, (r) => {
    if (r && r.error) { aviso(r.error); return; }
    if (miEstado) { /* el servidor confirmara el nuevo estado */ }
  });
}

function renderPlantilla() {
  const cartas = miEstado.cartas;
  $('contadorPlantilla').textContent = `(${cartas.length}/5)`;
  const slots = cartas.map((c) => `
    <div class="slot lleno">
      <div class="s-media">${c.media}</div>
      <div class="s-nombre">${c.nombre}</div>
      <div class="s-rol">${ROLES_CORTO[c.rol]}</div>
    </div>`).join('');
  const vacios = Math.max(0, 5 - cartas.length);
  let extra = '';
  for (let i = 0; i < vacios; i++) extra += '<div class="slot"><div class="s-rol">Por asignar</div></div>';
  $('miPlantilla').innerHTML = slots + extra;
}

function mostrarCartaGanada(carta, porQuiebra) {
  const attrs = Object.entries(carta.atributos).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('modal').innerHTML = `
    <div style="font-size:44px">${porQuiebra ? '🎁' : '🏆'}</div>
    <h2>${porQuiebra ? 'Asignación por quiebra' : '¡Ganaste la subasta!'}</h2>
    <p style="margin-bottom:16px">${porQuiebra ? 'Nadie pujó y no te quedaba dinero' : 'Se une a tu equipo'}</p>
    <div class="carta-fifa tier-${carta.tier}">
      <div class="cf-top">
        <div class="cf-media">${carta.media}</div>
        <div>
          <div class="cf-rol">${ROLES[carta.rol]}</div>
          <div style="font-size:12px;opacity:.85">${carta.tier.toUpperCase()}</div>
        </div>
      </div>
      <div class="cf-nombre">${carta.nombre}</div>
      <div class="cf-area">${carta.icon} ${carta.area}</div>
      <div class="cf-atributos">${attrs}</div>
      <div class="cf-rasgo ${carta.tipoRasgo}">${carta.tipoRasgo === 'positivo' ? '★' : carta.tipoRasgo === 'negativo' ? '⚠' : '•'} ${carta.rasgo}</div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:18px" onclick="document.getElementById('overlay').classList.add('oculto')">Continuar</button>`;
  $('overlay').classList.remove('oculto');
}

function mostrarFin(resultados) {
  window.__fin = true;
  const yo = resultados.find((r) => r.jugadorId === miId);
  if (!yo) return;
  const medalla = yo.puesto === 1 ? '🥇' : yo.puesto === 2 ? '🥈' : yo.puesto === 3 ? '🥉' : '🎖️';
  const lista = resultados.slice(0, 5).map((r) => `
    <tr style="${r.jugadorId === miId ? 'font-weight:800;background:#eef4fb' : ''}">
      <td>${r.puesto}</td><td>${r.esBot ? '🤖 ' : ''}${r.nombre}</td><td class="punt">${r.total}</td>
    </tr>`).join('');
  $('modal').innerHTML = `
    <div style="font-size:52px">${medalla}</div>
    <h2>Quedaste en ${yo.puesto}° lugar</h2>
    <p>Puntaje final: <b style="color:var(--uniceba-blue);font-size:22px">${yo.total}</b></p>
    <p style="font-size:13px;margin-top:6px">Media del equipo ${yo.media} · Bonus +${yo.bonus} · Penal -${yo.penal}</p>
    <table class="tabla-resultados"><thead><tr><th>#</th><th>Jugador</th><th>Puntaje</th></tr></thead><tbody>${lista}</tbody></table>`;
  $('overlay').classList.remove('oculto');
  $('overlayInstr').classList.add('oculto');
}

function aviso(txt) { alert(txt); }
