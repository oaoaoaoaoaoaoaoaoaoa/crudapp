let dbCheckInterval = null;

async function checkDatabaseAndShowUI() {
    const dbStatusDiv = document.getElementById('dbStatus');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const statusMessage = document.getElementById('statusMessage');
    
    if (!dbStatusDiv) return;
    
    const result = await checkDatabaseConnection();
    
    if (result.connected) {
        dbStatusDiv.style.display = 'none';
        loginFormDiv.style.display = 'block';
        registerFormDiv.style.display = 'none';
        
        if (dbCheckInterval) {
            clearInterval(dbCheckInterval);
            dbCheckInterval = null;
        }
    } else {
        dbStatusDiv.style.display = 'block';
        loginFormDiv.style.display = 'none';
        registerFormDiv.style.display = 'none';
        
        statusMessage.innerHTML = '⏳ База данных прогружается...<br>Пожалуйста, подождите немножко ❤️';
        
        if (!dbCheckInterval) {
            dbCheckInterval = setInterval(checkDatabaseAndShowUI, 5000);
        }
    }
}

function showRegister() {
    checkDatabaseAndShowUI().then(() => {
        const dbStatusDiv = document.getElementById('dbStatus');
        if (dbStatusDiv && dbStatusDiv.style.display !== 'none') {
            return;
        }
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });
}

function showLogin() {
    checkDatabaseAndShowUI().then(() => {
        const dbStatusDiv = document.getElementById('dbStatus');
        if (dbStatusDiv && dbStatusDiv.style.display !== 'none') {
            return;
        }
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });
}

async function register() {
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const firstName = document.getElementById('regFirstName').value;
    const lastName = document.getElementById('regLastName').value;
    const birthDate = document.getElementById('regBirthDate').value;
    const confirmCheckbox = document.getElementById('confirmContraindications');
    
    if (!email || !password) {
        alert('Заполните email и пароль');
        return;
    }
    
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,22}[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]{1,20}\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        alert('Некорректный email. Допустимые форматы: user@mail.ru, user@gmail.com и т.д. Максимум 24 символа.');
        return;
    }
    
    if (email.length > 24) {
        alert('Email не может быть длиннее 24 символов');
        return;
    }
    
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;
    if (password.length > 24) {
        alert('Пароль не может быть длиннее 24 символов');
        return;
    }
    if (password.length < 4) {
        alert('Пароль должен содержать минимум 4 символа');
        return;
    }
    if (!passwordRegex.test(password)) {
        alert('Пароль содержит недопустимые символы. Используйте латиницу, цифры и символы !@#$%^&*()_-+');
        return;
    }
    
    if (!confirmCheckbox || !confirmCheckbox.checked) {
        alert('Пожалуйста, подтвердите, что вы ознакомлены с противопоказаниями');
        return;
    }
    
    try {
        const response = await fetch(API_BASE_URL + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                first_name: firstName,
                last_name: lastName,
                birth_date: birthDate
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Регистрация успешна! Теперь войдите.');
            showLogin();
            document.getElementById('regEmail').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regFirstName').value = '';
            document.getElementById('regLastName').value = '';
            document.getElementById('regBirthDate').value = '';
        } else {
            alert('Ошибка: ' + (data.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        alert('Ошибка соединения: ' + error.message);
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Заполните email и пароль');
        return;
    }
    
    try {
        const response = await fetch(API_BASE_URL + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('userId', data.userId);
            alert('Вход выполнен!');
            window.location.href = 'dashboard.html';
        } else {
            alert('Ошибка: ' + (data.message || 'Неверный email или пароль'));
        }
    } catch (error) {
        alert('Ошибка соединения: ' + error.message);
    }
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    checkDatabaseAndShowUI();
});