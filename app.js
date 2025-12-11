import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SUAS CONFIGURAÇÕES (Mantidas) ---
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

// --- DADOS DOS PROFISSIONAIS (PERFIL COMPLETO) ---
// Usando UI Avatars para gerar fotos baseadas nas iniciais, mas você pode por URLs reais
const professionalsConfig = [
    { 
        id: "ana_corte", 
        name: "Ana Silva", 
        specialty: "Hair Stylist", 
        rating: "4.9", 
        reviews: 120,
        img: "https://ui-avatars.com/api/?name=Ana+Silva&background=ffc107&color=fff",
        portfolio: "#portfolio-ana" // Link fictício
    },
    { 
        id: "carlos_color", 
        name: "Carlos", 
        specialty: "Colorimetria", 
        rating: "5.0", 
        reviews: 85,
        img: "https://ui-avatars.com/api/?name=Carlos&background=0d47a1&color=fff",
        portfolio: "#portfolio-carlos"
    },
    { 
        id: "bia_nails", 
        name: "Bia", 
        specialty: "Nail Designer", 
        rating: "4.8", 
        reviews: 210,
        img: "https://ui-avatars.com/api/?name=Bia&background=e91e63&color=fff",
        portfolio: "#portfolio-bia"
    },
    { 
        id: "julio_barba", 
        name: "Júlio", 
        specialty: "Barbeiro", 
        rating: "4.9", 
        reviews: 95,
        img: "https://ui-avatars.com/api/?name=Julio&background=4caf50&color=fff",
        portfolio: "#portfolio-julio"
    }
];

// Serviços
const servicesConfig = [
    { id: "corte_fem", name: "Corte Feminino", duration: 60 },
    { id: "corte_masc", name: "Corte Masculino", duration: 30 },
    { id: "barba", name: "Barba Completa", duration: 30 },
    { id: "manicure", name: "Manicure", duration: 45 },
    { id: "pedicure", name: "Pedicure", duration: 45 },
    { id: "coloracao", name: "Coloração/Mechas", duration: 120 },
    { id: "hidratacao", name: "Hidratação Profunda", duration: 45 }
];

const SHOP_OPEN_HOUR = 9;
const SHOP_CLOSE_HOUR = 19;

// --- ELEMENTOS DOM ---
const proGrid = document.getElementById('professionalsGrid');
const serviceSelect = document.getElementById('service');
const step2 = document.getElementById('step2');
const dateInput = document.getElementById('date');
const slotsSection = document.getElementById('slotsSection');
const slotsContainer = document.getElementById('slotsContainer');
const submitBtn = document.getElementById('submitBtn');

// --- 1. RENDERIZAR PROFISSIONAIS ---
function renderProfessionals() {
    proGrid.innerHTML = '';
    professionalsConfig.forEach(pro => {
        const card = document.createElement('div');
        card.className = 'pro-card';
        card.innerHTML = `
            <img src="${pro.img}" class="pro-img" alt="${pro.name}">
            <span class="pro-name">${pro.name}</span>
            <span class="pro-spec">${pro.specialty}</span>
            <div class="pro-rating">⭐ ${pro.rating} <span style="font-size:0.8em; color:#999">(${pro.reviews})</span></div>
            <a href="${pro.portfolio}" onclick="event.stopPropagation()" class="portfolio-link">Ver Portfólio</a>
        `;

        card.addEventListener('click', () => selectProfessional(pro.id, card));
        proGrid.appendChild(card);
    });
}

function selectProfessional(id, cardElement) {
    // Visual
    document.querySelectorAll('.pro-card').forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    
    // Dados
    document.getElementById('selectedProfessional').value = id;
    
    // Mostra próximo passo
    step2.classList.remove('hidden-step');
    step2.scrollIntoView({ behavior: 'smooth' });
    
    // Reseta passos seguintes se mudar o profissional
    slotsSection.classList.add('hidden-step');
    submitBtn.classList.remove('active');
    checkAvailability(); // Tenta checar se já tiver data/serviço preenchidos
}

// Inicializa render
renderProfessionals();
populateServices();

function populateServices() {
    servicesConfig.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name;
        serviceSelect.appendChild(option);
    });
}

// Listeners
serviceSelect.addEventListener('change', () => {
    updateDuration();
    checkAvailability();
});
dateInput.addEventListener('change', checkAvailability);

function updateDuration() {
    const serviceId = serviceSelect.value;
    const service = servicesConfig.find(s => s.id === serviceId);
    const display = document.getElementById('serviceDurationDisplay');
    if (service) {
        display.textContent = `⏱ Duração: ${service.duration} min`;
        display.style.display = 'block';
    }
}

// --- 2. LÓGICA DE DISPONIBILIDADE ---
async function checkAvailability() {
    const proId = document.getElementById('selectedProfessional').value;
    const serviceId = serviceSelect.value;
    const date = dateInput.value;

    if (!proId || !serviceId || !date) return;

    // Mostra área de slots
    slotsSection.classList.remove('hidden-step');
    slotsContainer.innerHTML = '<p>Buscando agenda...</p>';

    // Query no Firebase
    const q = query(
        appointmentsRef, 
        where("date", "==", date),
        where("professional", "==", proId) // Filtra pelo ID do profissional
    );

    const snapshot = await getDocs(q);
    const existingBookings = [];
    snapshot.forEach(doc => existingBookings.push(doc.data()));

    generateTimeSlots(existingBookings, serviceId);
}

function generateTimeSlots(bookings, serviceId) {
    slotsContainer.innerHTML = '';
    const service = servicesConfig.find(s => s.id === serviceId);
    const duration = service.duration;

    const startMinutes = SHOP_OPEN_HOUR * 60; 
    const endMinutes = SHOP_CLOSE_HOUR * 60;
    const step = 30; 

    let hasSlots = false;

    for (let current = startMinutes; current + duration <= endMinutes; current += step) {
        const slotStart = current;
        const slotEnd = current + duration;
        let isFree = true;

        for (let booking of bookings) {
            const [bHour, bMin] = booking.time.split(':').map(Number);
            const bookingStart = bHour * 60 + bMin;
            const bookingEnd = bookingStart + booking.durationMinutes;

            if (slotStart < bookingEnd && slotEnd > bookingStart) {
                isFree = false;
                break;
            }
        }

        if (isFree) {
            hasSlots = true;
            createSlotButton(current);
        }
    }

    if (!hasSlots) slotsContainer.innerHTML = '<p>Agenda cheia para hoje 😔</p>';
}

function createSlotButton(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    const btn = document.createElement('div');
    btn.className = 'time-btn';
    btn.textContent = timeString;
    
    btn.onclick = () => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('selectedTime').value = timeString;
        submitBtn.classList.add('active');
        submitBtn.disabled = false;
    };
    slotsContainer.appendChild(btn);
}

// --- SUBMIT ---
const bookingForm = document.getElementById('bookingForm');
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.textContent = "Salvando...";

    const serviceId = document.getElementById('service').value;
    const serviceObj = servicesConfig.find(s => s.id === serviceId);
    const proId = document.getElementById('selectedProfessional').value;
    const proObj = professionalsConfig.find(p => p.id === proId);

    const newBooking = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        professional: proId,
        professionalName: proObj.name, // Salva o nome para facilitar leitura no banco
        service: serviceObj.name,
        date: document.getElementById('date').value,
        time: document.getElementById('selectedTime').value,
        durationMinutes: serviceObj.duration,
        createdAt: new Date()
    };

    try {
        await addDoc(appointmentsRef, newBooking);
        showToast("✅ Agendamento Confirmado com " + proObj.name + "!");
        setTimeout(() => window.location.reload(), 2000); // Recarrega para limpar
    } catch (error) {
        console.error(error);
        alert("Erro ao agendar.");
        submitBtn.textContent = "Confirmar Agendamento";
    }
});

function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show";
    setTimeout(() => t.className = t.className.replace("show", ""), 3000);
}
