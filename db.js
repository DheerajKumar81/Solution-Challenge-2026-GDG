/* ══════════════════════════════════════════
   FOOD LOOP — Client-Side Data Layer
   Uses localStorage as the database.
   ══════════════════════════════════════════ */

const DB_KEY = 'foodloop_foods';

// ─── Seed data (runs once) ─────────────────
const SEED_DATA = [
    { id: 1, foodType: 'Biryani', quantity: '25 kg', location: 'Connaught Place, Delhi', time: '6:00 PM', status: 'Available', createdAt: '2026-04-09T12:00:00' },
    { id: 2, foodType: 'Mixed Buffet', quantity: '40 kg', location: 'Saket, Delhi', time: '8:00 PM', status: 'Available', createdAt: '2026-04-09T11:30:00' },
    { id: 3, foodType: 'Dal & Rice', quantity: '30 kg', location: 'Dwarka, Delhi', time: '7:30 PM', status: 'Accepted', createdAt: '2026-04-09T10:00:00' },
    { id: 4, foodType: 'Sweets & Snacks', quantity: '15 kg', location: 'Karol Bagh, Delhi', time: '5:00 PM', status: 'Delivered', createdAt: '2026-04-08T14:00:00' },
    { id: 5, foodType: 'Sandwiches', quantity: '10 kg', location: 'Lajpat Nagar, Delhi', time: '1:00 PM', status: 'Delivered', createdAt: '2026-04-08T09:00:00' },
    { id: 6, foodType: 'Fruit Platter', quantity: '8 kg', location: 'Hauz Khas, Delhi', time: '4:00 PM', status: 'Available', createdAt: '2026-04-09T13:00:00' },
];

function initDB() {
    if (!localStorage.getItem(DB_KEY)) {
        localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
    }
}

function getAllFoods() {
    initDB();
    return JSON.parse(localStorage.getItem(DB_KEY));
}

function getFoodsByStatus(status) {
    return getAllFoods().filter(f => f.status === status);
}

function addFood(food) {
    const foods = getAllFoods();
    const maxId = foods.reduce((max, f) => Math.max(max, f.id), 0);
    food.id = maxId + 1;
    food.status = 'Available';
    food.createdAt = new Date().toISOString();
    foods.unshift(food);  // newest first
    localStorage.setItem(DB_KEY, JSON.stringify(foods));
    return food;
}

function updateFoodStatus(id, newStatus) {
    const foods = getAllFoods();
    const idx = foods.findIndex(f => f.id === id);
    if (idx === -1) return null;
    foods[idx].status = newStatus;
    localStorage.setItem(DB_KEY, JSON.stringify(foods));
    return foods[idx];
}

function getStats() {
    const foods = getAllFoods();
    const delivered = foods.filter(f => f.status === 'Delivered').length;
    let totalKg = 0;
    for (const f of foods) {
        const m = f.quantity.match(/([\d.]+)/);
        if (m) totalKg += parseFloat(m[1]);
    }
    return {
        totalEntries: foods.length,
        totalDeliveries: delivered,
        foodSaved: Math.round(totalKg),
        pollutionReduced: Math.round(totalKg * 2.5),
        peopleHelped: delivered * 40,
    };
}
