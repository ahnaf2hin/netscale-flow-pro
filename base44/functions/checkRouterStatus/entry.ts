import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const routers = await base44.asServiceRole.entities.MikrotikRouter.list(500);
    const now = Date.now();
    const STALE_MS = 5 * 60 * 1000; // offline if no sync in last 5 minutes

    let markedOffline = 0;
    for (const router of routers) {
      const last = router.last_synced ? new Date(router.last_synced).getTime() : 0;
      const isStale = (now - last) > STALE_MS;
      if (isStale && router.status !== 'offline') {
        await base44.asServiceRole.entities.MikrotikRouter.update(router.id, { status: 'offline' });
        markedOffline++;
      }
    }

    return Response.json({
      success: true,
      total_routers: routers.length,
      marked_offline: markedOffline,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});