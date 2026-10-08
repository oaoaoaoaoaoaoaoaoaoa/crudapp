let previousWeight = null;

 
async function loadProfile() {
    try {
        const profile = await getProfile();
        if (profile) {
            document.getElementById('height').value = profile.height || '';
            document.getElementById('weight').value = profile.weight || '';
            document.getElementById('age').value = profile.age || '';
            document.getElementById('gender').value = profile.gender || '';
            document.getElementById('bodyType').value = profile.body_type || '';
            document.getElementById('activityLevel').value = profile.activity_level || 'moderate';
            

            previousWeight = profile.weight ? parseFloat(profile.weight) : null;
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}


function updateProgressUI(goalId, progress) {

    const progressSpan = document.getElementById(`progress-${goalId}`);
    if (progressSpan) {
        progressSpan.innerText = progress;
    }
    

    const progressBar = document.getElementById(`progress-bar-${goalId}`);
    if (progressBar) {
        progressBar.style.width = progress + '%';
        

        if (progress >= 100) {
            progressBar.style.background = '#38a169';
        } else if (progress >= 75) {
            progressBar.style.background = '#48bb78';
        } else if (progress >= 50) {
            progressBar.style.background = '#ecc94b';
        } else if (progress >= 25) {
            progressBar.style.background = '#ed8936';
        } else {
            progressBar.style.background = '#ed64a6';
        }
    }
}


async function syncWeightWithAllGoals(newWeight) {
    try {

        const goals = await getGoals();
        
        if (!goals || goals.length === 0) {
            console.log('Нет активных целей для синхронизации');
            return;
        }
        

        for (const goal of goals) {
            const result = await updateGoalProgress(goal.id, newWeight);

            updateProgressUI(goal.id, result.progress);
        }
        
        console.log(`Синхронизировано ${goals.length} целей, новый вес: ${newWeight} кг`);
        

        if (typeof loadGoals === 'function') {
            setTimeout(() => loadGoals(), 100);
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка синхронизации веса с целями:', error);
        throw error;
    }
}


async function updateSingleGoalProgress(goalId, newWeight) {
    try {
        const result = await updateGoalProgress(goalId, newWeight);
        updateProgressUI(goalId, result.progress);
        return result;
    } catch (error) {
        console.error('Ошибка обновления цели:', error);
        throw error;
    }
}


const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newWeightInput = document.getElementById('weight').value;
        const newWeightNum = newWeightInput ? parseFloat(newWeightInput) : null;
        
        const data = {
            height: document.getElementById('height').value || null,
            weight: newWeightNum,
            age: document.getElementById('age').value || null,
            gender: document.getElementById('gender').value || null,
            body_type: document.getElementById('bodyType').value || null,
            activity_level: document.getElementById('activityLevel').value || 'moderate'
        };
        

        const submitBtn = profileForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'Сохранить';
        if (submitBtn) submitBtn.textContent = '⏳ Сохранение...';
        
        try {

            await saveProfile(data);
            

            const weightChanged = (previousWeight !== newWeightNum && newWeightNum !== null);
            
            const msg = document.getElementById('profileMessage');
            
            if (weightChanged) {

                await syncWeightWithAllGoals(newWeightNum);
                
                msg.innerHTML = '<p class="success">✅ Профиль сохранён! Прогресс всех целей обновлён.</p>';
                

                previousWeight = newWeightNum;
            } else {
                msg.innerHTML = '<p class="success">✅ Профиль сохранён!</p>';
            }
            

            setTimeout(() => {
                if (msg) msg.innerHTML = '';
            }, 3000);
            

            await loadProfile();
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            const msg = document.getElementById('profileMessage');
            msg.innerHTML = '<p class="error">❌ Ошибка: ' + error.message + '</p>';
            setTimeout(() => {
                if (msg) msg.innerHTML = '';
            }, 5000);
        } finally {

            if (submitBtn) submitBtn.textContent = originalBtnText;
        }
    });
}


let ingredientsList = [];

async function loadIngredientsList() {
    try {
        ingredientsList = await getIngredientsList();
        const userAllergies = await getUserAllergies();
        const container = document.getElementById('allergiesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (ingredientsList.length === 0) {
            container.innerHTML = '<p>📭 Нет доступных ингредиентов. Добавьте рецепты с ингредиентами.</p>';
            return;
        }
        
        ingredientsList.forEach(ingredient => {
            const isChecked = userAllergies.includes(ingredient.name);
            container.innerHTML += `
                <label style="display: inline-flex; align-items: center; gap: 5px; margin-right: 15px; margin-bottom: 8px; cursor: pointer;">
                    <input type="checkbox" value="${ingredient.name.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
                    ${ingredient.name}
                </label>
            `;
        });
    } catch (error) {
        console.error('Ошибка загрузки ингредиентов:', error);
        const container = document.getElementById('allergiesContainer');
        if (container) {
            container.innerHTML = '<p class="error">❌ Ошибка загрузки списка аллергенов</p>';
        }
    }
}

async function saveAllergies() {
    const checkboxes = document.querySelectorAll('#allergiesContainer input[type="checkbox"]');
    const selectedAllergies = [];
    
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedAllergies.push(cb.value);
        }
    });
    

    const saveBtn = document.getElementById('saveAllergiesBtn');
    const originalBtnText = saveBtn ? saveBtn.textContent : 'Сохранить аллергии';
    if (saveBtn) saveBtn.textContent = '⏳ Сохранение...';
    
    try {
        await saveUserAllergies(selectedAllergies);
        const msg = document.getElementById('allergiesMessage');
        msg.innerHTML = '<p class="success">✅ Аллергии сохранены!</p>';
        setTimeout(() => msg.innerHTML = '', 3000);
    } catch (error) {
        console.error('Ошибка сохранения аллергий:', error);
        const msg = document.getElementById('allergiesMessage');
        msg.innerHTML = '<p class="error">❌ Ошибка сохранения аллергий: ' + error.message + '</p>';
        setTimeout(() => msg.innerHTML = '', 5000);
    } finally {
        if (saveBtn) saveBtn.textContent = originalBtnText;
    }
}

const saveAllergiesBtn = document.getElementById('saveAllergiesBtn');
if (saveAllergiesBtn) {
    saveAllergiesBtn.addEventListener('click', saveAllergies);
}

async function confirmDeleteAccount() {
    const confirmed = confirm('⚠️ ВНИМАНИЕ! Это действие НЕОБРАТИМО.\n\nВы уверены, что хотите удалить свой аккаунт?\n\nБудут удалены:\n- ваш профиль\n- все цели\n- все планы питания и тренировок\n- вся история здоровья\n- избранное\n\nЭто действие нельзя отменить!');
    
    if (!confirmed) return;
    

    
    try {
        const response = await fetch(`${API_BASE_URL}/user/account`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('✅ Аккаунт успешно удалён');
            sessionStorage.clear();
            window.location.href = 'index.html';
        } else {
            alert('❌ Ошибка: ' + (data.message || 'Не удалось удалить аккаунт'));
        }
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        alert('❌ Ошибка соединения: ' + error.message);
    }
}


window.confirmDeleteAccount = confirmDeleteAccount;

window.updateProgressUI = updateProgressUI;
window.syncWeightWithAllGoals = syncWeightWithAllGoals;
window.updateSingleGoalProgress = updateSingleGoalProgress;


loadProfile();
loadIngredientsList();
