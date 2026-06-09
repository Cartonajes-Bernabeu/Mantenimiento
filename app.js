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
let DATOS = null;
let colorMap = {};
let vista = 'panel';
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
    err.textContent = '';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    inicializarApp();
  } else {
    err.textContent = 'Contraseña incorrecta.';
    const inp = document.getElementById('input-pass');
    inp.classList.remove('shake');
    void inp.offsetWidth;
    inp.classList.add('shake');
  }
}

function inicializarApp() {
  try {
    // DATOS_B64 viene definida en datos.js (cargado como <script>)
    if (typeof DATOS_B64 === 'undefined') {
      throw new Error('datos.js no está cargado correctamente.');
    }
    const json = atob(DATOS_B64);
    DATOS = JSON.parse(json);
    inicializarColores();
    poblarFiltrosPanel();
    poblarFiltrosGantt();
    bindNav();
    mostrarVista('panel');
  } catch (e) {
    document.getElementById('main-content').innerHTML =
      `<p style="color:#ef5350;padding:32px;font-size:0.95rem">❌ Error inicializando: ${e.message}</p>`;
    document.getElementById('app').style.display = 'block';
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
    // reset estado
    filtroOp = ''; filtroMes = ''; ganttOp = ''; ganttDia = '';
    document.getElementById('panel-op').value = '';
    document.getElementById('panel-mes').value = '';
    document.getElementById('gantt-op').value = '';
    document.getElementById('gantt-dia').innerHTML = '<option value="">-- Selecciona un día --</option>';
  });
}

function mostrarVista(v) {
  vista = v;
  document.getElementById('select-hoja').value = v;
  document.getElementById('filtros-panel').style.display = v === 'panel' ? 'flex' : 'none';
  document.getElementById('filtros-gantt').style.display = v === 'gantt'  ? 'flex' : 'none';
  if (v === 'panel') renderPanel();
  else renderGantt();
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA PANEL
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
    if (filtroOp  && r.op  !== filtroOp)            return false;
    if (filtroMes && !r.dia.startsWith(filtroMes))  return false;
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

  // Agrupar por día → operario
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
      const initials = op.split(',')[0].trim().split(' ').map(w => w[0]).join('').slice(0,2);
      html += `<div class="gantt-fila">
        <div class="gantt-nombre" title="${op}">
          <span class="avatar" style="background:${color}">${initials}</span>${op}
        </div>
        <div class="gantt-barra-wrap">`;

      for (let h = 0; h <= 24; h += 2) {
        const pct = (h * 60 / TOTAL) * 100;
        html += `<div class="grid-line" style="left:${pct.toFixed(2)}%"></div>`;
      }
      for (const b of porDia[dia][op]) {
        let { ent, sal } = b;
        if (sal < ent) sal = ent + 1;
        sal = Math.min(sal, TOTAL); ent = Math.max(ent, 0);
        const left  = (ent / TOTAL) * 100;
        const width = ((sal - ent) / TOTAL) * 100;
        const dur   = sal - ent;
        const label = dur >= 30 ? `${m2t(ent)}–${m2t(sal)}` : '';
        html += `<div class="gantt-bloque"
          style="left:${left.toFixed(3)}%;width:${Math.max(width,0.15).toFixed(3)}%;background:${color}"
          title="${op}\n${m2t(ent)} – ${m2t(sal)} (${dur} min)">
          <span class="bloque-label">${label}</span>
        </div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════════
// VISTA GANTT (por operario + día)
// ══════════════════════════════════════════════════════════════════════════════
function poblarFiltrosGantt() {
  const selOp  = document.getElementById('gantt-op');
  const selDia = document.getElementById('gantt-dia');

  const ops = Object.keys(DATOS.dias_por_op).sort();
  ops.forEach(op => {
    const o = document.createElement('option');
    o.value = op; o.textContent = op;
    selOp.appendChild(o);
  });

  selOp.addEventListener('change', () => {
    ganttOp = selOp.value;
    ganttDia = '';
    selDia.innerHTML = '<option value="">-- Selecciona un día --</option>';
    if (ganttOp && DATOS.dias_por_op[ganttOp]) {
      DATOS.dias_por_op[ganttOp].forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = fmtFecha(d);
        selDia.appendChild(o);
      });
    }
    renderGantt();
  });

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

  const bloques = DATOS.hoja1.filter(r => r.op === ganttOp && r.dia === ganttDia);
  const color   = colorMap[ganttOp] || '#4A9EFF';
  const initials = ganttOp.split(',')[0].trim().split(' ').map(w => w[0]).join('').slice(0,2);
  const TOTAL   = 1440;

  // Calcular slots de 30 min
  const slots = [];
  for (let m = 0; m < 1440; m += 30) {
    const activo = bloques.some(b => b.ent < (m + 30) && b.sal > m);
    slots.push({ min: m, activo });
  }

  // Estadísticas
  let totalMin = 0;
  for (const b of bloques) totalMin += Math.max(0, b.sal - b.ent);
  const horas = Math.floor(totalMin / 60);
  const mins  = totalMin % 60;

  let html = `<div class="gantt-detail-card">
    <div class="gantt-detail-header">
      <span class="avatar-lg" style="background:${color}">${initials}</span>
      <div>
        <div class="gantt-detail-nombre">${ganttOp}</div>
        <div class="gantt-detail-fecha">📅 ${fmtFecha(ganttDia)}</div>
        <div class="gantt-detail-stats">⏱ ${horas}h ${mins}m trabajados · ${bloques.length} movimientos</div>
      </div>
    </div>

    <div class="gantt-detail-legend">
      <span class="legend-dot" style="background:${color}"></span> Trabajo &nbsp;&nbsp;
      <span class="legend-dot" style="background:#2a3045;border:1px solid #3a4460"></span> Sin actividad
    </div>`;

  // Barra visual
  html += `<div class="gantt-wrapper" style="margin-top:14px">
    <div class="gantt-cabecera">
      <div class="gantt-nombre-col"></div>
      <div class="gantt-barra-col">`;
  for (let h = 0; h <= 24; h += 2) {
    const pct = (h * 60 / TOTAL) * 100;
    html += `<span class="hora-tick" style="left:${pct.toFixed(2)}%">${String(h).padStart(2,'0')}:00</span>`;
  }
  html += `</div></div>
    <div class="gantt-grupo" style="border:none">
      <div class="gantt-fila">
        <div class="gantt-nombre"><span class="avatar" style="background:${color}">${initials}</span>${ganttOp}</div>
        <div class="gantt-barra-wrap">`;

  for (let h = 0; h <= 24; h += 2) {
    const pct = (h * 60 / TOTAL) * 100;
    html += `<div class="grid-line" style="left:${pct.toFixed(2)}%"></div>`;
  }
  for (const b of bloques) {
    let { ent, sal } = b;
    if (sal < ent) sal = ent + 1;
    sal = Math.min(sal, TOTAL); ent = Math.max(ent, 0);
    const left  = (ent / TOTAL) * 100;
    const width = ((sal - ent) / TOTAL) * 100;
    const dur   = sal - ent;
    html += `<div class="gantt-bloque"
      style="left:${left.toFixed(3)}%;width:${Math.max(width,0.15).toFixed(3)}%;background:${color}"
      title="${m2t(ent)} – ${m2t(sal)} (${dur} min)"></div>`;
  }
  html += `</div></div></div></div>`;

  // Tabla de slots
  html += `<div class="slots-section">
    <h3 class="slots-title">Estado por franjas de 30 minutos</h3>
    <div class="slots-grid">`;
  for (const s of slots) {
    const label = m2t(s.min);
    const cls   = s.activo ? 'slot-trabajo' : 'slot-vacio';
    const txt   = s.activo ? 'Trabajo' : '—';
    html += `<div class="slot-cell ${cls}">
      <div class="slot-hora">${label}</div>
      <div class="slot-estado">${txt}</div>
    </div>`;
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
  const f  = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
  const ds = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const ms = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${ds[f.getDay()]} ${parseInt(d)} ${ms[parseInt(m)-1]} ${y}`;
}
