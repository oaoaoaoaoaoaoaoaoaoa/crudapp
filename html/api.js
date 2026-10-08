const API_BASE_URL = '/api';
//const API_BASE_URL = 'http://10.104.51.59:5000/api';
const STATIC_BASE_URL = ''; 
//const STATIC_BASE_URL = 'http://10.104.51.59:5000'; 

let isShowingDbError = false;
let globalDbCheckInterval = null;
let isDbConnected = true;
let lastDbCheckTime = 0;
let reconnectAttempts = 0;

async function checkDatabaseConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_BASE_URL}/check-db`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            const connected = data.status === 'connected';
            if (connected) {
                reconnectAttempts = 0;
            }
            isDbConnected = connected;
            return { connected: connected, message: data.message };
        }
        isDbConnected = false;
        return { connected: false, message: 'Сервер недоступен' };
    } catch (error) {
        console.error('Ошибка проверки БД:', error);
        isDbConnected = false;
        return { connected: false, message: 'Не удалось подключиться к серверу' };
    }
}

function showDatabaseErrorModal() {
    if (isShowingDbError) return;
    isShowingDbError = true;
    
    let modal = document.getElementById('dbErrorGlobalModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dbErrorGlobalModal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 100000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 40px; border-radius: 16px; text-align: center; max-width: 450px; margin: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">

                    <div id="dbErrorMessageText" style="font-size: 20px; margin-bottom: 15px; color: #333; font-weight: bold; line-height: 1.4;">
                        Потеряно соединение с БД
                    </div>
                    <div id="dbErrorDetailText" style="font-size: 14px; margin-bottom: 25px; color: #666;">
                        Идет переподключение...
                    </div>
                    <button onclick="window.forceLogout()" style="padding: 12px 30px; background: #e74c3c; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">
                        Выйти в главное меню
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'flex';
    }
    
    document.body.style.overflow = 'hidden';
    document.body.style.pointerEvents = 'none';
    
    const modalOverlay = modal.querySelector('div:first-child');
    if (modalOverlay) {
        modalOverlay.style.pointerEvents = 'auto';
    }
}

function hideDatabaseErrorModal() {
    const modal = document.getElementById('dbErrorGlobalModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    isShowingDbError = false;
    reconnectAttempts = 0;
}

window.forceLogout = function() {
    if (globalDbCheckInterval) {
        clearInterval(globalDbCheckInterval);
        globalDbCheckInterval = null;
    }
    sessionStorage.clear();
    hideDatabaseErrorModal();
    window.location.href = 'index.html';
};

function startDatabaseMonitoring() {
    if (globalDbCheckInterval) return;
    
    globalDbCheckInterval = setInterval(async () => {
        const result = await checkDatabaseConnection();
        
        if (result.connected) {
            if (isShowingDbError) {
                hideDatabaseErrorModal();
                location.reload();
            }
            reconnectAttempts = 0;
        } else {
            if (!isShowingDbError) {
                showDatabaseErrorModal();
            }
            reconnectAttempts++;
            updateReconnectProgress(reconnectAttempts);
            
            if (reconnectAttempts >= 20) {
                const detailText = document.getElementById('dbErrorDetailText');
                if (detailText) {
                    detailText.innerHTML = 'Не удалось восстановить соединение.<br>Пожалуйста, проверьте сервер БД и нажмите "Выйти".';
                }
            }
        }
    }, 3000);
}

async function ensureDbConnection() {
    if (!isDbConnected) {
        showDatabaseErrorModal();
        throw new Error('База данных недоступна');
    }
    
    const now = Date.now();
    if (now - lastDbCheckTime > 5000) {
        lastDbCheckTime = now;
        const result = await checkDatabaseConnection();
        if (!result.connected) {
            showDatabaseErrorModal();
            throw new Error('База данных недоступна');
        }
    }
    return true;
}

async function apiRequest(endpoint, method, data) {
    await ensureDbConnection();
    
    const url = API_BASE_URL + endpoint;
    const headers = {
        'Content-Type': 'application/json'
    };
    
    const token = sessionStorage.getItem('token');
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    const options = {
        method: method,
        headers: headers
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.status === 503) {
            isDbConnected = false;
            showDatabaseErrorModal();
            throw new Error('База данных недоступна');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка запроса');
        }
        
        isDbConnected = true;
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError' || error.message === 'Failed to fetch' || error.message === 'NetworkError when attempting to fetch resource') {
            isDbConnected = false;
            showDatabaseErrorModal();
            throw new Error('База данных недоступна');
        }
        throw error;
    }
}

function isValidEmail(email) {
    if (email.length > 24) return false;
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,22}[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]{1,20}\.[a-zA-Z]{2,6}$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    if (password.length > 24) return false;
    if (password.length < 4) return false;
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;
    return passwordRegex.test(password);
}

function sanitizeString(str) {
    if (!str) return '';
    return str.replace(/[;'"\\]/g, '');
}

async function register(userData) {
    return apiRequest('/register', 'POST', userData);
}

async function login(credentials) {
    return apiRequest('/login', 'POST', credentials);
}

async function saveProfile(profileData) {
    return apiRequest('/profile', 'POST', profileData);
}

async function getProfile() {
    return apiRequest('/profile', 'GET');
}

async function addGoal(goalData) {
    return apiRequest('/goals', 'POST', goalData);
}

async function getGoals() {
    return apiRequest('/goals', 'GET');
}

async function addHealthData(data) {
    return apiRequest('/health', 'POST', data);
}

async function getHealthHistory() {
    return apiRequest('/health', 'GET');
}

async function getWorkoutPlans() {
    return apiRequest('/workout-plans', 'GET');
}

async function getMealPlans() {
    return apiRequest('/meal-plans', 'GET');
}

async function getIngredientsList() {
    return apiRequest('/ingredients-list', 'GET');
}

async function getUserAllergies() {
    return apiRequest('/user-allergies', 'GET');
}

async function saveUserAllergies(allergies) {
    return apiRequest('/user-allergies', 'POST', { allergies: allergies });
}

async function getWorkoutPlanExercises(planId) {
    return apiRequest(`/workout-plans/${planId}/exercises`, 'GET');
}

async function getMealPlanRecipes(planId) {
    return apiRequest(`/meal-plans/${planId}/recipes`, 'GET');
}

async function deleteWorkoutPlan(planId) {
    return apiRequest(`/workout-plans/${planId}`, 'DELETE');
}

async function deleteMealPlan(planId) {
    return apiRequest(`/meal-plans/${planId}`, 'DELETE');
}

async function getAllRecipes() {
    const response = await apiRequest('/all-recipes', 'GET');
    console.log('getAllRecipes ответ:', response);
    return response;
}

async function updateGoalProgress(goalId, current_weight) {
    return apiRequest(`/goals/${goalId}/update-progress`, 'PATCH', { current_weight });
}

async function getAllExercises() {
    return apiRequest('/exercises', 'GET');
}

async function replaceExercise(planId, oldExerciseId, newExerciseId, sets, reps) {
    return apiRequest(`/workout-plans/${planId}/exercises/${oldExerciseId}`, 'PUT', { newExerciseId, sets, reps });
}

async function replaceRecipe(planId, oldRecipeId, newRecipeId) {
    if (!newRecipeId) {
        throw new Error('Не выбран рецепт для замены');
    }
    const newId = Number(newRecipeId);
    if (isNaN(newId) || newId <= 0) {
        throw new Error(`Неверный ID рецепта: ${newRecipeId}`);
    }
    return apiRequest(`/meal-plans/${planId}/recipes/${oldRecipeId}`, 'PUT', { newRecipeId: newId });
}

async function toggleRecipeComplete(planId, recipeId, isCompleted) {
    return apiRequest(`/meal-plans/${planId}/recipes/${recipeId}/complete`, 'PATCH', { is_completed: isCompleted });
}

async function toggleRecipeFavorite(recipeId, isFavorite) {
    return apiRequest(`/recipes/${recipeId}/favorite`, 'PATCH', { is_favorite: isFavorite });
}

async function getFavoriteRecipes() {
    return apiRequest('/favorite-recipes', 'GET');
}

async function toggleExerciseComplete(planId, exerciseId, isCompleted) {
    return apiRequest(`/workout-plans/${planId}/exercises/${exerciseId}/complete`, 'PATCH', { is_completed: isCompleted });
}

async function toggleExerciseFavorite(exerciseId, isFavorite) {
    return apiRequest(`/exercises/${exerciseId}/favorite`, 'PATCH', { is_favorite: isFavorite });
}

async function getFavoriteExercises() {
    return apiRequest('/favorite-exercises', 'GET');
}

async function getRecipeDetails(recipeId) {
    return apiRequest(`/recipes/${recipeId}`, 'GET');
}

async function getExerciseDetails(exerciseId) {
    return apiRequest(`/exercises/${exerciseId}`, 'GET');
}

async function updateRecipeServings(planId, recipeId, servings) {
    return apiRequest(`/meal-plans/${planId}/recipes/${recipeId}/servings`, 'PATCH', { servings: servings });
}

async function reorderMealPlans(planOrders) {
    const response = await fetch(`${API_BASE_URL}/meal-plans/reorder`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({ planOrders })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка обновления порядка');
    }
    return response.json();
}

async function reorderWorkoutPlans(planOrders) {
    const response = await fetch(`${API_BASE_URL}/workout-plans/reorder`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({ planOrders })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка обновления порядка');
    }
    return response.json();
}

async function updateWeight(weight) {
    const profile = await getProfile();
    const updatedProfile = {
        ...profile,
        weight: weight
    };
    return apiRequest('/profile', 'POST', updatedProfile);
}

async function updateAllGoalsProgressFromWeight(weight) {
    const goals = await getGoals();
    const results = [];
    for (const goal of goals) {
        try {
            const result = await updateGoalProgress(goal.id, weight);
            results.push({ goalId: goal.id, progress: result.progress });
        } catch (error) {
            console.error(`Ошибка обновления цели ${goal.id}:`, error);
        }
    }
    return results;
}

async function syncWeightAcrossAllGoals(newWeight, sourceGoalId = null) {
    await updateWeight(newWeight);
    const results = await updateAllGoalsProgressFromWeight(newWeight);
    return { newWeight, results };
}

async function updateGoalProgressBySteps(goalId, currentSteps) {
    return apiRequest(`/goals/${goalId}/update-progress`, 'PATCH', { current_steps: currentSteps });
}
