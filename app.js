import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SUAS CHAVES ---
const firebaseConfig = {
    apiKey: "AIzaSyCICXCU3bgxoVK4kAXncxSWZHAazKFS65s",
    authDomain: "agenda-salao-bbddf.firebaseapp.com",
    projectId: "agenda-salao-bbddf",
    storageBucket: "agenda-salao-bbddf.firebasestorage.app",
    messagingSenderId: "977961284310",
    appId: "1:977961284310:web:de2776476262d942e68f77",
    measurementId: "G-WGP1LCJN9M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ELEMENTOS ---
const elements = {
    form: document.getElementById('bookingForm'),
    service: document.getElementById('service'),
    professional: document.getElementById('professional'),
    date: document.getElementById('date'),
    slotsGrid: document.getElementById('slots-grid'),
    slotsLoader: document.getElementById('slots-loader'),
    selectedTimeInput: document.getElementById('selectedTime'),
    msg: document.getElementById('message'),
    btn: document.getElementById('submitBtn'),
    clientName: document.getElementById('clientName'),
    clientPhone: document.getElementById('clientPhone')
};

elements.date.min = new Date().toISOString().split("T")[0];

// --- 1. CARREGAR SERVIÇOS ---
async function loadServices() {
    try {
        const q = query(collection(db, "procedimentos"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        
        elements.service.innerHTML = '<option value="" disabled selected>Selecione uma experiência...</option>';

        if (querySnapshot.empty) {
            elements.service.innerHTML = '<option value="">Nenhum serviço disponível</option>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; 
            option.textContent = `${data.nome} (${data.duracao} min)`;
            option.setAttribute('data-duration', data.duracao);
            elements.service.appendChild(option);
        });
    } catch (error) {
        console.error("Erro serviços:", error);
        elements.service.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// --- 2. CARREGAR PROFISSIONAIS (NOVO) ---
async function loadProfessionals() {
    try {
        // Ordena por nome para ficar bonito na lista
        const q = query(collection(db, "profissionais"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        
        elements.professional.innerHTML = '<option value="" disabled selected>Selecione o especialista...</option>';

        if (querySnapshot.empty) {
            elements.professional.innerHTML = '<option value="">Nenhum profissional disponível</option>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; // O ID do documento é o valor chave
            // Mostra Nome e Especialidade
            option.textContent = `${data.nome} - ${data.especialidade}`;
            // Salvamos o nome limpo num atributo para usar depois se precisar
            option.setAttribute('data-name', data.nome);
            elements.professional.appendChild(option);
        });
    } catch (error) {
        console.error("Erro profissionais:", error);
        elements.professional.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// --- 3. VERIFICAR DISPONIBILIDADE ---
async function loadAvailability() {
    const dateVal = elements.date.value;
    const profId = elements.professional.value; // Agora usamos o ID do Firebase
    const serviceIndex = elements.service.selectedIndex;

    if(serviceIndex === -1) return;
    const serviceOpt = elements.service.options[serviceIndex];
    
    if (!dateVal || !profId || !serviceOpt.value) return;

    const duration = parseInt(serviceOpt.getAttribute('data-duration'));
    
    elements.slotsGrid.innerHTML = '';
    elements.slotsLoader.style.display = 'block';
    elements.selectedTimeInput.value = '';

    try {
        // Busca agendamentos onde o profissionalId seja igual ao selecionado
        const q = query(
            collection(db, "agendamentos"),
            where("profissionalId", "==", profId),
            where("data", "==", dateVal)
        );
        
        const querySnapshot = await getDocs(q);
        const busyTimes = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            busyTimes.push({ start: data.hora, duration: data.duracao });
        });

        generateSlots(busyTimes, duration);

    } catch (error) {
        console.error("Erro agenda:", error);
        elements.msg.innerHTML = `<span class="error">Erro ao verificar horários.</span>`;
    } finally {
        elements.slotsLoader.style.display = 'none';
    }
}

// --- 4. GERAR SLOTS ---
function generateSlots(busyTimes, serviceDuration) {
    const startHour = 9; 
    const endHour = 19; 
    const interval = 30; 

    let currentTime = new Date();
    currentTime.setHours(startHour, 0, 0, 0);

    const endTime = new Date();
    endTime.setHours(endHour, 0, 0, 0);

    let slotsHtml = '';
    let hasSlots = false;

    while (currentTime < endTime) {
        const timeString = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const serviceEndTime = new Date(currentTime.getTime() + serviceDuration * 60000);
        
        const isBusy = checkCollision(timeString, serviceDuration, busyTimes);
        const isTooLate = serviceEndTime > endTime;

        if (!isBusy && !isTooLate) {
            slotsHtml += `<button type="button" class="slot-btn" onclick="selectSlot(this, '${timeString}')">${timeString}</button>`;
            hasSlots = true;
        }
        currentTime.setMinutes(currentTime.getMinutes() + interval);
    }

    if (!hasSlots) {
        elements.slotsGrid.innerHTML = '<p style="grid-column: span 4; color: var(--text-muted); text-align: center; padding: 10px;">Sem horários para este serviço com este profissional hoje.</p>';
    } else {
        elements.slotsGrid.innerHTML = slotsHtml;
    }
}

// --- 5. COLISÃO ---
function checkCollision(slotTime, newDuration, busyList) {
    const timeToMin = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const newStart = timeToMin(slotTime);
    const newEnd = newStart + newDuration;

    for (let busy of busyList) {
        const busyStart = timeToMin(busy.start);
        const busyEnd = busyStart + busy.duration;
        if (newStart < busyEnd && newEnd > busyStart) return true; 
    }
    return false;
}

// --- 6. SALVAR ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const time = elements.selectedTimeInput.value;
    
    if (!time) {
        elements.msg.innerHTML = '<span class="error">Selecione um horário.</span>';
        return;
    }

    elements.btn.disabled = true;
    elements.btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agendando...';

    try {
        const serviceOpt = elements.service.options[elements.service.selectedIndex];
        const profOpt = elements.professional.options[elements.professional.selectedIndex];

        await addDoc(collection(db, "agendamentos"), {
            cliente: elements.clientName.value,
            telefone: elements.clientPhone.value,
            
            // Dados do Serviço
            servico: serviceOpt.text.split(' (')[0], // Pega só o nome, tira a duração
            servicoId: serviceOpt.value,
            duracao: parseInt(serviceOpt.getAttribute('data-duration')),
            
            // Dados do Profissional
            profissional: profOpt.getAttribute('data-name'), // Nome legível
            profissionalId: profOpt.value, // ID do banco (para busca)
            
            data: elements.date.value,
            hora: time,
            status: 'pendente',
            criadoEm: Timestamp.now()
        });

        elements.msg.innerHTML = '<span class="success"><i class="fas fa-check-circle"></i> Agendamento confirmado!</span>';
        elements.form.reset();
        elements.slotsGrid.innerHTML = '<div style="grid-column: span 4; text-align: center; color: #555;">Dados resetados.</div>';
        elements.selectedTimeInput.value = '';
        
        // Recarrega as listas para resetar os selects visualmente
        loadServices();
        loadProfessionals();

    } catch (error) {
        console.error(error);
        elements.msg.innerHTML = '<span class="error">Erro ao agendar. Tente novamente.</span>';
    } finally {
        elements.btn.disabled = false;
        elements.btn.textContent = "Confirmar Agendamento";
    }
}

// Helpers
window.selectSlot = (btn, time) => {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    elements.selectedTimeInput.value = time;
};

// Iniciar
window.addEventListener('DOMContentLoaded', () => {
    loadServices();
    loadProfessionals();
});

elements.date.addEventListener('change', loadAvailability);
elements.professional.addEventListener('change', loadAvailability);
elements.service.addEventListener('change', loadAvailability);
elements.form.addEventListener('submit', handleFormSubmit);
