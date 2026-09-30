// Pomodoro Tree - app.js

// =====================================================================
// CONSTANTES Y CONFIGURACIÓN
// =====================================================================
const MAX_GROWTH = 6;
const GROWTH_STORAGE_KEY = 'pomodoroTreeGrowth';
const SESSIONS_STORAGE_KEY = 'studySessions';
// [DEBUG] Clave para los días "sin estudiar" simulados. En el futuro se
// calculará automáticamente a partir de la fecha de la última sesión.
const IDLE_DAYS_KEY = 'pomodoroIdleDays';
// [DEBUG] Umbral provisional (minutos por nivel) para el futuro crecimiento
// automático por tiempo de estudio. No se usa todavía de forma automática.
const MINUTES_PER_GROWTH = 25;

const STAGE_NAMES = [
    'Semilla',
    'Brote',
    'Brote con flor',
    'Arbolito',
    'Árbol joven',
    'Frutos verdes',
    'Árbol frutal'
];

// =====================================================================
// SESIONES (localStorage)
// =====================================================================

function saveSessions(sessions) {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
}

function loadSessions() {
    const data = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }
    return [];
}

// =====================================================================
// FECHAS (siempre zona local)
// =====================================================================

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

// =====================================================================
// RACHA (se conserva de la versión anterior)
// =====================================================================

// Calcular la racha real a partir de las sesiones (fecha local)
function calculateStreak(sessions) {
    const today = getToday();
    const todayKey = formatDateKey(today);

    const sessionDates = new Set();
    sessions.forEach(session => sessionDates.add(session.date));

    if (sessionDates.has(todayKey)) {
        let streak = 1;
        let current = subtractOneDay(today);
        while (sessionDates.has(formatDateKey(current))) {
            streak++;
            current = subtractOneDay(current);
        }
        return streak;
    }

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
    return 0;
}

// Devuelve el estado a mostrar en la racha.
// [DEBUG] La racha se considera "encendida" (activa) si estudiaste hoy o
// ayer (idleDays <= 1). Si llevas 2 o más días sin estudiar, sale en 0 y gris.
function getStreakDisplay(sessions, idleDays) {
    if (idleDays >= 2) {
        return { value: 0, active: false };
    }
    const s = calculateStreak(sessions);
    return { value: s >= 1 ? s : 1, active: true };
}

function renderStreak(sessions) {
    // [DEBUG] El estado de "encendida/gris" se calcula con los días simulados
    const idleDays = loadIdleDays();
    const { value, active } = getStreakDisplay(sessions, idleDays);

    document.getElementById('streak').textContent = value;
    const card = document.getElementById('streak-card');
    card.classList.toggle('inactive', !active);
}

// =====================================================================
// FORMATO DE TIEMPO
// =====================================================================

// Total de minutos a partir de los sliders de horas y minutos
function totalMinutesFromSliders() {
    const h = parseInt(document.getElementById('hours').value, 10) || 0;
    const m = parseInt(document.getElementById('minutes').value, 10) || 0;
    return h * 60 + m;
}

// Formato legible de una duración en minutos
function formatDuration(minutes) {
    if (minutes < 60) return `${minutes} minutos`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
    return `${h}h ${m}min`;
}

// Mantener sincronizados los textos de los sliders con el total
function syncTimeUI(hoursEl, minutesEl, hoursValue, minutesValue, timeTotal) {
    hoursValue.textContent = hoursEl.value;
    minutesValue.textContent = minutesEl.value;
    timeTotal.textContent = formatDuration(totalMinutesFromSliders());
}

// =====================================================================
// CRECIMIENTO DEL ÁRBOL
// =====================================================================

// Lógica futura: minutos de estudio -> nivel de crecimiento (0..MAX_GROWTH)
// [DEBUG] Pensado para el futuro crecimiento automático por tiempo de estudio.
function growthFromStudyTime(totalMinutes) {
    const level = Math.floor(totalMinutes / MINUTES_PER_GROWTH);
    return Math.max(0, Math.min(MAX_GROWTH, level));
}

// [DEBUG] Cargar/guardar el nivel manual controlado por los botones
function loadGrowth() {
    const raw = localStorage.getItem(GROWTH_STORAGE_KEY);
    let level = raw === null ? 0 : parseInt(raw, 10);
    if (isNaN(level)) level = 0;
    return Math.max(0, Math.min(MAX_GROWTH, level));
}

function saveGrowth(level) {
    localStorage.setItem(GROWTH_STORAGE_KEY, String(level));
}

// Pintar el nivel de crecimiento: cambia la clase `stage-N` del contenedor
function renderGrowth(level) {
    const tree = document.getElementById('tree');
    for (let i = 0; i <= MAX_GROWTH; i++) tree.classList.remove('stage-' + i);
    tree.classList.add('stage-' + level);
    document.getElementById('stage-name').textContent = STAGE_NAMES[level];

    document.getElementById('btn-back').disabled = level <= 0;
    document.getElementById('btn-forward').disabled = level >= MAX_GROWTH;
}

// [DEBUG] Hacer crecer / volver un paso
function growForward() {
    const level = Math.min(MAX_GROWTH, loadGrowth() + 1);
    saveGrowth(level);
    renderGrowth(level);
    renderWilt();
}

function growBackward() {
    const level = Math.max(0, loadGrowth() - 1);
    saveGrowth(level);
    renderGrowth(level);
    renderWilt();
}

// =====================================================================
// MARCHITADO (wilt)
// =====================================================================

// [DEBUG] Cargar/guardar los días simulados sin estudiar
function loadIdleDays() {
    const raw = localStorage.getItem(IDLE_DAYS_KEY);
    let d = raw === null ? 0 : parseInt(raw, 10);
    if (isNaN(d) || d < 0) d = 0;
    return d;
}

function saveIdleDays(d) {
    localStorage.setItem(IDLE_DAYS_KEY, String(d));
}

// Fracción de marchitado (0..1) según días sin estudiar y nivel de crecimiento.
// Si estoy en el estado x, me tardan x días en marchitarlo por completo.
function computeWiltFraction(idleDays, growthLevel) {
    if (growthLevel <= 0) return 0; // una semilla no tiene copa que marchitarse
    return Math.max(0, Math.min(1, idleDays / growthLevel));
}

// Paso de marchitado discreto a partir de la fracción
function wiltStageFromFraction(fraction) {
    if (fraction >= 1.0) return 4;
    if (fraction >= 0.75) return 3;
    if (fraction >= 0.5) return 2;
    if (fraction >= 0.25) return 1;
    return 0;
}

function renderWilt() {
    const idleDays = loadIdleDays();
    const level = loadGrowth();
    const fraction = computeWiltFraction(idleDays, level);
    const stage = wiltStageFromFraction(fraction);

    const tree = document.getElementById('tree');
    for (let i = 0; i <= 4; i++) tree.classList.remove('wilt-' + i);
    tree.classList.add('wilt-' + stage);

    const wiltName = document.getElementById('wilt-name');
    if (fraction >= 1.0) {
        wiltName.textContent = 'Marchito 💀';
    } else if (fraction > 0) {
        wiltName.textContent = 'Se está marchitando…';
    } else {
        wiltName.textContent = '';
    }
}

// [DEBUG] Simular un día más sin estudiar (marchita y puede romper la racha)
function addIdleDay() {
    saveIdleDays(loadIdleDays() + 1);
    renderWilt();
    renderStreak(loadSessions());
}

// [DEBUG] "Estudiar hoy": revive el árbol y reactiva la racha
function revive() {
    saveIdleDays(0);
    renderWilt();
    renderStreak(loadSessions());
}

// [DEBUG] Reiniciar la zona de pruebas (nivel, marchitado)
function resetDebug() {
    saveGrowth(0);
    saveIdleDays(0);
    renderGrowth(0);
    renderWilt();
    renderStreak(loadSessions());
}

// =====================================================================
// RENDER DE SESIONES (con edición y borrado)
// =====================================================================

// Índice de la sesión que se está editando en este momento (o -1)
let editingIndex = -1;

function renderSessionsList(sessions) {
    const list = document.getElementById('sessions-list');
    list.innerHTML = '';
    editingIndex = -1;

    if (sessions.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Aún no tienes sesiones registradas.';
        empty.style.textAlign = 'center';
        empty.style.color = '#9aa089';
        list.appendChild(empty);
        return;
    }

    const sorted = sessions.slice().sort((a, b) => b.date.localeCompare(a.date));

    sorted.forEach((session, displayPos) => {
        const realIndex = sessions.indexOf(session);
        const li = document.createElement('li');

        if (realIndex === editingIndex) {
            buildEditForm(li, session, sessions);
        } else {
            buildSessionRow(li, session, realIndex);
        }

        list.appendChild(li);
    });
}

// Fila normal de una sesión
function buildSessionRow(li, session, realIndex) {
    const main = document.createElement('div');
    main.className = 'session-main';

    const topicDiv = document.createElement('div');
    topicDiv.className = 'session-topic';
    topicDiv.textContent = session.topic;

    const meta = document.createElement('div');
    meta.className = 'session-meta';

    const dateSpan = document.createElement('span');
    dateSpan.textContent = session.date;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'session-time';
    timeSpan.textContent = formatDuration(session.minutes);
    meta.appendChild(dateSpan);
    meta.appendChild(timeSpan);

    if (session.fixed) {
        const badge = document.createElement('span');
        badge.className = 'fixed-badge';
        badge.title = 'Tiempo de estudio fijado (no editable)';
        badge.textContent = '🔒 fijado';
        meta.appendChild(badge);
    }

    main.appendChild(topicDiv);
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'session-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'action-btn action-edit';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', () => {
        editingIndex = realIndex;
        renderSessionsList(loadSessions());
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'action-btn action-delete';
    deleteBtn.textContent = 'Borrar';
    deleteBtn.addEventListener('click', () => deleteSession(realIndex));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(main);
    li.appendChild(actions);
}

// Formulario de edición en línea
function buildEditForm(li, session, sessions) {
    li.classList.add('editing');

    const form = document.createElement('div');
    form.className = 'edit-form';

    // Tema (siempre editable)
    const topicGroup = document.createElement('div');
    const topicLabel = document.createElement('label');
    topicLabel.textContent = 'Tema / asignatura';
    const topicInput = document.createElement('input');
    topicInput.type = 'text';
    topicInput.value = session.topic;
    topicInput.required = true;
    topicGroup.appendChild(topicLabel);
    topicGroup.appendChild(topicInput);

    // Tiempo: editable solo si NO está fijado
    let timeBlock;
    if (session.fixed) {
        timeBlock = document.createElement('div');
        const note = document.createElement('p');
        note.className = 'locked-note';
        note.textContent = `🔒 Tiempo fijado: ${formatDuration(session.minutes)} (no editable)`;
        timeBlock.appendChild(note);
    } else {
        timeBlock = document.createElement('div');
        timeBlock.className = 'edit-time';

        const hLabel = document.createElement('label');
        hLabel.textContent = 'Horas';
        const hSlider = document.createElement('input');
        hSlider.type = 'range';
        hSlider.min = '0'; hSlider.max = '12'; hSlider.step = '1';
        hSlider.id = 'edit-hours';
        const hVal = document.createElement('span');
        hVal.className = 'time-value';

        const mLabel = document.createElement('label');
        mLabel.textContent = 'Minutos';
        const mSlider = document.createElement('input');
        mSlider.type = 'range';
        mSlider.min = '0'; mSlider.max = '55'; mSlider.step = '5';
        mSlider.id = 'edit-minutes';
        const mVal = document.createElement('span');
        mVal.className = 'time-value';

        // Establecer valores iniciales según el tiempo guardado
        const initialMinutes = session.minutes;
        hSlider.value = String(Math.floor(initialMinutes / 60));
        mSlider.value = String(initialMinutes % 60);
        hVal.textContent = hSlider.value;
        mVal.textContent = mSlider.value;

        const timeSummary = document.createElement('p');
        timeSummary.className = 'time-summary';
        timeSummary.innerHTML = 'Tiempo: <strong class="edit-total">' + formatDuration(initialMinutes) + '</strong>';

        hSlider.addEventListener('input', () => {
            hVal.textContent = hSlider.value;
            timeSummary.querySelector('.edit-total').textContent =
                formatDuration(parseInt(hSlider.value, 10) * 60 + parseInt(mSlider.value, 10));
        });
        mSlider.addEventListener('input', () => {
            mVal.textContent = mSlider.value;
            timeSummary.querySelector('.edit-total').textContent =
                formatDuration(parseInt(hSlider.value, 10) * 60 + parseInt(mSlider.value, 10));
        });

        timeBlock.appendChild(hLabel);
        timeBlock.appendChild(hSlider);
        timeBlock.appendChild(hVal);
        timeBlock.appendChild(mLabel);
        timeBlock.appendChild(mSlider);
        timeBlock.appendChild(mVal);
        timeBlock.appendChild(timeSummary);
    }

    const actions = document.createElement('div');
    actions.className = 'edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-primary action-btn';
    saveBtn.textContent = 'Guardar';
    saveBtn.addEventListener('click', () => {
        const newTopic = topicInput.value.trim();
        if (!newTopic) {
            alert('Por favor, escribe un tema.');
            return;
        }
        session.topic = newTopic;
        if (!session.fixed) {
            const h = parseInt(document.getElementById('edit-hours').value, 10) || 0;
            const m = parseInt(document.getElementById('edit-minutes').value, 10) || 0;
            const total = h * 60 + m;
            if (total <= 0) {
                alert('El tiempo debe ser mayor que 0.');
                return;
            }
            session.minutes = total;
        }
        saveSessions(sessions);
        editingIndex = -1;
        renderSessionsList(sessions);
        renderStreak(sessions);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-ghost action-btn';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => {
        editingIndex = -1;
        renderSessionsList(sessions);
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    form.appendChild(topicGroup);
    form.appendChild(timeBlock);
    form.appendChild(actions);
    li.appendChild(form);
}

// Borrar una sesión
function deleteSession(realIndex) {
    const sessions = loadSessions();
    const session = sessions[realIndex];
    if (!session) return;
    const ok = confirm(`¿Borrar la sesión "${session.topic}"?`);
    if (!ok) return;
    sessions.splice(realIndex, 1);
    saveSessions(sessions);
    renderSessionsList(sessions);
    renderStreak(sessions);
}

// =====================================================================
// INICIALIZACIÓN
// =====================================================================
function init() {
    const sessions = loadSessions();

    // ---- Pomodoro Tree: crecimiento manual [DEBUG] ----
    renderGrowth(loadGrowth());
    document.getElementById('btn-back').addEventListener('click', growBackward);
    document.getElementById('btn-forward').addEventListener('click', growForward);

    // ---- [DEBUG] Marchitado / racha ----
    renderWilt();
    document.getElementById('btn-wilt').addEventListener('click', addIdleDay);
    document.getElementById('btn-revive').addEventListener('click', revive);
    document.getElementById('btn-reset').addEventListener('click', resetDebug);

    // ---- Formulario de nueva sesión ----
    const todayInput = document.getElementById('date');
    todayInput.valueAsDate = getToday();

    const hoursInput = document.getElementById('hours');
    const minutesInput = document.getElementById('minutes');
    const hoursValue = document.getElementById('hours-value');
    const minutesValue = document.getElementById('minutes-value');
    const timeTotal = document.getElementById('time-total');

    hoursInput.addEventListener('input', () =>
        syncTimeUI(hoursInput, minutesInput, hoursValue, minutesValue, timeTotal));
    minutesInput.addEventListener('input', () =>
        syncTimeUI(hoursInput, minutesInput, hoursValue, minutesValue, timeTotal));
    syncTimeUI(hoursInput, minutesInput, hoursValue, minutesValue, timeTotal);

    const form = document.getElementById('session-form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const dateInput = document.getElementById('date');
        const topicInput = document.getElementById('topic');
        const fixedCheck = document.getElementById('fixed');

        const date = dateInput.value;
        const topic = topicInput.value.trim();
        const minutes = totalMinutesFromSliders();

        if (!date) {
            alert('Por favor, selecciona una fecha.');
            return;
        }
        if (!topic) {
            alert('Por favor, escribe un tema.');
            return;
        }
        if (minutes <= 0) {
            alert('Por favor, fija un tiempo de estudio mayor que 0.');
            return;
        }

        const newSession = {
            date: date,
            topic: topic,
            minutes: minutes,
            fixed: fixedCheck.checked
        };

        const all = loadSessions();
        all.push(newSession);
        saveSessions(all);

        renderStreak(all);
        renderSessionsList(all);

        form.reset();
        todayInput.valueAsDate = getToday();
        hoursInput.value = '0';
        minutesInput.value = '25';
        syncTimeUI(hoursInput, minutesInput, hoursValue, minutesValue, timeTotal);
        topicInput.focus();
    });

    // ---- Render inicial ----
    renderStreak(sessions);
    renderSessionsList(sessions);
}

document.addEventListener('DOMContentLoaded', init);
