import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase clients
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const getSupabaseClient = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to get authenticated user
async function getAuthenticatedUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// Health check endpoint
app.get("/make-server-b55216b3/health", (c) => {
  return c.json({ status: "ok" });
});

// Auth endpoints
app.post("/make-server-b55216b3/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }
    
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.log(`Signup error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }
    
    // Create user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      rating: 0,
      contributions: 0,
      createdAt: new Date().toISOString()
    });
    
    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Signup error: ${error}`);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

// Observations endpoints
app.get("/make-server-b55216b3/observations", async (c) => {
  try {
    const userId = c.req.query('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    
    let observations = await kv.getByPrefix('obs:');
    
    // Filter by userId if provided
    if (userId) {
      observations = observations.filter((obs: any) => obs.userId === userId);
    }
    
    // Sort by date descending
    observations.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Limit results
    observations = observations.slice(0, limit);
    
    // Fetch user data for each observation
    const observationsWithUsers = await Promise.all(
      observations.map(async (obs: any) => {
        const user = await kv.get(`user:${obs.userId}`);
        return {
          ...obs,
          user: user ? { id: user.id, name: user.name } : null
        };
      })
    );
    
    return c.json({ observations: observationsWithUsers });
  } catch (error) {
    console.log(`Error fetching observations: ${error}`);
    return c.json({ error: 'Failed to fetch observations' }, 500);
  }
});

app.post("/make-server-b55216b3/observations", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const data = await c.req.json();
    const { 
      lepidopteraImage, 
      lepidopteraSpecies, 
      hostPlantImage, 
      hostPlantSpecies,
      date,
      location,
      latitude,
      longitude,
      notes
    } = data;
    
    const obsId = crypto.randomUUID();
    const observation = {
      id: obsId,
      userId: user.id,
      lepidoptera: {
        image: lepidopteraImage,
        species: lepidopteraSpecies,
      },
      hostPlant: {
        image: hostPlantImage,
        species: hostPlantSpecies,
      },
      date,
      location,
      latitude,
      longitude,
      notes,
      createdAt: new Date().toISOString(),
      comments: [],
      identifications: []
    };
    
    await kv.set(`obs:${obsId}`, observation);
    
    // Update user contributions
    const userData = await kv.get(`user:${user.id}`);
    if (userData) {
      await kv.set(`user:${user.id}`, {
        ...userData,
        contributions: (userData.contributions || 0) + 1
      });
    }
    
    return c.json({ observation });
  } catch (error) {
    console.log(`Error creating observation: ${error}`);
    return c.json({ error: 'Failed to create observation' }, 500);
  }
});

app.get("/make-server-b55216b3/observations/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const observation = await kv.get(`obs:${id}`);
    
    if (!observation) {
      return c.json({ error: 'Observation not found' }, 404);
    }
    
    // Fetch user data
    const user = await kv.get(`user:${observation.userId}`);
    
    return c.json({ 
      observation: {
        ...observation,
        user: user ? { id: user.id, name: user.name, rating: user.rating } : null
      }
    });
  } catch (error) {
    console.log(`Error fetching observation: ${error}`);
    return c.json({ error: 'Failed to fetch observation' }, 500);
  }
});

// Comments endpoints
app.post("/make-server-b55216b3/observations/:id/comments", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const obsId = c.req.param('id');
    const { text } = await c.req.json();
    
    const observation = await kv.get(`obs:${obsId}`);
    if (!observation) {
      return c.json({ error: 'Observation not found' }, 404);
    }
    
    const commentId = crypto.randomUUID();
    const comment = {
      id: commentId,
      userId: user.id,
      userName: user.user_metadata?.name || 'Anonymous',
      text,
      createdAt: new Date().toISOString()
    };
    
    observation.comments = observation.comments || [];
    observation.comments.push(comment);
    
    await kv.set(`obs:${obsId}`, observation);
    
    // Create notification for observation owner
    if (observation.userId !== user.id) {
      const notifId = crypto.randomUUID();
      await kv.set(`notif:${observation.userId}:${notifId}`, {
        id: notifId,
        userId: observation.userId,
        type: 'comment',
        message: `${user.user_metadata?.name} commented on your observation`,
        observationId: obsId,
        read: false,
        createdAt: new Date().toISOString()
      });
    }
    
    return c.json({ comment });
  } catch (error) {
    console.log(`Error adding comment: ${error}`);
    return c.json({ error: 'Failed to add comment' }, 500);
  }
});

// Identifications endpoints
app.post("/make-server-b55216b3/observations/:id/identifications", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const obsId = c.req.param('id');
    const { species, type, confidence } = await c.req.json();
    
    const observation = await kv.get(`obs:${obsId}`);
    if (!observation) {
      return c.json({ error: 'Observation not found' }, 404);
    }
    
    const identId = crypto.randomUUID();
    const identification = {
      id: identId,
      userId: user.id,
      userName: user.user_metadata?.name || 'Anonymous',
      species,
      type, // 'lepidoptera' or 'hostPlant'
      confidence,
      verified: false,
      createdAt: new Date().toISOString()
    };
    
    observation.identifications = observation.identifications || [];
    observation.identifications.push(identification);
    
    await kv.set(`obs:${obsId}`, observation);
    
    // Create notification for observation owner
    if (observation.userId !== user.id) {
      const notifId = crypto.randomUUID();
      await kv.set(`notif:${observation.userId}:${notifId}`, {
        id: notifId,
        userId: observation.userId,
        type: 'identification',
        message: `${user.user_metadata?.name} suggested an identification for your observation`,
        observationId: obsId,
        read: false,
        createdAt: new Date().toISOString()
      });
    }
    
    return c.json({ identification });
  } catch (error) {
    console.log(`Error adding identification: ${error}`);
    return c.json({ error: 'Failed to add identification' }, 500);
  }
});

app.post("/make-server-b55216b3/identifications/:id/verify", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const identId = c.req.param('id');
    const { observationId } = await c.req.json();
    
    const observation = await kv.get(`obs:${observationId}`);
    if (!observation) {
      return c.json({ error: 'Observation not found' }, 404);
    }
    
    // Only observation owner can verify
    if (observation.userId !== user.id) {
      return c.json({ error: 'Only observation owner can verify' }, 403);
    }
    
    const identification = observation.identifications?.find((i: any) => i.id === identId);
    if (!identification) {
      return c.json({ error: 'Identification not found' }, 404);
    }
    
    identification.verified = true;
    await kv.set(`obs:${observationId}`, observation);
    
    // Update identifier's rating
    const identifierData = await kv.get(`user:${identification.userId}`);
    if (identifierData) {
      await kv.set(`user:${identification.userId}`, {
        ...identifierData,
        rating: (identifierData.rating || 0) + 1
      });
    }
    
    // Create notification for identifier
    const notifId = crypto.randomUUID();
    await kv.set(`notif:${identification.userId}:${notifId}`, {
      id: notifId,
      userId: identification.userId,
      type: 'verification',
      message: `Your identification was verified!`,
      observationId,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error verifying identification: ${error}`);
    return c.json({ error: 'Failed to verify identification' }, 500);
  }
});

// Species search endpoint (iNaturalist API)
app.get("/make-server-b55216b3/species/search", async (c) => {
  try {
    const query = c.req.query('q');
    const type = c.req.query('type'); // 'lepidoptera' or 'plant'
    
    if (!query) {
      return c.json({ species: [] });
    }
    
    // Call iNaturalist API
    let taxonId = type === 'lepidoptera' ? '47157' : '47126'; // Lepidoptera or Plantae
    const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(query)}&taxon_id=${taxonId}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    const species = data.results?.map((result: any) => ({
      id: result.id,
      name: result.name,
      commonName: result.preferred_common_name,
      rank: result.rank
    })) || [];
    
    return c.json({ species });
  } catch (error) {
    console.log(`Error searching species: ${error}`);
    return c.json({ error: 'Failed to search species' }, 500);
  }
});

// User profile endpoints
app.get("/make-server-b55216b3/users/:id", async (c) => {
  try {
    const userId = c.req.param('id');
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Get user's observations
    const observations = await kv.getByPrefix('obs:');
    const userObservations = observations.filter((obs: any) => obs.userId === userId);
    
    return c.json({ 
      user: {
        ...user,
        observationCount: userObservations.length
      }
    });
  } catch (error) {
    console.log(`Error fetching user profile: ${error}`);
    return c.json({ error: 'Failed to fetch user profile' }, 500);
  }
});

// Notifications endpoints
app.get("/make-server-b55216b3/notifications", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const notifications = await kv.getByPrefix(`notif:${user.id}:`);
    
    // Sort by date descending
    notifications.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ notifications });
  } catch (error) {
    console.log(`Error fetching notifications: ${error}`);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

app.post("/make-server-b55216b3/notifications/:id/read", async (c) => {
  try {
    const user = await getAuthenticatedUser(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const notifId = c.req.param('id');
    const notification = await kv.get(`notif:${user.id}:${notifId}`);
    
    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    notification.read = true;
    await kv.set(`notif:${user.id}:${notifId}`, notification);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error marking notification as read: ${error}`);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
});

// Relationship data endpoint (placeholder)
app.get("/make-server-b55216b3/relationships", async (c) => {
  try {
    const observations = await kv.getByPrefix('obs:');
    
    // Build relationship data
    const relationships: any = {};
    
    observations.forEach((obs: any) => {
      if (obs.lepidoptera?.species && obs.hostPlant?.species) {
        const key = `${obs.lepidoptera.species}::${obs.hostPlant.species}`;
        relationships[key] = (relationships[key] || 0) + 1;
      }
    });
    
    const data = Object.entries(relationships).map(([key, count]) => {
      const [lepidoptera, plant] = key.split('::');
      return { lepidoptera, plant, count };
    });
    
    return c.json({ relationships: data });
  } catch (error) {
    console.log(`Error fetching relationships: ${error}`);
    return c.json({ error: 'Failed to fetch relationships' }, 500);
  }
});

Deno.serve(app.fetch);
