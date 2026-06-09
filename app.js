// ─── Contraseña ───────────────────────────────────────────────────────────────
const PASSWORD = 'Bernabeu_2026';

// ─── Colores por operario ──────────────────────────────────────────────────────
const PALETTE = [
  '#4A9EFF','#2D7DD2','#1565C0','#0D47A1',
  '#26C6DA','#00838F','#006064',
  '#66BB6A','#388E3C','#1B5E20',
  '#FFA726','#E65100',
  '#AB47BC','#6A1B9A',
  '#EF5350','#B71C1C',
  '#78909C','#37474F',
];

// ─── Estado global ─────────────────────────────────────────────────────────────
let DATOS = null;             // { hoja1: [...], dias_por_op: {...} }
let colorMap = {};
let vista = 'panel';          // 'panel' | 'gantt'
let filtroOp = '';
let filtroMes = '';
let ganttOp = '';
let ganttDia = '';

// ─── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-login').addEventListener('click', intentarLogin);
  document.getElementById('input-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') intentarLogin();
  });
  document.getElementById('toggle-pass').addEventListener('click', () => {
    const inp = document.getElementById('input-pass');
    const btn = document.getElementById('toggle-pass');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  });
});

function intentarLogin() {
  const val = document.getElementById('input-pass').value;
  const err = document.getElementById('login-error');
  if (val === PASSWORD) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    cargarDatos();
  } else {
    err.textContent = 'Contraseña incorrecta.';
    document.getElementById('input-pass').classList.add('shake');
    setTimeout(() => document.getElementById('input-pass').classList.remove('shake'), 500);
  }
}

async function cargarDatos() {
  try {
    const res = await fetch('datos.b64');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b64 = await res.text();
    DATOS = JSON.parse(atob(b64.trim()));
    inicializarColores();
    poblarFiltrosPanel();
    poblarFiltrosGantt();
    bindNav();
    mostrarVista('panel');
  } catch (e) {
    document.getElementById('main-content').innerHTML =
      `<p style="color:#ef5350;padding:32px">Error cargando datos: ${e.message}</p>`;
  }
}

// ─── Colores ───────────────────────────────────────────────────────────────────
function inicializarColores() {
  const ops = [...new Set(DATOS.hoja1.map(r => r.op))].sort();
  ops.forEach((op, i) => colorMap[op] = PALETTE[i % PALETTE.length]);
}

// ─── Navegación ───────────────────────────────────────────────────────────────
function bindNav() {
  document.getElementById('select-hoja').addEventListener('change', e => {
    mostrarVista(e.target.value);
  });
  document.getElementById('btn-cerrar').addEventListener('click', () => {
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('input-pass').value = '';
    document.getElementById('login-error').textContent = '';
    DATOS = null;
  });
}

function mostrarVista(v) {
  vista = v;
  document.getElementById('select-hoja').value = v;
  document.getElementById('filtros-panel').style.display = v === 'panel' ? 'flex' : 'none';
  document.getElementById('filtros-gantt').style.display = v === 'gantt' ? 'flex' : 'none';
  if (v === 'panel') renderPanel();
  else renderGantt();
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA PANEL (Hoja1)
// ══════════════════════════════════════════════════════════════════════════════
function poblarFiltrosPanel() {
  const sel = document.getElementById('panel-op');
  const ops = [...new Set(DATOS.hoja1.map(r => r.op))].sort();
  ops.forEach(op => {
    const o = document.createElement('option');
    o.value = op; o.textContent = op;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { filtroOp = sel.value; renderPanel(); });

  const mes = document.getElementById('panel-mes');
  mes.addEventListener('change', () => { filtroMes = mes.value; renderPanel(); });

  document.getElementById('panel-limpiar').addEventListener('click', () => {
    sel.value = ''; mes.value = '';
    filtroOp = ''; filtroMes = '';
    renderPanel();
  });
}

function datosPanelFiltrados() {
  return DATOS.hoja1.filter(r => {
    if (filtroOp && r.op !== filtroOp) return false;
    if (filtroMes && !r.dia.startsWith(filtroMes)) return false;
    return true;
  });
}

function renderPanel() {
  const container = document.getElementById('main-content');
  const datos = datosPanelFiltrados();
  if (!datos.length) {
    container.innerHTML = '<p class="empty-msg">No hay tareas que coincidan con estos filtros.</p>';
    return;
  }
  const porDia = {};
  for (const r of datos) {
    if (!porDia[r.dia]) porDia[r.dia] = {};
    if (!porDia[r.dia][r.op]) porDia[r.dia][r.op] = [];
    porDia[r.dia][r.op].push({ ent: r.ent, sal: r.sal });
  }
  const TOTAL = 1440;
  let html = '<div class="gantt-wrapper"><div class="gantt-cabecera"><div class="gantt-nombre-col"></div><div class="gantt-barra-col">';
  for (let h = 0; h <= 24; h += 2) {
    const pct = (h * 60 / TOTAL) * 100;
    html += `<span class="hora-tick" style="left:${pct.toFixed(2)}%">${String(h).padStart(2,'0')}:00</span>`;
  }
  html += '</div></div>';

  for (const dia of Object.keys(porDia).sort()) {
    html += `<div class="gantt-grupo"><div class="gantt-fecha-label">${fmtFecha(dia)}</div>`;
    for (const op of Object.keys(porDia[dia]).sort()) {
      const color = colorMap[op] || '#4A9EFF';
      const initials = op.split(' ').slice(0,2).map(w=>w[0]).join('');
      html += `<div class="gantt-fila"><div class="gantt-nombre" title="${op}"><span class="avatar" style="background:${color}">${initials}</span>${op}</div><div class="gantt-barra-wrap">`;
      for (let h = 0; h <= 24; h += 2) {
        const pct = (h * 60 / TOTAL) * 100;
        html += `<div class="grid-line" style="left:${pct.toFixed(2)}%"></div>`;
      }
      for (const b of porDia[dia][op]) {
        let { ent, sal } = b;
        if (sal < ent) sal = ent + 1;
        sal = Math.min(sal, TOTAL); ent = Math.max(ent, 0);
        const left = (ent / TOTAL) * 100;
        const width = ((sal - ent) / TOTAL) * 100;
        const dur = sal - ent;
        const label = dur >= 30 ? `${m2t(ent)}–${m2t(sal)}` : '';
        html += `<div class="gantt-bloque" style="left:${left.toFixed(3)}%;width:${Math.max(width,0.15).toFixed(3)}%;background:${color}" title="${op}\n${m2t(ent)} – ${m2t(sal)} (${dur} min)"><span class="bloque-label">${label}</span></div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA GANTT (hoja Gantt del Excel)
// ══════════════════════════════════════════════════════════════════════════════
function poblarFiltrosGantt() {
  const selOp = document.getElementById('gantt-op');
  const selDia = document.getElementById('gantt-dia');

  const ops = Object.keys(DATOS.dias_por_op).sort();
  ops.forEach(op => {
    const o = document.createElement('option');
    o.value = op; o.textContent = op;
    selOp.appendChild(o);
  });

  function actualizarDias() {
    const op = selOp.value;
    selDia.innerHTML = '<option value="">-- Selecciona un día --</option>';
    if (op && DATOS.dias_por_op[op]) {
      DATOS.dias_por_op[op].forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = fmtFecha(d);
        selDia.appendChild(o);
      });
    }
    ganttOp = op; ganttDia = '';
    renderGantt();
  }

  selOp.addEventListener('change', actualizarDias);
  selDia.addEventListener('change', () => {
    ganttDia = selDia.value;
    renderGantt();
  });
}

function renderGantt() {
  const container = document.getElementById('main-content');

  if (!ganttOp) {
    container.innerHTML = '<p class="empty-msg">Selecciona un operario para ver su diagrama de Gantt.</p>';
    return;
  }
  if (!ganttDia) {
    container.innerHTML = '<p class="empty-msg">Selecciona un día para ver el diagrama.</p>';
    return;
  }

  // Obtener bloques del operario en ese día
  const bloques = DATOS.hoja1.filter(r => r.op === ganttOp && r.dia === ganttDia);
  const color = colorMap[ganttOp] || '#4A9EFF';

  // Construir array de 48 slots de 30 min (0–1410 min, cada 30)
  // Cada slot: minuto inicio, estado calculado
  const SLOT = 30;
  const slots = [];
  for (let m = 0; m < 1440; m += SLOT) {
    // Determinar estado: solapamiento con algún bloque de trabajo
    const enTrabajo = bloques.some(b => {
      const ent = b.ent; const sal = b.sal;
      return ent < (m + SLOT) && sal > m;
    });
    slots.push({ min: m, estado: enTrabajo ? 'Trabajo' : '---' });
  }

  const TOTAL = 1440;
  const initials = ganttOp.split(' ').slice(0,2).map(w=>w[0]).join('');

  let html = `
  <div class="gantt-detail-card">
    <div class="gantt-detail-header">
      <span class="avatar-lg" style="background:${color}">${initials}</span>
      <div>
        <div class="gantt-detail-nombre">${ganttOp}</div>
        <div class="gantt-detail-fecha">📅 ${fmtFecha(ganttDia)}</div>
      </div>
    </div>

    <div class="gantt-detail-legend">
      <span class="legend-dot" style="background:#4A9EFF"></span> Trabajo
      <span class="legend-dot parado" style="background:#ef5350;margin-left:16px"></span> Parado
      <span class="legend-dot" style="background:#2a3045;border:1px solid #3a4460;margin-left:16px"></span> Sin actividad
    </div>

    <div class="gantt-wrapper" style="margin-top:12px">
      <div class="gantt-cabecera">
        <div class="gantt-nombre-col"></div>
        <div class="gantt-barra-col">`;

  for (let h = 0; h <= 24; h += 2) {
    const pct = (h * 60 / TOTAL) * 100;
    html += `<span class="hora-tick" style="left:${pct.toFixed(2)}%">${String(h).padStart(2,'0')}:00</span>`;
  }
  html += `</div></div>`;

  // Fila de bloques visuales
  html += `<div class="gantt-grupo" style="border:none"><div class="gantt-fila">
    <div class="gantt-nombre" title="${ganttOp}"><span class="avatar" style="background:${color}">${initials}</span>${ganttOp}</div>
    <div class="gantt-barra-wrap">`;

  for (let h = 0; h <= 24; h += 2) {
    const pct = (h * 60 / TOTAL) * 100;
    html += `<div class="grid-line" style="left:${pct.toFixed(2)}%"></div>`;
  }
  for (const b of bloques) {
    let { ent, sal } = b;
    if (sal < ent) sal = ent + 1;
    sal = Math.min(sal, TOTAL); ent = Math.max(ent, 0);
    const left = (ent / TOTAL) * 100;
    const width = ((sal - ent) / TOTAL) * 100;
    const dur = sal - ent;
    html += `<div class="gantt-bloque" style="left:${left.toFixed(3)}%;width:${Math.max(width,0.15).toFixed(3)}%;background:${color}" title="${m2t(ent)} – ${m2t(sal)} (${dur} min)"></div>`;
  }
  html += `</div></div></div></div>`;

  // Tabla de slots estilo Excel
  html += `<div class="slots-section"><h3 class="slots-title">Estado por franjas de 30 minutos</h3><div class="slots-grid">`;
  for (const s of slots) {
    const h = Math.floor(s.min / 60);
    const m = s.min % 60;
    const label = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    let cls = 'slot-vacio';
    let txt = '—';
    if (s.estado === 'Trabajo') { cls = 'slot-trabajo'; txt = 'Trabajo'; }
    html += `<div class="slot-cell ${cls}"><div class="slot-hora">${label}</div><div class="slot-estado">${txt}</div></div>`;
  }
  html += `</div></div></div>`;

  container.innerHTML = html;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function m2t(min) {
  return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
}
function fmtFecha(iso) {
  const [y, m, d] = iso.split('-');
  const f = new Date(y, m-1, d);
  const ds = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const ms = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${ds[f.getDay()]} ${d} ${ms[m-1]} ${y}`;
}
