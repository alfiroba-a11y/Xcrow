const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const ctrl = require('../controllers/adminController');

// Admin login is its own endpoint (no public registration for admins).
router.post('/login', authCtrl.adminLogin);

router.use(protect, requireAdmin);

router.get('/overview', ctrl.getOverview);

router.get('/users', ctrl.listUsers);
router.patch('/users/:id/toggle-active', ctrl.toggleUserActive);

router.get('/escrows', ctrl.listEscrows);
router.post('/escrows/:id/refund', ctrl.refundEscrow);
router.post('/escrows/:id/approve-payout', ctrl.approvePayout);
router.post('/escrows/:id/confirm-crypto', ctrl.confirmCryptoPayment);

router.get('/tickets', ctrl.listTickets);
router.post('/tickets/:id/reply', ctrl.replyToTicketAsAdmin);

module.exports = router;
