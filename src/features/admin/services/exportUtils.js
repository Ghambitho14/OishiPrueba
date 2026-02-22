/**
 * Genera y descarga un archivo CSV compatible con Excel (BOM + Separador punto y coma)
 * Soluciona el problema de "todo en una columna".
 * @param {Array} data - Array de objetos a exportar
 * @param {string} filename - Nombre del archivo
 */
export const downloadCSV = (data, filename = 'reporte.csv') => {
    if (!data || !data.length) {
        console.warn('No hay datos para exportar');
        return;
    }

    // 1. Obtener encabezados
    const headers = Object.keys(data[0]);
    
    // 2. Construir filas
    const csvRows = [];
    
    // Encabezado con separador ;
    csvRows.push(headers.join(';'));

    // Datos
    for (const row of data) {
        const values = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) val = '';
            // Convertir a string y escapar comillas dobles
            const stringVal = String(val).replace(/"/g, '""');
            return `"${stringVal}"`;
        });
        csvRows.push(values.join(';'));
    }

    // 3. Unir con saltos de línea y agregar BOM
    const csvString = csvRows.join('\r\n');
    const bom = '\uFEFF'; // Byte Order Mark para UTF-8
    const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
    
    // 4. Disparar descarga
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};