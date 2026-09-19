/**
 * Fase 0 - Catalogo de puestos y economia del juego.
 *
 * Cada carta representa un puesto de trabajo con 5 atributos (1-99).
 * La media se calcula con el promedio de los atributos, igual que en FIFA/NBA.
 * La media permanece OCULTA para los jugadores hasta que ganan la subasta.
 */

// --- Economia y reglas ------------------------------------------------
const ECONOMIA = {
  presupuestoInicial: 20,      // dinero inicial por jugador
  tamanoPlantilla: 5,          // personas por equipo
  pujasRapidas: [1, 2, 3, 4, 5], // botones de puja (enteros)
  segundosPuja: 20,            // duracion de cada ronda de puja
  segundosDesempate: 15,       // duracion de la segunda vuelta
  pausaAdjudicada: 3500,       // ms que se muestra la carta adjudicada antes de la siguiente
  minJugadores: 2,
  maxJugadores: 15
};

// Roles y cuantos se permiten por plantilla (garantiza composicion valida)
const REGLAS_ROL = {
  ceo:          { nombre: 'CEO / Direccion General', min: 1, max: 1, peso: 3 },
  admin:        { nombre: 'Administrador / Jefatura de area', min: 1, max: 2, peso: 2 },
  colaborador:  { nombre: 'Colaborador / Obrero', min: 2, max: 3, peso: 1 }
};

// Bonus/penalizaciones sobre el puntaje final (media del equipo)
const PUNTAJE = {
  bonusComposicion: 3,   // plantilla con 1 CEO + 1-2 admin + 2-3 colaboradores
  bonusCeoEstrella: 4,   // CEO con media >= 85
  bonusSinConflictos: 2, // ninguna carta con rasgo negativo
  penalPorConflicto: 3   // por cada carta con rasgo negativo
};

// --- Areas de la empresa ---------------------------------------------
const AREAS = [
  { id: 'direccion',     nombre: 'Direccion General',        icon: '🏛️' },
  { id: 'finanzas',      nombre: 'Finanzas',                  icon: '💰' },
  { id: 'operaciones',   nombre: 'Operaciones',               icon: '⚙️' },
  { id: 'rrhh',          nombre: 'Recursos Humanos',          icon: '🤝' },
  { id: 'marketing',     nombre: 'Marketing',                 icon: '📣' },
  { id: 'ventas',        nombre: 'Ventas',                    icon: '📈' },
  { id: 'ti',            nombre: 'Tecnologia',                icon: '💻' },
  { id: 'logistica',     nombre: 'Logistica',                 icon: '🚚' },
  { id: 'produccion',    nombre: 'Produccion',                icon: '🏭' },
  { id: 'calidad',       nombre: 'Calidad',                   icon: '✅' },
  { id: 'internacional', nombre: 'Comercio Internacional',    icon: '🌎' }
];

// --- Puestos por area (ceo / admins / colaboradores) -----------------
const PUESTOS = {
  direccion: {
    ceo: ['Director General', 'CEO', 'Directora General Adjunta', 'Director de Innovacion', 'Director de Sostenibilidad'],
    admins: ['Gerente de Estrategia', 'Coordinador de Planeacion', 'Jefe de Auditoria Interna'],
    colaboradores: ['Analista Estrategico', 'Asistente Ejecutivo', 'Gestor de Proyectos', 'Analista de Inteligencia de Negocios', 'Especialista en Fusiones']
  },
  finanzas: {
    ceo: ['Director de Finanzas', 'Directora de Auditoria'],
    admins: ['Gerente de Finanzas', 'Jefe de Contabilidad', 'Coordinador de Presupuestos'],
    colaboradores: ['Analista Financiero', 'Auxiliar Contable', 'Tesorero Junior', 'Analista de Riesgos', 'Especialista en Cobranza']
  },
  operaciones: {
    ceo: ['Directora de Operaciones', 'Director de Excelencia Operativa'],
    admins: ['Gerente de Operaciones', 'Jefe de Planta', 'Coordinador de Procesos'],
    colaboradores: ['Supervisor de Turno', 'Operador de Maquina', 'Auxiliar de Operaciones', 'Planificador de Produccion', 'Analista de Tiempos']
  },
  rrhh: {
    ceo: ['Director de Talento Humano', 'Directora de Cultura Organizacional'],
    admins: ['Gerente de Recursos Humanos', 'Jefa de Reclutamiento', 'Coordinador de Nomina'],
    colaboradores: ['Reclutador', 'Analista de Nomina', 'Especialista en Capacitacion', 'Asistente de Bienestar', 'Analista de Clima Laboral']
  },
  marketing: {
    ceo: ['Director de Marketing', 'Directora de Marca'],
    admins: ['Gerente de Marca', 'Jefe de Contenido', 'Coordinador de Campanas'],
    colaboradores: ['Community Manager', 'Disenador Grafico', 'Analista de Mercado', 'Copywriter', 'Especialista en SEO']
  },
  ventas: {
    ceo: ['Director Comercial', 'Directora de Desarrollo de Negocio'],
    admins: ['Gerente de Ventas', 'Jefe de Cuentas Clave', 'Coordinador de Ventas'],
    colaboradores: ['Ejecutivo de Ventas', 'Telemarketer', 'Asesor Comercial', 'Analista de Ventas', 'Especialista en CRM']
  },
  ti: {
    ceo: ['Directora de Tecnologia', 'Director de Datos (CDO)'],
    admins: ['Gerente de TI', 'Jefe de Desarrollo', 'Coordinador de Infraestructura'],
    colaboradores: ['Desarrollador Full Stack', 'Analista de Datos', 'Tecnico de Soporte', 'Especialista en Ciberseguridad', 'Ingeniero DevOps']
  },
  logistica: {
    ceo: ['Director de Logistica', 'Directora de Cadena de Suministro'],
    admins: ['Gerente de Cadena de Suministro', 'Jefe de Almacen', 'Coordinador de Distribucion'],
    colaboradores: ['Almacenista', 'Chofer Repartidor', 'Analista de Inventarios', 'Coordinador de Rutas', 'Operador de Montacargas']
  },
  produccion: {
    ceo: ['Director de Produccion', 'Directora de Manufactura'],
    admins: ['Gerente de Manufactura', 'Supervisor de Produccion', 'Jefe de Mantenimiento'],
    colaboradores: ['Obrero de Linea', 'Operador de Empaque', 'Mecanico Industrial', 'Auxiliar de Produccion', 'Soldador']
  },
  calidad: {
    ceo: ['Director de Calidad', 'Directora de Mejora Continua'],
    admins: ['Gerente de Calidad', 'Jefe de Mejora Continua', 'Coordinador de Certificaciones'],
    colaboradores: ['Inspector de Calidad', 'Auditor Interno', 'Analista de Procesos', 'Tecnico de Laboratorio', 'Especialista en Normas ISO']
  },
  internacional: {
    ceo: ['Director de Negocios Internacionales', 'Directora de Expansion Global'],
    admins: ['Gerente de Exportaciones', 'Jefe de Comercio Exterior', 'Coordinador de Aduanas'],
    colaboradores: ['Analista de Comercio Exterior', 'Agente Aduanal', 'Coordinador de Importaciones', 'Especialista en Incoterms', 'Asistente de Exportaciones']
  }
};

// --- Generacion de atributos -----------------------------------------
// PRNG determinista (mulberry32) para que el catalogo sea siempre igual.
function crearRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERFIL_ROL = {
  ceo:         { liderazgo: 78, experiencia: 80, tecnica: 62, equipo: 70, estrategia: 84 },
  admin:       { liderazgo: 72, experiencia: 72, tecnica: 72, equipo: 78, estrategia: 70 },
  colaborador: { liderazgo: 58, experiencia: 62, tecnica: 78, equipo: 70, estrategia: 58 }
};

const TIERS = [
  { id: 'elite', offset: 16, peso: 15 },
  { id: 'alto', offset: 8, peso: 28 },
  { id: 'medio', offset: 0, peso: 35 },
  { id: 'bajo', offset: -8, peso: 17 },
  { id: 'riesgo', offset: -16, peso: 5 }
];

const RASGOS = {
  elite: [
    ['Mentor natural', 'positivo'], ['Visión global', 'positivo'],
    ['Alta iniciativa', 'positivo'], ['Resuelve conflictos', 'positivo'],
    ['Aprende rapidísimo', 'positivo'], ['Liderazgo ejemplar', 'positivo']
  ],
  alto: [
    ['Buen comunicador', 'positivo'], ['Proactivo', 'positivo'],
    ['Trabaja bien bajo presión', 'positivo'], ['Confiable', 'positivo']
  ],
  medio: [
    ['Perfil equilibrado', 'neutro'], ['Buen compañero', 'neutro'],
    ['Cumplido', 'neutro'], ['Requiere supervisión cercana', 'neutro']
  ],
  bajo: [
    ['Le cuesta delegar', 'negativo'], ['Poca tolerancia al cambio', 'negativo'],
    ['Se dispersa en equipo', 'negativo']
  ],
  riesgo: [
    ['Conflicto con la autoridad', 'negativo'], ['Alta rotación', 'negativo'],
    ['Genera rumores', 'negativo'], ['Resistente al cambio', 'negativo'],
    ['Liderazgo informal negativo', 'negativo']
  ]
};

function elegirTier(r) {
  const total = TIERS.reduce((s, t) => s + t.peso, 0);
  let x = r() * total;
  for (const t of TIERS) { if (x < t.peso) return t; x -= t.peso; }
  return TIERS[2];
}

function limitar(v) { return Math.max(30, Math.min(99, Math.round(v))); }

function generarCarta({ id, nombre, rol, area, rng }) {
  const base = PERFIL_ROL[rol];
  const tier = elegirTier(rng);
  const jitter = () => (rng() * 16 - 8);
  const atributos = {
    Liderazgo: limitar(base.liderazgo + tier.offset + jitter()),
    Experiencia: limitar(base.experiencia + tier.offset + jitter()),
    Tecnica: limitar(base.tecnica + tier.offset + jitter()),
    Equipo: limitar(base.equipo + tier.offset + jitter()),
    Estrategia: limitar(base.estrategia + tier.offset + jitter())
  };
  const valores = Object.values(atributos);
  const media = Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
  const rasgos = RASGOS[tier.id];
  const [rasgo, tipoRasgo] = rasgos[Math.floor(rng() * rasgos.length)];
  return {
    id, nombre, rol, areaId: area.id, area: area.nombre, icon: area.icon,
    tier: tier.id, atributos, media, rasgo, tipoRasgo
  };
}

function construirCatalogo() {
  const cartas = [];
  let i = 0;
  for (const area of AREAS) {
    const p = PUESTOS[area.id];
    for (const nombre of p.ceo) {
      cartas.push(generarCarta({ id: 'P' + String(++i).padStart(3, '0'), nombre, rol: 'ceo', area, rng: crearRng(1000 + i) }));
    }
    for (const nombre of p.admins) {
      cartas.push(generarCarta({ id: 'P' + String(++i).padStart(3, '0'), nombre, rol: 'admin', area, rng: crearRng(1000 + i) }));
    }
    for (const nombre of p.colaboradores) {
      cartas.push(generarCarta({ id: 'P' + String(++i).padStart(3, '0'), nombre, rol: 'colaborador', area, rng: crearRng(1000 + i) }));
    }
  }
  return cartas;
}

function contarPorRol(cartas) {
  return cartas.reduce((acc, c) => { acc[c.rol] = (acc[c.rol] || 0) + 1; return acc; }, {});
}

module.exports = {
  ECONOMIA, REGLAS_ROL, PUNTAJE, AREAS, PERFIL_ROL, TIERS,
  construirCatalogo, contarPorRol
};
