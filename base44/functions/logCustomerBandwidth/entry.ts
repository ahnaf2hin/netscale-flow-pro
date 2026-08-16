import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all online PPPoE sessions (per-customer bandwidth snapshot)
    const sessions = await base44.asServiceRole.entities.PPPoESession.list('-last_synced', 2000);
    const onlineSessions = sessions.filter(s => s.status === 'online' && s.customer_id);

    const today = new Date().toISOString().split('T')[0];

    // Estimate daily GB from average speed:
    // kbps * 1000 / 8 = bytes/sec; * 86400 sec/day; / 1e9 = GB/day
    const kbpsToGB = (kbps) => (kbps || 0) * 1000 / 8 * 86400 / 1e9;

    // Fetch existing logs for today
    const existing = await base44.asServiceRole.entities.CustomerBandwidthLog.filter({
      log_date: today,
    }, '-created_date', 500);

    const existingByCustomer = new Map(existing.map(l => [l.customer_id, l]));

    let updated = 0;
    let created = 0;
    const seenCustomers = new Set();

    for (const s of onlineSessions) {
      seenCustomers.add(s.customer_id);
      const entry = {
        customer_id: s.customer_id,
        log_date: today,
        avg_download_kbps: s.download_speed_kbps || 0,
        avg_upload_kbps: s.upload_speed_kbps || 0,
        download_gb: kbpsToGB(s.download_speed_kbps),
        upload_gb: kbpsToGB(s.upload_speed_kbps),
      };

      const prev = existingByCustomer.get(s.customer_id);
      if (prev) {
        await base44.asServiceRole.entities.CustomerBandwidthLog.update(prev.id, entry);
        updated++;
      } else {
        await base44.asServiceRole.entities.CustomerBandwidthLog.create(entry);
        created++;
      }
    }

    return Response.json({
      success: true,
      date: today,
      sessions_logged: onlineSessions.length,
      created,
      updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});