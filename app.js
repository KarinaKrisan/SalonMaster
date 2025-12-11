import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SUAS CONFIGURAÇÕES DO SALONMASTER ---
const firebaseConfig = {
  apiKey: "AIzaSyCICXCU3bgxoVK4kAXncxSWZHAazKFS65s",
  authDomain: "agenda-salao-bbddf.firebaseapp.com",
  projectId: "agenda-salao-bbddf",
  storageBucket: "agenda-salao-bbddf.firebasestorage.app",
  messagingSenderId: "977961284310",
  appId: "1:977961284310:web:de2776476262d942e68f77",
  measurementId: "G-WGP1LCJN9M"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const appointmentsRef = collection(db, "agendamentos");

// --- LÓGICA DE AGENDAMENTO ---
const bookingForm = document.getElementById('bookingForm');

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = "Verificando disponibilidade...";
    submitBtn.disabled = true;

    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const service = document.getElementById('service').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    try {
        // 1. VERIFICAÇÃO DE DUPLICIDADE
        // Consulta se já existe agendamento na mesma data e hora
        const qDuplicate = query(
            appointmentsRef, 
            where("date", "==", date), 
            where("time", "==", time)
        );

        const querySnapshot = await getDocs(qDuplicate);

        if (!querySnapshot.empty) {
            alert(`⚠️ O horário das ${time} no dia selecionado já está ocupado! Por favor, escolha outro.`);
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            return; // Para a execução aqui
        }

        // 2. SALVAR NO BANCO SE ESTIVER LIVRE
        await addDoc(appointmentsRef, {
            name, phone, service, date, time,
            createdAt: new Date()
        });
        
        alert(`✅ Agendamento confirmado para ${name}!`);
        bookingForm.reset();

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro no sistema. Tente novamente.");
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
});

// --- LISTAGEM EM TEMPO REAL ---
const listContainer = document.getElementById('appointmentsList');

// Mostra apenas agendamentos futuros (opcional, aqui mostra todos ordenados)
const qList = query(appointmentsRef, orderBy("date", "asc"), orderBy("time", "asc"));

onSnapshot(qList, (snapshot) => {
    listContainer.innerHTML = '';

    if(snapshot.empty) {
        listContainer.innerHTML = '<p style="text-align:center; color: #888;">Nenhum horário agendado ainda.</p>';
        return;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Formatar data: 2023-12-25 -> 25/12/2023
        const dateObj = new Date(data.date + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString('pt-BR');

        const card = document.createElement('div');
        card.classList.add('card');
        
        // Nota: Para privacidade pública, num app real você mostraria apenas "Reservado" 
        // em vez do nome do cliente, ou criaria uma área admin separada.
        card.innerHTML = `
            <div class="card-info">
                <strong>${data.time} - ${data.service}</strong>
                <span>Cliente: ${data.name}</span>
            </div>
            <div class="card-date">
                ${dateFormatted}<br>
                <small>${getDayName(dateObj)}</small>
            </div>
        `;
        
        listContainer.appendChild(card);
    });
});

// Auxiliar para pegar nome do dia da semana
function getDayName(date) {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[date.getDay()];
}
