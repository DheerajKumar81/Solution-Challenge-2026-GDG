const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'foodloop.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// ─── Create table ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS foods (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    foodType    TEXT    NOT NULL,
    quantity    TEXT    NOT NULL,
    location    TEXT    NOT NULL,
    time        TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'Available',
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Seed sample data on first run ────────────────────────
const count = db.prepare('SELECT COUNT(*) AS c FROM foods').get().c;
if (count === 0) {
    const insert = db.prepare(`
    INSERT INTO foods (foodType, quantity, location, time, status, createdAt)
    VALUES (@foodType, @quantity, @location, @time, @status, @createdAt)
  `);

    const seeds = [
        { foodType: 'Biryani', quantity: '25 kg', location: 'Connaught Place, Delhi', time: '6:00 PM', status: 'Available', createdAt: '2026-04-09 12:00:00' },
        { foodType: 'Mixed Buffet', quantity: '40 kg', location: 'Saket, Delhi', time: '8:00 PM', status: 'Available', createdAt: '2026-04-09 11:30:00' },
        { foodType: 'Dal & Rice', quantity: '30 kg', location: 'Dwarka, Delhi', time: '7:30 PM', status: 'Accepted', createdAt: '2026-04-09 10:00:00' },
        { foodType: 'Sweets & Snacks', quantity: '15 kg', location: 'Karol Bagh, Delhi', time: '5:00 PM', status: 'Delivered', createdAt: '2026-04-08 14:00:00' },
        { foodType: 'Sandwiches', quantity: '10 kg', location: 'Lajpat Nagar, Delhi', time: '1:00 PM', status: 'Delivered', createdAt: '2026-04-08 09:00:00' },
        { foodType: 'Fruit Platter', quantity: '8 kg', location: 'Hauz Khas, Delhi', time: '4:00 PM', status: 'Available', createdAt: '2026-04-09 13:00:00' },
    ];

    const insertMany = db.transaction((rows) => {
        for (const row of rows) insert.run(row);
    });
    insertMany(seeds);
    console.log('✅ Database seeded with sample food entries.');
}

module.exports = db;
