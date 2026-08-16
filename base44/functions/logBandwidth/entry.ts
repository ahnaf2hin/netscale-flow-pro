import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Snapshot current PPPoE sessions grouped by router
    const sessions = await base44.asServiceRole.entities.PPPoESession.list('-last_synced', 1000);
    const onlineSessions = sessions.filter(s => s.status === 'online');

    // Group by router
    const byRouter = new Map();
    for (const s of onlineSessions) {
      const key = s.router_id || 'unknown';
      if (!byRouter.has(key)) {
        byRouter.set(key, {
          router_id: s.router_id || '',
          router_name: s.router_name || 'Unknown',
          total_download_kbps: 0,
          total_upload_kbps: 0,
          active_sessions: 0,
        });
      }
      const entry = byRouter.get(key);
      entry.total_download_kbps += s.download_speed_kbps || 0;
      entry.total_upload_kbps += s.upload_speed_kbps || 0;
      entry.active_sessions += 1;
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if already logged today
    const existing = await base44.asServiceRole.entities.BandwidthLog.filter({
      log_date: today,
    }, '-created_date', 100);

    if (existing.length > 0) {
      // Update existing logs for today
      const existingByRouter = new Map(existing.map(l => [l.router_id || 'unknown', l]));
      for (const [key, entry] of byRouter) {
        if (existingByRouter.has(key)) {
          await base44.asServiceRole.entities.BandwidthLog.update(existingByRouter.get(key).id, entry);
        } else {
          await base44.asServiceRole.entities.BandwidthLog.create({ log_date: today, ...entry });
        }
      }
    } else {
      // Create new logs
      const logs = Array.from(byRouter.values()).map(entry => ({ log_date: today, ...entry }));
      if (logs.length > 0) {
        await base44.asServiceRole.entities.BandwidthLog.bulkCreate(logs);
      } else {
        // Log zero entry so the chart has data points
        await base44.asServiceRole.entities.BandwidthLog.create({
          log_date: today,
          router_id: '',
          router_name: 'All Routers',
          total_download_kbps: 0,
          total_upload_kbps: 0,
          active_sessions: 0,
        });
      }
    }

    return Response.json({
      success: true,
      date: today,
      routers_logged: byRouter.size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});