let editingMode = false;
let currentEditingPlanId = null;
let currentGoalId = null;
let allWorkoutPlans = [];



async function loadGoalsForSelect() {
    try {
        const goals = await getGoals();
        const select = document.getElementById('goalSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Выберите цель --</option>';
        

        const weightGoals = goals.filter(g => g.type !== 'steps');
        
        if (weightGoals.length === 0) {
            select.innerHTML += '<option value="" disabled>-- Нет активных целей по весу --</option>';
            return;
        }
        
        for (let g of weightGoals) {
            const typeText = g.type === 'weight_loss' ? '🏃 Похудение' : '💪 Набор массы';
            select.innerHTML += `<option value="${g.id}">${typeText} до ${g.desired_value} кг (${new Date(g.start_date).toLocaleDateString()} - ${new Date(g.end_date).toLocaleDateString()})</option>`;
        }
        
        const savedGoalId = sessionStorage.getItem('selectedWorkoutGoalId');
        if (savedGoalId && document.querySelector(`#goalSelect option[value="${savedGoalId}"]`)) {
            select.value = savedGoalId;
            currentGoalId = savedGoalId;
        }
    } catch (error) {
        console.error('Ошибка загрузки целей:', error);
    }
}
async function loadWorkoutPlans() {
    currentGoalId = document.getElementById('goalSelect').value;
    if (!currentGoalId) {
        alert('Выберите цель');
        return;
    }
    
    sessionStorage.setItem('selectedWorkoutGoalId', currentGoalId);
    
    try {
        const allPlans = await getWorkoutPlans();
        allWorkoutPlans = allPlans.filter(plan => plan.goal_id == currentGoalId);
        console.log(`📋 Загружено ${allWorkoutPlans.length} планов тренировок для цели ${currentGoalId}`);
        displayWorkoutPlans();
    } catch (error) {
        console.error('Ошибка загрузки тренировок:', error);
        document.getElementById('workoutPlansList').innerHTML = '<p>❌ Ошибка загрузки</p>';
    }
}

async function displayWorkoutPlans() {
    const container = document.getElementById('workoutPlansList');
    
    if (!allWorkoutPlans.length) {
        container.innerHTML = '<p>📭 Нет планов тренировок для выбранной цели</p>';
        return;
    }
    
    let html = '<h3>Мои тренировочные планы:</h3>';
    
    for (let i = 0; i < allWorkoutPlans.length; i++) {
        const p = allWorkoutPlans[i];
        const exercises = await getWorkoutPlanExercises(p.id);
        
        html += `
            <div class="plan-item" id="plan-${p.id}">
                <strong>${p.name}</strong><br>
                📅 ${new Date(p.start_date).toLocaleDateString()}<br>
                <button onclick="toggleEditMode(${p.id})" class="edit-plan-btn" id="edit-btn-${p.id}">✏️ Редактировать план</button>
                <div id="exercises-container-${p.id}">
                    <h4>🏋️ Упражнения:</h4>
                    <ul id="exercises-list-${p.id}" style="list-style: none; padding: 0;">
        `;
        
        for (let ex of exercises) {
            const completedClass = ex.is_completed ? 'completed' : '';
            const exerciseInfo = ex.duration ? `${ex.duration} минут` : `${ex.sets} × ${ex.reps}`;
            const caloriesInfo = ex.calories_burned ? `<span class="calories-info">🔥 ~${ex.calories_burned} ккал</span>` : '';
            const heartIcon = ex.is_favorite ? '❤️' : '♡';
            
            html += `
                <li id="exercise-${p.id}-${ex.exercise_id}" class="exercise-item ${completedClass}">
                    <label class="checkbox-label" onclick="event.stopPropagation(); handleExerciseComplete(${p.id}, ${ex.exercise_id}, ${!ex.is_completed})">
                        <span class="checkbox-custom ${ex.is_completed ? 'checked' : ''}"></span>
                        <span class="exercise-name" onclick="event.stopPropagation(); showExerciseDetails(${ex.exercise_id})"><strong>${ex.name}</strong>: ${exerciseInfo} ${caloriesInfo}</span>
                    </label>
                    <div class="item-actions">
                        <button class="heart-btn ${ex.is_favorite ? 'active' : ''}" onclick="event.stopPropagation(); handleExerciseFavorite(${p.id}, ${ex.exercise_id}, ${!ex.is_favorite})">
                            ${heartIcon}
                        </button>
                        <span class="replace-btn" style="display: none;" onclick="event.stopPropagation(); showReplaceExerciseModal(${p.id}, ${ex.exercise_id}, ${ex.sets}, ${ex.reps})">✏️ Заменить</span>
                    </div>
                </li>
            `;
        }
        
        html += `
                    </ul>
                </div>
                <button onclick="deleteWorkoutPlan(${p.id})" class="delete-btn">🗑️ Удалить план</button>
            </div>
        `;
    }
    container.innerHTML = html;
    
    if (editingMode && currentEditingPlanId) {
        toggleEditMode(currentEditingPlanId);
    }
}


async function showExerciseDetails(exerciseId) {
    try {
        const exercise = await getExerciseDetails(exerciseId);
        

        let imageUrl = '';
        if (exercise.image_url) {
            if (exercise.image_url.startsWith('/')) {
                imageUrl = exercise.image_url;
            } else {
                imageUrl = exercise.image_url;
            }
        }
        
        const muscleGroups = exercise.muscle_group ? exercise.muscle_group.split(',').map(m => m.trim()) : [];
        
        const modalHtml = `
            <div id="detailModal" class="detail-modal" onclick="closeDetailModal(event)">
                <div class="detail-modal-content" onclick="event.stopPropagation()">
                    <div class="detail-modal-header">
                        <h2>🏋️ ${exercise.name}</h2>
                        <div class="subtitle">${exercise.exercise_type === 'strength' ? '💪 Силовое' : exercise.exercise_type === 'cardio' ? '🏃 Кардио' : '🧘 Растяжка'}</div>
                    </div>
                    <div class="detail-modal-body">
                        ${imageUrl ? 
                            `<img src="${imageUrl}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23718096%22%3E📷%3C/text%3E%3C/svg%3E'" style="width: 100%; border-radius: 12px;">` : 
                            `<div style="background: linear-gradient(135deg, #48bb78, #38a169); height: 180px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; flex-direction: column;">
                                <span style="font-size: 48px;">🏋️</span>
                                <span>${exercise.name}</span>
                             </div>`
                        }
                        
                        <div class="detail-section">
                            <h3>💪 Работающие мышцы</h3>
                            <div>
                                ${muscleGroups.map(m => `<span class="detail-badge">${m}</span>`).join('')}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h3>📖 Техника выполнения</h3>
                            <p>${exercise.description || 'Описание не указано'}</p>
                        </div>
                        
                        ${exercise.contraindications ? `
                        <div class="detail-section">
                            <h3>⚠️ Противопоказания</h3>
                            <div class="contraindications">
                                <strong>Противопоказания:</strong>
                                <p>${exercise.contraindications}</p>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${exercise.met_value ? `
                        <div class="detail-section">
                            <h3>📊 Энергозатраты</h3>
                            <span class="met-value">MET: ${exercise.met_value}</span>
                            ${exercise.calories_per_minute ? `<span class="met-value" style="margin-left: 10px;">🔥 ~${exercise.calories_per_minute} ккал/мин</span>` : ''}
                        </div>
                        ` : ''}
                        
                        <button class="detail-close-btn" onclick="closeDetailModal()">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error('Ошибка загрузки деталей упражнения:', error);
        alert('Ошибка загрузки: ' + error.message);
    }
}

function closeDetailModal(event) {
    const modal = document.getElementById('detailModal');
    if (modal) modal.remove();
}

async function handleExerciseComplete(planId, exerciseId, isCompleted) {
    try {
        await apiRequest(`/workout-plans/${planId}/exercises/${exerciseId}/complete`, 'PATCH', { is_completed: isCompleted });
        await loadWorkoutPlans();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}


async function handleExerciseFavorite(planId, exerciseId, isFavorite) {
    try {
        await toggleExerciseFavorite(exerciseId, isFavorite);
        

        const heartBtn = document.querySelector(`#exercise-${planId}-${exerciseId} .heart-btn`);
        if (heartBtn) {
            if (isFavorite) {
                heartBtn.classList.add('active');
                heartBtn.textContent = '❤️';
            } else {
                heartBtn.classList.remove('active');
                heartBtn.textContent = '♡';
            }
        }
        
        if (typeof loadFavoriteExercises === 'function') {
            loadFavoriteExercises();
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}


function toggleEditMode(planId) {
    if (currentEditingPlanId === planId && editingMode) {
        editingMode = false;
        currentEditingPlanId = null;
        const replaceBtns = document.querySelectorAll(`#plan-${planId} .replace-btn`);
        const editBtn = document.getElementById(`edit-btn-${planId}`);
        
        replaceBtns.forEach(btn => btn.style.display = 'none');
        if (editBtn) {
            editBtn.textContent = '✏️ Редактировать план';
            editBtn.style.background = '#4299e1';
        }
    } else {
        if (currentEditingPlanId && currentEditingPlanId !== planId) {
            const oldEditBtn = document.getElementById(`edit-btn-${currentEditingPlanId}`);
            const oldReplaceBtns = document.querySelectorAll(`#plan-${currentEditingPlanId} .replace-btn`);
            oldReplaceBtns.forEach(btn => btn.style.display = 'none');
            if (oldEditBtn) {
                oldEditBtn.textContent = '✏️ Редактировать план';
                oldEditBtn.style.background = '#4299e1';
            }
        }
        
        editingMode = true;
        currentEditingPlanId = planId;
        const replaceBtns = document.querySelectorAll(`#plan-${planId} .replace-btn`);
        const editBtn = document.getElementById(`edit-btn-${planId}`);
        
        replaceBtns.forEach(btn => btn.style.display = 'inline-block');
        if (editBtn) {
            editBtn.textContent = '✅ Готово';
            editBtn.style.background = '#48bb78';
        }
    }
}

async function showReplaceExerciseModal(planId, oldExerciseId, currentSets, currentReps) {
    if (!editingMode || currentEditingPlanId !== planId) {
        alert('Сначала нажмите "Редактировать план" для этого плана');
        return;
    }
    
    try {
        const exercises = await getAllExercises();
        
        const grouped = {
            strength: {
                грудь: [],
                спина: [],
                ноги: [],
                плечи: [],
                руки: [],
                пресс: []
            },
            cardio: [],
            stretching: []
        };
        
        exercises.forEach(ex => {
            if (ex.exercise_type === 'strength') {
                const muscle = ex.muscle_group || 'другое';
                if (grouped.strength[muscle]) {
                    grouped.strength[muscle].push(ex);
                } else {
                    if (!grouped.strength.другое) grouped.strength.другое = [];
                    grouped.strength.другое.push(ex);
                }
            } else if (ex.exercise_type === 'cardio') {
                grouped.cardio.push(ex);
            } else if (ex.exercise_type === 'stretching') {
                grouped.stretching.push(ex);
            }
        });
        
        let optionsHtml = '';
        
        if (grouped.strength.грудь.length > 0) {
            optionsHtml += '<optgroup label="🏋️ Силовые - Грудь">';
            grouped.strength.грудь.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name} (${ex.muscle_group})</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.strength.спина.length > 0) {
            optionsHtml += '<optgroup label="🏋️ Силовые - Спина">';
            grouped.strength.спина.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name} (${ex.muscle_group})</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.strength.ноги.length > 0) {
            optionsHtml += '<optgroup label="🏋️ Силовые - Ноги">';
            grouped.strength.ноги.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name} (${ex.muscle_group})</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.strength.плечи.length > 0) {
            optionsHtml += '<optgroup label="🏋️ Силовые - Плечи">';
            grouped.strength.плечи.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name} (${ex.muscle_group})</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.strength.руки.length > 0) {
            optionsHtml += '<optgroup label="🏋️ Силовые - Руки">';
            grouped.strength.руки.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name} (${ex.muscle_group})</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.strength.пресс.length > 0) {
            optionsHtml += '<optgroup label="🏋️ Силовые - Пресс">';
            grouped.strength.пресс.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name} (${ex.muscle_group})</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.cardio.length > 0) {
            optionsHtml += '<optgroup label="🏃 Кардио">';
            grouped.cardio.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name}</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        if (grouped.stretching.length > 0) {
            optionsHtml += '<optgroup label="🧘 Растяжка">';
            grouped.stretching.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name}</option>`;
            });
            optionsHtml += '</optgroup>';
        }
        
        const modalHtml = `
            <div id="replaceModal" class="modal">
                <div class="modal-content">
                    <h3>Заменить упражнение</h3>
                    <select id="newExerciseId">${optionsHtml}</select>
                    <input type="number" id="newSets" placeholder="Количество подходов" value="${currentSets}">
                    <input type="number" id="newReps" placeholder="Количество повторений" value="${currentReps}">
                    <button onclick="confirmReplaceExercise(${planId}, ${oldExerciseId})">Заменить</button>
                    <button onclick="closeModal()">Отмена</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('replaceModal').style.display = 'flex';
    } catch (error) {
        alert('Ошибка загрузки упражнений: ' + error.message);
    }
}

async function confirmReplaceExercise(planId, oldExerciseId) {
    const newExerciseId = document.getElementById('newExerciseId').value;
    const sets = document.getElementById('newSets').value;
    const reps = document.getElementById('newReps').value;
    
    try {
        await replaceExercise(planId, oldExerciseId, newExerciseId, sets, reps);
        alert('✅ Упражнение заменено!');
        closeModal();
        loadWorkoutPlans();
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

function closeModal() {
    const modal = document.getElementById('replaceModal');
    if (modal) modal.remove();
}

async function deleteWorkoutPlan(planId) {
    if (!confirm('Вы уверены, что хотите удалить этот план тренировок?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/workout-plans/${planId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
        });
        
        if (response.ok) {
            alert('✅ План тренировок удалён');
            loadWorkoutPlans();
        } else {
            const data = await response.json();
            alert('❌ Ошибка: ' + (data.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

loadGoalsForSelect();
