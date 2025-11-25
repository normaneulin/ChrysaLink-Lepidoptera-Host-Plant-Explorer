Deno.serve(() => new Response(JSON.stringify({ hello: "world" }), { headers: { "Content-Type": "application/json" } }))
