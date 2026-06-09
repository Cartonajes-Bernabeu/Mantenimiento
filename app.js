// Cargar Google Charts (Timeline es ideal para turnos de horas)
google.charts.load('current', {'packages':['timeline']});
let googleChartsReady = false;
google.charts.setOnLoadCallback(() => { googleChartsReady = true; });

// --- ⚙️ CONFIGURACIÓN BASADA EN TU EXCEL ⚙️ ---
const CONFIG = {
    nombreHojaActivador: "Gantt", // La pestaña que activará el gráfico en el menú
    nombreHojaDatos: "Hoja1",     // La pestaña de donde leeremos los datos reales
    filaInicioDatos: 1,           // Fila donde empiezan los datos (omitir cabecera)
    colOperario: 0,               // Col A: Nombre_Operario_Movimiento
    colFechaDia: 3,               // Col D: Fecha_Dia
    colEntradaLimpia: 5,          // Col F: Entrada_limpia (minutos)
    colSalidaLimpia: 6            // Col G: Salida_limpia (minutos)
};

let libroExcelGlobal = null;
let datosTurnosGlobal = []; 

async function desbloquearYDesencriptar() {
    const password = document.getElementById('clave').value;
    const errorMsg = document.getElementById('error-msg');
    errorMsg.classList.add('hidden');

    try {
        const response = await fetch('datos.b64');
        if (!response.ok) throw new Error("No se pudo obtener el archivo.");
        const base64Data = await response.text();

        const rawBytes = CryptoJS.enc.Base64.parse(base64Data);
        const ivBytes = CryptoJS.lib.WordArray.create(rawBytes.words.slice(0, 4));
        const encryptedBytes = CryptoJS.lib.WordArray.create(rawBytes.words.slice(4));
        const keyBytes = CryptoJS.enc.Utf8.parse(password.padEnd(32).substring(0, 32));

        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: encryptedBytes },
            keyBytes,
            { iv: ivBytes, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );

        const libroRaw = decrypted.toString(CryptoJS.enc.Latin1);
        if (!libroRaw || libroRaw.length === 0) throw new Error();

        libroExcelGlobal = XLSX.read(libroRaw, { type: 'binary' });

        const selector = document.getElementById('selector-hojas');
        selector.innerHTML = '';
        libroExcelGlobal.SheetNames.forEach(nombreHoja => {
            const opcion = document.createElement('option');
            opcion.value = nombreHoja;
            opcion.textContent = nombreHoja;
            selector.appendChild(opcion);
        });

        cambiarHoja(libroExcelGlobal.SheetNames[0]);

        document.getElementById('pantalla-bloqueo').classList.add('hidden');
        document.getElementById('contenido-web').classList.remove('hidden');
        document.body.classList.remove('items-center', 'justify-center');

    } catch (error) {
        console.error(error);
        errorMsg.classList.remove('hidden');
        document.getElementById('clave').value = "";
    }
}

function cambiarHoja(nombreHoja) {
    if (!libroExcelGlobal) return;

    const esHojaGantt = nombreHoja.toLowerCase().includes(CONFIG.nombreHojaActivador.toLowerCase());

    if (esHojaGantt) {
        // En lugar de leer la hoja visual 'Gantt', leemos los datos crudos de 'Hoja1'
        const hojaDatos = libroExcelGlobal.Sheets[CONFIG.nombreHojaDatos];
        document.getElementById('contenedor-tabla').classList.add('hidden');
        document.getElementById('contenedor-gantt').classList.remove('hidden');
        document.getElementById('filtros-gantt').classList.remove('hidden');
        
        if(hojaDatos) {
            procesarDatosDeHoja1(hojaDatos);
        } else {
            document.getElementById('chart_div').innerHTML = `<div class="text-red-500 font-bold p-4">Error: No se encontró la pestaña "${CONFIG.nombreHojaDatos}" para extraer los datos del diagrama.</div>`;
        }
    } else {
        const hojaNormal = libroExcelGlobal.Sheets[nombreHoja];
        document.getElementById('contenedor-tabla').classList.remove('hidden');
        document.getElementById('contenedor-gantt').classList.add('hidden');
        document.getElementById('filtros-gantt').classList.add('hidden');
        dibujarTablaEstandar(hojaNormal);
    }
}

// ==========================================
// MÓDULO TIMELINE (GANTT POR HORAS)
// ==========================================

function excelDateToStr(serial) {
    if (!serial) return "";
    if (typeof serial === 'string') return serial.trim().substring(0, 10);
    const utc_days  = Math.floor(serial - 25569);
    const d = new Date(utc_days * 86400 * 1000);
    return d.toISOString().split('T')[0];
}

function minutosADateJS(minutos) {
    // Transforma minutos totales (ej: 1011) en una fecha ficticia solo para pintar la hora (16:51)
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return new Date(2000, 0, 1, h, m, 0);
}

function procesarDatosDeHoja1(hoja) {
    if (!googleChartsReady) {
        setTimeout(() => procesarDatosDeHoja1(hoja), 500);
        return;
    }

    const datosJSON = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true });
    
    datosTurnosGlobal = [];
    const operariosSet = new Set();
    const fechasSet = new Set();

    for (let i = CONFIG.filaInicioDatos; i < datosJSON.length; i++) {
        const fila = datosJSON[i];
        if (!fila) continue;

        const operarioRaw = fila[CONFIG.colOperario];
        const fechaRaw = fila[CONFIG.colFechaDia];
        const minInicio = fila[CONFIG.colEntradaLimpia];
        const minFin = fila[CONFIG.colSalidaLimpia];

        if (operarioRaw && fechaRaw && typeof minInicio === 'number' && typeof minFin === 'number') {
            const operarioText = String(operarioRaw).trim();
            const fechaText = excelDateToStr(fechaRaw);
            
            // Si entra y sale en el mismo minuto exacto, le sumamos 1 minuto para que la barra se dibuje y no sea invisible
            const finAjustado = (minInicio === minFin) ? minFin + 1 : minFin;

            operariosSet.add(operarioText);
            fechasSet.add(fechaText);

            datosTurnosGlobal.push({
                operario: operarioText,
                fechaStr: fechaText,
                inicio: minutosADateJS(minInicio),
                fin: minutosADateJS(finAjustado)
            });
        }
    }

    // Rellenar desplegable Operarios
    const selectOp = document.getElementById('filtro-operario');
    selectOp.innerHTML = '<option value="TODOS">Todos los operarios</option>';
    Array.from(operariosSet).sort().forEach(op => {
        const option = document.createElement('option');
        option.value = op; option.textContent = op;
        selectOp.appendChild(option);
    });

    // Rellenar desplegable Fechas (ordenadas de más reciente a más antigua)
    const selectFecha = document.getElementById('filtro-fecha');
    selectFecha.innerHTML = '<option value="TODAS">Todas las fechas</option>';
    Array.from(fechasSet).sort().reverse().forEach(f => {
        const option = document.createElement('option');
        option.value = f; option.textContent = f;
        selectFecha.appendChild(option);
    });

    // Por defecto, preseleccionamos la fecha más reciente si existe
    if (fechasSet.size > 0) {
        selectFecha.value = Array.from(fechasSet).sort().reverse()[0];
    }

    aplicarFiltrosTimeline();
}

function aplicarFiltrosTimeline() {
    const operarioSel = document.getElementById('filtro-operario').value;
    const fechaSel = document.getElementById('filtro-fecha').value;

    const datosFiltrados = datosTurnosGlobal.filter(t => {
        const pasaOp = (operarioSel === "TODOS" || t.operario === operarioSel);
        const pasaFecha = (fechaSel === "TODAS" || t.fechaStr === fechaSel);
        return pasaOp && pasaFecha;
    });

    dibujarTimeline(datosFiltrados);
}

function dibujarTimeline(tareas) {
    const contenedor = document.getElementById('chart_div');
    
    if (tareas.length === 0) {
        contenedor.innerHTML = '<div class="text-gray-500 flex items-center justify-center h-full pt-10">No hay registros para los filtros seleccionados.</div>';
        return;
    }

    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn({ type: 'string', id: 'Operario' });
    dataTable.addColumn({ type: 'string', id: 'Turno' });
    dataTable.addColumn({ type: 'date', id: 'Inicio' });
    dataTable.addColumn({ type: 'date', id: 'Fin' });

    tareas.forEach(t => {
        // En Timeline, la primera columna es el agrupador (fila), la segunda es el tooltip/etiqueta
        dataTable.addRow([ t.operario, "Turno Activo", t.inicio, t.fin ]);
    });

    const chart = new google.visualization.Timeline(contenedor);
    
    // Altura dinámica basada en el número de operarios distintos filtrados
    const operariosUnicos = new Set(tareas.map(t => t.operario)).size;
    const alturaDinamica = Math.max(350, (operariosUnicos * 50) + 100);

    const options = {
        height: alturaDinamica,
        timeline: {
            colorByRowLabel: true,
            rowLabelStyle: { fontName: 'Inter', fontSize: 13 },
            barLabelStyle: { fontName: 'Inter', fontSize: 11 }
        },
        hAxis: {
            format: 'HH:mm' // Mostrar formato 24 horas en el eje horizontal
        }
    };

    chart.draw(dataTable, options);
}

// ==========================================
// MÓDULO TABLA ESTÁNDAR (Para Hoja1 y otras)
// ==========================================

function dibujarTablaEstandar(hoja) {
    let datosJSON = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });
    let indiceCabecera = datosJSON.findIndex(fila => {
        if (!fila) return false;
        const celdasTexto = fila.filter(c => c !== null && c !== "" && typeof c === 'string');
        return celdasTexto.length >= 3;
    });

    if (indiceCabecera === -1) {
        document.getElementById('tabla-cabecera').innerHTML = '<tr><td class="p-4 text-gray-400">No se encontró cabecera</td></tr>';
        document.getElementById('tabla-cuerpo').innerHTML = '';
        return;
    }

    datosJSON = datosJSON.slice(indiceCabecera);
    if (datosJSON.length === 0 || !datosJSON[0]) return;

    const cabeceraCruda = datosJSON[0];
    let primerIdx = cabeceraCruda.findIndex(c => c !== null && c !== "");
    if (primerIdx === -1) primerIdx = 0;
    let ultimoIdx = cabeceraCruda.length - 1;
    while (ultimoIdx >= primerIdx && (cabeceraCruda[ultimoIdx] === null || cabeceraCruda[ultimoIdx] === "")) ultimoIdx--;

    const columnas = cabeceraCruda.slice(primerIdx, ultimoIdx + 1);
    const numColumnas = columnas.length;
    const offsetDatos = primerIdx;

    const cabeceraHTML = document.getElementById('tabla-cabecera');
    let filaCabecera = `<tr style="background-color:#FFD966;">`;
    columnas.forEach(col => {
        filaCabecera += `<th style="padding:10px 16px; border:1px solid #c8a400; text-transform:uppercase; font-size:0.75rem; font-weight:700; color:#1a1a1a; white-space:nowrap;">${col || ""}</th>`;
    });
    filaCabecera += '</tr>';
    cabeceraHTML.innerHTML = filaCabecera;

    const cuerpoHTML = document.getElementById('tabla-cuerpo');
    let filasCuerpo = '';

    for (let i = 1; i < datosJSON.length; i++) {
        const filaActual = datosJSON[i];
        if (!filaActual || !filaActual.some(c => c !== null && c !== "")) continue;

        const filaRecortada = filaActual.slice(offsetDatos, offsetDatos + numColumnas);
        const primeracelda = String(filaRecortada[0] || "").toLowerCase();
        const esFilaGlobal = primeracelda.includes('global') || primeracelda.includes('total');

        const estiloFila = esFilaGlobal ? `style="background-color:#E2EFDA; border-bottom:1px solid #aed1a0;"` : `style="border-bottom: 1px solid rgba(107,114,128,0.3);"`;
        const estiloTd = esFilaGlobal ? `style="padding:10px 16px; font-size:0.875rem; white-space:nowrap; color:#1a5e1a; font-weight:600; border:1px solid #aed1a0;"` : `style="padding:10px 16px; font-size:0.875rem; white-space:nowrap; color:inherit; border:1px solid rgba(107,114,128,0.2);"`;

        filasCuerpo += `<tr ${estiloFila} class="hover-row">`;
        for (let j = 0; j < numColumnas; j++) {
            let valor = filaRecortada[j];
            if (typeof valor === 'number') {
                const redond = Math.round(valor * 100) / 100;
                valor = redond.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(redond) ? 0 : 2 });
            } else if (valor === null || valor === undefined || valor === "") {
                valor = "-";
            }
            filasCuerpo += `<td ${estiloTd}>${valor}</td>`;
        }
        filasCuerpo += '</tr>';
    }
    cuerpoHTML.innerHTML = filasCuerpo;
}