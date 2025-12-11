import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO (SUAS CHAVES MANTIDAS) ---
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
const appointmentsRef = collection(db, "agendamentos");

// --- CONFIGURAÇÃO DO NEGÓCIO ---
// Lista de serviços com Duração em Minutos
const servicesConfig = [
    { id: "corte_masc", name: "Corte Masculino", duration: 30 },
    { id: "corte_fem", name: "Corte Feminino", duration: 60 },
    { id: "barba", name: "Barba", duration: 30 },
    { id: "manicure", name: "Manicure", duration: 45 },
    { id: "pedicure", name: "Pedicure", duration: 45 },
    { id: "combo_unhas", name: "Manicure + Pedicure", duration: 90 },
    { id: "hidratacao", name: "Hidratação", duration: 45 },
    { id: "coloracao", name: "Coloração", duration: 120 }
];

// Horário de Funcionamento (Ex: 09:00 as 19:00)
const SHOP_OPEN_HOUR = 9;
const SHOP_CLOSE_HOUR = 19;

// --- INICIALIZAÇÃO ---
const serviceSelect = document.getElementById('service');
const dateInput = document.getElementById('date');
const professionalInput = document.getElementById('professional');
const slotsContainer = document.getElementById('slotsContainer');
const slotsSection = document.getElementById('slotsSection');
const submitBtn = document.getElementById('submitBtn');

// Popula o select de serviços
servicesConfig.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.name;
    serviceSelect.appendChild(option);
});

// Event Listeners para atualizar disponibilidade
serviceSelect.addEventListener('change', updateDurationDisplay);
serviceSelect.addEventListener('change', checkAvailability);
dateInput.addEventListener('change', checkAvailability);
professionalInput.addEventListener('change', checkAvailability);

function updateDurationDisplay() {
    const serviceId = serviceSelect.value;
    const service = servicesConfig.find(s => s.id === serviceId);
    const display = document.getElementById('serviceDurationDisplay');
    if (service) {
        display.textContent = `Duração estimada: ${service.duration} minutos`;
        display.style.display = 'block';
    }
}

// --- LÓGICA DE DISPONIBILIDADE ---
async function checkAvailability() {
    const date = dateInput.value;
    const serviceId = serviceSelect.value;
    const professional = professionalInput.value;

    // Só busca se todos os campos estiverem preenchidos
    if (!date || !serviceId || !professional) return;

    slotsContainer.innerHTML = '<p>Carregando horários...</p>';
    slotsSection.style.display = 'block';
    submitBtn.classList.remove('active');

    // 1. Busca agendamentos existentes no banco para esse dia e profissional
    const q = query(
        appointmentsRef, 
        where("date", "==", date),
        where("professional", "==", professional)
    );
    
    const snapshot = await getDocs(q);
    const existingBookings = [];
    snapshot.forEach(doc => {
        existingBookings.push(doc.data());
    });

    // 2. Gera slots baseados na duração do serviço
    generateTimeSlots(existingBookings, serviceId);
}

function generateTimeSlots(bookings, serviceId) {
    slotsContainer.innerHTML = '';
    const service = servicesConfig.find(s => s.id === serviceId);
    const duration = service.duration; // Duração em minutos

    // Converte horas em minutos para facilitar o cálculo
    const startMinutes = SHOP_OPEN_HOUR * 60; 
    const endMinutes = SHOP_CLOSE_HOUR * 60;
    
    // Intervalo padrão da grade (ex: a cada 30 min)
    const step = 30; 

    for (let current = startMinutes; current + duration <= endMinutes; current += step) {
        
        // Verifica se esse horário (e a duração dele) conflita com agendamentos
        const slotStart = current;
        const slotEnd = current + duration;
        
        let isFree = true;

        for (let booking of bookings) {
            // Converte o horário do agendamento salvo (HH:MM) para minutos
            const [bHour, bMin] = booking.time.split(':').map(Number);
            const bookingStart = bHour * 60 + bMin;
            const bookingEnd = bookingStart + booking.durationMinutes;

            // Lógica de colisão de horários
            // (Se o novo começa antes do antigo terminar E o novo termina depois do antigo começar)
            if (slotStart < bookingEnd && slotEnd > bookingStart) {
                isFree = false;
                break;
            }
        }

        if (isFree) {
            createSlotButton(current);
        }
    }

    if (slotsContainer.children.length === 0) {
        slotsContainer.innerHTML = '<p>Sem horários livres para essa duração.</p>';
    }
}

function createSlotButton(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    const btn = document.createElement('div');
    btn.className = 'time-btn';
    btn.textContent = timeString;
    
    btn.onclick = () => {
        // Remove seleção anterior
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
        // Seleciona atual
        btn.classList.add('selected');
        document.getElementById('selectedTime').value = timeString;
        
        // Habilita botão de salvar
        submitBtn.classList.add('active');
        submitBtn.disabled = false;
    };

    slotsContainer.appendChild(btn);
}

// --- SALVAR AGENDAMENTO ---
const bookingForm = document.getElementById('bookingForm');

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.textContent = "Agendando...";
    
    const serviceId = document.getElementById('service').value;
    const serviceObj = servicesConfig.find(s => s.id === serviceId);

    const newBooking = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        professional: document.getElementById('professional').value,
        service: serviceObj.name,
        date: document.getElementById('date').value,
        time: document.getElementById('selectedTime').value,
        durationMinutes: serviceObj.duration, // Importante para calcular colisões futuras
        createdAt: new Date()
    };

    try {
        await addDoc(appointmentsRef, newBooking);
        
        // Sucesso
        showToast("✅ Agendamento Confirmado!");
        bookingForm.reset();
        slotsSection.style.display = 'none';
        submitBtn.classList.remove('active');
        submitBtn.textContent = "Confirmar Agendamento";

    } catch (error) {
        console.error(error);
        alert("Erro ao agendar.");
        submitBtn.textContent = "Tentar Novamente";
    }
});

function showToast(message) {
    const x = document.getElementById("toast");
    x.textContent = message;
    x.className = "toast show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}
