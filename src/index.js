/**
 * PW x AVENGERS API Proxy Worker
 * Cloudflare Worker that proxies requests to the external PW API
 */

const BASE_API_URL = 'https://pw-api1-ab3091004643.herokuapp.com';

// 🎯 ALLOWED BATCH IDs - Manage batches server-side
// Add/remove batch IDs here to control which batches are shown
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

];

// Search terms for efficient batch discovery
const SEARCH_TERMS = ['uday', 'arjuna', 'yakeen', 'lakshya', 'udaan', 'neev', 'parishram', 'umang', 'prayas'];

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
        return await handler(request, url);
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
  const searchParams = new URLSearchParams(url.search);
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 50;

  try {
    let filteredBatches = [];
    
    if (query) {
      // User has a search query - search and filter
      console.log(`🔍 Searching for: "${query}"`);
      const apiUrl = `${BASE_API_URL}/api/batches?page=${page}&limit=100&q=${encodeURIComponent(query)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      // Filter results to only allowed batches
      filteredBatches = data.batches?.filter(batch => 
        ALLOWED_BATCH_IDS.includes(batch._id)
      ) || [];
      
      console.log(`📊 Found ${filteredBatches.length} allowed batches from search`);
    } else {
      // No search query - get all allowed batches efficiently
      console.log('🏠 Loading homepage batches (server-side filtering)');
      
      // Use parallel requests with search terms to find allowed batches
      const fetchPromises = SEARCH_TERMS.map(term =>
        fetch(`${BASE_API_URL}/api/batches?page=1&limit=100&q=${encodeURIComponent(term)}`)
          .then(res => res.json())
          .catch(err => {
            console.error(`❌ Error fetching batches for "${term}":`, err);
            return { batches: [] };
          })
      );
      
      // Wait for all requests to complete
      const results = await Promise.all(fetchPromises);
      const foundBatchIds = new Set();
      
      // Process results and collect allowed batches
      results.forEach(searchData => {
        if (searchData.batches) {
          searchData.batches.forEach(batch => {
            if (ALLOWED_BATCH_IDS.includes(batch._id) && !foundBatchIds.has(batch._id)) {
              filteredBatches.push(batch);
              foundBatchIds.add(batch._id);
            }
          });
        }
      });
      
      // Fallback: try broader search if we don't have enough batches
      if (filteredBatches.length < ALLOWED_BATCH_IDS.length * 0.5) {
        console.log('🔄 Trying fallback search for missing batches...');
        try {
          const fallbackResponse = await fetch(`${BASE_API_URL}/api/batches?page=1&limit=200`);
          const fallbackData = await fallbackResponse.json();
          
          fallbackData.batches?.forEach(batch => {
            if (ALLOWED_BATCH_IDS.includes(batch._id) && !foundBatchIds.has(batch._id)) {
              filteredBatches.push(batch);
              foundBatchIds.add(batch._id);
            }
          });
        } catch (fallbackErr) {
          console.error('❌ Fallback search failed:', fallbackErr);
        }
      }
      
      console.log(`✅ Server-side filtering complete: ${filteredBatches.length} batches`);
    }
    
    // Apply pagination to filtered results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBatches = filteredBatches.slice(startIndex, endIndex);
    
    // Return filtered and paginated results
    const response = {
      batches: paginatedBatches,
      totalCount: filteredBatches.length,
      page: page,
      limit: limit,
      hasMore: endIndex < filteredBatches.length,
      allowedBatchIds: ALLOWED_BATCH_IDS.length, // For debugging
      serverFiltered: true // Flag to indicate server-side filtering
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    });
    
  } catch (error) {
    console.error('❌ Error in handleBatches:', error);
    return createErrorResponse('Failed to fetch batches', 500);
  }
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

async function handleAllContents(request, url) {
  // Extract path parameters from URL like: /api/batch/{batchId}/subject/{subjectSlug}/topic/{topicId}/all-contents
  const pathParts = url.pathname.split('/');
  const batchId = pathParts[3];
  const subjectSlug = pathParts[5];
  const topicId = pathParts[7];
  
  const apiPath = `/api/batch/${batchId}/subject/${subjectSlug}/topic/${topicId}/all-contents`;
  return proxyRequest(request, url, apiPath);
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
