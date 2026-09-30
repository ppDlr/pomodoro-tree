// Pomodoro Tree - app.js

// =====================================================================
// RACHA (se conserva de la versión anterior)
// =====================================================================

// Guardar sesiones en localStorage
function saveSessions(sessions) {
    localStorage.setItem('studySessions', JSON.stringify(sessions));
}

// Cargar sesiones desde localStorage
function loadSessions() {
    const data = localStorage.getItem('studySessions');
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }
    return [];
}

// Formatear fecha como YYYY-MM-DD (siempre en zona local)
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Obtener la fecha de hoy
function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Decrementar una fecha en un día (zona local)
function subtractOneDay(date) {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    return prev;
}

// Calcular la racha actual basada en hoy (fecha local del usuario)
function calculateStreak(sessions) {
    const today = getToday();
    const todayKey = formatDateKey(today);

    // Recolectar todas las fechas con al menos una sesión
    const sessionDates = new Set();
    sessions.forEach(session => {
        sessionDates.add(session.date);
    });

    const hasToday = sessionDates.has(todayKey);

    if (hasToday) {
        // Hoy tiene sesión: empezar contando desde hoy
        let streak = 1;
        let current = subtractOneDay(today);
        while (sessionDates.has(formatDateKey(current))) {
            streak++;
            current = subtractOneDay(current);
        }
        return streak;
    } else {
        // Hoy no tiene sesión: la racha sigue viva si ayer sí hubo sesión
        const yesterday = subtractOneDay(today);
        if (sessionDates.has(formatDateKey(yesterday))) {
            let streak = 1;
            let current = subtractOneDay(yesterday);
            while (sessionDates.has(formatDateKey(current))) {
                streak++;
                current = subtractOneDay(current);
            }
            return streak;
        }
        // No hay estudio hoy ni ayer: racha = 0
        return 0;
    }
}

// Renderizar la racha
function renderStreak(sessions) {
    document.getElementById('streak').textContent = calculateStreak(sessions);
}

// Renderizar lista de sesiones (más reciente a más antigua)
function renderSessionsList(sessions) {
    const list = document.getElementById('sessions-list');
    list.innerHTML = '';

    if (sessions.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Aún no tienes sesiones registradas.';
        empty.style.textAlign = 'center';
        empty.style.color = '#9aa089';
        list.appendChild(empty);
        return;
    }

    const sorted = sessions.slice().sort((a, b) => b.date.localeCompare(a.date));

    sorted.forEach(session => {
        const li = document.createElement('li');

        const topicDiv = document.createElement('div');
        topicDiv.className = 'session-topic';
        topicDiv.textContent = session.topic;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'session-details';

        const dateP = document.createElement('p');
        dateP.className = 'session-date';
        dateP.textContent = session.date;

        const minutesP = document.createElement('p');
        minutesP.className = 'session-minutes';
        minutesP.textContent = `${session.minutes} minutos`;

        detailsDiv.appendChild(dateP);
        detailsDiv.appendChild(minutesP);

        li.appendChild(topicDiv);
        li.appendChild(detailsDiv);
        list.appendChild(li);
    });
}

// =====================================================================
// POMODORO TREE - crecimiento del árbol
//
// Modelo pensado de cara al futuro: el crecimiento del árbol debería
// derivarse del tiempo de estudio del usuario. Por eso existe
// `growthFromStudyTime()` que convierte minutos -> nivel de crecimiento.
// En ESTA iteración el crecimiento NO depende de las sesiones: se controla
// manualmente con los botones "Hacia atrás" / "Hacia delante" para poder
// "viajar" en el tiempo y debuggear las distintas etapas.
// =====================================================================

const MAX_GROWTH = 5;
const GROWTH_STORAGE_KEY = 'pomodoroTreeGrowth';
// Umbral provisional (minutos por nivel) pensado para el futuro crecimiento
// automático por tiempo de estudio. No se usa todavía de forma automática.
const MINUTES_PER_GROWTH = 25;

const STAGE_NAMES = [
    'Semilla',
    'Brote',
    'Brote con flor',
    'Arbolito',
    'Árbol joven',
    'Árbol frutal'
];

// Lógica futura: minutos de estudio -> nivel de crecimiento (0..MAX_GROWTH)
function growthFromStudyTime(totalMinutes) {
    const level = Math.floor(totalMinutes / MINUTES_PER_GROWTH);
    return Math.max(0, Math.min(MAX_GROWTH, level));
}

// Cargar el nivel guardado (0 si no hay ninguno)
function loadGrowth() {
    const raw = localStorage.getItem(GROWTH_STORAGE_KEY);
    let level = raw === null ? 0 : parseInt(raw, 10);
    if (isNaN(level)) level = 0;
    return Math.max(0, Math.min(MAX_GROWTH, level));
}

// Guardar el nivel actual
function saveGrowth(level) {
    localStorage.setItem(GROWTH_STORAGE_KEY, String(level));
}

// Pintar el árbol según el nivel: cambia la clase `stage-N` del contenedor
function renderGrowth(level) {
    const tree = document.getElementById('tree');
    for (let i = 0; i <= MAX_GROWTH; i++) {
        tree.classList.remove('stage-' + i);
    }
    tree.classList.add('stage-' + level);
    document.getElementById('stage-name').textContent = STAGE_NAMES[level];

    // Deshabilitar botones en los extremos
    document.getElementById('btn-back').disabled = level <= 0;
    document.getElementById('btn-forward').disabled = level >= MAX_GROWTH;
}

// Hacer crecer un paso
function growForward() {
    const level = Math.min(MAX_GROWTH, loadGrowth() + 1);
    saveGrowth(level);
    renderGrowth(level);
}

// Hacer crecer hacia atrás un paso
function growBackward() {
    const level = Math.max(0, loadGrowth() - 1);
    saveGrowth(level);
    renderGrowth(level);
}

// =====================================================================
// Inicialización
// =====================================================================
function init() {
    // ---- Pomodoro Tree ----
    renderGrowth(loadGrowth());
    document.getElementById('btn-back').addEventListener('click', growBackward);
    document.getElementById('btn-forward').addEventListener('click', growForward);

    // ---- Diario ----
    const todayInput = document.getElementById('date');
    todayInput.valueAsDate = getToday();

    const sessions = loadSessions();
    renderStreak(sessions);
    renderSessionsList(sessions);

    const form = document.getElementById('session-form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const dateInput = document.getElementById('date');
        const topicInput = document.getElementById('topic');
        const minutesInput = document.getElementById('minutes');

        const date = dateInput.value;
        const topic = topicInput.value.trim();
        const minutes = parseInt(minutesInput.value, 10);

        if (!date) {
            alert('Por favor, selecciona una fecha.');
            return;
        }
        if (!topic) {
            alert('Por favor, escribe un tema.');
            return;
        }
        if (isNaN(minutes) || minutes <= 0) {
            alert('Por favor, escribe un número de minutos válido (mayor que 0).');
            return;
        }

        sessions.push({ date: date, topic: topic, minutes: minutes });
        saveSessions(sessions);

        renderStreak(sessions);
        renderSessionsList(sessions);

        form.reset();
        todayInput.valueAsDate = getToday();
        topicInput.focus();
    });
}

document.addEventListener('DOMContentLoaded', init);
