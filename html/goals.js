document.getElementById('goalType')?.addEventListener('change', function() {
    const muscleGroupSection = document.getElementById('muscleGroupSection');
    if (this.value === 'muscle_gain') {
        muscleGroupSection.style.display = 'block';
    } else {
        muscleGroupSection.style.display = 'none';
    }
});

document.getElementById('goalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const goalType = document.getElementById('goalType').value;
    const selectedMuscles = [];
    document.querySelectorAll('input[name="muscle_group"]:checked').forEach(cb => {
        selectedMuscles.push(cb.value);
    });
    
    let goalData = {
        type: goalType,
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value
    };
    
    if (goalType === 'steps') {

        const targetSteps = parseInt(document.getElementById('targetSteps').value);
        if (!targetSteps || targetSteps <= 0) {
            alert('Укажите целевое количество шагов');
            return;
        }
        goalData.target_steps = targetSteps;
        goalData.workouts_per_week = 0;
        goalData.meals_per_day = 0;
        goalData.target_muscles = [];
    } else {

        const desiredValue = parseFloat(document.getElementById('desiredValue').value);
        if (!desiredValue || desiredValue <= 0) {
            alert('Укажите желаемый вес');
            return;
        }
        goalData.desired_value = desiredValue;
        goalData.workouts_per_week = parseInt(document.getElementById('workoutsPerWeek').value);
        goalData.meals_per_day = parseInt(document.getElementById('mealsPerDay').value);
        goalData.target_muscles = selectedMuscles;
    }
    
    if (!goalData.start_date || !goalData.end_date) {
        alert('Укажите даты начала и окончания');
        return;
    }
    
    const start = new Date(goalData.start_date);
    const end = new Date(goalData.end_date);
    if (end <= start) {
        alert('Дата окончания должна быть позже даты начала');
        return;
    }
    
    try {
        const response = await fetch(API_BASE_URL + '/goals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
            body: JSON.stringify(goalData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Ошибка создания цели');
        }
        
        if (goalType === 'steps') {
            alert('✅ Цель на шаги создана!');
        } else {
            alert('✅ ' + data.message + '\n\n🍽️ Калорийность: ' + data.nutrition.calories + ' ккал/день\n🥩 Белок: ' + data.nutrition.protein + ' г');
        }
        
        document.getElementById('goalForm').reset();
        document.querySelectorAll('input[name="muscle_group"]').forEach(cb => cb.checked = false);
        document.getElementById('muscleGroupSection').style.display = 'none';
        document.getElementById('stepsGoalFields').style.display = 'none';
        document.getElementById('weightGoalFields').style.display = 'block';
        loadGoals();
        
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
});

function calculateMacros(calories, weight, goalType) {
    let protein, fat, carbs;
    
    if (goalType === 'weight_loss') {
        protein = Math.round(weight * 1.6);
        fat = Math.round((calories * 0.25) / 9);
        carbs = Math.round((calories - (protein * 4 + fat * 9)) / 4);
    } else {
        protein = Math.round(weight * 2.0);
        fat = Math.round((calories * 0.25) / 9);
        carbs = Math.round((calories - (protein * 4 + fat * 9)) / 4);
    }
    
    protein = Math.max(protein, 50);
    fat = Math.max(fat, 30);
    carbs = Math.max(carbs, 100);
    
    return { protein, fat, carbs };
}


function calculateProgressFromWeight(goalType, startWeight, currentWeight, targetWeight) {
    if (!startWeight || !currentWeight || !targetWeight) return 0;
    
    let progress = 0;
    
    if (goalType === 'weight_loss') {
        const totalToLose = startWeight - targetWeight;
        if (totalToLose > 0) {
            const lost = startWeight - currentWeight;
            progress = Math.min(100, Math.max(0, Math.round((lost / totalToLose) * 100)));
        }
        if (currentWeight <= targetWeight) progress = 100;
    } else if (goalType === 'muscle_gain') {
        const totalToGain = targetWeight - startWeight;
        if (totalToGain > 0) {
            const gained = currentWeight - startWeight;
            progress = Math.min(100, Math.max(0, Math.round((gained / totalToGain) * 100)));
        }
        if (currentWeight >= targetWeight) progress = 100;
    }
    
    return progress;
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


async function updateWeight(goalId) {
    const input = document.getElementById(`weight-input-${goalId}`);
    
    if (!input) {
        alert('Ошибка: поле ввода веса не найдено');
        return;
    }
    
    const current_weight = parseFloat(input.value);
    
    if (!current_weight || current_weight <= 0) {
        alert('Введите корректный вес (больше 0)');
        return;
    }
    
    const updateBtn = document.getElementById(`update-btn-${goalId}`);
    const originalBtnText = updateBtn ? updateBtn.textContent : '🔄 Обновить прогресс';
    
    try {
        if (updateBtn) updateBtn.textContent = '⏳ Обновление...';
        
        const profile = await getProfile();
        await saveProfile({
            ...profile,
            weight: current_weight
        });
        
        const goals = await getGoals();
        for (const goal of goals) {
            if (goal.type !== 'steps') {
                const result = await updateGoalProgress(goal.id, current_weight);
                updateProgressUI(goal.id, result.progress);
            }
        }
        
        const updatedGoal = goals.find(g => g.id == goalId);
        const progress = updatedGoal ? updatedGoal.progress : 0;
        
        alert(`✅ Вес обновлён до ${current_weight} кг!\nПрогресс: ${progress}%`);
        
    } catch (error) {
        console.error('Ошибка обновления веса:', error);
        alert('❌ Ошибка: ' + error.message);
    } finally {
        if (updateBtn) updateBtn.textContent = originalBtnText;
    }
}


async function updateSteps(goalId) {
    const input = document.getElementById(`steps-input-${goalId}`);
    if (!input) {
        alert('Ошибка: поле ввода не найдено');
        return;
    }
    
    const currentSteps = parseInt(input.value);
    if (isNaN(currentSteps) || currentSteps < 0) {
        alert('Введите корректное количество шагов (неотрицательное число)');
        return;
    }
    
    const updateBtn = document.getElementById(`update-steps-btn-${goalId}`);
    const originalText = updateBtn ? updateBtn.textContent : '🔄 Обновить прогресс';
    
    try {
        if (updateBtn) updateBtn.textContent = '⏳ Обновление...';
        

        localStorage.setItem(`steps_goal_${goalId}`, currentSteps);
        
        const response = await fetch(`${API_BASE_URL}/goals/${goalId}/update-progress`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            },
            body: JSON.stringify({ current_steps: currentSteps })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message);
        
        updateProgressUI(goalId, data.progress);
        alert(`✅ Прогресс обновлён: ${data.progress}%`);
        
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка: ' + error.message);
    } finally {
        if (updateBtn) updateBtn.textContent = originalText;
    }
}
async function loadGoals() {
    try {
        const goals = await getGoals();
        const container = document.getElementById('goalsList');
        
        if (!goals.length) {
            container.innerHTML = '<p>📭 Нет целей. Создайте первую!</p>';
            return;
        }
        
        let currentWeight = 70;
        try {
            const profile = await getProfile();
            currentWeight = profile?.weight || 70;
        } catch (e) {
            console.log('Не удалось получить вес, используем значение по умолчанию');
        }
        
        let html = '<h3>Мои цели:</h3>';
        
        for (let i = 0; i < goals.length; i++) {
            let g = goals[i];
            let progress = g.progress || 0;
            
            
	    if (g.type === 'steps') {
	        let targetSteps = g.target_steps;
	        let currentSteps = 0;
    
	    
	        try {
	            const healthData = await getHealthHistory();
	            if (healthData && healthData.length > 0) {
	    
	                currentSteps = healthData[0]?.steps || 0;
	            }
	        } catch(e) {
	            console.log('Не удалось загрузить шаги из health_data');
	        }
    
	    
	        const savedSteps = localStorage.getItem(`steps_goal_${g.id}`);
	        if (savedSteps !== null && !isNaN(parseInt(savedSteps))) {
	            currentSteps = parseInt(savedSteps);
	        }
    
	        html += `
	            <div class="goal-item" id="goal-${g.id}">
	                <strong>👣 Шаги</strong><br>
	                🎯 Цель: ${targetSteps ? targetSteps.toLocaleString() : 'не указано'} шагов<br>
	                📈 Прогресс: <span id="progress-${g.id}">${progress}</span>%
	                <div class="progress-bar-container">
	                    <div class="progress-bar" id="progress-bar-${g.id}" style="width: ${progress}%;"></div>
	                </div>
	                📅 С ${new Date(g.start_date).toLocaleDateString()} до ${new Date(g.end_date).toLocaleDateString()}
	                <div style="margin-top: 15px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
	                    <label>Пройдено шагов: </label>
	                    <input type="number" id="steps-input-${g.id}" step="1" style="width: 150px; padding: 5px;" value="${currentSteps}">
	                    <button onclick="updateSteps(${g.id})" class="update-btn" id="update-steps-btn-${g.id}">🔄 Обновить прогресс</button>
	                </div>
	                <button onclick="deleteGoal(${g.id})" class="delete-btn" style="margin-top: 10px;">🗑️ Удалить цель</button>
	            </div>
	        `;
	    }
            
            else {
                let typeText = g.type === 'weight_loss' ? '🏃 Похудение' : '💪 Набор мышечной массы';
                let targetCalories = g.target_calories || 2000;
                let startWeight = g.start_weight || currentWeight;
                
                const macros = calculateMacros(targetCalories, currentWeight, g.type);
                
                let workoutsText = '';
                switch(g.workouts_per_week) {
                    case 1: workoutsText = '1 раз в неделю'; break;
                    case 2: workoutsText = '2 раза в неделю'; break;
                    case 3: workoutsText = '3 раза в неделю'; break;
                    case 4: workoutsText = '4 раза в неделю'; break;
                    case 5: workoutsText = '5 раз в неделю'; break;
                    case 6: workoutsText = '6 раз в неделю'; break;
                    case 7: workoutsText = 'Каждый день'; break;
                    default: workoutsText = '3 раза в неделю';
                }
                
                let musclesText = '';
                if (g.type === 'muscle_gain' && g.target_muscles && g.target_muscles.length) {
                    const muscleNames = {
                        'грудь': '💪 Грудь', 'спина': '🔙 Спина', 'ноги': '🦵 Ноги',
                        'плечи': '🏋️ Плечи', 'руки': '💪 Руки', 'пресс': '🔥 Пресс',
                        'кардио': '🏃 Кардио'
                    };
                    const selected = g.target_muscles.split(',').map(m => muscleNames[m.trim()] || m.trim());
                    musclesText = `<br>🎯 Фокус: ${selected.join(', ')}`;
                }
                
                let barColor = '';
                if (progress >= 100) barColor = '#38a169';
                else if (progress >= 75) barColor = '#48bb78';
                else if (progress >= 50) barColor = '#ecc94b';
                else if (progress >= 25) barColor = '#ed8936';
                else barColor = '#ed64a6';
                
                html += `
                    <div class="goal-item" id="goal-${g.id}">
                        <strong>${typeText}</strong>${musclesText}<br>
                        📊 Стартовый вес: <strong>${startWeight}</strong> кг → 🎯 Цель: <strong>${g.desired_value}</strong> кг<br>
                        🔥 КБЖУ: ${targetCalories} ккал | Б: ${macros.protein} г | Ж: ${macros.fat} г | У: ${macros.carbs} г<br>
                        🏋️ Тренировки: ${workoutsText}<br>
                        📈 Прогресс: <span id="progress-${g.id}">${progress}</span>%
                        <div class="progress-bar-container">
                            <div class="progress-bar" id="progress-bar-${g.id}" style="width: ${progress}%; background: ${barColor};"></div>
                        </div>
                        📅 С ${new Date(g.start_date).toLocaleDateString()} до ${new Date(g.end_date).toLocaleDateString()}
                        <div style="margin-top: 15px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <label>Текущий вес (кг): </label>
                            <input type="number" id="weight-input-${g.id}" step="0.1" placeholder="${currentWeight}" style="width: 120px; padding: 5px;" value="${currentWeight}">
                            <button onclick="updateWeight(${g.id})" class="update-btn" id="update-btn-${g.id}">🔄 Обновить прогресс</button>
                        </div>
                        <button onclick="deleteGoal(${g.id})" class="delete-btn" style="margin-top: 10px;">🗑️ Удалить цель</button>
                    </div>
                `;
            }
        }
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка загрузки целей:', error);
        document.getElementById('goalsList').innerHTML = '<p>❌ Ошибка загрузки</p>';
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Вы уверены, что хотите удалить эту цель? Все связанные планы также будут удалены.')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + sessionStorage.getItem('token')
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка удаления');
        }
        
        alert('✅ Цель удалена');
        loadGoals();
    } catch (error) {
        alert('❌ Ошибка удаления: ' + error.message);
    }
}

async function updateStepsFromBridge(goalId, steps) {
    const input = document.getElementById(`steps-input-${goalId}`);
    if (input) {
        input.value = steps;

        localStorage.setItem(`steps_goal_${goalId}`, steps);
        console.log(`📝 Обновлено поле шагов для цели ${goalId}: ${steps}`);
    }
}


window.updateStepsFromBridge = updateStepsFromBridge;

window.updateProgressUI = updateProgressUI;
window.updateWeight = updateWeight;
window.updateSteps = updateSteps;
window.deleteGoal = deleteGoal;


loadGoals();
