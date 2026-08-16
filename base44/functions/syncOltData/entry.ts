import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { olt_id, olt_name, onus, api_key } = body;

    if (!olt_id || !onus || !Array.isArray(onus)) {
      return Response.json({ error: 'Missing olt_id or onus array' }, { status: 400 });
    }

    const expectedKey = Deno.env.get("COLLECTOR_API_KEY");
    if (expectedKey && api_key !== expectedKey) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const results = [];

    for (const onu of onus) {
      const { serial_number, pon_port, customer_id, customer_name, rx_power_dbm, tx_power_dbm, status } = onu;

      if (!serial_number) continue;

      const existing = await base44.asServiceRole.entities.ONU.filter({
        serial_number,
        olt_id,
      }, '-last_synced', 1);

      const data = {
        olt_id,
        olt_name: olt_name || '',
        pon_port: pon_port || '',
        serial_number,
        customer_id: customer_id || '',
        customer_name: customer_name || '',
        rx_power_dbm: rx_power_dbm ?? null,
        tx_power_dbm: tx_power_dbm ?? null,
        status: status || 'offline',
        last_synced: now,
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.ONU.update(existing[0].id, data);
        results.push({ serial_number, action: 'updated' });
      } else {
        await base44.asServiceRole.entities.ONU.create(data);
        results.push({ serial_number, action: 'created' });
      }
    }

    return Response.json({
      success: true,
      synced: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});