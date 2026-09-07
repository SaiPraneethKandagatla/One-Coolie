/**
 * server/src/controllers/incidentController.js
 *
 * Financial Incident Management Controller (Phase 5)
 *
 * Provides administrative oversight, investigation workflow, and audit resolution
 * for all detected financial anomalies, security incidents, and reconciliation discrepancies.
 */

const defaultSupabase = require('../config/db');

let io = null;

function setIO(ioInstance) {
  io = ioInstance;
}

function getClient(req) {
  return req.supabase || defaultSupabase;
}

function emitIncidentUpdate(incident) {
  if (!io || !incident) return;
  try {
    io.to('admin_room').emit('financial_incident_updated', {
      incidentId: incident.id,
      severity: incident.severity,
      incidentType: incident.incident_type,
      status: incident.status,
      resolvedBy: incident.resolved_by,
      updatedAt: incident.updated_at
    });
  } catch (err) {
    console.warn('Socket emit incident update error:', err.message);
  }
}

/**
 * GET /api/admin/incidents
 * Retrieves all financial incidents with filtering and pagination.
 */
exports.getIncidents = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { status, severity, incident_type, limit = 50, offset = 0 } = req.query || {};

    let query = client
      .from('financial_incidents')
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)', { count: 'exact' })
      .order('detected_at', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('status', status.toLowerCase());
    }
    if (severity && severity !== 'ALL') {
      query = query.eq('severity', severity.toLowerCase());
    }
    if (incident_type && incident_type !== 'ALL') {
      query = query.eq('incident_type', incident_type);
    }

    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    query = query.range(pageOffset, pageOffset + pageLimit - 1);

    const { data: incidents, count, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, incidents: [], total: 0 });
      }
      return res.status(500).json({ message: error.message });
    }

    res.json({
      success: true,
      incidents: incidents || [],
      total: count || (incidents ? incidents.length : 0),
      limit: pageLimit,
      offset: pageOffset
    });
  } catch (err) {
    console.error('GET INCIDENTS ERROR:', err);
    res.status(500).json({ message: 'Unable to load financial incidents.' });
  }
};

/**
 * GET /api/admin/incidents/stats
 * Aggregated counters for incident dashboard summary.
 */
exports.getIncidentStats = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { data: incidents, error } = await client
      .from('financial_incidents')
      .select('id, status, severity, resolved_at');

    if (error) {
      if (error.code === '42P01') {
        return res.json({
          success: true,
          stats: { open: 0, critical: 0, warnings: 0, resolved_today: 0, total: 0 }
        });
      }
      return res.status(500).json({ message: error.message });
    }

    const all = incidents || [];
    const openCount = all.filter((i) => i.status === 'open' || i.status === 'investigating').length;
    const criticalCount = all.filter((i) => (i.status === 'open' || i.status === 'investigating') && i.severity === 'critical').length;
    const warningCount = all.filter((i) => (i.status === 'open' || i.status === 'investigating') && i.severity === 'warning').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const resolvedToday = all.filter((i) => i.status === 'resolved' && i.resolved_at?.startsWith(todayStr)).length;

    res.json({
      success: true,
      stats: {
        open: openCount,
        critical: criticalCount,
        warnings: warningCount,
        resolved_today: resolvedToday,
        total: all.length
      }
    });
  } catch (err) {
    console.error('GET INCIDENT STATS ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve incident statistics.' });
  }
};

/**
 * GET /api/admin/incidents/:id
 * Retrieves single incident detail with full relational context.
 */
exports.getIncidentById = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { id } = req.params;

    const { data: incident, error } = await client
      .from('financial_incidents')
      .select('*, passenger:passenger_id(*), assistant:assistant_id(*), booking:booking_id(*), payment:payment_id(*), payout:payout_id(*), resolver:resolved_by(id, name, email)')
      .eq('id', id)
      .maybeSingle();

    if (error || !incident) {
      return res.status(404).json({ message: 'Financial incident not found.' });
    }

    res.json({ success: true, incident });
  } catch (err) {
    console.error('GET INCIDENT BY ID ERROR:', err);
    res.status(500).json({ message: 'Unable to load incident details.' });
  }
};

/**
 * POST /api/admin/incidents/:id/investigate
 * Moves incident status to 'investigating'.
 */
exports.investigateIncident = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { id } = req.params;

    const { data: updated, error } = await client
      .from('financial_incidents')
      .update({
        status: 'investigating',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !updated) {
      return res.status(404).json({ message: 'Incident not found or update failed.' });
    }

    emitIncidentUpdate(updated);

    res.json({
      success: true,
      message: 'Incident moved to investigating.',
      incident: updated
    });
  } catch (err) {
    console.error('INVESTIGATE INCIDENT ERROR:', err);
    res.status(500).json({ message: 'Unable to update incident.' });
  }
};

/**
 * POST /api/admin/incidents/:id/resolve
 * Resolves incident. Requires mandatory resolution_notes.
 */
exports.resolveIncident = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { id } = req.params;
    const { resolution_notes } = req.body || {};

    if (!resolution_notes || typeof resolution_notes !== 'string' || resolution_notes.trim().length < 5) {
      return res.status(400).json({
        message: 'Mandatory resolution notes required (minimum 5 characters).'
      });
    }

    const { data: updated, error } = await client
      .from('financial_incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: req.user?.id || 'admin_user',
        resolution_notes: resolution_notes.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !updated) {
      return res.status(404).json({ message: 'Incident not found or update failed.' });
    }

    emitIncidentUpdate(updated);

    res.json({
      success: true,
      message: 'Financial incident resolved successfully.',
      incident: updated
    });
  } catch (err) {
    console.error('RESOLVE INCIDENT ERROR:', err);
    res.status(500).json({ message: 'Unable to resolve incident.' });
  }
};

/**
 * POST /api/admin/incidents/:id/ignore
 * Marks incident as 'ignored' with historical audit intact.
 */
exports.ignoreIncident = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { id } = req.params;

    const { data: updated, error } = await client
      .from('financial_incidents')
      .update({
        status: 'ignored',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !updated) {
      return res.status(404).json({ message: 'Incident not found or update failed.' });
    }

    emitIncidentUpdate(updated);

    res.json({
      success: true,
      message: 'Incident marked as ignored.',
      incident: updated
    });
  } catch (err) {
    console.error('IGNORE INCIDENT ERROR:', err);
    res.status(500).json({ message: 'Unable to ignore incident.' });
  }
};

module.exports.setIO = setIO;
