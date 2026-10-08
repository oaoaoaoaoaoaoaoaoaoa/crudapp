let editingModeMeal = false;
let currentEditingMealPlanId = null;
let currentGoalId = null;
let allMealPlans = [];


const mealPlansRecipesCache = new Map();

function formatServings(servings) {
    if (!servings || servings === 1.0) return '';
    if (servings === 0.5) return ' ½';
    if (servings === 1.5) return ' 1½';
    if (servings === 2.5) return ' 2½';
    if (servings === 2.0) return ' 2';
    if (servings === 3.0) return ' 3';
    return ' ' + servings;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}



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
            const mealsText = g.meals_per_day ? ' (' + g.meals_per_day + ' приёмов)' : '';
            const typeText = g.type === 'weight_loss' ? '🏃 Похудение' : '💪 Набор массы';
            const startDate = new Date(g.start_date).toLocaleDateString();
            const endDate = new Date(g.end_date).toLocaleDateString();
            select.innerHTML += '<option value="' + g.id + '">' + typeText + ' до ' + g.desired_value + ' кг' + mealsText + ' (' + startDate + ' - ' + endDate + ')</option>';
        }
        
        const savedGoalId = localStorage.getItem('selectedMealGoalId');
        if (savedGoalId && document.querySelector(`#goalSelect option[value="${savedGoalId}"]`)) {
            select.value = savedGoalId;
            currentGoalId = savedGoalId;
        }
    } catch (error) {
        console.error('Ошибка загрузки целей:', error);
    }
}
async function loadMealPlans() {
    currentGoalId = document.getElementById('goalSelect').value;
    if (!currentGoalId) {
        document.getElementById('mealPlansList').innerHTML = '<p>⚠️ Выберите цель</p>';
        return;
    }
    
    localStorage.setItem('selectedMealGoalId', currentGoalId);
    
    try {
        const allPlans = await getMealPlans();
        const filteredPlans = allPlans.filter(plan => plan.goal_id == currentGoalId);
        
        filteredPlans.sort((a, b) => {
            const numA = parseInt(a.name.match(/\d+/)?.[0] || 0);
            const numB = parseInt(b.name.match(/\d+/)?.[0] || 0);
            return numA - numB;
        });
        
        allMealPlans = filteredPlans;
        mealPlansRecipesCache.clear();
        
        console.log('📋 Загружено ' + allMealPlans.length + ' планов питания');
        await displayMealPlans();
    } catch (error) {
        console.error('Ошибка загрузки планов питания:', error);
        document.getElementById('mealPlansList').innerHTML = '<p>❌ Ошибка загрузки</p>';
    }
}

async function getCachedMealPlanRecipes(planId) {
    if (mealPlansRecipesCache.has(planId)) {
        return mealPlansRecipesCache.get(planId);
    }
    const recipes = await getMealPlanRecipes(planId);
    mealPlansRecipesCache.set(planId, recipes);
    return recipes;
}

async function updateCachedRecipeServings(planId, recipeId, newServings, newTotalCalories) {
    const recipes = await getCachedMealPlanRecipes(planId);
    const recipe = recipes.find(r => r.recipe_id == recipeId);
    if (recipe) {
        recipe.servings = newServings;
    }
    
    const plan = allMealPlans.find(p => p.id == planId);
    if (plan && newTotalCalories !== undefined) {
        plan.total_calories = newTotalCalories;
    }
}

async function changeServings(planId, recipeId, newServings) {
    newServings = parseFloat(newServings);
    if (isNaN(newServings)) return;
    
    newServings = Math.round(newServings * 2) / 2;
    
    if (newServings < 0.5 || newServings > 3.0) return;
    
    const recipeElement = document.getElementById(`recipe-${planId}-${recipeId}`);
    if (!recipeElement) return;
    
    const oldServingsSpan = recipeElement.querySelector('.servings-value');
    if (!oldServingsSpan) return;
    
    const oldServings = parseFloat(oldServingsSpan.textContent);
    if (oldServings === newServings) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/meal-plans/${planId}/recipes/${recipeId}/servings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ servings: newServings })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка обновления порции');
        }
        
        const data = await response.json();
        
        await updateCachedRecipeServings(planId, recipeId, newServings, data.totalCalories);
        
        updateRecipeServingsUI(planId, recipeId, newServings, data.totalCalories);
        
    } catch (error) {
        console.error('Ошибка обновления порции:', error);
        alert('Ошибка: ' + error.message);
    }
}

function updateRecipeServingsUI(planId, recipeId, newServings, newTotalCalories) {
    const recipeElement = document.getElementById(`recipe-${planId}-${recipeId}`);
    if (!recipeElement) return;
    
    const servingsSpan = recipeElement.querySelector('.servings-value');
    if (servingsSpan) {
        servingsSpan.textContent = newServings;
    }
    
    const caloriesInfo = recipeElement.querySelector('.calories-info');
    if (caloriesInfo) {
        const originalCalories = parseFloat(recipeElement.dataset.originalCalories);
        if (!isNaN(originalCalories)) {
            const actualCalories = Math.round(originalCalories * newServings);
            const servingsText = formatServings(newServings);
            caloriesInfo.textContent = `(${actualCalories} ккал${servingsText})`;
        }
    }
    
    const planElement = document.getElementById(`mealplan-${planId}`);
    if (planElement && newTotalCalories !== undefined) {
        const caloriesSpan = planElement.querySelector('.plan-calories');
        if (caloriesSpan) {
            caloriesSpan.textContent = newTotalCalories;
        }
    }
    
    updateServingsButtons(planId, recipeId, newServings);
}

function updateServingsButtons(planId, recipeId, currentServings) {
    const recipeElement = document.getElementById(`recipe-${planId}-${recipeId}`);
    if (!recipeElement) return;
    
    const minusBtn = recipeElement.querySelector('.servings-btn[data-action="minus"]');
    const plusBtn = recipeElement.querySelector('.servings-btn[data-action="plus"]');
    
    if (minusBtn) {
        const newMinusValue = (currentServings - 0.5).toFixed(1);
        minusBtn.setAttribute('data-new-servings', newMinusValue);
    }
    
    if (plusBtn) {
        const newPlusValue = (currentServings + 0.5).toFixed(1);
        plusBtn.setAttribute('data-new-servings', newPlusValue);
    }
}

function handleServingsClick(event) {
    event.stopPropagation();
    const button = event.currentTarget;
    const planId = parseInt(button.dataset.planId);
    const recipeId = parseInt(button.dataset.recipeId);
    const newServings = parseFloat(button.dataset.newServings);
    
    if (!isNaN(newServings)) {
        changeServings(planId, recipeId, newServings);
    }
}

async function displayMealPlans() {
    const container = document.getElementById('mealPlansList');
    
    if (!allMealPlans.length) {
        container.innerHTML = '<p>📭 Нет планов питания для выбранной цели</p>';
        return;
    }
    
    let html = '<h3>Мои планы питания:</h3>';
    
    for (const plan of allMealPlans) {
        const recipes = await getCachedMealPlanRecipes(plan.id);
        const isEditing = (editingModeMeal && currentEditingMealPlanId === plan.id);
        
        html += generateMealPlanHTML(plan, recipes, isEditing);
    }
    
    container.innerHTML = html;
    
    attachServingsEventListeners();
    
    if (editingModeMeal && currentEditingMealPlanId) {
        highlightEditingPlan(currentEditingMealPlanId);
    }
}

function generateMealPlanHTML(plan, recipes, isEditing) {
    let html = `<div class="plan-item" id="mealplan-${plan.id}">`;
    html += `<strong>${escapeHtml(plan.name)}</strong><br>`;
    html += `🔥 Калории: <span class="plan-calories">${plan.total_calories || 0}</span> ккал<br>`;
    html += `📅 Создан: ${new Date(plan.created_at).toLocaleString()}<br>`;
    html += `<button onclick="toggleEditModeMeal(${plan.id})" class="edit-plan-btn" id="edit-btn-meal-${plan.id}" style="background: ${isEditing ? '#48bb78' : '#4299e1'}">`;
    html += isEditing ? '✅ Готово' : '✏️ Редактировать план';
    html += `</button>`;
    html += `<div id="recipes-container-${plan.id}">`;
    html += `<h4>🍽️ Рецепты:</h4>`;
    html += `<ul id="recipes-list-${plan.id}" style="list-style: none; padding: 0;">`;
    
    for (const recipe of recipes) {
        html += generateRecipeItemHTML(plan.id, recipe, isEditing);
    }
    
    html += `</ul></div>`;
    html += `<button onclick="deleteMealPlan(${plan.id})" class="delete-btn">🗑️ Удалить план</button>`;
    html += `</div>`;
    
    return html;
}

function generateRecipeItemHTML(planId, recipe, isEditing) {
    const mealType = recipe.meal_type ? `${recipe.meal_type}: ` : '';
    const completedClass = recipe.is_completed ? 'completed' : '';
    const heartIcon = recipe.is_favorite ? '❤️' : '♡';
    const servings = parseFloat(recipe.servings) || 1.0;
    const actualCalories = Math.round(recipe.calories * servings);
    const servingsText = formatServings(servings);
    
    let html = `<li id="recipe-${planId}-${recipe.recipe_id}" class="recipe-item ${completedClass}" data-original-calories="${recipe.calories}">`;
    html += `<label class="checkbox-label" onclick="event.stopPropagation(); handleRecipeComplete(${planId}, ${recipe.recipe_id}, ${!recipe.is_completed})">`;
    html += `<span class="checkbox-custom ${recipe.is_completed ? 'checked' : ''}"></span>`;
    html += `<span class="recipe-name" onclick="event.stopPropagation(); showRecipeDetails(${recipe.recipe_id})">`;
    html += `<strong>${escapeHtml(mealType)}${escapeHtml(recipe.name)}</strong>`;
    html += `<span class="calories-info">(${actualCalories} ккал${servingsText})</span>`;
    html += `</span></label>`;
    html += `<div class="item-actions">`;
    html += `<span class="servings-control" style="display: ${isEditing ? 'inline-flex' : 'none'}; align-items: center; gap: 5px; margin-right: 10px;">`;
    html += `<button class="servings-btn" data-action="minus" data-plan-id="${planId}" data-recipe-id="${recipe.recipe_id}" data-new-servings="${(servings - 0.5).toFixed(1)}">-</button>`;
    html += `<span class="servings-value">${servings}</span>`;
    html += `<button class="servings-btn" data-action="plus" data-plan-id="${planId}" data-recipe-id="${recipe.recipe_id}" data-new-servings="${(servings + 0.5).toFixed(1)}">+</button>`;
    html += `</span>`;
    html += `<button class="heart-btn ${recipe.is_favorite ? 'active' : ''}" onclick="event.stopPropagation(); handleRecipeFavorite(${planId}, ${recipe.recipe_id}, ${!recipe.is_favorite})">${heartIcon}</button>`;
    html += `<span class="replace-btn-meal" style="display: ${isEditing ? 'inline-block' : 'none'};" onclick="event.stopPropagation(); showReplaceRecipeModal(${planId}, ${recipe.recipe_id})">✏️ Заменить</span>`;
    html += `</div></li>`;
    
    return html;
}

function attachServingsEventListeners() {
    const minusButtons = document.querySelectorAll('.servings-btn[data-action="minus"]');
    const plusButtons = document.querySelectorAll('.servings-btn[data-action="plus"]');
    
    minusButtons.forEach(button => {
        button.removeEventListener('click', handleServingsClick);
        button.addEventListener('click', handleServingsClick);
    });
    
    plusButtons.forEach(button => {
        button.removeEventListener('click', handleServingsClick);
        button.addEventListener('click', handleServingsClick);
    });
}

function highlightEditingPlan(planId) {
    const editBtn = document.getElementById(`edit-btn-meal-${planId}`);
    if (editBtn) {
        editBtn.textContent = '✅ Готово';
        editBtn.style.background = '#48bb78';
    }
    
    const replaceBtns = document.querySelectorAll(`#mealplan-${planId} .replace-btn-meal`);
    const servingsControls = document.querySelectorAll(`#mealplan-${planId} .servings-control`);
    
    replaceBtns.forEach(btn => btn.style.display = 'inline-block');
    servingsControls.forEach(ctrl => ctrl.style.display = 'inline-flex');
}

function resetEditingPlan(planId) {
    const editBtn = document.getElementById(`edit-btn-meal-${planId}`);
    if (editBtn) {
        editBtn.textContent = '✏️ Редактировать план';
        editBtn.style.background = '#4299e1';
    }
    
    const replaceBtns = document.querySelectorAll(`#mealplan-${planId} .replace-btn-meal`);
    const servingsControls = document.querySelectorAll(`#mealplan-${planId} .servings-control`);
    
    replaceBtns.forEach(btn => btn.style.display = 'none');
    servingsControls.forEach(ctrl => ctrl.style.display = 'none');
}

function toggleEditModeMeal(planId) {
    if (currentEditingMealPlanId === planId && editingModeMeal) {
        editingModeMeal = false;
        resetEditingPlan(planId);
        currentEditingMealPlanId = null;
    } else {
        if (currentEditingMealPlanId) {
            resetEditingPlan(currentEditingMealPlanId);
        }
        
        editingModeMeal = true;
        currentEditingMealPlanId = planId;
        highlightEditingPlan(planId);
    }
}

async function handleRecipeComplete(planId, recipeId, isCompleted) {
    try {
        await apiRequest(`/meal-plans/${planId}/recipes/${recipeId}/complete`, 'PATCH', { is_completed: isCompleted });
        mealPlansRecipesCache.delete(planId);
        await loadMealPlans();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function handleRecipeFavorite(planId, recipeId, isFavorite) {
    try {
        await toggleRecipeFavorite(recipeId, isFavorite);
        

        const heartBtn = document.querySelector(`#recipe-${planId}-${recipeId} .heart-btn`);
        if (heartBtn) {
            if (isFavorite) {
                heartBtn.classList.add('active');
                heartBtn.textContent = '❤️';
            } else {
                heartBtn.classList.remove('active');
                heartBtn.textContent = '♡';
            }
        }
        

        mealPlansRecipesCache.delete(planId);
        if (typeof loadFavoriteRecipes === 'function') {
            loadFavoriteRecipes();
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function showReplaceRecipeModal(planId, oldRecipeId) {
    if (!editingModeMeal || currentEditingMealPlanId !== planId) {
        alert('Сначала нажмите "Редактировать план" для этого плана');
        return;
    }
    
    try {
        const recipes = await getAllRecipes();
        if (!recipes || recipes.length === 0) {
            alert('Нет рецептов для замены');
            return;
        }
        
        let optionsHtml = '';
        const weightLoss = recipes.filter(r => r.category === 'weight_loss');
        const muscleGain = recipes.filter(r => r.category === 'muscle_gain');
        
        if (weightLoss.length > 0) {
            optionsHtml += '<optgroup label="🥗 Низкокалорийные (для похудения)">';
            for (const recipe of weightLoss) {
                optionsHtml += `<option value="${recipe.id}">${escapeHtml(recipe.name)} (${recipe.calories} ккал)</option>`;
            }
            optionsHtml += '</optgroup>';
        }
        
        if (muscleGain.length > 0) {
            optionsHtml += '<optgroup label="💪 Высокобелковые (для набора мышечной массы)">';
            for (const recipe of muscleGain) {
                optionsHtml += `<option value="${recipe.id}">${escapeHtml(recipe.name)} (${recipe.calories} ккал)</option>`;
            }
            optionsHtml += '</optgroup>';
        }
        
        const modalHtml = `
            <div id="replaceModal" class="modal" style="display: flex;">
                <div class="modal-content">
                    <h3>Заменить рецепт</h3>
                    <select id="newRecipeId">${optionsHtml}</select>
                    <div style="margin-top: 15px;">
                        <button onclick="confirmReplaceRecipe(${planId}, ${oldRecipeId})">Заменить</button>
                        <button onclick="closeModal()">Отмена</button>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('replaceModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка загрузки рецептов: ' + error.message);
    }
}

async function confirmReplaceRecipe(planId, oldRecipeId) {
    const select = document.getElementById('newRecipeId');
    if (!select) {
        alert('Ошибка: список рецептов не найден');
        return;
    }
    
    const newRecipeId = select.value;
    if (!newRecipeId) {
        alert('Пожалуйста, выберите рецепт из списка');
        return;
    }
    
    try {
        await replaceRecipe(planId, oldRecipeId, newRecipeId);
        alert('✅ Рецепт заменён!');
        closeModal();
        mealPlansRecipesCache.delete(planId);
        await loadMealPlans();
    } catch (error) {
        console.error('Ошибка замены:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}

function closeModal() {
    const modal = document.getElementById('replaceModal');
    if (modal) modal.remove();
}

async function deleteMealPlan(planId) {
    if (!confirm('Вы уверены, что хотите удалить этот план питания?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/meal-plans/${planId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
            alert('✅ План питания удалён');
            mealPlansRecipesCache.delete(planId);
            await loadMealPlans();
        } else {
            const data = await response.json();
            alert('❌ Ошибка: ' + (data.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
}

async function loadRecipes() {
    try {
        const recipes = await getAllRecipes();
        const container = document.getElementById('recipesList');
        if (!container) return;
        
        if (!recipes || recipes.length === 0) {
            container.innerHTML = '<p>📭 Нет рецептов, соответствующих вашим аллергиям</p>';
            return;
        }
        
        let html = '<h3>🍽️ Все рецепты:</h3><div style="display: flex; flex-wrap: wrap; gap: 15px;">';
        
        for (const recipe of recipes) {
            html += '<div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; width: calc(33% - 10px); background: white;">';
            html += `<strong>${escapeHtml(recipe.name)}</strong><br>`;
            html += `🔥 ${recipe.calories} ккал<br>`;
            html += `🥗 ${escapeHtml(recipe.ingredients)}`;
            html += '</div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки рецептов:', error);
        const container = document.getElementById('recipesList');
        if (container) {
            container.innerHTML = '<p>❌ Ошибка загрузки рецептов</p>';
        }
    }
}

async function showRecipeDetails(recipeId) {
    try {
        const recipe = await getRecipeDetails(recipeId);
        
        let imageUrl = '';
        if (recipe.image_url) {
            if (recipe.image_url.startsWith('/')) {
                imageUrl = recipe.image_url;
            } else {
                imageUrl = recipe.image_url;
            }
        }
        
        const imageHtml = imageUrl ? 
            `<div class="image-container"><img src="${imageUrl}" alt="${escapeHtml(recipe.name)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23718096%22%3E📷%3C/text%3E%3C/svg%3E'"></div>` : 
            '<div class="image-container" style="background: linear-gradient(135deg, #667eea, #764ba2); height: 180px; display: flex; align-items: center; justify-content: center; color: white; flex-direction: column;">' +
            '<span style="font-size: 48px;">🍽️</span>' +
            `<span>${escapeHtml(recipe.name)}</span></div>`;
        
        const modalHtml = `
            <div id="detailModal" class="detail-modal" onclick="closeDetailModal(event)">
                <div class="detail-modal-content" onclick="event.stopPropagation()">
                    <div class="detail-modal-header">
                        <h2>🍽️ ${escapeHtml(recipe.name)}</h2>
                        <div class="subtitle">${recipe.category === 'weight_loss' ? '🏃 Для похудения' : '💪 Для набора массы'}</div>
                    </div>
                    <div class="detail-modal-body">
                        ${imageHtml}
                        <div class="detail-section">
                            <h3>🔥 Калорийность и КБЖУ</h3>
                            <div class="detail-kbju">
                                <div class="kbju-item"><span class="kbju-value">${recipe.calories}</span><span class="kbju-label">ккал</span></div>
                                <div class="kbju-item"><span class="kbju-value">${recipe.protein || '?'}</span><span class="kbju-label">белки</span></div>
                                <div class="kbju-item"><span class="kbju-value">${recipe.fat || '?'}</span><span class="kbju-label">жиры</span></div>
                                <div class="kbju-item"><span class="kbju-value">${recipe.carbs || '?'}</span><span class="kbju-label">углеводы</span></div>
                            </div>
                        </div>
                        <div class="detail-section">
                            <h3>🥗 Ингредиенты</h3>
                            <div class="recipe-ingredients"><p>${escapeHtml(recipe.ingredients ? recipe.ingredients.replace(/,/g, ', ') : 'Не указаны')}</p></div>
                        </div>
                        <div class="detail-section">
                            <h3>👨‍🍳 Приготовление</h3>
                            <div class="recipe-instructions"><p>${escapeHtml(recipe.instructions || 'Инструкция не указана')}</p></div>
                        </div>
                        <button class="detail-close-btn" onclick="closeDetailModal()">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('detailModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Ошибка загрузки деталей рецепта:', error);
        alert('Ошибка загрузки: ' + error.message);
    }
}

function closeDetailModal(event) {
    const modal = document.getElementById('detailModal');
    if (modal) modal.remove();
}

loadGoalsForSelect();
loadRecipes();
