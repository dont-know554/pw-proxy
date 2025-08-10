/**
 * PW x AVENGERS API Proxy Worker
 * Cloudflare Worker that proxies requests to the external PW API
 */

const BASE_API_URL = 'https://pw-api1-ab3091004643.herokuapp.com';

// 🎯 BATCH FILTERING DISABLED - All batches from API will be shown
// Previously used for server-side filtering, now commented out
/*
const ALLOWED_BATCH_IDS = [
  "6774ebb37aa1a60276d43e7c",  // neev
  "65df241600f257001881fbbd",  // udaan
  "6774f509dcc961a5430bb4ba", // uday2026
  "67a3095a0ca0d94d9c023bc9", // uday2026 - commerce
  "6773ed69073fb66bd4a9081c", // uday2026 - humanities
  "676e5677418e84037bd6247c", // arjuna neet
  "676e4dee1ec923bc192f38c9", // arjuna jee
  "6774f509fd80ba9fd582cb96", // parishram
  "65dc6fbaf5bcd500180102cd", // lakshya neet
  "65dc6fbabb55350018d555b7", // lakshya jee
  "678a0324dab28c8848cc026f", // arjuna jee 2.0
  "678a1c6c984a0ff1ae00a142", // arjuna jee 3.0
  "678a08fc872e93ccb58047b0", // arjuna neet 2.0
  "678a29372d11efb05956e1f8", // arjuna neet 3.0
  "677929e692a5a811765a3658", // umang
  "67a31ccb67ed4d0022edaa14", // parishram commerce
  "67d7b5d9da15d97e06fb22c6", // uday isc 2026
  "67beb6e665bd7b47d657bcbf", // neev 2.0
  "67be1ea9508fc4755e582d8e", // udaan 2.0
  "6789f904f69b15eb632db640", // lakshya jee 2.0
  "678a0ffe3afbca5384419b05", // lakshya neet 2.0
  "67738e4a5787b05d8ec6e07f", // prayas jee
  "67738e4c6e30ac746bcb34d7", // yakeen neet
  "65d898a774dfb200182ce11b", // udaan 2025
  "6784c47dca2bac6bb557821c", // uday nda foundation
  "67e4034e1d90a238e0186a0a", // arjuna neet weekend express
  "6774f1aa440cb58775292c6e", // udaan hindi medium
  "65ded79ac66de2001847128f", // yakeen neet 5.0
  "67fc9f296743740c0bee0208", // udaan goat
  "67becd2b508fc4755e5c5bde", // uday 2.0
  "67fc9f2953d560becbad4ba7", // neev goat
  "678a39b07764c4041763336a", // prayas jee 2.0
  "67a3116376be70372c9967de", // uday 3.0 commerce
  "67e555b89419a6e8b3ab706c", // ssb mantra
  "67be1ea98627cf3431ce4132", // udaan reloaded
  "65e2bbf5a07cbf0018f198f5", // power batch 10
  "65df1046479ea30018d33041", // udaan 3.0 2025
  "65ded9c3c66de20018471ac6", // yakeen neet 6.0
  "685cf3cd8746216a1638b4d4", // arjuna jee 2.0 hindi
  "677ba4ff2e14829a8d5ca593", // jkbose baaz 11 1.0
  "67a30b5993d3824e289b363e", // uday commerce 2.0
  "685cf3cd6e987196fab1ecc6", // lakshya jee 2.0 hindi
  "679da9537999da8c2331b4a7", // sbi po interview batch
  "", // udaan 2024
  "6718e9d32ae489ddf85c027f", // ibps rrb po intrview
];

// Search terms for efficient batch discovery (no longer used)
const SEARCH_TERMS = ['uday', 'arjuna', 'yakeen', 'lakshya', 'udaan', 'neev', 'parishram', 'umang', 'prayas', 'ibps', 'sbi', 'jkbose'];
*/

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Route handlers
const routes = {
  '/api/batches': handleBatches,
  '/api/batch': handleBatch,
  '/api/batch-content': handleBatchContent,
  '/api/todays-schedule': handleTodaysSchedule,
  '/api/topics': handleTopics,
  '/api/all-contents': handleAllContents,
  '/api/video/stream-info': handleStreamInfo,
  '/api/otp': handleOTP,
  '/api/url': handleUrl,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Find matching route
    const handler = findRouteHandler(url.pathname);
    
    if (handler) {
      try {
        return await handler(request, url, env);
      } catch (error) {
        console.error('Handler error:', error);
        return createErrorResponse('Internal server error', 500);
      }
    }

    return createErrorResponse('Not Found', 404);
  }
};

/**
 * Find the appropriate route handler for a given path
 */
function findRouteHandler(pathname) {
  // Direct match
  if (routes[pathname]) {
    return routes[pathname];
  }

  // Pattern matching for dynamic routes
  if (pathname.startsWith('/api/batch/') && pathname.includes('/subject/') && pathname.includes('/schedule/') && pathname.includes('/content')) {
    return routes['/api/batch-content'];
  }
  
  if (pathname.startsWith('/api/batch/') && pathname.includes('/todays-schedule')) {
    return routes['/api/todays-schedule'];
  }
  
  if (pathname.startsWith('/api/batch/') && pathname.includes('/subject/') && pathname.includes('/topics')) {
    return routes['/api/topics'];
  }
  
  if (pathname.startsWith('/api/batch/') && pathname.includes('/subject/') && pathname.includes('/topic/') && pathname.includes('/all-contents')) {
    return routes['/api/all-contents'];
  }
  
  if (pathname.startsWith('/api/batch/') && !pathname.includes('/subject/')) {
    return routes['/api/batch'];
  }

  return null;
}

/**
 * Generic proxy function
 */
async function proxyRequest(request, url, apiPath) {
  const apiUrl = `${BASE_API_URL}${apiPath}${url.search}`;
  
  const proxyRequest = new Request(apiUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PW-Avengers-Proxy/1.0',
    },
    body: request.method !== 'GET' ? request.body : undefined,
  });

  const response = await fetch(proxyRequest);
  const data = await response.text();
  
  return new Response(data, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Route Handlers
 */
async function handleBatches(request, url) {
  // Simply proxy the request to the original API without any filtering
  console.log('🌐 Proxying batches request - showing all batches');
  return proxyRequest(request, url, '/api/batches');
}

async function handleBatch(request, url) {
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3]; // /api/batch/{batchId}
  return proxyRequest(request, url, `/api/batch/${batchId}`);
}

async function handleBatchContent(request, url) {
  // Extract path parameters from URL like: /api/batch/{batchId}/subject/{subjectSlug}/schedule/{scheduleId}/content
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  const subjectSlug = pathParts[5];
  const scheduleId = pathParts[7];
  
  const apiPath = `/api/batch/${batchId}/subject/${subjectSlug}/schedule/${scheduleId}/content`;
  return proxyRequest(request, url, apiPath);
}

async function handleTodaysSchedule(request, url) {
  // Extract path parameters from URL like: /api/batch/{batchId}/todays-schedule
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  
  const apiPath = `/api/batch/${batchId}/todays-schedule`;
  return proxyRequest(request, url, apiPath);
}

async function handleTopics(request, url) {
  // Extract path parameters from URL like: /api/batch/{batchId}/subject/{subjectSlug}/topics
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  const subjectSlug = pathParts[5];
  
  const apiPath = `/api/batch/${batchId}/subject/${subjectSlug}/topics`;
  return proxyRequest(request, url, apiPath);
}

async function handleAllContents(request, url, env) {
  // Extract path parameters from URL like: /api/batch/{batchId}/subject/{subjectSlug}/topic/{topicId}/all-contents
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  const subjectSlug = pathParts[5];
  const topicId = pathParts[7];
  
  const searchParams = new URLSearchParams(url.search);
  const contentType = searchParams.get('type') || 'videos';
  
  // Create cache key for Supabase storage
  const cacheKey = `content_${batchId}_${subjectSlug}_${topicId}_${contentType}`;
  
  try {
    // 1. Try API first
    const apiPath = `/api/batch/${batchId}/subject/${subjectSlug}/topic/${topicId}/all-contents`;
    const apiUrl = `${BASE_API_URL}${apiPath}${url.search}`;
    
    const proxyRequest = new Request(apiUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PW-Avengers-Proxy/1.0',
      },
      body: request.method !== 'GET' ? request.body : undefined,
    });

    const response = await fetch(proxyRequest);
    
    if (response.ok) {
      const data = await response.text();
      const parsedData = JSON.parse(data);
      
      // 2. Cache successful response in Supabase
      try {
        await cacheToSupabase(env, cacheKey, {
          batch_id: batchId,
          subject_slug: subjectSlug,
          topic_id: topicId,
          content_type: contentType,
          data: parsedData,
          response_size: data.length,
          api_status: response.status
        });
        console.log(`✅ Cached content for key: ${cacheKey}`);
      } catch (cacheError) {
        console.error('⚠️ Failed to cache data:', cacheError);
      }
      
      return new Response(data, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'X-Cache-Status': 'MISS'
        },
      });
    } else {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
  } catch (error) {
    console.error(`❌ API failed for ${cacheKey}:`, error.message);
    
    // 3. API failed - check Supabase cache
    try {
      const cachedData = await getFromSupabaseCache(env, cacheKey);
      if (cachedData) {
        const age = Date.now() - new Date(cachedData.created_at).getTime();
        const ageMinutes = Math.floor(age / 1000 / 60);
        
        console.log(`✅ Serving cached data for ${cacheKey} (${ageMinutes} minutes old)`);
        
        // Increment hit count
        await incrementCacheHit(env, cacheKey);
        
        // Add cache metadata to response
        const responseData = {
          ...cachedData.data,
          _cached: true,
          _cacheAge: ageMinutes,
          _cacheTimestamp: cachedData.created_at
        };
        
        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'X-Cache-Status': 'HIT',
            'X-Cache-Age': ageMinutes.toString()
          },
        });
      }
    } catch (cacheError) {
      console.error('⚠️ Failed to read from cache:', cacheError);
    }
    
    // 4. No cache available - return error
    console.error(`❌ No cache available for ${cacheKey}`);
    return createErrorResponse(`Content not available: ${error.message}`, 503);
  }
}

async function handleStreamInfo(request, url) {
  return proxyRequest(request, url, '/api/video/stream-info');
}

async function handleOTP(request, url) {
  return proxyRequest(request, url, '/api/otp');
}

async function handleUrl(request, url) {
  return proxyRequest(request, url, '/api/url');
}

/**
 * Cache data to Supabase
 */
async function cacheToSupabase(env, cacheKey, cacheData) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  
  const response = await fetch(`${supabaseUrl}/rest/v1/content_cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      cache_key: cacheKey,
      ...cacheData,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase cache write failed: ${error}`);
  }
  
  return await response.json();
}

/**
 * Get data from Supabase cache
 */
async function getFromSupabaseCache(env, cacheKey) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  
  const response = await fetch(`${supabaseUrl}/rest/v1/content_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&expires_at=gte.${new Date().toISOString()}&select=*`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey
    }
  });
  
  if (!response.ok) {
    throw new Error(`Supabase cache read failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

/**
 * Increment cache hit count
 */
async function incrementCacheHit(env, cacheKey) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return; // Fail silently for hit counting
  }
  
  try {
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_cache_hit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        cache_key_param: cacheKey
      })
    });
  } catch (error) {
    console.error('Failed to increment cache hit:', error);
  }
}

/**
 * Create error response with CORS headers
 */
function createErrorResponse(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
