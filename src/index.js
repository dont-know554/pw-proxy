const BASE_API_URL = 'https://pw-api2-9bac5f87cf60.herokuapp.com';

// CORS headers for all responses
const CORS_HEADERS = {
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
  '/api/video-data': handleVideoData,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check if the request is coming from an allowed domain
    const origin = request.headers.get('Origin');
    const allowedOrigins = [
      'https://pwxavengers.netlify.app',
      'https://pwxavengers.xyz'
    ];
    
    // If Origin header is present and doesn't match our allowed domains, reject the request
    if (origin && !allowedOrigins.includes(origin)) {
      return createErrorResponse('Access denied: Invalid origin', 403);
    }
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Access-Control-Allow-Origin': origin || allowedOrigins[0],
        },
      });
    }

    // Find matching route
    const handler = findRouteHandler(url.pathname);
    
    if (handler) {
      try {
        const response = await handler(request, url, env);
        
        // Add the allowed origin to the response headers
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
        
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
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

async function handleVideoData(request, url) {
  // Extract query parameters
  const batchId = url.searchParams.get('batchId');
  const scheduleId = url.searchParams.get('scheduleId');
  
  // Validate required parameters
  if (!batchId || !scheduleId) {
    return createErrorResponse('Missing required parameters: batchId and scheduleId', 400);
  }
  
  // Construct the target URL with query parameters
  const targetUrl = new URL(`https://url-live-b68920287dd4.herokuapp.com/get-video-data`);
  targetUrl.searchParams.set('batchId', batchId);
  targetUrl.searchParams.set('scheduleId', scheduleId);
  
  // Proxy the request to the new API endpoint
  const apiResponse = await fetch(targetUrl.toString());
  
  // Create a new response with CORS headers
  const responseBody = await apiResponse.text();
  const responseHeaders = new Headers(apiResponse.headers);
  
  // Add CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    responseHeaders.set(key, value);
  });
  
  return new Response(responseBody, {
    status: apiResponse.status,
    headers: responseHeaders
  });
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
