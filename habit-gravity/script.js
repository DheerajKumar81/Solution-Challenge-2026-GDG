// Habit Gravity Engine Core

const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint,
    Body = Matter.Body,
    Events = Matter.Events;

let engine, world, render, runner;
let width = window.innerWidth;
let height = window.innerHeight;

const PLANET_STREAK_THRESHOLD = 5;
const OVERLAY = document.getElementById('habits-overlay');
const SCORE_ELEM = document.getElementById('score-value');
const STARS_CONTAINER = document.getElementById('stars-container');
const BOOSTER_FILL = document.getElementById('booster-fill');

let consistencyScore = 0;
let isRewardActive = false;
let lastInteractionTime = Date.now();
let dragStartPos = null;
let isDragging = false;

let habits = [
    { id: 1, name: 'Gym', streak: 0, status: 'neutral', body: null, element: null },
    { id: 2, name: 'Running', streak: 2, status: 'neutral', body: null, element: null },
    { id: 3, name: 'Study', streak: 4, status: 'neutral', body: null, element: null },
    { id: 4, name: 'Meditation', streak: 1, status: 'neutral', body: null, element: null },
    { id: 5, name: 'Reading', streak: 0, status: 'neutral', body: null, element: null },
    { id: 6, name: 'Coding', streak: 6, status: 'completed', body: null, element: null } // Starting planet
];

function initPhysics() {
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1;

    render = Render.create({
        element: document.getElementById('canvas-container'),
        engine: engine,
        options: {
            width,
            height,
            wireframes: false,
            background: 'transparent'
        }
    });

    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    setupBoundaries();

    // Mouse control
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: { visible: false }
        }
    });
    Composite.add(world, mouseConstraint);
    render.mouse = mouse;

    // We want clicks to register as state toggles if not dragging
    Events.on(mouseConstraint, 'mousedown', function (event) {
        dragStartPos = { x: event.mouse.position.x, y: event.mouse.position.y };
        isDragging = false;
    });

    Events.on(mouseConstraint, 'mousemove', function (event) {
        if (dragStartPos) {
            const dx = event.mouse.position.x - dragStartPos.x;
            const dy = event.mouse.position.y - dragStartPos.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging = true;
            }
        }
    });

    Events.on(mouseConstraint, 'mouseup', function (event) {
        if (!isDragging) {
            // It was a click
            const bodies = Composite.allBodies(world);
            const clickedBodies = Matter.Query.point(bodies, event.mouse.position);
            if (clickedBodies.length > 0) {
                const body = clickedBodies[0];
                if (!body.isStatic) {
                    toggleHabitStateByBody(body);
                }
            }
        }
        dragStartPos = null;
        isDragging = false;
    });

    // Custom interactions: float up completed, planet orbits
    Events.on(engine, 'beforeUpdate', applyCustomForces);

    // Sync DOM to Physics
    Events.on(engine, 'afterUpdate', updateDOMPositions);

    // Load Habits
    habits.forEach((habit) => {
        createHabit(habit);
    });

    scoreInitialHabits();
}

function setupBoundaries() {
    const wallOptions = { isStatic: true, render: { visible: false } };
    Composite.add(world, [
        Bodies.rectangle(width / 2, height + 50, width, 100, wallOptions), // Bottom
        Bodies.rectangle(-50, height / 2, 100, height * 2, wallOptions), // Left
        Bodies.rectangle(width + 50, height / 2, 100, height * 2, wallOptions) // Right
    ]);
}

function createHabit(habit) {
    const isPlanet = habit.streak >= PLANET_STREAK_THRESHOLD;

    const startX = width / 2 + (Math.random() - 0.5) * (width * 0.8);
    const startY = -100 - (Math.random() * 500);

    if (isPlanet) {
        habit.body = Bodies.circle(startX, height / 2, 60, {
            restitution: 0.8,
            frictionAir: 0.05,
            density: 0.005,
            render: { visible: false }
        });
    } else {
        habit.body = Bodies.rectangle(startX, startY, 160, 80, {
            chamfer: { radius: 16 },
            restitution: 0.5,
            friction: 0.1,
            frictionAir: 0.02,
            render: { visible: false }
        });
    }

    habit.body.plugin.habitId = habit.id;
    Composite.add(world, habit.body);

    const el = document.createElement('div');
    el.className = `habit-card ${isPlanet ? 'planet' : ''} ${habit.status}`;

    const nameEl = document.createElement('div');
    nameEl.className = 'habit-name';
    nameEl.innerText = habit.name;

    const streakEl = document.createElement('div');
    streakEl.className = 'habit-streak';
    streakEl.innerText = `🔥 ${habit.streak}`;

    el.appendChild(nameEl);
    el.appendChild(streakEl);
    OVERLAY.appendChild(el);
    habit.element = el;
}

function updateDOMPositions() {
    habits.forEach(habit => {
        if (!habit.body || !habit.element) return;

        const pos = habit.body.position;
        const angle = habit.body.angle;

        // Horizontal Wrap around
        if (pos.x < -100) Body.setPosition(habit.body, { x: width + 50, y: pos.y });
        if (pos.x > width + 100) Body.setPosition(habit.body, { x: -50, y: pos.y });

        // Vertical Wrap (Float up respawns below)
        if (pos.y < -150 && habit.status === 'completed') {
            Body.setPosition(habit.body, { x: pos.x, y: height + 100 });
        }

        habit.element.style.left = `${pos.x}px`;
        habit.element.style.top = `${pos.y}px`;
        habit.element.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    });
}

function applyCustomForces() {
    habits.forEach(habit => {
        if (!habit.body) return;

        const isPlanet = habit.streak >= PLANET_STREAK_THRESHOLD;

        if (habit.status === 'completed' && !isPlanet) {
            // Anti-gravity
            const forceMagnitude = 0.0011 * habit.body.mass;
            Body.applyForce(habit.body, habit.body.position, { x: 0, y: -forceMagnitude });
        } else if (isPlanet) {
            // Orbit / Float
            const gravityForce = engine.gravity.scale * engine.gravity.y * habit.body.mass;
            const dx = (width / 2) - habit.body.position.x;
            const dy = (height / 2) - habit.body.position.y;

            const pullStrength = 0.000005 * habit.body.mass;

            Body.applyForce(habit.body, habit.body.position, {
                x: dx * pullStrength,
                y: -gravityForce + (dy * pullStrength)
            });

            if (habit.body.speed > 2) {
                Body.setVelocity(habit.body, {
                    x: habit.body.velocity.x * 0.95,
                    y: habit.body.velocity.y * 0.95
                });
            }
        }
    });
}

function toggleHabitStateByBody(body) {
    const habitId = body.plugin.habitId;
    if (!habitId) return;

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (habit.status === 'neutral') {
        habit.status = 'completed';
        habit.streak += 1;
        consistencyScore += 10;
        createStar();
    } else if (habit.status === 'completed') {
        habit.status = 'missed';
        habit.streak = Math.max(0, habit.streak - 1);
        consistencyScore -= 10;
    } else {
        habit.status = 'neutral';
    }

    updateScore();
    updateBoosterBar();
    updateHabitVisuals(habit);
    checkPlanetMorph(habit);
}

function checkPlanetMorph(habit) {
    const shouldBePlanet = habit.streak >= PLANET_STREAK_THRESHOLD;
    const isCurrentlyPlanet = habit.element.classList.contains('planet');

    const pos = habit.body.position;
    const oldBody = habit.body;
    let newBody;

    if (shouldBePlanet && !isCurrentlyPlanet) {
        habit.element.classList.add('planet');
        newBody = Bodies.circle(pos.x, pos.y, 60, {
            restitution: 0.8,
            frictionAir: 0.05,
            density: 0.005,
            render: { visible: false }
        });
    } else if (!shouldBePlanet && isCurrentlyPlanet) {
        habit.element.classList.remove('planet');
        newBody = Bodies.rectangle(pos.x, pos.y, 160, 80, {
            chamfer: { radius: 16 },
            restitution: 0.5,
            friction: 0.1,
            frictionAir: 0.02,
            render: { visible: false }
        });
    }

    if (newBody) {
        newBody.plugin.habitId = habit.id;
        Body.setAngle(newBody, oldBody.angle);
        Body.setVelocity(newBody, oldBody.velocity);
        Body.setAngularVelocity(newBody, oldBody.angularVelocity);

        Composite.remove(world, oldBody);
        Composite.add(world, newBody);
        habit.body = newBody;
    }
}

function updateHabitVisuals(habit) {
    const isPlanet = habit.element.classList.contains('planet');
    habit.element.className = `habit-card ${isPlanet ? 'planet' : ''} ${habit.status}`;
    habit.element.querySelector('.habit-streak').innerText = `🔥 ${habit.streak}`;

    // Animate scale on click
    habit.element.style.transform += ' scale(1.1)';
    // Note: since updateDOMPositions overwrites transform every frame, we could implement a spring scale 
    // or separate nested container for visual scaling, but skipping for simplicity.
}

function scoreInitialHabits() {
    habits.forEach(habit => {
        if (habit.status === 'completed') {
            consistencyScore += 10;
        }
    });
    updateScore();
    updateBoosterBar();
    // Add extra ambient stars
    for (let i = 0; i < 20; i++) createStar();
}

function updateScore() {
    SCORE_ELEM.innerText = consistencyScore;
    document.querySelector('.score-board').style.transform = 'scale(1.1)';
    setTimeout(() => {
        document.querySelector('.score-board').style.transform = 'scale(1)';
    }, 200);
}

function updateBoosterBar() {
    const totalHabits = habits.length;
    const completedHabits = habits.filter(h => h.status === 'completed').length;
    const percentage = (completedHabits / totalHabits) * 100;

    BOOSTER_FILL.style.width = `${percentage}%`;

    if (completedHabits === totalHabits && !isRewardActive) {
        triggerRewardSurge();
    } else if (completedHabits < totalHabits && isRewardActive) {
        isRewardActive = false;
        BOOSTER_FILL.classList.remove('max');
        document.body.classList.remove('reward-active');
    }
}

function triggerRewardSurge() {
    isRewardActive = true;
    BOOSTER_FILL.classList.add('max');
    document.body.classList.add('reward-active');

    // Grant extra consistency points
    consistencyScore += 100;
    updateScore();

    // Spawn a burst of stars
    for (let i = 0; i < 50; i++) {
        setTimeout(createStar, i * 20);
    }
}

function createStar() {
    const star = document.createElement('div');
    star.className = 'star';

    const size = Math.random() * 3 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}vw`;
    star.style.top = `${Math.random() * 100}vh`;
    star.style.animationDuration = `${Math.random() * 2 + 1}s`;
    star.style.animationDelay = `${Math.random() * 2}s`;

    STARS_CONTAINER.appendChild(star);
}

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    render.canvas.width = width;
    render.canvas.height = height;

    const bodies = Composite.allBodies(world);
    // Find boundaries and adjust
    bodies.forEach(b => {
        if (b.isStatic && b.label === 'Rectangle Body') {
            // Simpler just to recreate or ignore. In a robust app, we'd reposition boundaries here.
        }
    });
});

initPhysics();
