const BASE_API_URL = 'https://api.pwthor.site';

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Route handlers
const routes = {
  '/api/batches': handleBatches,
  '/api/batches/by-ids': handleBatchesByIds,
  '/api/batch': handleBatch,
  '/api/batch-content': handleBatchContent,
  '/api/todays-schedule': handleTodaysSchedule,
  '/api/topics': handleTopics,
  '/api/all-contents': handleAllContents,
  '/api/video/stream-info': handleStreamInfo,
  '/api/otp': handleOTP,
  '/api/url': handleUrl,
  '/api/video-data': handleVideoData,
  '/api/video-data-alt': handleVideoDataAlt,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check if the request is coming from an allowed domain
    const origin = request.headers.get('Origin');
    const allowedOrigins = [
      'https://pwxavengers.netlify.app',
      'https://testingavengers.netlify.app',
      'https://pwxavengers.xyz'
    ];
    
    // Log request information for debugging
    console.log('Proxy request received:', {
      url: request.url,
      method: request.method,
      origin: origin,
      userAgent: request.headers.get('User-Agent'),
      allowedOrigins: allowedOrigins
    });
    
    // If Origin header is present and doesn't match our allowed domains, reject the request
    if (origin && !allowedOrigins.includes(origin)) {
      console.log('Origin not allowed:', origin);
      return createErrorResponse(`Access denied: Invalid origin (${origin})`, 403);
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
 * Enhanced proxy function with referrer parameter fix
 */
async function proxyRequest(request, url, apiPath, env) {
  // Add referrer parameter to bypass API protection
  const urlParams = new URLSearchParams(url.search);
  if (!urlParams.has('referrer')) {
    urlParams.set('referrer', 'https://pwxavengers.netlify.app');
  }
  
  const apiUrl = `${BASE_API_URL}${apiPath}?${urlParams.toString()}`;
  
  console.log('Proxying request to:', apiUrl);
  
  // Create headers that mimic a browser request
  const headers = new Headers();
  
  // Copy safe headers from original request
  for (const [key, value] of request.headers) {
    const lowerKey = key.toLowerCase();
    if (!['host', 'content-length', 'cf-ray', 'cf-visitor', 'cf-connecting-ip'].includes(lowerKey)) {
      headers.set(key, value);
    }
  }
  
  // Set essential browser headers
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  headers.set('Accept', 'application/json, text/plain, */*');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Accept-Encoding', 'gzip, deflate, br');
  headers.set('Referer', 'https://pwxavengers.netlify.app/');
  headers.set('Origin', 'https://pwxavengers.netlify.app');
  headers.set('Connection', 'keep-alive');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Pragma', 'no-cache');
  
  try {
    const response = await fetch(apiUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' ? request.body : undefined,
      redirect: 'follow'
    });
    
    const data = await response.text();
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      console.error('API error response:', data);
      return createErrorResponse(`API returned ${response.status}: ${data}`, response.status);
    }
    
    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
    
  } catch (error) {
    console.error('Proxy request failed:', error);
    return createErrorResponse(`Proxy request failed: ${error.message}`, 502);
  }
}

/**
 * Make a Cloudflare bypass request with specific browser fingerprinting
 */
async function makeCloudflareBypassRequest(apiUrl, originalRequest, browserType = 'chrome') {
  const headers = new Headers();
  
  // Remove problematic headers
  const skipHeaders = ['host', 'content-length', 'cf-ray', 'cf-visitor', 'cf-connecting-ip'];
  
  // Copy safe headers from original request
  for (const [key, value] of originalRequest.headers) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }
  
  // Set browser-specific headers for Cloudflare bypass
  const browserConfigs = {
    chrome: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    },
    firefox: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    safari: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache'
    }
  };
  
  const config = browserConfigs[browserType] || browserConfigs.chrome;
  
  // Apply browser-specific headers
  Object.entries(config).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // Add additional bypass headers
  headers.set('Referer', BASE_API_URL);
  headers.set('Origin', BASE_API_URL);
  headers.set('Connection', 'keep-alive');
  headers.set('Upgrade-Insecure-Requests', '1');
  
  console.log(`Making ${browserType} request with headers:`, Object.fromEntries(headers));
  
  const response = await fetch(apiUrl, {
    method: originalRequest.method,
    headers: headers,
    body: originalRequest.method !== 'GET' ? originalRequest.body : undefined,
    // Add additional fetch options for bypass
    redirect: 'follow',
    credentials: 'omit'
  });
  
  const data = await response.text();
  console.log(`${browserType} response status:`, response.status);
  
  // Check if we got a Cloudflare challenge page
  if (data.includes('Checking your browser') || data.includes('cloudflare') || data.includes('cf-browser-verification')) {
    console.log('Detected Cloudflare challenge page');
    throw new Error('Cloudflare challenge detected');
  }
  
  return new Response(data, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

/**
 * Fallback direct request method
 */
async function makeDirectRequest(apiUrl, originalRequest) {
  console.log('Making direct request as fallback');
  
  const headers = new Headers(originalRequest.headers);
  
  // Remove headers that shouldn't be forwarded
  headers.delete('Host');
  headers.delete('Content-Length');
  
  const response = await fetch(apiUrl, {
    method: originalRequest.method,
    headers: headers,
    body: originalRequest.method !== 'GET' ? originalRequest.body : undefined,
  });
  
  const data = await response.text();
  
  return new Response(data, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

/**
 * Route Handlers
 */
async function handleBatches(request, url, env) {
  // Simply proxy the request to the original API without any filtering
  console.log('🌐 Proxying batches request - showing all batches');
  return proxyRequest(request, url, '/api/batches', env);
}

async function handleBatchesByIds(request, url, env) {
  // Handle fetching batches by comma-separated IDs
  const ids = url.searchParams.get('ids');
  
  if (!ids) {
    return createErrorResponse('Missing required parameter: ids', 400);
  }
  
  console.log('🔥 Fetching batches by IDs:', ids);
  
  // Proxy the request to the original API
  return proxyRequest(request, url, '/api/batches/by-ids', env);
}

async function handleBatch(request, url, env) {
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3]; // /api/batch/{batchId}
  return proxyRequest(request, url, `/api/batch/${batchId}`, env);
}

async function handleBatchContent(request, url, env) {
  // Extract path parameters from URL like: /api/batch/{batchId}/subject/{subjectSlug}/schedule/{scheduleId}/content
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  const subjectSlug = pathParts[5];
  const scheduleId = pathParts[7];
  
  const apiPath = `/api/batch/${batchId}/subject/${subjectSlug}/schedule/${scheduleId}/content`;
  return proxyRequest(request, url, apiPath, env);
}

async function handleTodaysSchedule(request, url, env) {
  // Extract path parameters from URL like: /api/batch/{batchId}/todays-schedule
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  
  const apiPath = `/api/batch/${batchId}/todays-schedule`;
  return proxyRequest(request, url, apiPath, env);
}

async function handleTopics(request, url, env) {
  // Extract path parameters from URL like: /api/batch/{batchId}/subject/{subjectSlug}/topics
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  const subjectSlug = pathParts[5];
  
  const apiPath = `/api/batch/${batchId}/subject/${subjectSlug}/topics`;
  return proxyRequest(request, url, apiPath, env);
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

async function handleStreamInfo(request, url, env) {
  return proxyRequest(request, url, '/api/video/stream-info', env);
}

async function handleOTP(request, url, env) {
  return proxyRequest(request, url, '/api/otp', env);
}

async function handleUrl(request, url, env) {
  return proxyRequest(request, url, '/api/url', env);
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
  
  // Log the target URL
  console.log('handleVideoData proxying to:', targetUrl.toString());
  
  // Proxy the request to the new API endpoint
  // Forward more headers from the original request
  const headers = new Headers(request.headers);
  
  // Remove headers that shouldn't be forwarded
  headers.delete('Host');
  headers.delete('Content-Length');
  
  // Add browser-like headers to appear more legitimate if not already present
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US,en;q=0.9');
  }
  if (!headers.has('Accept-Encoding')) {
    headers.set('Accept-Encoding', 'gzip, deflate, br');
  }
  if (!headers.has('Connection')) {
    headers.set('Connection', 'keep-alive');
  }
  
  // Log headers being sent
  console.log('handleVideoData headers:', Object.fromEntries(headers));
  
  const apiRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' ? request.body : undefined,
  });
  
  const apiResponse = await fetch(apiRequest);
  
  // Log response status
  console.log('handleVideoData response status:', apiResponse.status);
  
  // Handle 530 Cloudflare errors specifically
  if (apiResponse.status === 530) {
    console.error('Cloudflare 530 error in handleVideoData: Origin server is unreachable');
    return createErrorResponse('Origin server is unreachable. This may be due to Cloudflare blocking the connection or the origin server being down.', 530);
  }
  
  // Handle 403 errors specifically
  if (apiResponse.status === 403) {
    console.error('403 Forbidden error in handleVideoData: Access to origin server forbidden');
    return createErrorResponse('Access to origin server forbidden. This may be due to Cloudflare protection or CORS restrictions.', 403);
  }
  
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

async function handleVideoDataAlt(request, url) {
  // Extract query parameters
  const batchId = url.searchParams.get('batchId');
  const scheduleId = url.searchParams.get('scheduleId');
  
  // Validate required parameters
  if (!batchId || !scheduleId) {
    return createErrorResponse('Missing required parameters: batchId and scheduleId', 400);
  }
  
  // Construct the target URL with query parameters
  const targetUrl = new URL(`https://url-rec-4f0a3764bc8d.herokuapp.com/get-video-data`);
  targetUrl.searchParams.set('batchId', batchId);
  targetUrl.searchParams.set('scheduleId', scheduleId);
  
  // Log the target URL
  console.log('handleVideoDataAlt proxying to:', targetUrl.toString());
  
  // Proxy the request to the new API endpoint
  // Forward more headers from the original request
  const headers = new Headers(request.headers);
  
  // Remove headers that shouldn't be forwarded
  headers.delete('Host');
  headers.delete('Content-Length');
  
  // Add browser-like headers to appear more legitimate if not already present
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US,en;q=0.9');
  }
  if (!headers.has('Accept-Encoding')) {
    headers.set('Accept-Encoding', 'gzip, deflate, br');
  }
  if (!headers.has('Connection')) {
    headers.set('Connection', 'keep-alive');
  }
  
  // Log headers being sent
  console.log('handleVideoDataAlt headers:', Object.fromEntries(headers));
  
  const apiRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' ? request.body : undefined,
  });
  
  const apiResponse = await fetch(apiRequest);
  
  // Log response status
  console.log('handleVideoDataAlt response status:', apiResponse.status);
  
  // Handle 530 Cloudflare errors specifically
  if (apiResponse.status === 530) {
    console.error('Cloudflare 530 error in handleVideoDataAlt: Origin server is unreachable');
    return createErrorResponse('Origin server is unreachable. This may be due to Cloudflare blocking the connection or the origin server being down.', 530);
  }
  
  // Handle 403 errors specifically
  if (apiResponse.status === 403) {
    console.error('403 Forbidden error in handleVideoDataAlt: Access to origin server forbidden');
    return createErrorResponse('Access to origin server forbidden. This may be due to Cloudflare protection or CORS restrictions.', 403);
  }
  
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
  // For 530 errors, provide more specific information
  let errorMessage = message;
  if (status === 530) {
    errorMessage = `Cloudflare Error 530: Origin server is unreachable. ${message}`;
  }
  
  return new Response(JSON.stringify({ 
    error: errorMessage,
    status: status,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
