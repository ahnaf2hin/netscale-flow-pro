import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns the list of Mikrotik routers (with credentials) to a local collector agent.
// Authenticated via COLLECTOR_API_KEY — only the collector should call this.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate via api_key in the body or header
    const apiKey = req.headers.get('x-api-key') || (await req.clone().json().catch(() => ({}))).api_key;
    const expectedKey = Deno.env.get('COLLECTOR_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routers = await base44.asServiceRole.entities.MikrotikRouter.list(500);
    return Response.json({
      routers: routers.map(r => ({
        id: r.id,
        name: r.name,
        host: r.host,
        api_port: r.api_port || 8728,
        username: r.username,
        password: r.password,
        snmp_community: r.snmp_community || 'public',
        snmp_port: r.snmp_port || 161,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});