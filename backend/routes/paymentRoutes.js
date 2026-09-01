const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');
const bankCtrl = require('../controllers/bankController');

router.use(protect);

router.get('/banks', bankCtrl.getBanks);
router.post('/bank-details', bankCtrl.saveBankDetails);

router.get('/usdt-address', ctrl.getUsdtAddress);
router.post('/:id/initialize', ctrl.initializePayment);
router.post('/:id/verify', ctrl.verifyPayment);
router.post('/:id/charge-mpesa', ctrl.chargeMpesa);
router.post('/:id/submit-crypto', ctrl.submitCryptoPayment);

module.exports = router;
