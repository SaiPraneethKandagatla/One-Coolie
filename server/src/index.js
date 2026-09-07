require('dotenv').config();

const dns = require('node:dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');

// Config & Security
const { validateEnvironment, isProduction, getAllowedOrigins } = require('./config/environment');
const { logger, requestLoggerMiddleware } = require('./utils/logger');
const requestIdMiddleware = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const productionReadinessService = require('./services/productionReadinessService');

// Validate environment on boot
const envValidation = validateEnvironment({ exitOnFailure: isProduction() });
if (!envValidation.valid) {
  logger.warn('Environment validation warning: missing non-critical or development variables', {
    missing: envValidation.missing
  });
} else {
  logger.info('Environment validated successfully for ONECOOLIE API', {
    env: process.env.NODE_ENV || 'development'
  });
}

// Routes
const authRoutes = require('./routes/authRoutes');
const trainRoutes = require('./routes/trainRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const assistantPayoutRoutes = require('./routes/assistantPayoutRoutes');
const assistantWalletRoutes = require('./routes/assistantWalletRoutes');

// Database Client
const supabase = require('./config/db');

// Controllers
const serviceController = require('./controllers/serviceController');
const payoutController = require('./controllers/payoutController');

const app = express();
const server = http.createServer(app);

// Enable reverse proxy trust for real client IP resolution & rate limit accuracy
app.set('trust proxy', 1);

// --------------------------------------------------
// SECURITY HEADERS (HELMET)
// --------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com"],
        connectSrc: ["'self'", "https://api.razorpay.com", "wss:", "ws:"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction() ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// --------------------------------------------------
// CORS
// --------------------------------------------------
const allowedOrigins = getAllowedOrigins();

const corsOriginHandler = (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl, server-to-server, health checks)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  // Allow localhost during development / staging or local operator testing
  if (!isProduction() || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return callback(null, true);
  }
  // Allow Vercel production and preview deployment origins
  if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
};

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Client-Version', 'x-razorpay-signature']
  })
);

// --------------------------------------------------
// REQUEST CORRELATION & STRUCTURED LOGGING
// --------------------------------------------------
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// --------------------------------------------------
// BODY PARSING
// --------------------------------------------------
// Razorpay Webhook requires exact raw byte buffer for HMAC signature verification (Phase 2C)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// --------------------------------------------------
// SOCKET.IO
// --------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  }
});

io.on('connection', (socket) => {
  logger.info('User connected to WebSocket', { socketId: socket.id });

  // Join booking-specific room
  socket.on('join_booking', (bookingId) => {
    if (!bookingId) return;
    socket.join(`booking_${bookingId}`);
  });

  // Join assistant-specific room for real-time wallet & payout notifications (Phase 3B)
  socket.on('join_assistant', (assistantId) => {
    if (!assistantId) return;
    socket.join(`assistant_${assistantId}`);
    socket.join(`user_${assistantId}`);
  });

  // Join admin room for real-time operations, telemetry & incident sync (Phase 5)
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });

  // Chat — broadcast to the booking room only
  socket.on('chat_message', (payload) => {
    if (!payload?.bookingId || !payload?.text) return;

    io.to(`booking_${payload.bookingId}`).emit('chat_message', {
      bookingId: payload.bookingId,
      from: payload.from || 'unknown',
      text: String(payload.text).slice(0, 1000), // cap message length
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    logger.info('User disconnected from WebSocket', { socketId: socket.id });
  });
});

// Controllers & Services Socket.IO injection
const incidentController = require('./controllers/incidentController');
const financialMonitoringService = require('./services/financialMonitoringService');

serviceController.setIO(io);
payoutController.setIO(io);
incidentController.setIO(io);
financialMonitoringService.setIO(io);

// --------------------------------------------------
// OPERATIONAL PROBES & HEALTH CHECKS
// --------------------------------------------------

// Liveness probe: returns 200 if Node.js event loop is healthy
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'onecoolie-api',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Readiness probe: verifies DB connectivity and essential infrastructure
app.get('/', (req, res) => {
  res.json({
    service: 'onecoolie-api',
    status: 'ok',
    health: '/api/health',
    emailHealth: '/api/health/email'
  });
});

app.get(['/ready', '/api/ready'], async (req, res) => {
  try {
    const report = await productionReadinessService.getProductionReadinessReport(supabase);
    const httpStatus = report.status === 'NOT_READY' ? 503 : 200;
    return res.status(httpStatus).json(report);
  } catch (err) {
    logger.error('Readiness check failed', { error: err.message });
    return res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: 'Readiness check encountered an internal error.'
    });
  }
});

app.get('/api/health/email', (req, res) => {
  res.json({
    activeProvider: process.env.BREVO_API_KEY
      ? 'Brevo (HTTPS Port 443)'
      : process.env.RESEND_API_KEY
      ? 'Resend (HTTPS Port 443)'
      : 'Gmail SMTP (Port 465)',
    hasBrevoKey: !!process.env.BREVO_API_KEY,
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasGmailUser: !!process.env.GMAIL_USER,
    gmailUser: process.env.GMAIL_USER || null,
    hasGmailPassword: !!process.env.GMAIL_APP_PASSWORD,
  });
});

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/assistants', assistantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/assistant-wallet', assistantWalletRoutes);
app.use('/api/assistant-payouts', assistantPayoutRoutes);

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    message: 'API route not found',
    path: req.originalUrl,
    requestId: req.requestId
  });
});

// --------------------------------------------------
// CENTRAL ERROR HANDLER (PHASE 6)
// --------------------------------------------------
app.use(errorHandler);

// --------------------------------------------------
// START SERVER & GRACEFUL SHUTDOWN
// --------------------------------------------------
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`OneCoolie API running on port ${PORT}`, {
      port: PORT,
      url: `http://localhost:${PORT}`,
      env: process.env.NODE_ENV || 'development'
    });
  });
}

// Graceful shutdown
let isShuttingDown = false;
const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error('Error during HTTP server shutdown', { error: err.message });
      process.exit(1);
    }
    logger.info('HTTP and WebSocket server closed cleanly.');
    process.exit(0);
  });

  // Force termination after 10 seconds if in-flight connections hang
  setTimeout(() => {
    logger.warn('Graceful shutdown timeout exceeded (10s). Forcing termination.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };