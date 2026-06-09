// Cargar Google Charts
google.charts.load('current', {'packages':['gantt']});
let googleChartsReady = false;
google.charts.setOnLoadCallback(() => { googleChartsReady = true; });

// --- ⚙️ CONFIGURACIÓN DEL GANTT ⚙️ ---
// Modifica esto para que coincida con la hoja donde guardas la LISTA de tareas
const CONFIG = {
    nombreHojaGantt: "Gantt", // El nombre EXACTO de la pestaña que contiene los datos del Gantt
    filaInicioDatos: 1,       // Fila donde empiezan los datos reales (0 es fila 1, 1 es fila 2...)
    colTarea: 0,              // Columna A (Nombre de la tarea)
    colOperario: 1,           // Columna B (Nombre del Operario)
    colInicio: 2,             // Columna C (Fecha Inicio)
    colFin: 3                 // Columna D (Fecha Fin)
};
// ------------------------------------

let libroExcelGlobal = null;
let datosGanttGlobal = []; // Almacenará todas las tareas extraídas

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

    const hoja = libroExcelGlobal.Sheets[nombreHoja];
    const esHojaGantt = nombreHoja.toLowerCase().includes(CONFIG.nombreHojaGantt.toLowerCase());

    if (esHojaGantt) {
        // --- MODO GANTT ---
        document.getElementById('contenedor-tabla').classList.add('hidden');
        document.getElementById('contenedor-gantt').classList.remove('hidden');
        document.getElementById('filtros-gantt').classList.remove('hidden');
        procesarDatosGantt(hoja);
    } else {
        // --- MODO TABLA NORMAL ---
        document.getElementById('contenedor-tabla').classList.remove('hidden');
        document.getElementById('contenedor-gantt').classList.add('hidden');
        document.getElementById('filtros-gantt').classList.add('hidden');
        dibujarTablaEstandar(hoja);
    }
}

// ==========================================
// MÓDULO GANTT
// ==========================================

function excelToJSDate(serial) {
    if (!serial || isNaN(serial)) return null;
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

function procesarDatosGantt(hoja) {
    if (!googleChartsReady) {
        setTimeout(() => procesarDatosGantt(hoja), 500);
        return;
    }

    // Leemos usando raw:true para obtener las fechas como números seriales de Excel (muy preciso)
    const datosJSON = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, raw: true });
    
    datosGanttGlobal = [];
    const operariosSet = new Set();

    for (let i = CONFIG.filaInicioDatos; i < datosJSON.length; i++) {
        const fila = datosJSON[i];
        if (!fila) continue;

        const tareaRaw = fila[CONFIG.colTarea];
        const operarioRaw = fila[CONFIG.colOperario];
        let inicioDate = typeof fila[CONFIG.colInicio] === 'number' ? excelToJSDate(fila[CONFIG.colInicio]) : null;
        let finDate = typeof fila[CONFIG.colFin] === 'number' ? excelToJSDate(fila[CONFIG.colFin]) : null;

        // Validar que tengamos los datos mínimos para dibujar
        if (tareaRaw && inicioDate && finDate) {
            const operarioText = (operarioRaw || "Sin asignar").toString().trim();
            operariosSet.add(operarioText);

            datosGanttGlobal.push({
                id: `T${i}`,
                tarea: String(tareaRaw),
                operario: operarioText,
                inicio: inicioDate,
                fin: finDate
            });
        }
    }

    // Rellenar desplegable de operarios
    const selectOp = document.getElementById('filtro-operario');
    selectOp.innerHTML = '<option value="TODOS">Todos los operarios</option>';
    Array.from(operariosSet).sort().forEach(op => {
        const option = document.createElement('option');
        option.value = op;
        option.textContent = op;
        selectOp.appendChild(option);
    });

    aplicarFiltrosGantt();
}

function limpiarFiltros() {
    document.getElementById('filtro-operario').value = "TODOS";
    document.getElementById('filtro-fecha').value = "";
    aplicarFiltrosGantt();
}

function aplicarFiltrosGantt() {
    const operarioSeleccionado = document.getElementById('filtro-operario').value;
    const mesSeleccionado = document.getElementById('filtro-fecha').value; // Formato YYYY-MM

    // Filtrar la base de datos
    const tareasFiltradas = datosGanttGlobal.filter(t => {
        let pasaOperario = true;
        let pasaFecha = true;

        if (operarioSeleccionado !== "TODOS" && t.operario !== operarioSeleccionado) {
            pasaOperario = false;
        }

        if (mesSeleccionado) {
            const [anoStr, mesStr] = mesSeleccionado.split('-');
            const ano = parseInt(anoStr);
            const mes = parseInt(mesStr) - 1; // JS meses van de 0 a 11
            
            // La tarea se muestra si empieza o termina en ese mes, o si cruza ese mes
            const inicioMes = new Date(ano, mes, 1);
            const finMes = new Date(ano, mes + 1, 0);
            
            if (t.fin < inicioMes || t.inicio > finMes) {
                pasaFecha = false;
            }
        }

        return pasaOperario && pasaFecha;
    });

    dibujarGraficoGantt(tareasFiltradas);
}

function dibujarGraficoGantt(tareas) {
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Task ID');
    data.addColumn('string', 'Tarea');
    data.addColumn('string', 'Operario');
    data.addColumn('date', 'Start Date');
    data.addColumn('date', 'End Date');
    data.addColumn('number', 'Duration');
    data.addColumn('number', 'Percent Complete');
    data.addColumn('string', 'Dependencies');

    tareas.forEach(t => {
        data.addRow([
            t.id, 
            t.tarea, 
            t.operario, 
            t.inicio, 
            t.fin, 
            null, // Duration (calculado auto)
            100,  // Porcentaje (fijo visual)
            null  // Dependencias
        ]);
    });

    const chart = new google.visualization.Gantt(document.getElementById('chart_div'));
    
    if (tareas.length === 0) {
        document.getElementById('chart_div').innerHTML = '<div class="text-gray-500 flex items-center justify-center h-full">No hay tareas que coincidan con estos filtros.</div>';
        return;
    }

    // Calcula el alto dinámicamente según cantidad de tareas
    const alturaDinamica = Math.max(450, tareas.length * 42 + 50);

    const options = {
        height: alturaDinamica,
        gantt: {
            trackHeight: 30,
            barHeight: 20,
            labelStyle: { fontName: 'Inter', fontSize: 13, color: '#333' }
        }
    };

    chart.draw(data, options);
}

// ==========================================
// MÓDULO TABLA ESTÁNDAR (El que ya tenías)
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