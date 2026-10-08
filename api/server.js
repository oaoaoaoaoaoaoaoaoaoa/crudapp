const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = 5000;

app.use(cors({
  origin: true,                 
  credentials: true,            
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static('/var/www/html'));

const db = mysql.createPool({
  host: 'db',          
  user: 'root',
  password: '1',  
  database: 'db',      
  waitForConnections: true,
  connectionLimit: 10,
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err);
    } else {
        console.log('✅ Подключение к БД успешно');
        connection.release();
    }
});


const MEAL_CONFIGS = {
    1: [
        { type: 'Обед', percent: 100 }
    ],
    2: [
        { type: 'Завтрак', percent: 50 },
        { type: 'Ужин', percent: 50 }
    ],
    3: [
        { type: 'Завтрак', percent: 25 },
        { type: 'Обед', percent: 45 },
        { type: 'Ужин', percent: 30 }
    ],
    4: [
        { type: 'Завтрак', percent: 20 },
        { type: 'Перекус', percent: 10 },
        { type: 'Обед', percent: 40 },
        { type: 'Ужин', percent: 30 }
    ],
    5: [
        { type: 'Завтрак', percent: 20 },
        { type: 'Перекус', percent: 10 },
        { type: 'Обед', percent: 35 },
        { type: 'Полдник', percent: 10 },
        { type: 'Ужин', percent: 25 }
    ],
    6: [
        { type: 'Завтрак', percent: 20 },
        { type: 'Перекус', percent: 10 },
        { type: 'Обед', percent: 30 },
        { type: 'Полдник', percent: 10 },
        { type: 'Ужин', percent: 20 },
        { type: 'Перекус 2', percent: 10 }
    ]
};


const VALID_SERVINGS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Токен не предоставлен' });
    jwt.verify(token, 'your_secret_key', (err, user) => {
        if (err) return res.status(403).json({ message: 'Недействительный токен' });
        req.user = user;
        next();
    });
};


function getActivityMultiplier(activityLevel) {
    switch(activityLevel) {
        case 'sedentary': return 1.2;
        case 'light': return 1.375;
        case 'moderate': return 1.55;
        case 'active': return 1.725;
        case 'very_active': return 1.9;
        default: return 1.55;
    }
}

function getBodyTypeMultiplier(bodyType, goalType) {
    if (goalType === 'weight_loss') {
        switch(bodyType) {
            case 'ectomorph': return 0.9;
            case 'endomorph': return 1.1;
            default: return 1.0;
        }
    } else if (goalType === 'muscle_gain') {
        switch(bodyType) {
            case 'ectomorph': return 1.15;
            case 'endomorph': return 0.85;
            default: return 1.0;
        }
    }
    return 1.0;
}

function calculateTargetCalories(profile, goalType, currentWeight, targetValue, daysDiff) {
    let bmr;
    if (profile.gender === 'male') {
        bmr = 10 * currentWeight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
        bmr = 10 * currentWeight + 6.25 * profile.height - 5 * profile.age - 161;
    }
    
    const activityMultiplier = getActivityMultiplier(profile.activity_level);
    const tdee = bmr * activityMultiplier;
    
    let targetCalories = tdee;
    let dailyDeficit = 0;
    let proteinTarget = 0;
    
    const bodyTypeMultiplier = getBodyTypeMultiplier(profile.body_type, goalType);
    
    if (goalType === 'weight_loss') {
        const weightToLose = currentWeight - targetValue;
        const totalCaloriesToLose = weightToLose * 7700;
        dailyDeficit = totalCaloriesToLose / daysDiff;
        const safeDeficit = Math.min(dailyDeficit, 800);
        const adjustedDeficit = safeDeficit * bodyTypeMultiplier;
        targetCalories = Math.round(tdee - adjustedDeficit);
        dailyDeficit = Math.round(adjustedDeficit);
        proteinTarget = Math.round(currentWeight * 1.6);
    } else if (goalType === 'muscle_gain') {
        const weightToGain = targetValue - currentWeight;
        const totalCaloriesToAdd = weightToGain * 1800;
        const dailySurplus = totalCaloriesToAdd / daysDiff;
        let safeSurplus = Math.min(500, Math.max(300, dailySurplus));
        const adjustedSurplus = safeSurplus * bodyTypeMultiplier;
        targetCalories = Math.round(tdee + adjustedSurplus);
        dailyDeficit = -Math.round(adjustedSurplus);
        proteinTarget = Math.round(currentWeight * 2.0);
    } else {
        targetCalories = Math.round(tdee);
        proteinTarget = Math.round(currentWeight * 1.2);
    }
    
    targetCalories = Math.max(targetCalories, 1200);
    return { targetCalories, dailyDeficit, proteinTarget, tdee };
}

function getMuscleSize(muscleGroup) {
    const largeMuscles = ['грудь', 'спина', 'ноги', 'бедра', 'ягодицы', 'квадрицепс', 'бицепс бедра'];
    const smallMuscles = ['плечи', 'руки', 'бицепс', 'трицепс', 'пресс', 'кор', 'икры', 'предплечья', 'трапеции', 'дельты'];
    
    muscleGroup = muscleGroup.toLowerCase();
    
    if (largeMuscles.some(m => muscleGroup.includes(m))) {
        return 'large';
    }
    if (smallMuscles.some(m => muscleGroup.includes(m))) {
        return 'small';
    }
    return 'medium';
}

function calculateSetsAndReps(bodyType, muscleGroup, isLargeMuscle = null) {
    const muscleSize = isLargeMuscle !== null ? isLargeMuscle : getMuscleSize(muscleGroup);
    let setsRange, repsRange;
    
    switch(bodyType) {
        case 'ectomorph':
            if (muscleSize === 'large') {
                setsRange = [3, 4];
                repsRange = [6, 8];
            } else {
                setsRange = [3, 4];
                repsRange = [8, 8];
            }
            break;
        case 'mesomorph':
            if (muscleSize === 'large') {
                setsRange = [3, 5];
                repsRange = [8, 10];
            } else {
                setsRange = [3, 5];
                repsRange = [10, 12];
            }
            break;
        case 'endomorph':
            if (muscleSize === 'large') {
                setsRange = [4, 5];
                repsRange = [12, 13];
            } else {
                setsRange = [4, 5];
                repsRange = [13, 15];
            }
            break;
        default:
            setsRange = [3, 4];
            repsRange = [8, 12];
    }
    
    const sets = Math.floor(Math.random() * (setsRange[1] - setsRange[0] + 1)) + setsRange[0];
    const reps = Math.floor(Math.random() * (repsRange[1] - repsRange[0] + 1)) + repsRange[0];
    return { sets, reps };
}

function getWorkoutDaysSchedule(startDate, endDate, workoutsPerWeek) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const workoutDays = new Array(daysDiff).fill(false);
    
    if (workoutsPerWeek === 1) {
        for (let i = 0; i < daysDiff; i++) {
            if (i === 0 || i % 7 === 0) workoutDays[i] = true;
        }
    } else if (workoutsPerWeek === 2) {
        for (let i = 0; i < daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos === 0 || weekPos === 3) workoutDays[i] = true;
        }
    } else if (workoutsPerWeek === 3) {
        for (let i = 0; i < daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos === 0 || weekPos === 2 || weekPos === 4) workoutDays[i] = true;
        }
    } else if (workoutsPerWeek === 4) {
        for (let i = 0; i < daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos === 0 || weekPos === 2 || weekPos === 4 || weekPos === 6) workoutDays[i] = true;
        }
    } else if (workoutsPerWeek === 5) {
        for (let i = 0; i < daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos < 5) workoutDays[i] = true;
        }
    } else if (workoutsPerWeek === 6) {
        for (let i = 0; i < daysDiff; i++) {
            const weekPos = i % 7;
            if (weekPos < 6) workoutDays[i] = true;
        }
    } else if (workoutsPerWeek === 7) {
        for (let i = 0; i < daysDiff; i++) workoutDays[i] = true;
    }
    
    return workoutDays;
}

function checkGoalSafety(goalType, currentWeight, targetValue, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const weeksDiff = daysDiff / 7;
    let isDangerous = false, isImpossible = false, warningMessage = '';
    
    if (goalType === 'weight_loss') {
        const weightDiff = currentWeight - targetValue;
        const changePerWeek = weightDiff / weeksDiff;
        if (changePerWeek > 1.5) {
            isImpossible = true;
            warningMessage = `Невозможно сбросить ${weightDiff.toFixed(1)} кг за ${daysDiff} дней. Безопасная норма — не более 1 кг в неделю.`;
        } else if (changePerWeek > 1.0) {
            isDangerous = true;
            warningMessage = `Вы планируете сбрасывать ${changePerWeek.toFixed(1)} кг в неделю. Это выше безопасной нормы (1 кг/неделю).`;
        }
    } else if (goalType === 'muscle_gain') {
        const weightDiff = targetValue - currentWeight;
        const changePerWeek = weightDiff / weeksDiff;
        if (changePerWeek > 0.8) {
            isImpossible = true;
            warningMessage = `Невозможно набрать ${weightDiff.toFixed(1)} кг за ${daysDiff} дней. Реалистичный набор — 0.2-0.5 кг в неделю.`;
        } else if (changePerWeek > 0.5) {
            isDangerous = true;
            warningMessage = `Вы планируете набирать ${changePerWeek.toFixed(1)} кг в неделю. Новичкам рекомендуется 0.2-0.3 кг в неделю.`;
        }
    }
    return { isDangerous, isImpossible, warningMessage, daysDiff };
}

async function findBestRecipeForMeal(targetCalories, allergies, favoriteRecipeIds, allRecipes, usedRecipeIds, goalType) {
    let availableRecipes = allRecipes;
    if (allergies && allergies.length > 0) {
        const allergyList = allergies.split(',').map(a => a.trim().toLowerCase());
        availableRecipes = availableRecipes.filter(recipe => {
            const ingredients = recipe.ingredients?.toLowerCase() || '';
            return !allergyList.some(allergy => ingredients.includes(allergy));
        });
    }
    
    availableRecipes = availableRecipes.filter(recipe => !usedRecipeIds.has(recipe.recipe_id));
    
    if (availableRecipes.length === 0) return null;
    
    let bestRecipe = null;
    let bestDiff = Infinity;
    let bestServings = 1.0;
    let bestActualCalories = 0;
    
    for (const recipe of availableRecipes) {
        for (const servings of VALID_SERVINGS) {
            const actualCalories = recipe.calories * servings;
            
            let isValid = true;
            if (goalType === 'weight_loss') {
                if (actualCalories > targetCalories) {
                    isValid = false;
                }
            } else if (goalType === 'muscle_gain') {
                if (actualCalories < targetCalories) {
                    isValid = false;
                }
            }
            
            if (!isValid) continue;
            
            const diff = Math.abs(actualCalories - targetCalories);
            const isFavorite = favoriteRecipeIds.has(recipe.recipe_id);
            const adjustedDiff = isFavorite ? diff * 0.9 : diff;
            
            if (adjustedDiff < bestDiff) {
                bestDiff = adjustedDiff;
                bestRecipe = recipe;
                bestServings = servings;
                bestActualCalories = actualCalories;
            }
        }
    }
    
    if (bestRecipe) {
        return {
            recipe: bestRecipe,
            servings: bestServings,
            actualCalories: bestActualCalories
        };
    }
    
    return null;
}

async function generateMealPlans(goalId, goalType, startDate, endDate, allergies, targetCalories, userId, mealsPerDay) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const mealConfig = MEAL_CONFIGS[mealsPerDay] || MEAL_CONFIGS[5];
    const category = goalType === 'weight_loss' ? 'weight_loss' : 'muscle_gain';

    const [profileData] = await db.promise().execute(
        'SELECT favorite_recipes FROM profiles WHERE user_id = ?',
        [userId]
    );
    const favoriteRecipeIds = new Set();
    if (profileData.length > 0 && profileData[0].favorite_recipes) {
        profileData[0].favorite_recipes.split(',').forEach(id => {
            favoriteRecipeIds.add(parseInt(id.trim()));
        });
    }
    
    let [allRecipes] = await db.promise().execute('SELECT * FROM recipes WHERE category = ?', [category]);
    
    if (allRecipes.length === 0) {
        const [allR] = await db.promise().execute('SELECT * FROM recipes LIMIT 50');
        allRecipes = allR;
    }
    
    const uniquePlansCount = Math.ceil(daysDiff / 2) + 1;
    console.log(`📅 Дней: ${daysDiff}, генерируем планов: ${uniquePlansCount}`);
    console.log(`📚 Доступно рецептов: ${allRecipes.length}`);
    
    const globalUsedRecipeIds = new Set();
    const validMealVariants = [];
    
    for (let v = 0; v < uniquePlansCount; v++) {
        const dayMeals = [];
        let planSuccess = true;
        
        for (const meal of mealConfig) {
            const mealTargetCalories = Math.round(targetCalories * (meal.percent / 100));
            
            const best = await findBestRecipeForMeal(
                mealTargetCalories, 
                allergies, 
                favoriteRecipeIds, 
                allRecipes, 
                globalUsedRecipeIds,
                goalType
            );
            
            if (best) {
                dayMeals.push({
                    meal_type: meal.type,
                    recipe: best.recipe,
                    servings: best.servings,
                    actualCalories: best.actualCalories
                });
                globalUsedRecipeIds.add(best.recipe.recipe_id);
            } else {
                console.log(`⚠️ Не хватает рецептов для ${meal.type} (цель ${mealTargetCalories} ккал)`);
                planSuccess = false;
                break;
            }
        }
        
        if (planSuccess && dayMeals.length === mealConfig.length) {
            let totalCalories = 0;
            for (const meal of dayMeals) {
                totalCalories += meal.actualCalories;
            }
            
            let isCaloriesValid = true;
            if (goalType === 'weight_loss') {
                if (totalCalories > targetCalories) {
                    console.log(`⚠️ План ${v + 1}: калорийность ${Math.round(totalCalories)} ккал превышает цель ${targetCalories} ккал — ОТБРАСЫВАЕМ`);
                    isCaloriesValid = false;
                }
            } else if (goalType === 'muscle_gain') {
                if (totalCalories < targetCalories) {
                    console.log(`⚠️ План ${v + 1}: калорийность ${Math.round(totalCalories)} ккал ниже цели ${targetCalories} ккал — ОТБРАСЫВАЕМ`);
                    isCaloriesValid = false;
                }
            }
            
            if (isCaloriesValid) {
                console.log(`✅ План ${v + 1}: калорийность ${Math.round(totalCalories)} ккал — ПРИНЯТ`);
                validMealVariants.push(dayMeals);
            } else {
                console.log(`   → План ${v + 1} не прошёл проверку, не включаем в чередование`);
            }
        } else {
            console.log(`⚠️ План ${v + 1} не удалось собрать, пропускаем`);
        }
    }
    
    if (validMealVariants.length === 0) {
        console.error('❌ Не удалось сгенерировать ни одного плана, прошедшего проверку');
        return;
    }
    
    console.log(`✅ Прошло проверку калорийности: ${validMealVariants.length} планов из ${uniquePlansCount}`);
    console.log(`📋 Чередование будет по ${validMealVariants.length} планам`);
    
    let mealCounter = 1;
    
    for (let dayIndex = 0; dayIndex < daysDiff; dayIndex++) {
        const pairIndex = Math.floor(dayIndex / 4);
        const positionInPair = dayIndex % 4;
        
        let planIndex;
        if (positionInPair === 0 || positionInPair === 2) {
            planIndex = pairIndex * 2;
        } else {
            planIndex = pairIndex * 2 + 1;
        }
        
        planIndex = planIndex % validMealVariants.length;
        
        const dayMeals = validMealVariants[planIndex];
        
        let totalCalories = 0;
        for (const meal of dayMeals) {
            totalCalories += meal.actualCalories;
        }
	const [mealResult] = await db.promise().execute(
	    'INSERT INTO meal_plan (name, total_calories, goal_id, display_order) VALUES (?, ?, ?, ?)',
	    [`Суточный рацион ${mealCounter}`, Math.round(totalCalories), goalId, mealCounter - 1]
	);        

        const mealPlanId = mealResult.insertId;
        
        for (const meal of dayMeals) {
            await db.promise().execute(
                `INSERT INTO meal_plan_recipes (mplan_id, recipe_id, meal_type, servings, is_completed) 
                 VALUES (?, ?, ?, ?, ?)`,
                [mealPlanId, meal.recipe.recipe_id, meal.meal_type, meal.servings, false]
            );
        }
        
        mealCounter++;
    }
    
    console.log(`✅ Сгенерировано ${mealCounter - 1} планов питания на ${daysDiff} дней`);
}


async function generateWorkoutPlans(goalId, goalType, startDate, endDate, workoutsPerWeek, profile, tdee, targetCalories, targetMuscles = [], userId) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const bodyType = profile.body_type || 'mesomorph';
   
    const workoutDaysSchedule = getWorkoutDaysSchedule(startDate, endDate, workoutsPerWeek);
    
    const totalWorkoutDays = workoutDaysSchedule.filter(d => d).length;
    console.log(`📅 По правилам (${workoutsPerWeek} раз/неделю) будет ${totalWorkoutDays} тренировок`);
    
    const workoutDayIndices = [];
    for (let i = 0; i < workoutDaysSchedule.length; i++) {
        if (workoutDaysSchedule[i]) {
            workoutDayIndices.push(i);
        }
    }
    console.log(`📅 Дни с тренировками (по правилам):`, workoutDayIndices);
    
    let variantsCount = Math.min(totalWorkoutDays, 5);
    variantsCount = Math.max(variantsCount, 2);

    const [profileExercises] = await db.promise().execute(
        'SELECT favorite_exercises FROM profiles WHERE user_id = ?',
        [userId]
    );
    const favoriteIds = new Set();
    if (profileExercises.length > 0 && profileExercises[0].favorite_exercises) {
        profileExercises[0].favorite_exercises.split(',').forEach(id => {
            favoriteIds.add(parseInt(id.trim()));
        });
    }
    
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    
    let allExercises = [];
    if (goalType === 'weight_loss') {
        const [exercises] = await db.promise().execute('SELECT * FROM exercises WHERE exercise_type = ?', ['cardio']);
        allExercises = exercises;
    } else {
        if (targetMuscles && targetMuscles.length > 0) {
            const conditions = targetMuscles.map(() => 'muscle_group LIKE ?').join(' OR ');
            const likeParams = targetMuscles.map(m => `%${m}%`);
            const [exercises] = await db.promise().execute(`SELECT * FROM exercises WHERE exercise_type = 'strength' AND (${conditions})`, likeParams);
            allExercises = exercises;
        } else {
            const [exercises] = await db.promise().execute('SELECT * FROM exercises WHERE exercise_type = ?', ['strength']);
            allExercises = exercises;
        }
    }
    
    if (allExercises.length === 0) {
        const [exercises] = await db.promise().execute('SELECT * FROM exercises LIMIT 20');
        allExercises = exercises;
    }
    
    const favoriteExercisesList = allExercises.filter(ex => favoriteIds.has(ex.exercise_id));
    
    function generateUniqueVariants(exercisesList, favoritesList, variantsNeeded, exercisesPerVariant = 4) {
        const variants = [];
        const usedCombinations = new Set();
        
        if (exercisesList.length < exercisesPerVariant) {
            console.log(`⚠️ Упражнений (${exercisesList.length}) меньше чем ${exercisesPerVariant} в варианте`);
            exercisesPerVariant = exercisesList.length;
        }
        
        let attempts = 0;
        const maxAttempts = 100;
        
        while (variants.length < variantsNeeded && attempts < maxAttempts) {
            const variant = [];
            const usedIds = new Set();
            
            for (let ex of favoritesList) {
                if (variant.length < exercisesPerVariant && !usedIds.has(ex.exercise_id)) {
                    variant.push(ex);
                    usedIds.add(ex.exercise_id);
                }
            }
            
            const remainingExercises = exercisesList.filter(ex => !usedIds.has(ex.exercise_id));
            const shuffledRemaining = shuffleArray([...remainingExercises]);
            
            for (let ex of shuffledRemaining) {
                if (variant.length < exercisesPerVariant && !usedIds.has(ex.exercise_id)) {
                    variant.push(ex);
                    usedIds.add(ex.exercise_id);
                }
            }
            
            if (variant.length < exercisesPerVariant) {
                const shuffledAll = shuffleArray([...exercisesList]);
                for (let ex of shuffledAll) {
                    if (variant.length < exercisesPerVariant && !usedIds.has(ex.exercise_id)) {
                        variant.push(ex);
                        usedIds.add(ex.exercise_id);
                    }
                }
            }
            
            const variantKey = variant.map(ex => ex.exercise_id).sort().join(',');
            
            if (!usedCombinations.has(variantKey) || variants.length === 0) {
                usedCombinations.add(variantKey);
                variants.push(variant);
                console.log(`✅ Уникальный вариант ${variants.length}: ${variant.map(ex => ex.name).join(', ')}`);
            }
            
            attempts++;
        }
        
        if (variants.length < variantsNeeded) {
            console.log(`⚠️ Создано только ${variants.length} уникальных вариантов из ${variantsNeeded}, будем повторять`);
            while (variants.length < variantsNeeded) {
                const repeatIndex = (variants.length - variantsNeeded) % variants.length;
                variants.push(variants[repeatIndex]);
                console.log(`🔄 Повторяем вариант ${repeatIndex + 1}`);
            }
        }
        
        return variants;
    }
    
    const workoutVariants = generateUniqueVariants(allExercises, favoriteExercisesList, variantsCount, 4);
    console.log(`🎯 Создано ${workoutVariants.length} вариантов тренировок`);
    
    let caloriesPerWorkout = 0;
    if (goalType === 'weight_loss' && totalWorkoutDays > 0 && tdee && targetCalories) {
        const deficitPerDay = tdee - targetCalories;
        caloriesPerWorkout = Math.round((deficitPerDay * daysDiff) / totalWorkoutDays);
        caloriesPerWorkout = Math.min(caloriesPerWorkout, 600);
    }
    
    let workoutCounter = 0;
    let variantIndex = 0;
    
    for (let dayIndex = 0; dayIndex < workoutDaysSchedule.length; dayIndex++) {
        if (workoutDaysSchedule[dayIndex]) {
            const workoutVariant = workoutVariants[variantIndex % workoutVariants.length];
            variantIndex++;
            
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + dayIndex);
            
            console.log(`📝 Создаём тренировку для дня ${dayIndex} (${currentDate.toLocaleDateString()})`);
            
            const [workoutResult] = await db.promise().execute(
                'INSERT INTO workout_plan (name, start_date, end_date, goal_id, display_order) VALUES (?, ?, ?, ?, ?)',
                [`Тренировка ${workoutCounter + 1}`, currentDate, currentDate, goalId, dayIndex] 
            );

            const workoutPlanId = workoutResult.insertId;
            
            for (let ex of workoutVariant) {
                if (goalType === 'weight_loss' && caloriesPerWorkout > 0 && ex.met_value) {
                    const calPerMin = (ex.met_value * profile.weight * 3.5) / 200;
                    let duration = Math.round(caloriesPerWorkout / (calPerMin * workoutVariant.length));
                    duration = Math.min(45, Math.max(10, duration));
                    const calories = Math.round(calPerMin * duration);
                    await db.promise().execute(
                        `INSERT INTO plan_exercise (wplan_id, exercise_id, duration, calories_burned, is_completed) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [workoutPlanId, ex.exercise_id, duration, calories, false]
                    );
                } else {
                    let muscleSize = 'medium';
                    if (ex.muscle_group) {
                        const primaryMuscle = ex.muscle_group.split(',')[0].trim();
                        muscleSize = getMuscleSize(primaryMuscle);
                    }
                    const { sets, reps } = calculateSetsAndReps(bodyType, ex.muscle_group, muscleSize === 'large');
                    await db.promise().execute(
                        `INSERT INTO plan_exercise (wplan_id, exercise_id, sets, reps, is_completed) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [workoutPlanId, ex.exercise_id, sets, reps, false]
                    );
                }
            }
            workoutCounter++;
        }
    }
    
    console.log(`✅ Сгенерировано ${workoutCounter} тренировок, распределённых по ${totalWorkoutDays} дням (${workoutsPerWeek} раз/неделю)`);
    
    console.log('📅 ИТОГОВОЕ РАСПИСАНИЕ ТРЕНИРОВОК:');
    for (let i = 0; i < Math.min(workoutDaysSchedule.length, 30); i++) {
        if (workoutDaysSchedule[i]) {
            console.log(`  День ${i}: 🏋️ Тренировка есть`);
        } else {
            console.log(`  День ${i}: 😴 Отдых`);
        }
    }
}

function sanitizeString(str) {
    if (!str) return '';
    return String(str).replace(/[;'"\\]/g, '');
}

function isValidEmail(email) {
    if (!email) return false;
    if (email.length > 24) return false;
    if (!email.includes('@') || !email.includes('.')) return false;
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    if (!password) return false;
    if (password.length > 24 || password.length < 4) return false;
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;
    return passwordRegex.test(password);
}
app.get('/api/test', (req, res) => res.json({ message: 'API работает!' }));


app.post('/api/register', async (req, res) => {
    let { email, password, first_name, last_name, birth_date } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны' });
    }
    
    email = String(email).toLowerCase().trim();
    password = String(password).trim();
    

    if (!isValidEmail(email)) {
        return res.status(400).json({ 
            message: 'Некорректный email. Допустимые форматы: user@mail.ru, user@gmail.com. Максимум 24 символа.' 
        });
    }
    

    if (!isValidPassword(password)) {
        return res.status(400).json({ 
            message: 'Пароль должен содержать 4-24 символа. Допустимы латиница, цифры и символы !@#$%^&*()_-+' 
        });
    }
    

    if (first_name) first_name = sanitizeString(first_name).substring(0, 50);
    if (last_name) last_name = sanitizeString(last_name).substring(0, 50);
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.promise().execute(
            'INSERT INTO users (email, password_hash, first_name, last_name, birth_date) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, first_name || null, last_name || null, birth_date || null]
        );
        const token = jwt.sign({ userId: result.insertId, email }, 'your_secret_key', { expiresIn: '7d' });
        res.status(201).json({ message: 'Регистрация успешна', token, userId: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        } else {
            console.error(error);
            res.status(500).json({ message: 'Ожидаю подключение к базе данных' });
        }
    }
});


app.post('/api/login', async (req, res) => {
    let { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны' });
    }
    
    email = String(email).toLowerCase().trim();
    password = String(password).trim();
    
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Некорректный формат email' });
    }
    
    if (!isValidPassword(password)) {
        return res.status(400).json({ message: 'Некорректный формат пароля' });
    }
    
    try {
        const [users] = await db.promise().execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ message: 'Неверный email или пароль' });
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ message: 'Неверный email или пароль' });
        
        const token = jwt.sign({ userId: user.user_id, email: user.email }, 'your_secret_key', { expiresIn: '7d' });
        res.json({ message: 'Вход выполнен', token, userId: user.user_id });
    } catch (error) {
        console.error(error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const [profiles] = await db.promise().execute(
            'SELECT height, weight, age, gender, body_type, allergies, activity_level FROM profiles WHERE user_id = ?',
            [req.user.userId]
        );
        if (profiles.length === 0) return res.json({});
        res.json(profiles[0]);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.post('/api/profile', authenticateToken, async (req, res) => {
    const { height, weight, age, gender, body_type, allergies, activity_level } = req.body;
    try {
        await db.promise().execute(
            `INSERT INTO profiles (user_id, height, weight, age, gender, body_type, allergies, activity_level) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             height = VALUES(height), weight = VALUES(weight), age = VALUES(age), 
             gender = VALUES(gender), body_type = VALUES(body_type), allergies = VALUES(allergies), activity_level = VALUES(activity_level)`,
            [req.user.userId, height || null, weight || null, age || null, gender || null, body_type || null, allergies || '', activity_level || 'moderate']
        );
        res.json({ message: 'Профиль сохранён' });
    } catch (error) {
        console.error('❌ Ошибка сохранения профиля:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});


app.get('/api/ingredients-list', authenticateToken, async (req, res) => {
    try {
        const [recipes] = await db.promise().execute('SELECT ingredients FROM recipes WHERE ingredients IS NOT NULL AND ingredients != ""');
        const allIngredients = new Set();
        const excludeWords = ['вода', 'воды', 'воду', 'водой', 'лёд', 'лед', 'льда', 'льду', 'льдом'];
        recipes.forEach(recipe => {
            if (recipe.ingredients) {
                const items = recipe.ingredients.split(',').map(i => i.trim().toLowerCase());
                items.forEach(item => { if (item && !excludeWords.includes(item)) allIngredients.add(item); });
            }
        });
        const ingredientsList = Array.from(allIngredients).map((name, index) => ({ id: index + 1, name: name }));
        res.json(ingredientsList);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/user-allergies', authenticateToken, async (req, res) => {
    try {
        const [profiles] = await db.promise().execute('SELECT allergies FROM profiles WHERE user_id = ?', [req.user.userId]);
        let allergies = [];
        if (profiles.length > 0 && profiles[0].allergies) allergies = profiles[0].allergies.split(',').map(a => a.trim().toLowerCase());
        res.json(allergies);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});


app.get('/api/check-db', async (req, res) => {
    try {

        await db.promise().query('SELECT 1');
        res.json({ status: 'connected', message: 'База данных доступна' });
    } catch (error) {
        console.error('❌ БД недоступна:', error.message);
        res.status(503).json({ 
            status: 'disconnected', 
            message: 'База данных недоступна. Пожалуйста, дождитесь её запуска.' 
        });
    }
});
app.post('/api/user-allergies', authenticateToken, async (req, res) => {
    const { allergies } = req.body;
    try {
        const allergiesText = allergies && allergies.length > 0 ? allergies.join(', ') : '';
        await db.promise().execute(
            `INSERT INTO profiles (user_id, allergies) VALUES (?, ?) ON DUPLICATE KEY UPDATE allergies = VALUES(allergies)`,
            [req.user.userId, allergiesText]
        );
        res.json({ message: 'Аллергии сохранены' });
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.delete('/api/user/account', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    
    const connection = await db.promise().getConnection();
    
    try {
        await connection.beginTransaction();
        
        await connection.execute('DELETE FROM health_data WHERE user_id = ?', [userId]);
        
        await connection.execute(
            'DELETE pe FROM plan_exercise pe JOIN workout_plan wp ON pe.wplan_id = wp.wplan_id WHERE wp.goal_id IN (SELECT goal_id FROM goals WHERE user_id = ?)',
            [userId]
        );
        
        await connection.execute(
            'DELETE wp FROM workout_plan wp WHERE wp.goal_id IN (SELECT goal_id FROM goals WHERE user_id = ?)',
            [userId]
        );
        
        await connection.execute(
            'DELETE mpr FROM meal_plan_recipes mpr JOIN meal_plan mp ON mpr.mplan_id = mp.mplan_id WHERE mp.goal_id IN (SELECT goal_id FROM goals WHERE user_id = ?)',
            [userId]
        );
        
        await connection.execute(
            'DELETE mp FROM meal_plan mp WHERE mp.goal_id IN (SELECT goal_id FROM goals WHERE user_id = ?)',
            [userId]
        );
        
        await connection.execute('DELETE FROM goals WHERE user_id = ?', [userId]);
        
        await connection.execute('DELETE FROM profiles WHERE user_id = ?', [userId]);
        
        const [result] = await connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);
        
        if (result.affectedRows === 0) {
            throw new Error('Пользователь не найден');
        }
        
        await connection.commit();
        
        res.json({ message: 'Аккаунт успешно удалён' });
        
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка удаления аккаунта:', error);
        res.status(500).json({ message: 'Ошибка удаления аккаунта: ' + error.message });
    } finally {
        connection.release();
    }
});


app.post('/api/goals', authenticateToken, async (req, res) => {
    const { type, desired_value, target_steps, start_date, end_date, workouts_per_week, target_muscles, meals_per_day } = req.body;
    
    if (!type || !start_date || !end_date) {
        return res.status(400).json({ message: 'Не все поля заполнены' });
    }

    if (type === 'steps') {
        if (!target_steps || target_steps < 1) {  
            return res.status(400).json({ message: 'Укажите желаемое количество шагов' });
        }
    
        const [result] = await db.promise().execute(
            `INSERT INTO goals (user_id, type, target_steps, start_date, end_date, progress, workouts_per_week, meals_per_day) 
             VALUES (?, ?, ?, ?, ?, 0, 0, 0)`,
            [req.user.userId, type, target_steps, start_date, end_date]
        );
    
        return res.status(201).json({ 
            message: 'Цель на шаги создана', 
            goalId: result.insertId 
        });
    }
    
    if (!desired_value || !workouts_per_week) {
        return res.status(400).json({ message: 'Не все поля заполнены' });
    }
    
    const mealsPerDay = meals_per_day && meals_per_day >= 1 && meals_per_day <= 6 ? meals_per_day : 5;
    
    try {
        const [profiles] = await db.promise().execute(
            'SELECT height, weight, age, gender, body_type, allergies, activity_level FROM profiles WHERE user_id = ?',
            [req.user.userId]
        );
        if (profiles.length === 0) return res.status(400).json({ message: 'Сначала заполните профиль' });
        
        const profile = profiles[0];
        const currentWeight = profile.weight;
        const daysDiff = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
        
        const safety = checkGoalSafety(type, currentWeight, desired_value, start_date, end_date);
        if (safety.isImpossible) return res.status(400).json({ message: safety.warningMessage, code: 'IMPOSSIBLE_GOAL' });
        if (safety.isDangerous) return res.status(409).json({ message: safety.warningMessage, code: 'DANGEROUS_GOAL', requiresConfirmation: true });
        
        const { targetCalories, dailyDeficit, proteinTarget, tdee } = calculateTargetCalories(profile, type, currentWeight, desired_value, daysDiff);
        
        const [result] = await db.promise().execute(
            `INSERT INTO goals (user_id, type, desired_value, start_date, end_date, progress, workouts_per_week, target_calories, daily_deficit, protein_target, meals_per_day, start_weight) 
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
            [req.user.userId, type, desired_value, start_date, end_date, workouts_per_week, targetCalories, dailyDeficit, proteinTarget, mealsPerDay, currentWeight]
        );
        
        const goalId = result.insertId;
        
        await generateMealPlans(goalId, type, start_date, end_date, profile.allergies || '', targetCalories, req.user.userId, mealsPerDay);
        await generateWorkoutPlans(goalId, type, start_date, end_date, workouts_per_week, profile, tdee, targetCalories, target_muscles || [], req.user.userId);
        
        res.status(201).json({
            message: 'Цель создана, планы сгенерированы',
            goalId: goalId,
            nutrition: { calories: targetCalories, protein: proteinTarget, deficit: dailyDeficit }
        });
    } catch (error) {
        console.error('Ошибка создания цели:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/goals', authenticateToken, async (req, res) => {
    try {
        const [goals] = await db.promise().execute(
            'SELECT goal_id as id, user_id, type, desired_value, target_steps, start_date, end_date, progress, workouts_per_week, target_calories, meals_per_day, start_weight FROM goals WHERE user_id = ? ORDER BY end_date ASC',
            [req.user.userId]
        );
        res.json(goals);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
    const goalId = req.params.id;
    try {
        const [goal] = await db.promise().execute('SELECT goal_id FROM goals WHERE goal_id = ? AND user_id = ?', [goalId, req.user.userId]);
        if (goal.length === 0) return res.status(404).json({ message: 'Цель не найдена' });
        await db.promise().execute('DELETE FROM plan_exercise WHERE wplan_id IN (SELECT wplan_id FROM workout_plan WHERE goal_id = ?)', [goalId]);
        await db.promise().execute('DELETE FROM workout_plan WHERE goal_id = ?', [goalId]);
        await db.promise().execute('DELETE FROM meal_plan_recipes WHERE mplan_id IN (SELECT mplan_id FROM meal_plan WHERE goal_id = ?)', [goalId]);
        await db.promise().execute('DELETE FROM meal_plan WHERE goal_id = ?', [goalId]);
        await db.promise().execute('DELETE FROM goals WHERE goal_id = ? AND user_id = ?', [goalId, req.user.userId]);
        res.json({ message: 'Цель и все связанные планы удалены' });
    } catch (error) {
        console.error('Ошибка удаления цели:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/recipes', authenticateToken, async (req, res) => {
    try {
        const [profile] = await db.promise().execute('SELECT allergies FROM profiles WHERE user_id = ?', [req.user.userId]);
        const allergies = profile[0]?.allergies?.split(',').map(a => a.trim().toLowerCase()) || [];
        let [recipes] = await db.promise().execute('SELECT * FROM recipes ORDER BY calories');
        if (allergies.length > 0 && allergies[0] !== '') {
            recipes = recipes.filter(recipe => {
                const ingredients = recipe.ingredients?.toLowerCase() || '';
                return !allergies.some(allergy => ingredients.includes(allergy));
            });
        }
        res.json(recipes);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/meal-plans', authenticateToken, async (req, res) => {
    try {
        const [plans] = await db.promise().execute(
            `SELECT mp.mplan_id as id, mp.name, mp.created_at, mp.total_calories, mp.goal_id, mp.display_order
             FROM meal_plan mp 
             INNER JOIN goals g ON mp.goal_id = g.goal_id 
             WHERE g.user_id = ? 
             ORDER BY mp.display_order ASC, mp.created_at ASC`,
            [req.user.userId]
        );
        res.json(plans);
    } catch (error) {
        console.error('Ошибка получения планов питания:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/meal-plans/:id/recipes', authenticateToken, async (req, res) => {
    const planId = req.params.id;
    const userId = req.user.userId;
    
    try {
        const [profiles] = await db.promise().execute(
            'SELECT favorite_recipes FROM profiles WHERE user_id = ?',
            [userId]
        );
        
        const favoriteIds = new Set();
        if (profiles.length > 0 && profiles[0].favorite_recipes) {
            profiles[0].favorite_recipes.split(',').forEach(id => {
                favoriteIds.add(parseInt(id.trim()));
            });
        }
        
        const [recipes] = await db.promise().execute(
            `SELECT r.*, mpr.meal_type, mpr.is_completed, mpr.servings 
             FROM recipes r 
             JOIN meal_plan_recipes mpr ON r.recipe_id = mpr.recipe_id 
             WHERE mpr.mplan_id = ? 
             ORDER BY FIELD(mpr.meal_type, 'Завтрак', 'Перекус', 'Обед', 'Полдник', 'Ужин', 'Перекус 2')`,
            [planId]
        );
        
        const recipesWithFavorite = recipes.map(recipe => ({
            ...recipe,
            is_favorite: favoriteIds.has(recipe.recipe_id)
        }));
        
        res.json(recipesWithFavorite);
    } catch (error) {
        console.error('Ошибка получения рецептов плана:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.patch('/api/meal-plans/:planId/recipes/:recipeId/complete', authenticateToken, async (req, res) => {
    const { planId, recipeId } = req.params;
    const { is_completed } = req.body;
    try {
        const [check] = await db.promise().execute(
            `SELECT mpr.mplan_id FROM meal_plan_recipes mpr 
             JOIN meal_plan mp ON mpr.mplan_id = mp.mplan_id 
             JOIN goals g ON mp.goal_id = g.goal_id 
             WHERE mpr.mplan_id = ? AND mpr.recipe_id = ? AND g.user_id = ?`,
            [planId, recipeId, req.user.userId]
        );
        if (check.length === 0) return res.status(404).json({ message: 'Запись не найдена' });
        await db.promise().execute('UPDATE meal_plan_recipes SET is_completed = ? WHERE mplan_id = ? AND recipe_id = ?', [is_completed, planId, recipeId]);
        res.json({ message: is_completed ? '✅ Отмечено как съедено' : '❌ Отметка снята', is_completed });
    } catch (error) {
        console.error('Ошибка обновления статуса рецепта:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.patch('/api/recipes/:id/favorite', authenticateToken, async (req, res) => {
    const recipeId = parseInt(req.params.id);
    const { is_favorite } = req.body;
    const userId = req.user.userId;
    
    try {
        const [profiles] = await db.promise().execute(
            'SELECT favorite_recipes FROM profiles WHERE user_id = ?',
            [userId]
        );
        
        let favorites = [];
        if (profiles.length > 0 && profiles[0].favorite_recipes) {
            favorites = profiles[0].favorite_recipes.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }
        
        if (is_favorite) {
            if (!favorites.includes(recipeId)) {
                favorites.push(recipeId);
            }
        } else {
            favorites = favorites.filter(id => id !== recipeId);
        }
        
        const favoritesText = favorites.length > 0 ? favorites.join(',') : null;
        
        await db.promise().execute(
            'UPDATE profiles SET favorite_recipes = ? WHERE user_id = ?',
            [favoritesText, userId]
        );
        
        res.json({ message: is_favorite ? '❤️ Добавлено в избранное' : '💔 Удалено из избранного', is_favorite });
    } catch (error) {
        console.error('Ошибка:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.patch('/api/meal-plans/:planId/recipes/:recipeId/servings', authenticateToken, async (req, res) => {
    const { planId, recipeId } = req.params;
    const { servings } = req.body;
    
    if (!VALID_SERVINGS.includes(servings)) {
        return res.status(400).json({ message: 'Недопустимое значение порции. Допустимые: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0' });
    }
    
    try {
        const [check] = await db.promise().execute(
            `SELECT mp.mplan_id FROM meal_plan mp 
             INNER JOIN goals g ON mp.goal_id = g.goal_id 
             WHERE mp.mplan_id = ? AND g.user_id = ?`,
            [planId, req.user.userId]
        );
        
        if (check.length === 0) {
            return res.status(403).json({ message: 'Нет доступа к этому плану' });
        }
        
        const [recipe] = await db.promise().execute(
            'SELECT calories FROM recipes WHERE recipe_id = ?',
            [recipeId]
        );
        
        if (recipe.length === 0) {
            return res.status(404).json({ message: 'Рецепт не найден' });
        }
        
        await db.promise().execute(
            'UPDATE meal_plan_recipes SET servings = ? WHERE mplan_id = ? AND recipe_id = ?',
            [servings, planId, recipeId]
        );
        
        const [recipes] = await db.promise().execute(
            `SELECT r.calories, mpr.servings 
             FROM meal_plan_recipes mpr
             JOIN recipes r ON mpr.recipe_id = r.recipe_id
             WHERE mpr.mplan_id = ?`,
            [planId]
        );
        
        let totalCalories = 0;
        for (const r of recipes) {
            totalCalories += r.calories * r.servings;
        }
        
        await db.promise().execute(
            'UPDATE meal_plan SET total_calories = ? WHERE mplan_id = ?',
            [Math.round(totalCalories), planId]
        );
        
        res.json({ 
            message: 'Порция обновлена', 
            servings: servings,
            totalCalories: Math.round(totalCalories)
        });
        
    } catch (error) {
        console.error('Ошибка обновления порции:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/favorite-recipes', authenticateToken, async (req, res) => {
    try {
        const [profiles] = await db.promise().execute(
            'SELECT favorite_recipes FROM profiles WHERE user_id = ?',
            [req.user.userId]
        );
        
        let favoriteIds = [];
        if (profiles.length > 0 && profiles[0].favorite_recipes) {
            favoriteIds = profiles[0].favorite_recipes.split(',').map(id => parseInt(id.trim()));
        }
        
        if (favoriteIds.length === 0) {
            return res.json([]);
        }
        
        const placeholders = favoriteIds.map(() => '?').join(',');
        const [recipes] = await db.promise().execute(
            `SELECT * FROM recipes WHERE recipe_id IN (${placeholders})`,
            favoriteIds
        );
        
        res.json(recipes);
    } catch (error) {
        console.error('Ошибка получения избранных рецептов:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/workout-plans', authenticateToken, async (req, res) => {
    try {
        const [plans] = await db.promise().execute(
            `SELECT wp.wplan_id as id, wp.name, wp.start_date, wp.end_date, wp.goal_id, wp.display_order
             FROM workout_plan wp 
             INNER JOIN goals g ON wp.goal_id = g.goal_id 
             WHERE g.user_id = ? 
             ORDER BY wp.display_order ASC, wp.start_date ASC`,
            [req.user.userId]
        );
        res.json(plans);
    } catch (error) {
        console.error('Ошибка получения планов тренировок:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});


app.get('/api/workout-plans/:id/exercises', authenticateToken, async (req, res) => {
    const planId = req.params.id;
    const userId = req.user.userId;
    
    try {
        const [profiles] = await db.promise().execute(
            'SELECT favorite_exercises FROM profiles WHERE user_id = ?',
            [userId]
        );
        
        const favoriteIds = new Set();
        if (profiles.length > 0 && profiles[0].favorite_exercises) {
            profiles[0].favorite_exercises.split(',').forEach(id => {
                favoriteIds.add(parseInt(id.trim()));
            });
        }
        
        const [exercises] = await db.promise().execute(
            `SELECT e.*, pe.sets, pe.reps, pe.duration, pe.calories_burned, pe.is_completed 
             FROM exercises e 
             JOIN plan_exercise pe ON e.exercise_id = pe.exercise_id 
             WHERE pe.wplan_id = ?`,
            [planId]
        );
        
        const exercisesWithFavorite = exercises.map(exercise => ({
            ...exercise,
            is_favorite: favoriteIds.has(exercise.exercise_id)
        }));
        
        res.json(exercisesWithFavorite);
    } catch (error) {
        console.error('Ошибка получения упражнений плана:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.patch('/api/workout-plans/:planId/exercises/:exerciseId/complete', authenticateToken, async (req, res) => {
    const { planId, exerciseId } = req.params;
    const { is_completed } = req.body;
    try {
        const [check] = await db.promise().execute(
            `SELECT pe.wplan_id FROM plan_exercise pe
             JOIN workout_plan wp ON pe.wplan_id = wp.wplan_id
             JOIN goals g ON wp.goal_id = g.goal_id
             WHERE pe.wplan_id = ? AND pe.exercise_id = ? AND g.user_id = ?`,
            [planId, exerciseId, req.user.userId]
        );
        if (check.length === 0) return res.status(404).json({ message: 'Запись не найдена' });
        await db.promise().execute('UPDATE plan_exercise SET is_completed = ? WHERE wplan_id = ? AND exercise_id = ?', [is_completed, planId, exerciseId]);
        res.json({ message: is_completed ? '✅ Упражнение выполнено' : '❌ Отметка снята', is_completed });
    } catch (error) {
        console.error('Ошибка обновления статуса упражнения:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.patch('/api/exercises/:id/favorite', authenticateToken, async (req, res) => {
    const exerciseId = parseInt(req.params.id);
    const { is_favorite } = req.body;
    const userId = req.user.userId;
    
    try {
        const [profiles] = await db.promise().execute(
            'SELECT favorite_exercises FROM profiles WHERE user_id = ?',
            [userId]
        );
        
        let favorites = [];
        if (profiles.length > 0 && profiles[0].favorite_exercises) {
            favorites = profiles[0].favorite_exercises.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }
        
        if (is_favorite) {
            if (!favorites.includes(exerciseId)) {
                favorites.push(exerciseId);
            }
        } else {
            favorites = favorites.filter(id => id !== exerciseId);
        }
        
        const favoritesText = favorites.length > 0 ? favorites.join(',') : null;
        
        await db.promise().execute(
            'UPDATE profiles SET favorite_exercises = ? WHERE user_id = ?',
            [favoritesText, userId]
        );
        
        res.json({ message: is_favorite ? '❤️ Добавлено в избранное' : '💔 Удалено из избранного', is_favorite });
    } catch (error) {
        console.error('Ошибка:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});


app.get('/api/favorite-exercises', authenticateToken, async (req, res) => {
    try {
        const [profiles] = await db.promise().execute(
            'SELECT favorite_exercises FROM profiles WHERE user_id = ?',
            [req.user.userId]
        );
        
        let favoriteIds = [];
        if (profiles.length > 0 && profiles[0].favorite_exercises) {
            favoriteIds = profiles[0].favorite_exercises.split(',').map(id => parseInt(id.trim()));
        }
        
        if (favoriteIds.length === 0) {
            return res.json([]);
        }
        
        const placeholders = favoriteIds.map(() => '?').join(',');
        const [exercises] = await db.promise().execute(
            `SELECT * FROM exercises WHERE exercise_id IN (${placeholders})`,
            favoriteIds
        );
        
        res.json(exercises);
    } catch (error) {
        console.error('Ошибка получения избранных упражнений:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/health', authenticateToken, async (req, res) => {
    try {
        const [data] = await db.promise().execute(
            'SELECT data_id as id, user_id, heart_rate, steps, time as recorded_time, date as recorded_date FROM health_data WHERE user_id = ? ORDER BY time DESC LIMIT 100',
            [req.user.userId]
        );
        res.json(data);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.post('/api/health', authenticateToken, async (req, res) => {
    const { heart_rate, steps, recorded_time, recorded_date } = req.body;
    try {
        await db.promise().execute(
            'INSERT INTO health_data (user_id, heart_rate, steps, time, date) VALUES (?, ?, ?, ?, ?)',
            [req.user.userId, heart_rate || null, steps || null, recorded_time || new Date(), recorded_date || new Date()]
        );
        res.status(201).json({ message: 'Данные здоровья добавлены' });
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.delete('/api/workout-plans/:id', authenticateToken, async (req, res) => {
    const planId = req.params.id;
    try {
        const [result] = await db.promise().execute(
            `DELETE wp FROM workout_plan wp 
             INNER JOIN goals g ON wp.goal_id = g.goal_id 
             WHERE wp.wplan_id = ? AND g.user_id = ?`,
            [planId, req.user.userId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'План не найден или не принадлежит пользователю' });
        res.json({ message: 'План тренировок удалён' });
    } catch (error) {
        console.error('Ошибка удаления плана тренировок:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.delete('/api/meal-plans/:id', authenticateToken, async (req, res) => {
    const planId = req.params.id;
    try {
        const [result] = await db.promise().execute(
            `DELETE mp FROM meal_plan mp 
             INNER JOIN goals g ON mp.goal_id = g.goal_id 
             WHERE mp.mplan_id = ? AND g.user_id = ?`,
            [planId, req.user.userId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'План не найден или не принадлежит пользователю' });
        res.json({ message: 'План питания удалён' });
    } catch (error) {
        console.error('Ошибка удаления плана питания:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});


app.patch('/api/goals/:id/update-progress', authenticateToken, async (req, res) => {
    const goalId = req.params.id;
    const { current_weight, current_steps } = req.body;
    
    try {
        const [goals] = await db.promise().execute(
            'SELECT type, desired_value, target_steps, start_weight FROM goals WHERE goal_id = ? AND user_id = ?', 
            [goalId, req.user.userId]
        );
        
        if (goals.length === 0) return res.status(404).json({ message: 'Цель не найдена' });
        
        const goal = goals[0];
        let progress = 0;
        
        if (goal.type === 'steps') {
            const targetSteps = goal.target_steps;
            if (targetSteps && targetSteps > 0 && current_steps !== undefined) {
                progress = Math.min(100, Math.max(0, Math.round((current_steps / targetSteps) * 100)));
            }
        }
       
        else if (goal.type === 'weight_loss') {
            const startWeight = goal.start_weight;
            const targetWeight = goal.desired_value;
            if (startWeight && targetWeight && current_weight) {
                const totalToLose = startWeight - targetWeight;
                if (totalToLose > 0) {
                    const lost = startWeight - current_weight;
                    progress = Math.min(100, Math.max(0, Math.round((lost / totalToLose) * 100)));
                }
                if (current_weight <= targetWeight) progress = 100;
            }
        }
        
        else if (goal.type === 'muscle_gain') {
            const startWeight = goal.start_weight;
            const targetWeight = goal.desired_value;
            if (startWeight && targetWeight && current_weight) {
                const totalToGain = targetWeight - startWeight;
                if (totalToGain > 0) {
                    const gained = current_weight - startWeight;
                    progress = Math.min(100, Math.max(0, Math.round((gained / totalToGain) * 100)));
                }
                if (current_weight >= targetWeight) progress = 100;
            }
        }
        
        await db.promise().execute(
            'UPDATE goals SET progress = ? WHERE goal_id = ? AND user_id = ?', 
            [progress, goalId, req.user.userId]
        );
        
        res.json({ message: 'Прогресс обновлён', progress: progress });
        
    } catch (error) {
        console.error('Ошибка обновления прогресса:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/exercises', authenticateToken, async (req, res) => {
    try {
        const [exercises] = await db.promise().execute('SELECT exercise_id as id, name, muscle_group, exercise_type FROM exercises ORDER BY name');
        res.json(exercises);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.put('/api/workout-plans/:planId/exercises/:exerciseId', authenticateToken, async (req, res) => {
    const { planId, exerciseId } = req.params;
    const { newExerciseId, sets, reps } = req.body;
    try {
        const [check] = await db.promise().execute(
            `SELECT wp.wplan_id FROM workout_plan wp 
             INNER JOIN goals g ON wp.goal_id = g.goal_id 
             WHERE wp.wplan_id = ? AND g.user_id = ?`,
            [planId, req.user.userId]
        );
        if (check.length === 0) return res.status(403).json({ message: 'Нет доступа к этому плану' });
        const [result] = await db.promise().execute(
            'UPDATE plan_exercise SET exercise_id = ?, sets = ?, reps = ? WHERE wplan_id = ? AND exercise_id = ?',
            [newExerciseId, sets, reps, planId, exerciseId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Упражнение не найдено в этом плане' });
        res.json({ message: 'Упражнение заменено' });
    } catch (error) {
        console.error('❌ Ошибка замены упражнения:', error);
        res.status(500).json({ message: 'Ошибка сервера: ' + error.message });
    }
});

app.get('/api/all-recipes', authenticateToken, async (req, res) => {
    try {
        const [profile] = await db.promise().execute('SELECT allergies FROM profiles WHERE user_id = ?', [req.user.userId]);
        const allergies = profile[0]?.allergies?.split(',').map(a => a.trim().toLowerCase()) || [];
        let [recipes] = await db.promise().execute('SELECT recipe_id as id, name, calories, category, ingredients FROM recipes ORDER BY name');
        if (allergies.length > 0 && allergies[0] !== '') {
            recipes = recipes.filter(recipe => {
                const ingredients = recipe.ingredients?.toLowerCase() || '';
                return !allergies.some(allergy => ingredients.includes(allergy));
            });
        }
        res.json(recipes);
    } catch (error) {
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.put('/api/meal-plans/:planId/recipes/:recipeId', authenticateToken, async (req, res) => {
    const { planId, recipeId } = req.params;
    const { newRecipeId } = req.body;
    try {
        const [check] = await db.promise().execute(
            `SELECT mp.mplan_id FROM meal_plan mp 
             INNER JOIN goals g ON mp.goal_id = g.goal_id 
             WHERE mp.mplan_id = ? AND g.user_id = ?`,
            [planId, req.user.userId]
        );
        if (check.length === 0) return res.status(403).json({ message: 'Нет доступа к этому плану' });
        const [recipeExists] = await db.promise().execute('SELECT recipe_id FROM recipes WHERE recipe_id = ?', [newRecipeId]);
        if (recipeExists.length === 0) return res.status(404).json({ message: 'Новый рецепт не найден' });
        const [result] = await db.promise().execute('UPDATE meal_plan_recipes SET recipe_id = ? WHERE mplan_id = ? AND recipe_id = ?', [newRecipeId, planId, recipeId]);
        res.json({ message: 'Рецепт заменён' });
    } catch (error) {
        console.error('❌ Ошибка замены рецепта:', error);
        res.status(500).json({ message: 'Ошибка сервера: ' + error.message });
    }
});

app.get('/api/recipes/:id', authenticateToken, async (req, res) => {
    try {
        const recipeId = req.params.id;
        const [recipes] = await db.promise().execute('SELECT * FROM recipes WHERE recipe_id = ?', [recipeId]);
        if (recipes.length === 0) return res.status(404).json({ message: 'Рецепт не найден' });
        res.json(recipes[0]);
    } catch (error) {
        console.error('Ошибка получения рецепта:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.get('/api/exercises/:id', authenticateToken, async (req, res) => {
    try {
        const exerciseId = req.params.id;
        const [exercises] = await db.promise().execute('SELECT * FROM exercises WHERE exercise_id = ?', [exerciseId]);
        if (exercises.length === 0) return res.status(404).json({ message: 'Упражнение не найдено' });
        res.json(exercises[0]);
    } catch (error) {
        console.error('Ошибка получения упражнения:', error);
        console.error('❌ 500 at', req.method, req.path, 'code:', error && error.code, 'sqlMessage:', error && error.sqlMessage, 'sql:', error && error.sql, 'msg:', error && error.message); res.status(500).json({ message: 'Ошибка сервера', code: error && error.code, sqlMessage: error && error.sqlMessage, sql: error && error.sql });
    }
});

app.put('/api/meal-plans/reorder', authenticateToken, async (req, res) => {
    const { planOrders } = req.body;
    
    if (!planOrders || !Array.isArray(planOrders)) {
        return res.status(400).json({ message: 'Неверный формат данных' });
    }
    
    const connection = await db.promise().getConnection();
    
    try {
        await connection.beginTransaction();
        
        for (const item of planOrders) {
            const [check] = await connection.execute(
                `SELECT mp.mplan_id 
                 FROM meal_plan mp
                 JOIN goals g ON mp.goal_id = g.goal_id
                 WHERE mp.mplan_id = ? AND g.user_id = ?`,
                [item.planId, req.user.userId]
            );
            
            if (check.length === 0) {
                throw new Error(`План ${item.planId} не принадлежит пользователю`);
            }
            
            await connection.execute(
                'UPDATE meal_plan SET display_order = ? WHERE mplan_id = ?',
                [item.order, item.planId]
            );
        }
        
        await connection.commit();
        res.json({ message: 'Порядок планов обновлён', success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка обновления порядка планов:', error);
        res.status(500).json({ message: 'Ошибка сервера: ' + error.message });
    } finally {
        connection.release();
    }
});

app.put('/api/workout-plans/reorder', authenticateToken, async (req, res) => {
    const { planOrders } = req.body;
    
    if (!planOrders || !Array.isArray(planOrders)) {
        return res.status(400).json({ message: 'Неверный формат данных' });
    }
    
    const connection = await db.promise().getConnection();
    
    try {
        await connection.beginTransaction();
        
        for (const item of planOrders) {
            const [check] = await connection.execute(
                `SELECT wp.wplan_id 
                 FROM workout_plan wp
                 JOIN goals g ON wp.goal_id = g.goal_id
                 WHERE wp.wplan_id = ? AND g.user_id = ?`,
                [item.planId, req.user.userId]
            );
            
            if (check.length === 0) {
                throw new Error(`План ${item.planId} не принадлежит пользователю`);
            }
            
            await connection.execute(
                'UPDATE workout_plan SET display_order = ? WHERE wplan_id = ?',
                [item.order, item.planId]
            );
        }
        
        await connection.commit();
        res.json({ message: 'Порядок тренировок обновлён', success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка обновления порядка тренировок:', error);
        res.status(500).json({ message: 'Ошибка сервера: ' + error.message });
    } finally {
        connection.release();
    }
});



//const server = http.createServer(app);
//const wss = new WebSocket.Server({ server });
const fs = require('fs');
const https = require('https');
const httpServer = http.createServer(app);
httpServer.listen(80, '0.0.0.0', () => {
    console.log('✅ HTTP сервер: http://0.0.0.0:80');
});

const httpsOptions = {
    key: fs.readFileSync('/app/server.key'),
    cert: fs.readFileSync('/app/server.crt'),
};
const httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(443, '0.0.0.0', () => {
    console.log('✅ HTTPS сервер: https://0.0.0.0:443');
});
const wss = new WebSocket.Server({ server: httpsServer });
wss.on('connection', (ws) => {
    console.log('📱 Новое WebSocket подключение');
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📥 Получено сообщение:', message);
            
            if (message.type === 'start_workout') {
                console.log('🏃 ТРЕНИРОВКА СТАРТ');
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send('start_workout');
                    }
                });
                ws.send(JSON.stringify({ type: 'workout_started' }));
            }
            
            if (message.type === 'stop_workout') {
                console.log('⏹️ ТРЕНИРОВКА СТОП');
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send('stop_workout');
                    }
                });
                ws.send(JSON.stringify({ type: 'workout_stopped' }));
            }
            
            if (message.type === 'heartbeat') {
                const heartRate = message.heart_rate || 0;
                const stepsCount = message.steps || 0;
                
                console.log(`❤️ Пульс: ${heartRate}, 👣 Шаги: ${stepsCount}`);
                
                const userId = 1;
                
                await db.promise().execute(
                    'INSERT INTO health_data (user_id, heart_rate, steps, time, date) VALUES (?, ?, ?, NOW(), CURDATE())',
                    [userId, heartRate, stepsCount]
                );
                
                if (stepsCount > 0) {
                    try {
                        const [stepsGoals] = await db.promise().execute(
                            `SELECT goal_id, target_steps, progress 
                             FROM goals 
                             WHERE user_id = ? AND type = 'steps' AND end_date >= CURDATE()`,
                            [userId]
                        );
                        
                        for (const goal of stepsGoals) {
                            const targetSteps = goal.target_steps;
                            let newProgress = 0;
                            
                            if (targetSteps && targetSteps > 0) {
                                newProgress = Math.min(100, Math.max(0, Math.round((stepsCount / targetSteps) * 100)));
                            }
                            
                            if (newProgress !== goal.progress) {
                                await db.promise().execute(
                                    'UPDATE goals SET progress = ? WHERE goal_id = ?',
                                    [newProgress, goal.goal_id]
                                );
                                console.log(`📊 Цель "${goal.goal_id}" (шаги): прогресс ${goal.progress}% → ${newProgress}%`);
                            }
                        }
                    } catch (err) {
                        console.error('Ошибка обновления прогресса шагов:', err);
                    }
                }
                
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'heartbeat',
                            heart_rate: heartRate,
                            steps: stepsCount,
                            timestamp: message.timestamp
                        }));
                    }
                });
            }
        } catch (e) {
            console.error('WebSocket ошибка:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket клиент отключился');
    });
});

//server.listen(PORT, '0.0.0.0', () => {
//    console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
//    console.log(`✅ WebSocket на ws://0.0.0.0:${PORT}`);
//});
