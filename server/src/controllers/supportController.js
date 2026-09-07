const fs = require('fs');
const path = require('path');

const TICKETS_FILE = path.join(__dirname, '..', 'data', 'support_tickets.json');

// Helper to load tickets safely
function loadTickets() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) {
      const initialTickets = [
        {
          id: 'KZJ-SUP-9102',
          assistant_id: 'sample-assistant-id',
          assistant_name: 'Sai Coolie',
          assistant_phone: '+91 98480 22338',
          station: 'KZJ',
          category: 'Luggage Assistance Dispute',
          pnr: '2489012431',
          desc: 'Passenger luggage exceeded 45kg; guidance provided for excess baggage tariff.',
          priority: 'normal',
          status: 'Resolved by Station Master',
          resolution_notes: 'Station Master issued excess luggage receipt to passenger.',
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        }
      ];
      fs.writeFileSync(TICKETS_FILE, JSON.stringify(initialTickets, null, 2));
      return initialTickets;
    }
    const raw = fs.readFileSync(TICKETS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading support tickets:', err);
    return [];
  }
}

// Helper to save tickets safely
function saveTickets(tickets) {
  try {
    const dir = path.dirname(TICKETS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving support tickets:', err);
    return false;
  }
}

// ----------------------------------------------------
// CREATE TICKET (POST /api/assistants/support-tickets)
// ----------------------------------------------------
exports.createTicket = async (req, res) => {
  try {
    const { category, pnr, description, desc, priority, station } = req.body;
    const ticketDesc = (description || desc || '').trim();

    if (!ticketDesc) {
      return res.status(400).json({ error: 'Issue description is required.' });
    }

    const stn = (station || req.user?.station_code || 'KZJ').toUpperCase();
    const id = `${stn}-SUP-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTicket = {
      id,
      assistant_id: req.user?.id || 'unknown',
      assistant_name: req.user?.name || 'On-Duty Assistant',
      assistant_phone: req.user?.phone || 'N/A',
      station: stn,
      category: category || 'Other Station Concern',
      pnr: pnr && pnr !== 'N/A' ? String(pnr).trim() : 'N/A',
      desc: ticketDesc,
      priority: priority === 'urgent' ? 'urgent' : 'normal',
      status: 'Dispatched to Station Supervisor',
      resolution_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tickets = loadTickets();
    tickets.unshift(newTicket);
    saveTickets(tickets);

    console.log(`[SUPPORT TICKET] New ticket #${id} created by ${newTicket.assistant_name} at station ${stn}`);
    return res.status(201).json(newTicket);
  } catch (err) {
    console.error('Create ticket error:', err);
    return res.status(500).json({ error: 'Failed to dispatch ticket to Station Desk.' });
  }
};

// ----------------------------------------------------
// GET ASSISTANT TICKETS (GET /api/assistants/support-tickets)
// ----------------------------------------------------
exports.getAssistantTickets = async (req, res) => {
  try {
    const assistantId = req.user?.id;
    const tickets = loadTickets();
    
    // Return tickets created by this assistant or station tickets
    const userTickets = tickets.filter(
      (t) => t.assistant_id === assistantId || t.assistant_id === 'sample-assistant-id'
    );

    return res.json(userTickets);
  } catch (err) {
    console.error('Get assistant tickets error:', err);
    return res.status(500).json({ error: 'Failed to retrieve support tickets.' });
  }
};

// ----------------------------------------------------
// GET ALL TICKETS (GET /api/admin/support-tickets)
// ----------------------------------------------------
exports.getAllTickets = async (req, res) => {
  try {
    const { station, status, priority, q } = req.query;
    let tickets = loadTickets();

    if (station && station !== 'ALL') {
      tickets = tickets.filter((t) => t.station === station);
    }
    if (status && status !== 'ALL') {
      tickets = tickets.filter((t) => t.status === status);
    }
    if (priority && priority !== 'ALL') {
      tickets = tickets.filter((t) => t.priority === priority);
    }
    if (q) {
      const query = q.toLowerCase();
      tickets = tickets.filter(
        (t) =>
          t.id.toLowerCase().includes(query) ||
          (t.pnr && t.pnr.toLowerCase().includes(query)) ||
          t.assistant_name.toLowerCase().includes(query) ||
          t.desc.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }

    return res.json(tickets);
  } catch (err) {
    console.error('Get all tickets error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tickets for Admin.' });
  }
};

// ----------------------------------------------------
// UPDATE TICKET STATUS (PATCH /api/admin/support-tickets/:id)
// ----------------------------------------------------
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;

    const tickets = loadTickets();
    const index = tickets.findIndex((t) => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    if (status) {
      tickets[index].status = status;
    }
    if (resolution_notes !== undefined) {
      tickets[index].resolution_notes = resolution_notes;
    }
    tickets[index].updated_at = new Date().toISOString();

    saveTickets(tickets);

    console.log(`[SUPPORT TICKET] Ticket #${id} status updated to "${tickets[index].status}" by Admin.`);
    return res.json(tickets[index]);
  } catch (err) {
    console.error('Update ticket error:', err);
    return res.status(500).json({ error: 'Failed to update ticket status.' });
  }
};
