/**
 * Prueba end-to-end con Playwright: levanta el servidor, conecta un anfitrion
 * y varios jugadores, juega una partida completa y valida el podio final.
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const N_JUGADORES = Number(process.env.JUGADORES) || 3;

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function esperarServidor(intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch (e) { /* aun no */ }
    await esperar(300);
  }
  return false;
}

async function bucleJugador(page) {
  for (let i = 0; i < 4000; i++) {
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
          const b1 = cont.querySelector('button[data-monto="1"]');
          if (b1 && !b1.disabled) { b1.click(); return 'puja'; }
          const pasar = cont.querySelector('button[data-pasar]');
          if (pasar && !pasar.disabled) { pasar.click(); return 'pasa'; }
        }
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
  const env = { ...process.env, PORT: String(PORT), SEGUNDOS_PUJA: '1', SEGUNDOS_DESEMPATE: '1', PAUSA_ADJUDICADA: '250' };
  const servidor = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env, stdio: 'inherit' });

  const cerrar = () => { try { servidor.kill(); } catch (e) { /* noop */ } };
  process.on('exit', cerrar);

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

    const jugadores = [];
    for (let i = 0; i < N_JUGADORES; i++) {
      const ctxJugador = await navegador.newContext();
      const p = await ctxJugador.newPage();
      await p.goto(`${BASE}/play?code=${code}`);
      await p.fill('#inputNombre', 'Alumno' + (i + 1));
      await p.click('#btnEntrar');
      await p.waitForSelector('#vistaJuego:not(.oculto)', { timeout: 10000 });
      jugadores.push(p);
    }
    console.log(`${jugadores.length} jugadores conectados.`);

    await host.waitForFunction(() => !document.getElementById('btnIniciar').disabled, { timeout: 10000 });
    await host.click('#btnIniciar');

    const bucles = jugadores.map((p) => bucleJugador(p));
    await host.waitForSelector('#overlayFin:not(.oculto)', { timeout: 240000 });
    await Promise.race([Promise.all(bucles), esperar(8000)]);

    const resumen = await host.evaluate(() => {
      const filas = [...document.querySelectorAll('#modalFin .tabla-resultados tbody tr')];
      const podio = document.querySelectorAll('#modalFin .podio .lugar').length;
      return { filas: filas.length, podio, primera: filas[0] ? filas[0].innerText.replace(/\s+/g, ' ').trim() : null };
    });
    console.log('Resultado:', JSON.stringify(resumen));

    if (resumen.filas !== N_JUGADORES) { console.error(`Se esperaban ${N_JUGADORES} filas, hay ${resumen.filas}`); errores++; }
    if (resumen.podio < Math.min(3, N_JUGADORES)) { console.error('Podio incompleto.'); errores++; }

    // Verifica que cada jugador tenga 5 cartas al final
    for (let i = 0; i < jugadores.length; i++) {
      const cartas = await jugadores[i].evaluate(() => document.querySelectorAll('#miPlantilla .slot.lleno').length);
      if (cartas !== 5) { console.error(`Alumno${i + 1} termino con ${cartas} cartas`); errores++; }
    }
  } catch (e) {
    console.error('Fallo la prueba:', e.message);
    errores++;
  } finally {
    await navegador.close();
    cerrar();
  }

  console.log(errores === 0 ? '\nE2E OK: partida completa de principio a fin.' : `\nE2E con ${errores} error(es).`);
  process.exit(errores === 0 ? 0 : 1);
})();

