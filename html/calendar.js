let currentGoal = null;
let allMealPlans = [];
let allWorkoutPlans = [];
let workoutScheduleMap = new Map();
let draggedItem = null;
let draggedItemType = null;
let draggedFromDayIndex = null;
let draggedHasPlan = false;



async function loadGoals() {
    try {
        const goals = await getGoals();
        const select = document.getElementById('goalSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Выберите цель --</option>';
        

        const weightGoals = goals.filter(g => g.type !== 'steps');
        
        if (weightGoals.length === 0) {
            select.innerHTML += '<option value="" disabled>-- Нет активных целей по весу --</option>';
            document.getElementById('calendarBlock').style.display = 'none';
            return;
        }
        
        for (let g of weightGoals) {
            const typeText = g.type === 'weight_loss' ? '🏃 Похудение' : '💪 Набор массы';
            const startDate = new Date(g.start_date).toLocaleDateString();
            const endDate = new Date(g.end_date).toLocaleDateString();
            select.innerHTML += `<option value="${g.id}">${typeText} до ${g.desired_value} кг (${startDate} - ${endDate})</option>`;
        }
        
        const savedGoalId = localStorage.getItem('selectedCalendarGoalId');
        if (savedGoalId && document.querySelector(`#goalSelect option[value="${savedGoalId}"]`)) {
            select.value = savedGoalId;
            loadCalendar();
        }
    } catch (error) {
        console.error('Ошибка загрузки целей:', error);
    }
}


async function loadCalendar() {
    const goalId = document.getElementById('goalSelect').value;
    if (!goalId) {
        document.getElementById('calendarBlock').style.display = 'none';
        return;
    }
    
    localStorage.setItem('selectedCalendarGoalId', goalId);
    document.getElementById('calendarBlock').style.display = 'block';
    
    try {
        const goals = await getGoals();

        currentGoal = goals.find(g => g.id == goalId && g.type !== 'steps');
        
        if (!currentGoal) {
            console.error('Цель не найдена или это цель по шагам');
            document.getElementById('calendarGrid').innerHTML = '<p style="color: red;">❌ Цель не найдена</p>';
            return;
        }
        
        console.log('=== ЗАГРУЖЕНА ЦЕЛЬ ===');
        console.log('Тип:', currentGoal.type);
        console.log('Тренировок в неделю:', currentGoal.workouts_per_week);
        
        const allPlans = await getMealPlans();
        allMealPlans = allPlans
            .filter(plan => plan.goal_id == goalId)
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        
        const allWorkoutPlansData = await getWorkoutPlans();
        allWorkoutPlans = allWorkoutPlansData
            .filter(plan => plan.goal_id == goalId);
        
        console.log('Загружено планов тренировок:', allWorkoutPlans.length);
        
        buildWorkoutScheduleMap();
        drawCalendar();
    } catch (error) {
        console.error('Ошибка загрузки календаря:', error);
        document.getElementById('calendarGrid').innerHTML = '<p style="color: red;">❌ Ошибка загрузки</p>';
    }
}


function buildWorkoutScheduleMap() {
    const start = new Date(currentGoal.start_date);
    const end = new Date(currentGoal.end_date);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    workoutScheduleMap.clear();
    

    for (let i = 0; i <= daysDiff; i++) {
        workoutScheduleMap.set(i, { hasWorkout: false });
    }
    

    const workoutsPerWeek = currentGoal.workouts_per_week || 3;
    const expectedDays = getExpectedWorkoutDays(start, end, workoutsPerWeek);
    

    let usesCustomOrder = false;
    
    for (let i = 0; i < allWorkoutPlans.length; i++) {
        const plan = allWorkoutPlans[i];
        const expectedDay = expectedDays[i];
        

        if (plan.display_order !== undefined && expectedDay !== undefined && plan.display_order !== expectedDay) {
            usesCustomOrder = true;
            console.log(`🔧 Обнаружен кастомный порядок: тренировка ${plan.id} должна быть в день ${expectedDay}, но находится в ${plan.display_order}`);
            break;
        }
    }
    
    if (!usesCustomOrder) {
        console.log(`📋 Используем ПРАВИЛА для тренировок (${workoutsPerWeek} раз/неделю)`);
        

        for (let i = 0; i < allWorkoutPlans.length && i < expectedDays.length; i++) {
            const workout = allWorkoutPlans[i];
            const dayIndex = expectedDays[i];
            
            if (dayIndex !== undefined && dayIndex >= 0 && dayIndex <= daysDiff) {
                workoutScheduleMap.set(dayIndex, {
                    hasWorkout: true,
                    workoutId: workout.id,
                    workoutName: workout.name,
                    workoutOrder: i
                });
                console.log(`  День ${dayIndex} ← Тренировка ${i+1} (по правилам)`);
            }
        }
    } else {
        console.log(`📋 Используем СОХРАНЁННЫЙ порядок тренировок (пользователь менял)`);
        

        const sortedPlans = [...allWorkoutPlans].sort((a, b) => {
            const orderA = a.display_order !== undefined ? a.display_order : 999999;
            const orderB = b.display_order !== undefined ? b.display_order : 999999;
            return orderA - orderB;
        });
        

        for (const workout of sortedPlans) {
            const dayIndex = workout.display_order;
            
            if (dayIndex !== undefined && dayIndex >= 0 && dayIndex <= daysDiff) {
                workoutScheduleMap.set(dayIndex, {
                    hasWorkout: true,
                    workoutId: workout.id,
                    workoutName: workout.name,
                    workoutOrder: workout.display_order
                });
                console.log(`  День ${dayIndex} ← Тренировка ${workout.id} (сохранённый порядок)`);
            } else {
                console.warn(`⚠️ Тренировка ${workout.id} имеет неверный display_order=${dayIndex}`);
            }
        }
    }
    

    let workoutCount = 0;
    console.log(`📅 Итоговое расписание (${workoutsPerWeek} раз/неделю):`);
    for (let i = 0; i <= Math.min(daysDiff, 30); i++) {
        const info = workoutScheduleMap.get(i);
        if (info && info.hasWorkout) {
            workoutCount++;
            console.log(`  День ${i}: 🏋️ Тренировка`);
        } else {
            console.log(`  День ${i}: 😴 Отдых`);
        }
    }
    console.log(`📊 Всего тренировок: ${workoutCount}, планов в БД: ${allWorkoutPlans.length}`);
}


function getExpectedWorkoutDays(startDate, endDate, workoutsPerWeek) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    

    const workoutDaysBool = new Array(daysDiff + 1).fill(false);
    
    if (workoutsPerWeek === 1) {
        for (let i = 0; i <= daysDiff; i++) {
            if (i === 0 || i % 7 === 0) workoutDaysBool[i] = true;
        }
    } else if (workoutsPerWeek === 2) {
        for (let i = 0; i <= daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos === 0 || weekPos === 3) workoutDaysBool[i] = true;
        }
    } else if (workoutsPerWeek === 3) {
        for (let i = 0; i <= daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos === 0 || weekPos === 2 || weekPos === 4) workoutDaysBool[i] = true;
        }
    } else if (workoutsPerWeek === 4) {
        for (let i = 0; i <= daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos === 0 || weekPos === 2 || weekPos === 4 || weekPos === 6) workoutDaysBool[i] = true;
        }
    } else if (workoutsPerWeek === 5) {
        for (let i = 0; i <= daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos < 5) workoutDaysBool[i] = true;
        }
    } else if (workoutsPerWeek === 6) {
        for (let i = 0; i <= daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos < 6) workoutDaysBool[i] = true;
        }
    } else if (workoutsPerWeek === 7) {
        for (let i = 0; i <= daysDiff; i++) {
            workoutDaysBool[i] = true;
        }
    }
    

    const workoutDaysIndices = [];
    for (let i = 0; i <= daysDiff; i++) {
        if (workoutDaysBool[i]) {
            workoutDaysIndices.push(i);
        }
    }
    
    return workoutDaysIndices;
}


function drawCalendar() {
    const start = new Date(currentGoal.start_date);
    const end = new Date(currentGoal.end_date);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    let html = '';
    let dayCounter = 0;
    
    let currentDate = new Date(start);
    while (currentDate <= end) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthYear = `${monthNames[month]} ${year}`;
        
        const firstDayOfMonth = new Date(year, month, 1);
        let startOffset = firstDayOfMonth.getDay() - 1;
        if (startOffset < 0) startOffset = 6;
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        html += `<div style="margin-top: 20px; margin-bottom: 10px; font-weight: bold; font-size: 18px;">${monthYear}</div>`;
        html += `<div class="calendar-grid">`;
        
        for (let w = 0; w < 7; w++) {
            html += `<div style="text-align: center; font-weight: bold; color: #718096; padding: 5px;">${weekDays[w]}</div>`;
        }
        
        for (let i = 0; i < startOffset; i++) {
            html += `<div style="background: #f7fafc; padding: 12px; text-align: center; border-radius: 8px; border: 1px solid #e2e8f0; opacity: 0.5;"></div>`;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const cellDate = new Date(year, month, day);
            const isInRange = cellDate >= start && cellDate <= end;
            
            if (isInRange) {
                const mealPlan = allMealPlans.length > 0 ? allMealPlans[dayCounter % allMealPlans.length] : null;
                const workoutInfo = workoutScheduleMap.get(dayCounter) || { hasWorkout: false };
                const weekdayName = weekDays[cellDate.getDay() === 0 ? 6 : cellDate.getDay() - 1];
                
                html += `
                    <div class="calendar-day" data-day-index="${dayCounter}" data-date="${cellDate.toISOString()}" onclick="showFullDayPlan(${dayCounter})">
                        <div class="day-number">${day}</div>
                        <div class="weekday">${weekdayName}</div>
                        <div class="calendar-items">
                            <div class="calendar-item meal-item ${!mealPlan ? 'empty' : ''}" 
                                 data-day-index="${dayCounter}"
                                 data-plan-id="${mealPlan?.id || ''}"
                                 data-plan-type="meal"
                                 data-has-plan="${!!mealPlan}"
                                 draggable="true"
                                 onclick="event.stopPropagation(); showMealPlanDetails(${dayCounter}, '${mealPlan?.id || ''}')">
                                <span class="item-icon">🍽️</span>
                                <span class="item-name">${mealPlan ? 'Рацион' : 'Нет плана'}</span>
                            </div>
                            <div class="calendar-item workout-item" 
                                 data-day-index="${dayCounter}"
                                 data-plan-id="${workoutInfo.hasWorkout ? workoutInfo.workoutId : ''}"
                                 data-plan-type="workout"
                                 data-has-plan="${workoutInfo.hasWorkout}"
                                 draggable="true"
                                 onclick="event.stopPropagation(); showWorkoutPlanDetails(${dayCounter}, '${workoutInfo.hasWorkout ? workoutInfo.workoutId : ''}')">
				<span class="item-icon">${workoutInfo.hasWorkout ? '🏋️' : '💤'}</span>
                                <span class="item-name">${workoutInfo.hasWorkout ? 'Тренировка' : 'Отдых'}</span>
                            </div>
                        </div>
                    </div>
                `;
                dayCounter++;
            } else {
                html += `<div style="background: #f7fafc; padding: 12px; text-align: center; border-radius: 8px; border: 1px solid #e2e8f0; opacity: 0.3;">
                            <div class="day-number" style="font-size: 18px; color: #cbd5e0;">${day}</div>
                         </div>`;
            }
        }
        
        html += '</div>';
        currentDate = new Date(year, month + 1, 1);
    }
    
    document.getElementById('calendarGrid').innerHTML = html;
    initDragAndDrop();
}


async function showFullDayPlan(dayIndex) {
    console.log(`Показываем полную информацию за день ${dayIndex}`);
    
    const start = new Date(currentGoal.start_date);
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);
    
    const mealPlan = allMealPlans.length > 0 ? allMealPlans[dayIndex % allMealPlans.length] : null;
    const workoutInfo = workoutScheduleMap.get(dayIndex) || { hasWorkout: false };
    
    let html = `
        <div class="plan-details-header">
            <h3>📅 ${currentDate.toLocaleDateString('ru', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
        </div>
    `;
    

    html += `<div class="day-section meal-section">`;
    if (mealPlan) {
        try {
            const recipes = await getMealPlanRecipes(mealPlan.id);
            html += `<h4>🍽️ План питания</h4>`;
            
            if (!recipes || recipes.length === 0) {
                html += `<p>❌ Нет рецептов в этом плане</p>`;
            } else {
                let totalCalories = 0;
                const mealsByType = {
                    'Завтрак': [],
                    'Перекус': [],
                    'Обед': [],
                    'Полдник': [],
                    'Ужин': [],
                    'Перекус 2': []
                };
                
                recipes.forEach(recipe => {
                    const mealType = recipe.meal_type || 'Другое';
                    if (mealsByType[mealType]) {
                        mealsByType[mealType].push(recipe);
                    } else {
                        if (!mealsByType['Другое']) mealsByType['Другое'] = [];
                        mealsByType['Другое'].push(recipe);
                    }
                    const servings = recipe.servings || 1.0;
                    totalCalories += Math.round(recipe.calories * servings);
                });
                
                html += `<div class="plan-summary">🔥 Общая калорийность: ${totalCalories} ккал</div>`;
                
                for (const [mealType, mealRecipes] of Object.entries(mealsByType)) {
                    if (mealRecipes.length > 0) {
                        html += `<h5>${getMealTypeIcon(mealType)} ${mealType}</h5><ul>`;
                        for (const recipe of mealRecipes) {
                            const servings = recipe.servings || 1.0;
                            const actualCalories = Math.round(recipe.calories * servings);
                            const servingsText = formatServingsText(servings);
                            html += `
                                <li>
                                    <strong>${escapeHtml(recipe.name)}</strong>
                                    <span class="recipe-calories">${actualCalories} ккал${servingsText}</span>
                                    ${recipe.ingredients ? `<br><span class="recipe-ingredients">🥗 ${escapeHtml(recipe.ingredients.substring(0, 100))}${recipe.ingredients.length > 100 ? '...' : ''}</span>` : ''}
                                </li>
                            `;
                        }
                        html += `</ul>`;
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки рецептов:', error);
            html += `<p>❌ Ошибка загрузки плана питания</p>`;
        }
    } else {
        html += `<h4>🍽️ План питания</h4>`;
        html += `<div class="empty-plan-message">📭 Нет плана питания на этот день</div>`;
    }
    html += `</div>`;
    

    html += `<div class="day-section workout-section">`;
    if (workoutInfo.hasWorkout) {
        try {
            const exercises = await getWorkoutPlanExercises(workoutInfo.workoutId);
            html += `<h4>🏋️ Тренировка</h4>`;
            
            if (!exercises || exercises.length === 0) {
                html += `<p>❌ Нет упражнений в этой тренировке</p>`;
            } else {
                let totalCalories = 0;
                for (const ex of exercises) {
                    const exerciseInfo = ex.duration ? `${ex.duration} минут` : `${ex.sets} × ${ex.reps}`;
                    if (ex.calories_burned) totalCalories += ex.calories_burned;
                    
                    html += `
                        <div class="exercise-item">
                            <div class="exercise-name">
                                <strong>${escapeHtml(ex.name)}</strong>
                                <span class="exercise-info">${exerciseInfo}</span>
                            </div>
                            ${ex.calories_burned ? `<div class="exercise-calories">🔥 ~${ex.calories_burned} ккал</div>` : ''}
                            ${ex.muscle_group ? `<div class="exercise-muscles">💪 ${escapeHtml(ex.muscle_group)}</div>` : ''}
                        </div>
                    `;
                }
                if (totalCalories > 0) {
                    html += `<div class="plan-summary">🔥 Сожжено калорий: ~${totalCalories} ккал</div>`;
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки упражнений:', error);
            html += `<p>❌ Ошибка загрузки тренировки</p>`;
        }
    } else {
        html += `<h4>🏋️ Тренировка</h4>`;
        html += `<div class="rest-day-message">
                    <p>😊 День отдыха!</p>
                    <p>Восстанавливайтесь и набирайтесь сил для следующих тренировок.</p>
                    <div class="rest-tips">
                        💡 Рекомендации на день отдыха:<br>
                        • Хорошо выспитесь<br>
                        • Пейте достаточно воды<br>
                        • Лёгкая прогулка на свежем воздухе<br>
                        • Растяжка для восстановления мышц
                    </div>
                </div>`;
    }
    html += `</div>`;
    
    html += `<button onclick="document.getElementById('dayPlanBlock').classList.remove('active')" class="close-plan-btn">Закрыть</button>`;
    
    document.getElementById('dayPlanBlock').innerHTML = html;
    document.getElementById('dayPlanBlock').classList.add('active');
}


async function showMealPlanDetails(dayIndex, planId) {
    if (!planId) {
        showNoPlanMessage(dayIndex, 'питания');
        return;
    }
    
    const start = new Date(currentGoal.start_date);
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);
    
    let html = `
        <div class="plan-details-header">
            <h3>🍽️ План питания</h3>
            <div class="plan-date">${currentDate.toLocaleDateString('ru', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
    `;
    
    try {
        const recipes = await getMealPlanRecipes(parseInt(planId));
        
        if (!recipes || recipes.length === 0) {
            html += `<p>❌ Нет рецептов в этом плане</p>`;
        } else {
            let totalCalories = 0;
            html += `<div class="plan-details">`;
            
            const mealsByType = {
                'Завтрак': [],
                'Перекус': [],
                'Обед': [],
                'Полдник': [],
                'Ужин': [],
                'Перекус 2': []
            };
            
            recipes.forEach(recipe => {
                const mealType = recipe.meal_type || 'Другое';
                if (mealsByType[mealType]) {
                    mealsByType[mealType].push(recipe);
                } else {
                    if (!mealsByType['Другое']) mealsByType['Другое'] = [];
                    mealsByType['Другое'].push(recipe);
                }
                const servings = recipe.servings || 1.0;
                totalCalories += Math.round(recipe.calories * servings);
            });
            
            html += `<div class="plan-summary">🔥 Общая калорийность: ${totalCalories} ккал</div>`;
            
            for (const [mealType, mealRecipes] of Object.entries(mealsByType)) {
                if (mealRecipes.length > 0) {
                    html += `<h4>${getMealTypeIcon(mealType)} ${mealType}</h4><ul>`;
                    for (const recipe of mealRecipes) {
                        const servings = recipe.servings || 1.0;
                        const actualCalories = Math.round(recipe.calories * servings);
                        const servingsText = formatServingsText(servings);
                        html += `
                            <li>
                                <strong>${escapeHtml(recipe.name)}</strong>
                                <span class="recipe-calories">${actualCalories} ккал${servingsText}</span>
                                ${recipe.ingredients ? `<br><span class="recipe-ingredients">🥗 ${escapeHtml(recipe.ingredients.substring(0, 100))}${recipe.ingredients.length > 100 ? '...' : ''}</span>` : ''}
                            </li>
                        `;
                    }
                    html += `</ul>`;
                }
            }
            html += `</div>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки рецептов:', error);
        html += `<p>❌ Ошибка загрузки плана питания</p>`;
    }
    
    html += `<button onclick="document.getElementById('dayPlanBlock').classList.remove('active')" class="close-plan-btn">Закрыть</button>`;
    
    document.getElementById('dayPlanBlock').innerHTML = html;
    document.getElementById('dayPlanBlock').classList.add('active');
}


async function showWorkoutPlanDetails(dayIndex, planId) {
    if (!planId) {
        showRestDayMessage(dayIndex);
        return;
    }
    
    const start = new Date(currentGoal.start_date);
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);
    
    let html = `
        <div class="plan-details-header">
            <h3>🏋️ Тренировка</h3>
            <div class="plan-date">${currentDate.toLocaleDateString('ru', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
    `;
    
    try {
        const exercises = await getWorkoutPlanExercises(parseInt(planId));
        
        if (!exercises || exercises.length === 0) {
            html += `<p>❌ Нет упражнений в этой тренировке</p>`;
        } else {
            let totalCalories = 0;
            html += `<div class="plan-details">`;
            
            for (const ex of exercises) {
                const exerciseInfo = ex.duration ? `${ex.duration} минут` : `${ex.sets} × ${ex.reps}`;
                if (ex.calories_burned) totalCalories += ex.calories_burned;
                
                html += `
                    <div class="exercise-item">
                        <div class="exercise-name">
                            <strong>${escapeHtml(ex.name)}</strong>
                            <span class="exercise-info">${exerciseInfo}</span>
                        </div>
                        ${ex.calories_burned ? `<div class="exercise-calories">🔥 ~${ex.calories_burned} ккал</div>` : ''}
                        ${ex.muscle_group ? `<div class="exercise-muscles">💪 ${escapeHtml(ex.muscle_group)}</div>` : ''}
                    </div>
                `;
            }
            
            if (totalCalories > 0) {
                html += `<div class="plan-summary">🔥 Сожжено калорий: ~${totalCalories} ккал</div>`;
            }
            
            html += `</div>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки упражнений:', error);
        html += `<p>❌ Ошибка загрузки тренировки</p>`;
    }
    
    html += `<button onclick="document.getElementById('dayPlanBlock').classList.remove('active')" class="close-plan-btn">Закрыть</button>`;
    
    document.getElementById('dayPlanBlock').innerHTML = html;
    document.getElementById('dayPlanBlock').classList.add('active');
}

function showNoPlanMessage(dayIndex, planType) {
    const start = new Date(currentGoal.start_date);
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);
    
    const html = `
        <div class="plan-details-header">
            <h3>🍽️ План питания</h3>
            <div class="plan-date">${currentDate.toLocaleDateString('ru', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div class="empty-plan-message">
            <p>📭 Нет плана питания на этот день</p>
            <p class="help-text">Создайте цель с планами питания, чтобы они появились в календаре</p>
        </div>
        <button onclick="document.getElementById('dayPlanBlock').classList.remove('active')" class="close-plan-btn">Закрыть</button>
    `;
    
    document.getElementById('dayPlanBlock').innerHTML = html;
    document.getElementById('dayPlanBlock').classList.add('active');
}

function showRestDayMessage(dayIndex) {
    const start = new Date(currentGoal.start_date);
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);
    
    const html = `
        <div class="plan-details-header">
            <h3>💤 Отдых</h3>
            <div class="plan-date">${currentDate.toLocaleDateString('ru', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div class="rest-day-message">
            <p>😊 День отдыха!</p>
            <p>Восстанавливайтесь и набирайтесь сил для следующих тренировок.</p>
            <div class="rest-tips">
                💡 Рекомендации на день отдыха:<br>
                • Хорошо выспитесь<br>
                • Пейте достаточно воды<br>
                • Лёгкая прогулка на свежем воздухе<br>
                • Растяжка для восстановления мышц
            </div>
        </div>
        <button onclick="document.getElementById('dayPlanBlock').classList.remove('active')" class="close-plan-btn">Закрыть</button>
    `;
    
    document.getElementById('dayPlanBlock').innerHTML = html;
    document.getElementById('dayPlanBlock').classList.add('active');
}


function initDragAndDrop() {
    const allItems = document.querySelectorAll('.calendar-item');
    
    console.log('Найдено перетаскиваемых элементов:', allItems.length);
    
    document.body.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    
    document.body.addEventListener('drop', function(e) {
        e.preventDefault();
    });
    
    allItems.forEach(item => {
        item.setAttribute('draggable', 'true');
        
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragend', handleDragEnd);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('dragleave', handleDragLeave);
        item.removeEventListener('drop', handleDrop);
        
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    const item = e.target.closest('.calendar-item');
    if (!item) return;
    
    draggedItem = item;
    draggedItemType = item.dataset.planType;
    draggedFromDayIndex = parseInt(item.dataset.dayIndex);
    draggedHasPlan = item.dataset.hasPlan === 'true';
    
    console.log(`🟢 DRAG START: тип=${draggedItemType}, день=${draggedFromDayIndex}, есть план=${draggedHasPlan}`);
    
    if (draggedHasPlan) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: draggedItemType,
            fromDay: draggedFromDayIndex,
            planId: item.dataset.planId
        }));
        e.dataTransfer.effectAllowed = 'move';
    } else {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: draggedItemType,
            fromDay: draggedFromDayIndex,
            isEmpty: true
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }
    
    item.style.opacity = '0.5';
}

function handleDragEnd(e) {
    if (draggedItem) {
        draggedItem.style.opacity = '1';
    }
    
    document.querySelectorAll('.calendar-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    console.log('🔴 DRAG END');
    
    draggedItem = null;
    draggedItemType = null;
    draggedFromDayIndex = null;
    draggedHasPlan = false;
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const targetItem = e.target.closest('.calendar-item');
    if (!targetItem) return;
    
    if (draggedItem === targetItem) return;
    
    const targetType = targetItem.dataset.planType;
    if (draggedItemType && targetType && draggedItemType !== targetType) return;
    
    targetItem.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.calendar-item');
    if (targetItem) {
        targetItem.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🟡 DROP событие сработало!');
    
    const targetItem = e.target.closest('.calendar-item');
    if (!targetItem) {
        console.log('Нет целевого элемента');
        return;
    }
    
    targetItem.classList.remove('drag-over');
    
    if (!draggedItem) {
        console.log('Нет draggedItem');
        return;
    }
    
    const toDayIndex = parseInt(targetItem.dataset.dayIndex);
    const targetType = targetItem.dataset.planType;
    
    console.log(`Целевой день=${toDayIndex}, тип=${targetType}`);
    
    if (draggedItemType !== targetType) {
        showNotification('❌ Нельзя перемещать план питания на место тренировки и наоборот!', 'error');
        return;
    }
    
    if (draggedFromDayIndex === toDayIndex) {
        console.log('Перемещение на тот же день - отмена');
        return;
    }
    
    if (!draggedHasPlan) {
        showNotification('ℹ️ Нельзя перемещать "Отдых"', 'info');
        return;
    }
    
    showNotification(`⏳ Перемещаем ${draggedItemType === 'meal' ? 'рацион' : 'тренировку'}...`, 'info');
    
    try {
        if (draggedItemType === 'meal') {
            await moveMealPlan(draggedFromDayIndex, toDayIndex);
        } else {
            await moveWorkoutPlan(draggedFromDayIndex, toDayIndex);
        }
        
        showNotification('✅ План успешно перемещён!', 'success');
        await loadCalendar();
        
        if (typeof loadMealPlans === 'function') {
            await loadMealPlans();
        }
        if (typeof loadWorkoutPlans === 'function') {
            await loadWorkoutPlans();
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
}


async function moveMealPlan(fromDayIndex, toDayIndex) {
    console.log(`=== ПЕРЕМЕЩЕНИЕ РАЦИОНА ${fromDayIndex} -> ${toDayIndex} ===`);
    
    if (!allMealPlans.length) return;
    
    const fromCycleIndex = fromDayIndex % allMealPlans.length;
    const toCycleIndex = toDayIndex % allMealPlans.length;
    
    if (fromCycleIndex === toCycleIndex) return;
    
    const fromPlan = allMealPlans[fromCycleIndex];
    const toPlan = allMealPlans[toCycleIndex];
    
    allMealPlans[fromCycleIndex] = toPlan;
    allMealPlans[toCycleIndex] = fromPlan;
    
    const planOrders = allMealPlans.map((plan, index) => ({
        planId: plan.id,
        order: index
    }));
    
    await reorderMealPlans(planOrders);
    console.log('Рацион перемещён успешно');
}



async function moveWorkoutPlan(fromDayIndex, toDayIndex) {
    console.log(`=== ПЕРЕМЕЩЕНИЕ ТРЕНИРОВКИ ${fromDayIndex} -> ${toDayIndex} ===`);
    

    const fromInfo = workoutScheduleMap.get(fromDayIndex);
    if (!fromInfo || !fromInfo.hasWorkout) {
        console.log('❌ Нет тренировки в исходном дне');
        showNotification('❌ Нет тренировки для перемещения', 'error');
        return;
    }
    
    const workoutId = fromInfo.workoutId;
    console.log(`Перемещаем тренировку ID=${workoutId}`);
    

    const workoutToMove = allWorkoutPlans.find(w => w.id == workoutId);
    if (!workoutToMove) {
        console.log('❌ Тренировка не найдена в массиве');
        return;
    }
    

    const toInfo = workoutScheduleMap.get(toDayIndex);
    const hasWorkoutAtTarget = toInfo && toInfo.hasWorkout;
    
    console.log(`Целевой день ${toDayIndex}: ${hasWorkoutAtTarget ? 'есть тренировка' : 'свободен'}`);
    

    const oldOrder = workoutToMove.display_order;
    
    if (hasWorkoutAtTarget) {

        const targetWorkoutId = toInfo.workoutId;
        const targetWorkout = allWorkoutPlans.find(w => w.id == targetWorkoutId);
        
        if (targetWorkout) {
            console.log(`🔄 Меняем местами с тренировкой ${targetWorkoutId}`);
            console.log(`   ${workoutToMove.name} (было: день ${oldOrder}) <-> ${targetWorkout.name} (было: день ${targetWorkout.display_order})`);
            

            const tempOrder = workoutToMove.display_order;
            workoutToMove.display_order = targetWorkout.display_order;
            targetWorkout.display_order = tempOrder;
        }
    } else {

        console.log(`📦 Перемещаем тренировку с дня ${fromDayIndex} на день ${toDayIndex}`);
        console.log(`   ${workoutToMove.name} (было: день ${oldOrder}) -> день ${toDayIndex}`);
        
        workoutToMove.display_order = toDayIndex;
        

        if (oldOrder < toDayIndex) {

            for (let plan of allWorkoutPlans) {
                if (plan.id === workoutToMove.id) continue; 
                
                if (plan.display_order > oldOrder && plan.display_order <= toDayIndex) {
                    plan.display_order--;
                    console.log(`   Сдвиг НАЗАД: тренировка ${plan.id} -> день ${plan.display_order}`);
                }
            }
        } else if (oldOrder > toDayIndex) {

            for (let plan of allWorkoutPlans) {
                if (plan.id === workoutToMove.id) continue; 
                
                if (plan.display_order >= toDayIndex && plan.display_order < oldOrder) {
                    plan.display_order++;
                    console.log(`   Сдвиг ВПЕРЁД: тренировка ${plan.id} -> день ${plan.display_order}`);
                }
            }
        }
    }
    
    
    allWorkoutPlans.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    
    const planOrders = allWorkoutPlans.map((plan, index) => ({
        planId: plan.id,
        order: plan.display_order !== undefined ? plan.display_order : index
    }));
    
    console.log('📤 Отправка в БД:', planOrders);
    
    try {
  
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
        
        console.log('✅ display_order сохранён в БД');
        
  
        buildWorkoutScheduleMap();
        
  
        drawCalendar();
        
        showNotification('✅ Тренировка перемещена!', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка сохранения порядка:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
        
  
        await loadCalendar();
    }
}


function getMealTypeIcon(mealType) {
    const icons = {
        'Завтрак': '🌅',
        'Перекус': '🍎',
        'Обед': '🍲',
        'Полдник': '🍪',
        'Ужин': '🌙',
        'Перекус 2': '🍿'
    };
    return icons[mealType] || '🍽️';
}

function formatServingsText(servings) {
    if (servings === 1.0) return '';
    if (servings === 0.5) return ' (½ порции)';
    if (servings === 1.5) return ' (1½ порции)';
    if (servings === 2.5) return ' (2½ порции)';
    return ` (${servings} порции)`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}


const detailStyles = document.createElement('style');
detailStyles.textContent = `
    .plan-details-header {
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
    }
    
    .plan-details-header h3 {
        margin: 0 0 5px 0;
        color: #2d3748;
    }
    
    .plan-date {
        color: #718096;
        font-size: 14px;
    }
    
    .plan-summary {
        background: #ebf8ff;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-weight: bold;
        color: #2b6cb0;
    }
    
    .plan-details h4, .day-section h4 {
        color: #4a5568;
        margin: 15px 0 10px 0;
        padding-left: 5px;
        border-left: 3px solid #48bb78;
    }
    
    .day-section.workout-section h4 {
        border-left-color: #e53e3e;
    }
    
    .plan-details ul, .day-section ul {
        list-style: none;
        padding: 0;
        margin: 0 0 15px 0;
    }
    
    .plan-details li, .day-section li {
        padding: 8px 0;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .plan-details li:last-child, .day-section li:last-child {
        border-bottom: none;
    }
    
    .recipe-calories {
        float: right;
        color: #e53e3e;
        font-size: 12px;
    }
    
    .recipe-ingredients {
        font-size: 11px;
        color: #718096;
        display: block;
        margin-top: 4px;
    }
    
    .exercise-item {
        padding: 12px;
        background: #f7fafc;
        border-radius: 8px;
        margin-bottom: 10px;
    }
    
    .exercise-name {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
    }
    
    .exercise-info {
        color: #718096;
        font-size: 12px;
    }
    
    .exercise-calories {
        color: #e53e3e;
        font-size: 12px;
        margin-top: 5px;
    }
    
    .exercise-muscles {
        color: #48bb78;
        font-size: 11px;
        margin-top: 5px;
    }
    
    .empty-plan-message, .rest-day-message {
        text-align: center;
        padding: 20px;
        background: #f7fafc;
        border-radius: 8px;
    }
    
    .rest-tips {
        margin-top: 15px;
        padding: 12px;
        background: #ebf8ff;
        border-radius: 8px;
        text-align: left;
        font-size: 12px;
        line-height: 1.5;
    }
    
    .close-plan-btn {
        margin-top: 20px;
        width: 100%;
        padding: 10px;
        background: #4299e1;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
    }
    
    .close-plan-btn:hover {
        background: #3182ce;
    }
    
    .calendar-day {
        background: white;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        transition: all 0.2s;
        min-height: 110px;
        display: flex;
        flex-direction: column;
        cursor: pointer;
    }
    
    .calendar-day:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .calendar-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 8px;
        flex: 1;
    }
    
    .calendar-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11px;
        transition: all 0.2s;
        border: 1px solid transparent;
        background: #f7fafc;
        cursor: grab;
    }
    
    .calendar-item:active {
        cursor: grabbing;
    }
    
    .calendar-item[draggable="true"]:hover {
        background: #edf2f7;
        transform: translateY(-1px);
    }
    
    .calendar-item.drag-over {
        border: 2px solid #48bb78;
        background: #e6fffa;
        transform: scale(1.02);
    }
    
    .meal-item {
        border-left: 3px solid #48bb78;
    }
    
    .workout-item {
        border-left: 3px solid #e53e3e;
    }
    
    .item-icon {
        font-size: 14px;
    }
    
    .item-name {
        font-size: 11px;
        color: #4a5568;
        flex: 1;
    }
    
    .day-number {
        font-size: 18px;
        font-weight: bold;
        text-align: center;
    }
    
    .weekday {
        font-size: 12px;
        color: #718096;
        text-align: center;
        margin-top: 3px;
    }
    
    .day-section {
        margin-bottom: 20px;
        padding: 15px;
        background: #f7fafc;
        border-radius: 10px;
    }
    
    .day-section.meal-section {
        border-left: 4px solid #48bb78;
    }
    
    .day-section.workout-section {
        border-left: 4px solid #e53e3e;
    }
    
    .day-section h5 {
        color: #4a5568;
        margin: 10px 0 8px 0;
        font-size: 14px;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(detailStyles);


document.getElementById('goalSelect')?.addEventListener('change', loadCalendar);


loadGoals();
