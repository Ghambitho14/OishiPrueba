import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/supabaseTables';
import { uploadImage } from '../../../shared/utils/cloudinary';

/**
 * Servicio Senior de Órdenes
 * Encapsula la lógica de negocio de creación de pedidos tanto para 
 * clientes (Web) como para administración (Manual).
 */
export const ordersService = {
    /**
     * Crea un pedido completo vinculándolo a un cliente (o creando uno nuevo)
     */
    async createOrder(orderData, receiptFile = null) {
        try {
            // 0. VALIDACIÓN DE CAJA (REGLA DE NEGOCIO GLOBAL)
            if (!orderData.branch_id) {
                throw new Error("El ID de sucursal es obligatorio para crear un pedido.");
            }

            const { data: openShift } = await supabase
                .from(TABLES.cash_shifts)
                .select('id')
                .eq('status', 'open')
                .eq('branch_id', orderData.branch_id)
                .maybeSingle();

            if (!openShift) {
                throw new Error("El local no está recibiendo pedidos en este momento (Caja Cerrada). Por favor verifique el horario de atención.");
            }

            // [MEJORA DE SEGURIDAD] Recalcular total para evitar manipulación de precios
            const calculatedTotal = orderData.items.reduce((sum, item) => {
                // Priorizar precio de descuento si existe y es válido
                const price = (item.has_discount && item.discount_price && Number(item.discount_price) > 0) 
                    ? Number(item.discount_price) 
                    : Number(item.price || 0);
                
                return sum + (price * (Number(item.quantity) || 1));
            }, 0);

            // Si hay una discrepancia mayor a $50 (por posibles redondeos), corregimos forzosamente
            if (Math.abs(calculatedTotal - orderData.total) > 50) {
                console.warn(`⚠️ Discrepancia de precio detectada. Recibido: ${orderData.total}, Calculado: ${calculatedTotal}. Se aplicará el calculado.`);
                orderData.total = calculatedTotal;
            }

            // 1. Subida de comprobante (si aplica). Si falla, guardamos el pedido igual.
            let receiptUrl = null;
            let receiptUploadFailed = false;
            if (orderData.payment_type === 'online' && receiptFile) {
                try {
                    receiptUrl = await uploadImage(receiptFile, 'receipts');
                } catch (uploadErr) {
                    console.warn('No se pudo subir comprobante, se guarda el pedido sin URL:', uploadErr);
                    receiptUploadFailed = true;
                }
            }

            // 2. Lógica de Cliente (Upsert)
            const clientId = await this._ensureClient(orderData);

            // 3. Inserción del Pedido
            const paymentRef = receiptUrl
                || orderData.payment_ref
                || (orderData.payment_type === 'online' ? 'Comprobante pendiente por WhatsApp' : 'Pago Presencial');

            // Agregar info de sucursal a la nota para que el admin sepa
            let finalNote = orderData.note || '';
            if (orderData.branch_name) {
                finalNote = `[Sucursal: ${orderData.branch_name}] \n${finalNote}`.trim();
            }

            const { data: newOrder, error: orderError } = await supabase
                .from(TABLES.orders)
                .insert({
                    client_id: clientId,
                    client_name: orderData.client_name,
                    client_rut: orderData.client_rut || '',
                    client_phone: orderData.client_phone,
                    items: orderData.items,
                    total: orderData.total,
                    payment_type: orderData.payment_type,
                    payment_ref: paymentRef,
                    note: finalNote,
                    status: orderData.status || 'pending',
                    branch_id: orderData.branch_id, // Add branch_id
                    company_id: orderData.company_id, // Add company_id
                    created_at: new Date().toISOString()
                })
                .select()
                .maybeSingle();

            if (orderError) throw orderError;
            return { order: newOrder, receiptUploadFailed };
        } catch (error) {
            console.error('Error in ordersService.createOrder:', error);
            throw error;
        }
    },

    /**
     * Asegura que el cliente exista y actualiza sus estadísticas
     * @private
     */
    async _ensureClient(orderData) {
        const { client_rut, client_name, client_phone, total } = orderData;
        
        // 1. Limpieza de datos
        const safePhone = (client_phone || '').trim();
        const safeRut = (client_rut || '').trim();
        const hasValidRut = safeRut.length > 6;

        if (!safePhone) throw new Error('El teléfono es obligatorio para crear un pedido');

        // 2. Buscar cliente existente por Teléfono (Identificador principal)
        const { data: existingClient, error: searchError } = await supabase
            .from(TABLES.clients)
            .select('*')
            .eq('phone', safePhone)
            .maybeSingle(); // Usamos maybeSingle para evitar error si no existe o si hay múltiples (aunque unique lo previene)

        if (searchError) {
            console.error("Error buscando cliente:", searchError);
            throw searchError;
        }

        if (existingClient) {
            // 3. Actualizar cliente existente
            const updateData = {
                name: client_name || existingClient.name,
                last_order_at: new Date().toISOString(),
                total_spent: (existingClient.total_spent || 0) + total,
                total_orders: (existingClient.total_orders || 0) + 1
            };

            // Solo actualizamos RUT si el nuevo es válido y el existente es temporal/nulo
            if (hasValidRut && (!existingClient.rut || existingClient.rut.startsWith('SIN-RUT'))) {
                updateData.rut = safeRut;
            }

            const { error: updateError } = await supabase
                .from(TABLES.clients)
                .update(updateData)
                .eq('id', existingClient.id);

            if (updateError) {
                 console.error("Error actualizando cliente:", updateError);
                 // No lanzamos error para no bloquear la venta, solo logueamos
            }
            return existingClient.id;
        } else {
            // 4. Crear nuevo cliente
            const rutToSave = hasValidRut ? safeRut : `SIN-RUT-${Date.now().toString().slice(-6)}`;
            
            // Usamos UPSERT por seguridad (en caso de condición de carrera con el teléfono)
            const { data: newClient, error: createError } = await supabase
                .from(TABLES.clients)
                .upsert({
                    name: client_name,
                    phone: safePhone,
                    rut: rutToSave,
                    total_spent: total,
                    total_orders: 1,
                    last_order_at: new Date().toISOString(),
                    company_id: orderData.company_id
                }, { onConflict: 'phone' }) // Si el teléfono ya existe, actualiza
                .select('id')
                .single();

            if (createError) {
                 // Si falla upsert, intentamos buscar de nuevo por si acaso fue creado milisegundos antes
                 if (createError.code === '23505') {
                      const { data: retryClient } = await supabase.from(TABLES.clients).select('id').eq('phone', safePhone).single();
                      if (retryClient) return retryClient.id;
                 }
                 throw createError;
            }
            return newClient.id;
        }
    }
};

// Mantener compatibilidad con exportación antigua si se requiere
export const createManualOrder = (orderData, receiptFile) => ordersService.createOrder(orderData, receiptFile);
