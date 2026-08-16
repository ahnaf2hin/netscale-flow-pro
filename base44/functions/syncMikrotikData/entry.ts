import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This endpoint receives data from the local collector agent
    // The collector authenticates using the app's service token
    const body = await req.json();
    const { router_id, router_name, sessions, vlans, system_info, api_key } = body;

    // Validate required fields
    if (!router_id || !sessions || !Array.isArray(sessions)) {
      return Response.json({ error: 'Missing router_id or sessions array' }, { status: 400 });
    }

    // Validate API key (set COLLECTOR_API_KEY in environment variables)
    const expectedKey = Deno.env.get("COLLECTOR_API_KEY");
    if (expectedKey && api_key !== expectedKey) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const results = [];

    // Mark this router as online and record its last sync time
    try {
      await base44.asServiceRole.entities.MikrotikRouter.update(router_id, {
        status: 'online',
        last_synced: now,
        ...(system_info || {}),
      });
    } catch (e) {
      // Router record may not exist yet (collector pushing for unregistered router)
    }

    for (const session of sessions) {
      const { pppoe_username, customer_id, customer_name, ip_address, download_bytes, upload_bytes, uptime, status } = session;

      if (!pppoe_username) continue;

      // Try to find existing session by pppoe_username and router_id
      const existing = await base44.asServiceRole.entities.PPPoESession.filter({
        pppoe_username,
        router_id,
      }, '-last_synced', 1);

      // Compute live speed from byte delta since last sync (same method as managePppoe)
      const prevDl = existing.length > 0 ? (existing[0].download_bytes || 0) : 0;
      const prevUl = existing.length > 0 ? (existing[0].upload_bytes || 0) : 0;
      const prevSynced = existing.length > 0 && existing[0].last_synced ? new Date(existing[0].last_synced).getTime() : Date.now();
      const secs = (Date.now() - prevSynced) / 1000;
      const speedDl = secs > 0 ? Math.max(0, Math.round(((download_bytes || 0) - prevDl) / 1024 / secs)) : 0;
      const speedUl = secs > 0 ? Math.max(0, Math.round(((upload_bytes || 0) - prevUl) / 1024 / secs)) : 0;

      const data = {
        customer_id: customer_id || '',
        customer_name: customer_name || '',
        router_id,
        router_name: router_name || '',
        pppoe_username,
        ip_address: ip_address || '',
        download_bytes: download_bytes || 0,
        upload_bytes: upload_bytes || 0,
        download_speed_kbps: speedDl,
        upload_speed_kbps: speedUl,
        uptime: uptime || '',
        status: status || 'offline',
        last_synced: now,
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.PPPoESession.update(existing[0].id, data);
        results.push({ pppoe_username, action: 'updated' });
      } else {
        await base44.asServiceRole.entities.PPPoESession.create(data);
        results.push({ pppoe_username, action: 'created' });
      }
    }

    // Sync VLAN interface traffic if provided
    if (Array.isArray(vlans)) {
      for (const vlan of vlans) {
        const { vlan_id, vlan_name, tx_kbps, rx_kbps } = vlan;
        if (!vlan_id) continue;
        const existingV = await base44.asServiceRole.entities.VlanTraffic.filter({
          router_id,
          vlan_id,
        }, '-last_synced', 1);

        const vData = {
          router_id,
          router_name: router_name || '',
          vlan_id,
          vlan_name: vlan_name || '',
          tx_kbps: tx_kbps || 0,
          rx_kbps: rx_kbps || 0,
          last_synced: now,
        };

        if (existingV.length > 0) {
          await base44.asServiceRole.entities.VlanTraffic.update(existingV[0].id, vData);
        } else {
          await base44.asServiceRole.entities.VlanTraffic.create(vData);
        }
      }
    }

    // Also check for pending commands for this router
    const pendingCommands = await base44.asServiceRole.entities.CommandQueue.filter({
      router_id,
      status: 'pending',
    }, '-created_date', 50);

    return Response.json({ 
      success: true, 
      synced: results.length,
      results,
      pending_commands: pendingCommands,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});