// Pomodoro Tree - app.js

// =====================================================================
// CONSTANTES Y CONFIGURACIÓN
// =====================================================================
const MAX_GROWTH = 6;
const SESSIONS_STORAGE_KEY = 'studySessions';
// [DEBUG] Clave para los días "sin estudiar" simulados con el botón de pruebas.
// El marchitado real se calcula a partir de la última sesión registrada.
const IDLE_DAYS_KEY = 'pomodoroIdleDays';
// Umbral (minutos de estudio acumulados por nivel) para el crecimiento automático.
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

// Franjas horarias del fondo (hora local) y su nombre de clase CSS.
const TIME_OF_DAY_NAMES = ['noche', 'madrugada', 'manana', 'mediodia', 'tarde', 'atardecer'];
// Nombres legibles (con tildes) para mostrar las franjas en la interfaz.
const TIME_OF_DAY_LABELS = {
    noche: 'noche',
    madrugada: 'madrugada',
    manana: 'mañana',
    mediodia: 'mediodía',
    tarde: 'tarde',
    atardecer: 'atardecer'
};

// Franja correspondiente a una hora local:
// noche 21:00-05:59 · madrugada 06:00-08:59 · mañana 09:00-11:59
// mediodía 12:00-15:59 · tarde 16:00-18:59 · atardecer 19:00-20:59
function getTimeOfDayBand(hour) {
    if (hour >= 21 || hour < 6) return 'noche';
    if (hour < 9) return 'madrugada';
    if (hour < 12) return 'manana';
    if (hour < 16) return 'mediodia';
    if (hour < 19) return 'tarde';
    return 'atardecer';
}

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

// Convertir una clave de fecha YYYY-MM-DD a un Date a medianoche (zona local)
function parseDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// =====================================================================
// RACHA (solo a partir de sesiones reales, nunca de botones de debug)
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

// Devuelve el valor y el estado ("encendida/gris") de la racha.
// La racha está viva si hay sesión hoy o ayer: lo deciden las sesiones reales.
function getStreakDisplay(sessions) {
    const value = calculateStreak(sessions);
    return { value: value, active: value > 0 };
}

function renderStreak(sessions) {
    const { value, active } = getStreakDisplay(sessions);

    document.getElementById('streak').textContent = value;
    const card = document.getElementById('streak-card');
    card.classList.toggle('inactive', !active);
}

// =====================================================================
// FORMATO DE TIEMPO
// =====================================================================

// Total de minutos a partir de los campos de horas y minutos del formulario
function totalMinutesFromTimeInputs() {
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

// Mantener el resumen "Tiempo: X" sincronizado con los campos del formulario
function updateTimeSummary() {
    document.getElementById('time-total').textContent =
        formatDuration(totalMinutesFromTimeInputs());
}

// =====================================================================
// FONDO DEL DÍA (franjas horarias en la carga, sin transición gradual)
// =====================================================================

// Determina la franja horaria y aplica su clase al <body>.
// Por defecto usa la hora local actual; si se pasa una hora, usa esa
// (la usan los controles de [DEBUG] para revisar los colores del fondo).
// Se decide una vez al cargar la página: cambio por salto, no animación.
function applyTimeOfDay(hour) {
    if (hour === undefined) hour = new Date().getHours();
    const band = getTimeOfDayBand(hour);
    const body = document.body;
    TIME_OF_DAY_NAMES.forEach(name => body.classList.remove('tod-' + name));
    body.classList.add('tod-' + band);
}

// [DEBUG] Rellenar el selector de hora simulada ("Hora real" + 24 horas)
function fillBgHourOptions(select) {
    select.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'Hora real';
    select.appendChild(auto);
    for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = String(h);
        opt.textContent = String(h).padStart(2, '0') + ':00 · ' +
            TIME_OF_DAY_LABELS[getTimeOfDayBand(h)];
        select.appendChild(opt);
    }
}

// =====================================================================
// CRECIMIENTO DEL ÁRBOL (automático, por tiempo de estudio acumulado)
// =====================================================================

// Suma de todos los minutos de estudio registrados
function totalStudyMinutes(sessions) {
    return sessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
}

// Minutos de estudio -> nivel de crecimiento (0..MAX_GROWTH)
function growthFromStudyTime(totalMinutes) {
    const level = Math.floor(totalMinutes / MINUTES_PER_GROWTH);
    return Math.max(0, Math.min(MAX_GROWTH, level));
}

// Nivel actual derivado de las sesiones reales
function currentGrowthLevel() {
    return growthFromStudyTime(totalStudyMinutes(loadSessions()));
}

// Pintar el nivel de crecimiento: cambia la clase `stage-N` del contenedor
function renderGrowth(level) {
    const tree = document.getElementById('tree');
    for (let i = 0; i <= MAX_GROWTH; i++) tree.classList.remove('stage-' + i);
    tree.classList.add('stage-' + level);
    document.getElementById('stage-name').textContent = STAGE_NAMES[level];
}

// =====================================================================
// MARCHITADO (wilt)
// =====================================================================

// [DEBUG] Cargar/guardar los días simulados sin estudiar (solo visual)
function loadIdleDays() {
    const raw = localStorage.getItem(IDLE_DAYS_KEY);
    let d = raw === null ? 0 : parseInt(raw, 10);
    if (isNaN(d) || d < 0) d = 0;
    return d;
}

function saveIdleDays(d) {
    localStorage.setItem(IDLE_DAYS_KEY, String(d));
}

// Días reales sin estudiar: completos desde la última sesión registrada.
// 0 si hay sesión hoy (o en el futuro), 1 si la última sesión fue ayer, etc.
function realIdleDays(sessions) {
    if (sessions.length === 0) return 0;
    let lastKey = sessions[0].date;
    sessions.forEach(s => {
        if (s.date > lastKey) lastKey = s.date;
    });
    const last = parseDateKey(lastKey);
    const today = getToday();
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((today - last) / msPerDay);
    return Math.max(0, diff);
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

// El marchitado visual combina los días reales con los simulados por [DEBUG]
// (el contador de pruebas solo añade días, nunca descuenta los reales).
function renderWilt() {
    const sessions = loadSessions();
    const idleDays = realIdleDays(sessions) + loadIdleDays();
    const level = currentGrowthLevel();
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

// [DEBUG] Simular un día más sin estudiar (afecta solo al marchitado visual)
function addIdleDay() {
    saveIdleDays(loadIdleDays() + 1);
    renderWilt();
}

// [DEBUG] "Estudiar hoy": descarta los días simulados y revive el árbol visualmente
function revive() {
    saveIdleDays(0);
    renderWilt();
}

// [DEBUG] Reiniciar la zona de pruebas (contador de días simulados)
function resetDebug() {
    saveIdleDays(0);
    renderWilt();
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
        const hInput = document.createElement('input');
        hInput.type = 'number';
        hInput.min = '0'; hInput.max = '12'; hInput.step = '1';
        hInput.id = 'edit-hours';

        const mLabel = document.createElement('label');
        mLabel.textContent = 'Minutos';
        const mInput = document.createElement('input');
        mInput.type = 'number';
        mInput.min = '0'; mInput.max = '59'; mInput.step = '5';
        mInput.id = 'edit-minutes';

        // Establecer valores iniciales según el tiempo guardado
        const initialMinutes = session.minutes;
        hInput.value = String(Math.floor(initialMinutes / 60));
        mInput.value = String(initialMinutes % 60);

        const timeSummary = document.createElement('p');
        timeSummary.className = 'time-summary';
        timeSummary.innerHTML = 'Tiempo: <strong class="edit-total">' + formatDuration(initialMinutes) + '</strong>';

        function refreshEditTotal() {
            const h = parseInt(hInput.value, 10) || 0;
            const m = parseInt(mInput.value, 10) || 0;
            timeSummary.querySelector('.edit-total').textContent = formatDuration(h * 60 + m);
        }
        hInput.addEventListener('input', refreshEditTotal);
        mInput.addEventListener('input', refreshEditTotal);

        timeBlock.appendChild(hLabel);
        timeBlock.appendChild(hInput);
        timeBlock.appendChild(mLabel);
        timeBlock.appendChild(mInput);
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
        renderGrowth(currentGrowthLevel());
        renderWilt();
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
    renderGrowth(currentGrowthLevel());
    renderWilt();
}

// =====================================================================
// INICIALIZACIÓN
// =====================================================================
function init() {
    const sessions = loadSessions();

    // ---- Fondo: franja horaria local (una vez, en la carga) ----
    applyTimeOfDay();

    // ---- Pomodoro Tree: crecimiento automático por tiempo de estudio ----
    renderGrowth(currentGrowthLevel());

    // ---- Marchitado (días reales + simulados [DEBUG]) ----
    renderWilt();
    document.getElementById('btn-wilt').addEventListener('click', addIdleDay);
    document.getElementById('btn-revive').addEventListener('click', revive);
    document.getElementById('btn-reset').addEventListener('click', resetDebug);

    // ---- [DEBUG] Fondo: simular la hora para revisar cada franja ----
    const bgHourSelect = document.getElementById('bg-hour');
    fillBgHourOptions(bgHourSelect);
    bgHourSelect.addEventListener('change', () => {
        const v = bgHourSelect.value;
        applyTimeOfDay(v === '' ? undefined : parseInt(v, 10));
    });

    // ---- Formulario de nueva sesión ----
    const todayInput = document.getElementById('date');
    todayInput.valueAsDate = getToday();

    const hoursInput = document.getElementById('hours');
    const minutesInput = document.getElementById('minutes');

    hoursInput.addEventListener('input', updateTimeSummary);
    minutesInput.addEventListener('input', updateTimeSummary);
    updateTimeSummary();

    const form = document.getElementById('session-form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const dateInput = document.getElementById('date');
        const topicInput = document.getElementById('topic');
        const fixedCheck = document.getElementById('fixed');

        const date = dateInput.value;
        const topic = topicInput.value.trim();
        const minutes = totalMinutesFromTimeInputs();

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
        renderGrowth(growthFromStudyTime(totalStudyMinutes(all)));
        renderWilt();
        renderSessionsList(all);

        form.reset();
        todayInput.valueAsDate = getToday();
        hoursInput.value = '0';
        minutesInput.value = '25';
        updateTimeSummary();
        topicInput.focus();
    });

    // ---- Render inicial ----
    renderStreak(sessions);
    renderSessionsList(sessions);
}

document.addEventListener('DOMContentLoaded', init);
