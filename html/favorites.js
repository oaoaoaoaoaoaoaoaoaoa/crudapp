let currentTab = 'recipes';

async function loadFavoriteRecipes() {
    const container = document.getElementById('favoriteRecipesList');
    if (!container) return;
    
    try {
        const favorites = await getFavoriteRecipes();
        
        if (!favorites || favorites.length === 0) {
            container.innerHTML = '<p class="empty-message">💔 У вас пока нет избранных рецептов. Добавьте их, нажав на сердечко в плане питания!</p>';
            return;
        }
        
        let html = '<div class="favorites-grid">';
        for (let recipe of favorites) {
            html += `
                <div class="favorite-card" onclick="showFavoriteRecipeDetails(${recipe.recipe_id})" style="cursor: pointer;">
                    <div class="favorite-header">
                        <h3>${escapeHtml(recipe.name)}</h3>
                        <button class="favorite-btn active" onclick="event.stopPropagation(); removeFavoriteRecipe(${recipe.recipe_id})" title="Удалить из избранного">
                            ❤️
                        </button>
                    </div>
                    <div class="favorite-details">
                        <span class="calories">🔥 ${recipe.calories} ккал</span>
                        <span class="category">📂 ${getCategoryName(recipe.category)}</span>
                    </div>
                    <div class="ingredients">
                        <strong>🥗 Ингредиенты:</strong> ${escapeHtml(recipe.ingredients || 'Не указаны')}
                    </div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки избранных рецептов:', error);
        container.innerHTML = '<p class="error">❌ Ошибка загрузки</p>';
    }
}

async function loadFavoriteExercises() {
    const container = document.getElementById('favoriteExercisesList');
    if (!container) return;
    
    try {
        const favorites = await getFavoriteExercises();
        
        if (!favorites || favorites.length === 0) {
            container.innerHTML = '<p class="empty-message">💔 У вас пока нет избранных упражнений. Добавьте их, нажав на сердечко в плане тренировки!</p>';
            return;
        }
        
        let html = '<div class="favorites-grid">';
        for (let exercise of favorites) {
            html += `
                <div class="favorite-card" onclick="showFavoriteExerciseDetails(${exercise.exercise_id})" style="cursor: pointer;">
                    <div class="favorite-header">
                        <h3>${escapeHtml(exercise.name)}</h3>
                        <button class="favorite-btn active" onclick="event.stopPropagation(); removeFavoriteExercise(${exercise.exercise_id})" title="Удалить из избранного">
                            ❤️
                        </button>
                    </div>
                    <div class="favorite-details">
                        <span class="muscle">💪 ${exercise.muscle_group || 'Общее'}</span>
                        <span class="type">${getExerciseTypeName(exercise.exercise_type)}</span>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки избранных упражнений:', error);
        container.innerHTML = '<p class="error">❌ Ошибка загрузки</p>';
    }
}

function getCategoryName(category) {
    const categories = {
        'weight_loss': 'Для похудения',
        'muscle_gain': 'Для набора массы',
        'weight_gain': 'Для набора веса'
    };
    return categories[category] || category || 'Общее';
}

function getExerciseTypeName(type) {
    const types = {
        'strength': 'Силовое',
        'cardio': 'Кардио',
        'stretching': 'Растяжка'
    };
    return types[type] || type || 'Общее';
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
async function removeFavoriteRecipe(recipeId) {
    try {
        await toggleRecipeFavorite(recipeId, false);  
        await loadFavoriteRecipes();
    } catch (error) {
        console.error('Ошибка удаления из избранного:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function removeFavoriteExercise(exerciseId) {
    try {
        await toggleExerciseFavorite(exerciseId, false);  
        await loadFavoriteExercises();
    } catch (error) {
        console.error('Ошибка удаления из избранного:', error);
        alert('Ошибка: ' + error.message);
    }
}

function showTab(tab) {
    currentTab = tab;
    
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (tab === 'recipes') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('recipesTab').style.display = 'block';
        document.getElementById('exercisesTab').style.display = 'none';
        loadFavoriteRecipes();
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('recipesTab').style.display = 'none';
        document.getElementById('exercisesTab').style.display = 'block';
        loadFavoriteExercises();
    }
}
async function showFavoriteRecipeDetails(recipeId) {
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
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h2>🍽️ ${escapeHtml(recipe.name)}</h2>
                            <button class="heart-btn ${recipe.is_favorite ? 'active' : ''}" 
                                    onclick="event.stopPropagation(); toggleFavoriteFromModal(${recipe.recipe_id}, ${!recipe.is_favorite})"
                                    style="font-size: 28px; background: none; border: none; cursor: pointer;">
                                ${recipe.is_favorite ? '❤️' : '♡'}
                            </button>
                        </div>
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


async function toggleFavoriteFromModal(recipeId, isFavorite) {
    try {
        await toggleRecipeFavorite(recipeId, isFavorite);

        await loadFavoriteRecipes();

        closeDetailModal();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}
async function showFavoriteExerciseDetails(exerciseId) {
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
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h2>🏋️ ${escapeHtml(exercise.name)}</h2>
                            <button class="heart-btn ${exercise.is_favorite ? 'active' : ''}" 
                                    onclick="event.stopPropagation(); toggleExerciseFavoriteFromModal(${exercise.exercise_id}, ${!exercise.is_favorite})"
                                    style="font-size: 28px; background: none; border: none; cursor: pointer;">
                                ${exercise.is_favorite ? '❤️' : '♡'}
                            </button>
                        </div>
                        <div class="subtitle">${exercise.exercise_type === 'strength' ? '💪 Силовое' : exercise.exercise_type === 'cardio' ? '🏃 Кардио' : '🧘 Растяжка'}</div>
                    </div>
                    <div class="detail-modal-body">
                        ${imageUrl ? 
                            `<img src="${imageUrl}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23718096%22%3E📷%3C/text%3E%3C/svg%3E'" style="width: 100%; border-radius: 12px;">` : 
                            `<div style="background: linear-gradient(135deg, #48bb78, #38a169); height: 180px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; flex-direction: column;">
                                <span style="font-size: 48px;">🏋️</span>
                                <span>${escapeHtml(exercise.name)}</span>
                             </div>`
                        }
                        
                        <div class="detail-section">
                            <h3>💪 Работающие мышцы</h3>
                            <div>
                                ${muscleGroups.map(m => `<span class="detail-badge">${escapeHtml(m)}</span>`).join('')}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h3>📖 Техника выполнения</h3>
                            <p>${escapeHtml(exercise.description || 'Описание не указано')}</p>
                        </div>
                        
                        ${exercise.contraindications ? `
                        <div class="detail-section">
                            <h3>⚠️ Противопоказания</h3>
                            <div class="contraindications">
                                <strong>Противопоказания:</strong>
                                <p>${escapeHtml(exercise.contraindications)}</p>
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
        
        const existingModal = document.getElementById('detailModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Ошибка загрузки деталей упражнения:', error);
        alert('Ошибка загрузки: ' + error.message);
    }
}


async function toggleExerciseFavoriteFromModal(exerciseId, isFavorite) {
    try {
        await toggleExerciseFavorite(exerciseId, isFavorite);
        await loadFavoriteExercises();
        closeDetailModal();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

function closeDetailModal(event) {
    const modal = document.getElementById('detailModal');
    if (modal) modal.remove();
}
loadFavoriteRecipes();
