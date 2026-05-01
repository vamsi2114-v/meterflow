const https = require('https');
const http = require('http');
const { URL } = require('url');
const Api = require('../models/Api');

// @route ALL /gateway/:apiId/*
// Validates key (done by middleware), then proxies request to the real API
exports.proxyRequest = async (req, res) => {
  try {
    const { apiId } = req.params;
    const api = await Api.findById(apiId);

    if (!api || !api.isActive) {
      return res.status(404).json({ success: false, message: 'API not found or inactive' });
    }

    // Build target URL
    const subPath = req.params[0] || '';
    const targetUrl = new URL(subPath, api.baseUrl.endsWith('/') ? api.baseUrl : api.baseUrl + '/');

    // Forward query params (excluding api_key)
    Object.entries(req.query).forEach(([k, v]) => {
      if (k !== 'api_key') targetUrl.searchParams.set(k, v);
    });

    const protocol = targetUrl.protocol === 'https:' ? https : http;

    // Properly remove internal headers instead of setting to undefined
    const forwardHeaders = { ...req.headers, host: targetUrl.hostname }
    delete forwardHeaders['x-api-key']
    delete forwardHeaders['authorization']

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: forwardHeaders,
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      Object.entries(proxyRes.headers).forEach(([k, v]) => res.setHeader(k, v));
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.status(502).json({ success: false, message: 'Bad gateway — upstream API unreachable' });
    });

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};