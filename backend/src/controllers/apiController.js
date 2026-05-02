const Api = require('../models/Api');
const ApiKey = require('../models/ApiKey');
const redis = require('../config/redis');

// @route GET /api/apis
exports.getApis = async (req, res) => {
  try {
    const apis = await Api.find({ userId: req.user._id });
    res.json({ success: true, count: apis.length, data: apis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/apis
exports.createApi = async (req, res) => {
  try {
    const { name, description, baseUrl, pricing } = req.body;
    const api = await Api.create({ userId: req.user._id, name, description, baseUrl, pricing });
    res.status(201).json({ success: true, data: api });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/apis/:id
exports.getApi = async (req, res) => {
  try {
    const api = await Api.findOne({ _id: req.params.id, userId: req.user._id });
    if (!api) return res.status(404).json({ success: false, message: 'API not found' });
    res.json({ success: true, data: api });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/apis/:id
exports.updateApi = async (req, res) => {
  try {
    const api = await Api.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!api) return res.status(404).json({ success: false, message: 'API not found' });
    res.json({ success: true, data: api });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route DELETE /api/apis/:id
exports.deleteApi = async (req, res) => {
  try {
    const api = await Api.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!api) return res.status(404).json({ success: false, message: 'API not found' });
    await ApiKey.updateMany({ apiId: req.params.id }, { status: 'revoked' });
    res.json({ success: true, message: 'API deleted and all keys revoked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── API KEY MANAGEMENT ──────────────────────────────────────────

// @route GET /api/apis/:id/keys
exports.getKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ apiId: req.params.id, userId: req.user._id });
    res.json({ success: true, count: keys.length, data: keys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/apis/:id/keys
exports.generateKey = async (req, res) => {
  try {
    const api = await Api.findOne({ _id: req.params.id, userId: req.user._id });
    if (!api) return res.status(404).json({ success: false, message: 'API not found' });

    const key = await ApiKey.create({
      apiId: req.params.id,
      userId: req.user._id,
      name: req.body.name || 'Default Key',
      rateLimit: req.body.rateLimit || 60,
    });

    res.status(201).json({ success: true, data: key });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/apis/:id/keys/:keyId/revoke
exports.revokeKey = async (req, res) => {
  try {
    const key = await ApiKey.findOneAndUpdate(
      { _id: req.params.keyId, userId: req.user._id },
      { status: 'revoked' },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, message: 'Key not found' });

    // Invalidate Redis cache
    await redis.del(`apikey:${key.key}`);

    res.json({ success: true, message: 'Key revoked', data: key });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/apis/:id/keys/:keyId/rotate
exports.rotateKey = async (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const key = await ApiKey.findOne({ _id: req.params.keyId, userId: req.user._id });
    if (!key) return res.status(404).json({ success: false, message: 'Key not found' });

    // Delete old Redis cache
    await redis.del(`apikey:${key.key}`);

    // Generate new key value
    key.key = `mf_${uuidv4().replace(/-/g, '')}`;
    key.status = 'active';
    await key.save();

    res.json({ success: true, message: 'Key rotated', data: key });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};