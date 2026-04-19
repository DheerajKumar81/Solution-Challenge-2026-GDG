const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API: Get all foods (optional ?status= filter) ───────
app.get('/api/foods', (req, res) => {
    const { status } = req.query;
    let rows;
    if (status) {
        rows = db.prepare('SELECT * FROM foods WHERE status = ? ORDER BY createdAt DESC').all(status);
    } else {
        rows = db.prepare('SELECT * FROM foods ORDER BY createdAt DESC').all();
    }
    res.json(rows);
});

// ─── API: Aggregated stats ────────────────────────────────
app.get('/api/stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM foods').get().c;
    const delivered = db.prepare("SELECT COUNT(*) AS c FROM foods WHERE status = 'Delivered'").get().c;

    // Parse numeric kg from quantity strings for foodSaved
    const allRows = db.prepare('SELECT quantity FROM foods').all();
    let totalKg = 0;
    for (const row of allRows) {
        const match = row.quantity.match(/([\d.]+)/);
        if (match) totalKg += parseFloat(match[1]);
    }

    res.json({
        totalEntries: total,
        totalDeliveries: delivered,
        foodSaved: Math.round(totalKg),
        pollutionReduced: Math.round(totalKg * 2.5),  // ~2.5 kg CO₂ per kg food saved
        peopleHelped: delivered * 40,                   // estimate ~40 people per delivery
    });
});

// ─── API: Create food donation ────────────────────────────
app.post('/api/foods', (req, res) => {
    const { foodType, quantity, location, time } = req.body;

    if (!foodType || !quantity || !location || !time) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const result = db.prepare(`
    INSERT INTO foods (foodType, quantity, location, time, status)
    VALUES (?, ?, ?, ?, 'Available')
  `).run(foodType, quantity, location, time);

    const newFood = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newFood);
});

// ─── API: Accept a food entry ─────────────────────────────
app.patch('/api/foods/:id/accept', (req, res) => {
    const { id } = req.params;
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(id);

    if (!food) return res.status(404).json({ error: 'Food entry not found.' });
    if (food.status !== 'Available') return res.status(400).json({ error: 'Food is no longer available.' });

    db.prepare("UPDATE foods SET status = 'Accepted' WHERE id = ?").run(id);
    const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(id);
    res.json(updated);
});

// ─── API: Mark as delivered ───────────────────────────────
app.patch('/api/foods/:id/deliver', (req, res) => {
    const { id } = req.params;
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(id);

    if (!food) return res.status(404).json({ error: 'Food entry not found.' });
    if (food.status !== 'Accepted') return res.status(400).json({ error: 'Food must be accepted before delivery.' });

    db.prepare("UPDATE foods SET status = 'Delivered' WHERE id = ?").run(id);
    const updated = db.prepare('SELECT * FROM foods WHERE id = ?').get(id);
    res.json(updated);
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Food Loop server running at http://localhost:${PORT}`);
});
