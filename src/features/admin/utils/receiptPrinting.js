import { formatCurrency } from '../../../shared/utils/formatters';

export const printOrderTicket = (order, branchName = 'OISHI SUSHI', logoUrl = null) => {
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) {
        alert('Permite las ventanas emergentes para imprimir');
        return;
    }

    const itemsHtml = (order.items || []).map(item => {
        // Calcular precio real considerando descuentos si existen en el item
        const price = (item.has_discount && item.discount_price > 0) 
            ? Number(item.discount_price) 
            : Number(item.price);
            
        const subtotal = price * (item.quantity || 1);

        return `
        <div class="item">
            <div class="row">
                <span class="qty">${item.quantity}</span>
                <span class="name">${item.name}</span>
                <span class="price">${formatCurrency(subtotal)}</span>
            </div>
            ${item.description ? `<div class="note">(${item.description})</div>` : ''}
        </div>
    `}).join('');

    const html = `
        <html>
        <head>
            <title>Comanda #${String(order.id || 'PRE').slice(-4)}</title>
            <style>
                @page { margin: 0; }
                body { font-family: 'Courier New', monospace; font-size: 11px; width: 100%; max-width: 300px; margin: 0; padding: 5px; color: black; background: white; line-height: 1.1; }
                .header { text-align: center; margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                .logo { width: 40px; height: auto; margin-bottom: 2px; filter: grayscale(100%); }
                .title { font-size: 14px; font-weight: bold; margin: 0; text-transform: uppercase; }
                .info { font-size: 10px; margin: 0; }
                .items { margin-top: 5px; }
                .item { margin-bottom: 3px; }
                .row { display: flex; justify-content: space-between; align-items: flex-start; }
                .qty { font-weight: bold; margin-right: 5px; min-width: 15px; }
                .name { flex: 1; font-weight: 600; }
                .price { margin-left: 5px; white-space: nowrap; font-size: 11px; }
                .note { font-size: 9px; font-style: italic; margin-left: 20px; margin-top: 0; }
                .total { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; text-align: right; font-size: 14px; font-weight: bold; }
                .order-note { margin-top: 6px; font-size: 11px; font-weight: bold; border: 1px solid #000; padding: 3px; text-align: center; }
                .footer { text-align: center; margin-top: 8px; font-size: 9px; }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                <h1 class="title">${branchName || 'OISHI SUSHI'}</h1>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                    <span class="info">${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})}</span>
                    <span class="info">#${String(order.id || 'PRE').slice(-4)}</span>
                </div>
                <p class="info" style="text-align: left; margin-top: 2px; font-weight: 600;">Cli: ${order.client_name || 'Mostrador'}</p>
            </div>
            <div class="items">${itemsHtml}</div>
            <div class="total">TOTAL: ${formatCurrency(order.total || 0)}</div>
            ${order.note ? `<div class="order-note">NOTA: ${order.note}</div>` : ''}
            <div class="footer"><p>*** COMANDA ***</p></div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { 
        printWindow.print(); 
        printWindow.close(); 
    }, 500);
};