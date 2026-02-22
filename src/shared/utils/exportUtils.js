/**
 * Genera y descarga un archivo Excel (.xls) basado en HTML.
 * Soluciona definitivamente el problema de columnas unidas en Excel.
 * @param {Array} data - Array de objetos a exportar
 * @param {string} filename - Nombre del archivo
 */
export const downloadExcel = (data, filename = 'reporte.xls') => {
    if (!data || !data.length) {
        console.warn('No hay datos para exportar');
        return;
    }

    // 1. Obtener encabezados
    const headers = Object.keys(data[0]);
    
    // 2. Construir Tabla HTML para Excel
    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Hoja1</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body>
            <table border="1">
                <thead>
                    <tr>
                        ${headers.map(h => `<th style="background-color: #f0f0f0;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => `
                        <tr>
                            ${headers.map(h => {
                                let val = row[h];
                                if (val === null || val === undefined) val = '';
                                return `<td>${val}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    // 3. Crear Blob y Descargar
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Asegurar extensión .xls
    const finalFilename = filename.replace(/\.csv$/i, '.xls');
    link.setAttribute('download', finalFilename.endsWith('.xls') ? finalFilename : `${finalFilename}.xls`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
