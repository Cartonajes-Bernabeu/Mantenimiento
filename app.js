// ─── Configuración ────────────────────────────────────────────────────────────
const HORA_INICIO = 0;   // minutos desde medianoche (0 = 00:00)
const HORA_FIN    = 1440; // 24:00

// Paleta de colores para bloques de trabajo
const COLORES_TRABAJO = [
  '#4A9EFF','#2D7DD2','#1565C0','#0D47A1',
  '#26C6DA','#00838F','#006064',
  '#66BB6A','#388E3C','#1B5E20',
  '#FFA726','#E65100',
  '#AB47BC','#6A1B9A',
  '#EF5350','#B71C1C',
  '#78909C','#37474F',
];

// ─── Estado global ─────────────────────────────────────────────────────────────
let todosLosDatos = [];
let operarioColorMap = {};
let filtroOperario = '';
let filtroMes = '';

// ─── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('datos.b64');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b64 = await res.text();
    const json = atob(b64.trim());
    todosLosDatos = JSON.parse(json);

    inicializarColores();
    poblarFiltros();
    renderizarGantt();
  } catch (e) {
    document.getElementById('gantt-container').innerHTML =
      `<p style="color:#ef5350;padding:24px">Error cargando datos: ${e.message}</p>`;
  }
});

// ─── Colores por operario ──────────────────────────────────────────────────────
function inicializarColores() {
  const operarios = [...new Set(todosLosDatos.map(r => r.op))].sort();
  operarios.forEach((op, i) => {
    operarioColorMap[op] = COLORES_TRABAJO[i % COLORES_TRABAJO.length];
  });
}

// ─── Filtros ───────────────────────────────────────────────────────────────────
function poblarFiltros() {
  const selectOp = document.getElementById('filtro-operario');
  const operarios = [...new Set(todosLosDatos.map(r => r.op))].sort();
  operarios.forEach(op => {
    const opt = document.createElement('option');
    opt.value = op;
    opt.textContent = op;
    selectOp.appendChild(opt);
  });

  selectOp.addEventListener('change', () => {
    filtroOperario = selectOp.value;
    renderizarGantt();
  });

  const inputMes = document.getElementById('filtro-mes');
  inputMes.addEventListener('change', () => {
    filtroMes = inputMes.value; // "YYYY-MM"
    renderizarGantt();
  });

  document.getElementById('btn-limpiar').addEventListener('click', () => {
    selectOp.value = '';
    inputMes.value = '';
    filtroOperario = '';
    filtroMes = '';
    renderizarGantt();
  });

  // Botón cerrar sesión (placeholder)
  document.getElementById('btn-cerrar').addEventListener('click', () => {
    alert('Sesión cerrada.');
  });

  // Botón ver hoja
  document.getElementById('btn-hoja').addEventListener('change', () => {});
}

// ─── Datos filtrados ───────────────────────────────────────────────────────────
function datosFiltrados() {
  return todosLosDatos.filter(r => {
    if (filtroOperario && r.op !== filtroOperario) return false;
    if (filtroMes && !r.dia.startsWith(filtroMes)) return false;
    return true;
  });
}

// ─── Agrupar por día y operario ───────────────────────────────────────────────
function agruparPorDia(registros) {
  const map = {};
  for (const r of registros) {
    const key = r.dia;
    if (!map[key]) map[key] = {};
    if (!map[key][r.op]) map[key][r.op] = [];
    map[key][r.op].push({ ent: r.ent, sal: r.sal });
  }
  return map;
}

// ─── Renderizado principal ────────────────────────────────────────────────────
function renderizarGantt() {
  const container = document.getElementById('gantt-container');
  const datos = datosFiltrados();

  if (datos.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay tareas que coincidan con estos filtros.</p>';
    return;
  }

  const porDia = agruparPorDia(datos);
  const dias = Object.keys(porDia).sort();

  // Construir HTML
  let html = '<div class="gantt-wrapper">';

  // Cabecera de horas
  html += buildCabeceraHoras();

  for (const dia of dias) {
    const operarios = Object.keys(porDia[dia]).sort();
    html += `<div class="gantt-grupo">`;
    html += `<div class="gantt-fecha-label">${formatearFecha(dia)}</div>`;

    for (const op of operarios) {
      const bloques = porDia[dia][op];
      const color = operarioColorMap[op] || '#4A9EFF';
      html += buildFila(op, bloques, color);
    }

    html += `</div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ─── Cabecera de horas ─────────────────────────────────────────────────────────
function buildCabeceraHoras() {
  const TOTAL_MIN = HORA_FIN - HORA_INICIO;
  let html = '<div class="gantt-cabecera"><div class="gantt-nombre-col"></div><div class="gantt-barra-col">';

  for (let h = 0; h <= 24; h += 2) {
    const pct = ((h * 60 - HORA_INICIO) / TOTAL_MIN) * 100;
    if (pct < 0 || pct > 100) continue;
    html += `<span class="hora-tick" style="left:${pct.toFixed(2)}%">${String(h).padStart(2,'0')}:00</span>`;
  }

  html += '</div></div>';
  return html;
}

// ─── Una fila de operario ──────────────────────────────────────────────────────
function buildFila(op, bloques, color) {
  const TOTAL_MIN = HORA_FIN - HORA_INICIO;
  const initials = op.split(' ').slice(0,2).map(w => w[0]).join('');

  let html = `<div class="gantt-fila">`;
  html += `<div class="gantt-nombre" title="${op}"><span class="avatar" style="background:${color}">${initials}</span>${op}</div>`;
  html += `<div class="gantt-barra-wrap">`;

  // Líneas de guía verticales (cada 2h)
  for (let h = 0; h <= 24; h += 2) {
    const pct = ((h * 60 - HORA_INICIO) / TOTAL_MIN) * 100;
    if (pct < 0 || pct > 100) continue;
    html += `<div class="grid-line" style="left:${pct.toFixed(2)}%"></div>`;
  }

  for (const b of bloques) {
    let { ent, sal } = b;
    if (sal < ent) sal = ent + 1; // sanity check
    if (sal > HORA_FIN) sal = HORA_FIN;
    if (ent < HORA_INICIO) ent = HORA_INICIO;

    const left  = ((ent - HORA_INICIO) / TOTAL_MIN) * 100;
    const width = ((sal - ent) / TOTAL_MIN) * 100;
    const dur   = sal - ent;
    const label = dur >= 30 ? `${minToHHMM(ent)}–${minToHHMM(sal)}` : '';

    html += `<div class="gantt-bloque" 
      style="left:${left.toFixed(3)}%;width:${Math.max(width,0.15).toFixed(3)}%;background:${color}"
      title="${op}\n${minToHHMM(ent)} – ${minToHHMM(sal)} (${dur} min)">
      <span class="bloque-label">${label}</span>
    </div>`;
  }

  html += `</div></div>`;
  return html;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function formatearFecha(iso) {
  const [y, m, d] = iso.split('-');
  const fecha = new Date(y, m - 1, d);
  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${diasSemana[fecha.getDay()]} ${d} ${meses[m-1]} ${y}`;
}
