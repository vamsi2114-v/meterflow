const express = require('express');
const router = express.Router();
const {
  getApis, createApi, getApi, updateApi, deleteApi,
  getKeys, generateKey, revokeKey, rotateKey,
} = require('../controllers/apiController');
const { protect } = require('../middleware/auth');

router.use(protect);

// API CRUD
router.route('/').get(getApis).post(createApi);
router.route('/:id').get(getApi).put(updateApi).delete(deleteApi);

// API Key management
router.route('/:id/keys').get(getKeys).post(generateKey);
router.put('/:id/keys/:keyId/revoke', revokeKey);
router.post('/:id/keys/:keyId/rotate', rotateKey);

module.exports = router;