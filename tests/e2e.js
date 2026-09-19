/**
 * Prueba end-to-end con Playwright: levanta el servidor, agrega bots,
 * conecta jugadores, juega una partida completa en tiempo real y valida el final.
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 3100;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const N_JUGADORES = Number(process.env.JUGADORES) || 3;
const N_BOTS = Number(process.env.BOTS) || 2;

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function esperarServidor(intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return true; } catch (e) { /* aun no */ }
    await esperar(300);
  }
  return false;
}

async function bucleJugador(page) {
  for (let i = 0; i < 20000; i++) {
    try {
      const hecho = await page.evaluate(() => {
        if (window.__fin) return 'fin';
        const overlay = document.getElementById('overlay');
        if (overlay && !overlay.classList.contains('oculto')) {
          const btn = overlay.querySelector('button');
          if (btn) { btn.click(); return 'cerrar'; }
        }
        const cont = document.getElementById('pujaBotones');
        if (cont && !cont.classList.contains('oculto')) {
          const b = cont.querySelector('button:not([disabled])');
          if (b) { b.click(); return 'puja'; }
        }
        return 'nada';
      });
      if (hecho === 'fin') return;
      if (hecho === 'nada') await esperar(90);
    } catch (e) {
      if (/Execution context was destroyed|Target closed/.test(e.message)) return;
      await esperar(120);
    }
  }
}

async function bucleHost(page) {
  for (let i = 0; i < 20000; i++) {
    try {
      const hecho = await page.evaluate(() => {
        const fin = document.getElementById('overlayFin');
        if (fin && !fin.classList.contains('oculto')) return 'fin';
        const visible = (el) => el && !el.classList.contains('oculto') && el.offsetParent !== null;
        const sig = document.getElementById('btnSiguiente');
        if (visible(sig)) { sig.click(); return 'siguiente'; }
        const ini = document.getElementById('btnIniciar');
        if (visible(ini) && !ini.disabled) { ini.click(); return 'iniciar'; }
        return 'nada';
      });
      if (hecho === 'fin') return;
      if (hecho === 'nada') await esperar(120);
    } catch (e) {
      if (/Execution context was destroyed|Target closed/.test(e.message)) return;
      await esperar(150);
    }
  }
}

(async () => {
  let cerrar = () => {};
  if (!process.env.BASE_URL) {
    const env = { ...process.env, PORT: String(PORT), SEGUNDOS_PUJA: '1', MAX_ENVIOS: '20', BOT_DELAY_MIN: '150', BOT_DELAY_MAX: '600' };
    const servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env, stdio: 'inherit' });
    cerrar = () => { try { servidor.kill(); } catch (e) { /* noop */ } };
    process.on('exit', cerrar);
  }

  if (!(await esperarServidor())) { console.error('El servidor no respondio.'); cerrar(); process.exit(1); }

  const navegador = await chromium.launch({ headless: true });
  const contextoHost = await navegador.newContext();
  let errores = 0;

  try {
    const host = await contextoHost.newPage();
    await host.goto(BASE + '/');
    await host.waitForFunction(() => {
      const c = document.getElementById('codigoSala');
      return c && c.textContent && c.textContent !== '-----';
    }, { timeout: 15000 });
    const code = (await host.textContent('#codigoSala')).trim();
    console.log('Sala creada:', code);

    for (let i = 0; i < N_BOTS; i++) { await host.click('#btnAgregarBot'); await esperar(120); }

    const jugadores = [];
    for (let i = 0; i < N_JUGADORES; i++) {
      const ctx = await navegador.newContext();
      const p = await ctx.newPage();
      await p.goto(`${BASE}/play?code=${code}`);
      await p.waitForSelector('#overlayInstr:not(.oculto)', { timeout: 10000 });
      if (i === 0) { // valida que aparezcan las instrucciones al escanear
        const txt = await p.textContent('#instruccionesJugador');
        if (!/20 segundos/.test(txt)) { console.error('Faltan instrucciones al escanear.'); errores++; }
      }
      await p.click('#btnEntendido');
      await p.fill('#inputNombre', 'Alumno' + (i + 1));
      await p.click('#btnEntrar');
      await p.waitForSelector('#vistaJuego:not(.oculto)', { timeout: 10000 });
      jugadores.push(p);
    }
    console.log(`${jugadores.length} jugadores + ${N_BOTS} bots conectados.`);

    await host.waitForFunction(() => !document.getElementById('btnIniciar').disabled, { timeout: 10000 });

    const bucles = [bucleHost(host), ...jugadores.map((p) => bucleJugador(p))];
    await host.waitForSelector('#overlayFin:not(.oculto)', { timeout: 240000 });
    await Promise.race([Promise.all(bucles), esperar(6000)]);

    const resumen = await host.evaluate(() => {
      const filas = [...document.querySelectorAll('#modalFin .tabla-resultados tbody tr')];
      return { filas: filas.length, podio: document.querySelectorAll('#modalFin .podio .lugar').length };
    });
    const esperados = N_JUGADORES + N_BOTS;
    console.log('Resultado:', JSON.stringify(resumen), 'esperados:', esperados);
    if (resumen.filas !== esperados) { console.error(`Se esperaban ${esperados} filas, hay ${resumen.filas}`); errores++; }
    if (resumen.podio < 3) { console.error('Podio incompleto.'); errores++; }

    for (let i = 0; i < jugadores.length; i++) {
      const cartas = await jugadores[i].evaluate(() => document.querySelectorAll('#miPlantilla .slot.lleno').length);
      if (cartas > 5) { console.error(`Alumno${i + 1} termino con ${cartas} cartas`); errores++; }
    }
  } catch (e) {
    console.error('Fallo la prueba:', e.message);
    errores++;
  } finally {
    await navegador.close();
    cerrar();
  }

  console.log(errores === 0 ? '\nE2E OK: partida completa con bots.' : `\nE2E con ${errores} error(es).`);
  process.exit(errores === 0 ? 0 : 1);
})();
