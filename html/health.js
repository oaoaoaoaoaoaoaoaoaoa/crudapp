let healthChart = null;
let currentMetric = 'heart_rate';
let allHealthData = [];


async function loadAllHealthData() {
    try {
        const data = await getHealthHistory();
        allHealthData = data.sort((a, b) => {
            const dateA = new Date(a.time || a.recorded_time);
            const dateB = new Date(b.time || b.recorded_time);
            return dateA - dateB;
        });
        console.log('Загружено данных:', allHealthData.length);
        return allHealthData;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        return [];
    }
}


window.addRealtimeData = function(heartRate, steps) {
    const now = new Date();
    const newRecord = {
        heart_rate: heartRate,
        steps: steps,
        time: now.toISOString(),
        recorded_time: now.toISOString()
    };
    
    allHealthData.push(newRecord);
    

    if (allHealthData.length > 200) {
        allHealthData = allHealthData.slice(-200);
    }
    
    updateChart();
};


function prepareChartData(data, metric) {
    if (!data.length) return { labels: [], values: [] };
    

    const lastData = data.slice(-100);
    
    const allValues = lastData.map(item => {
        if (metric === 'heart_rate') return item.heart_rate;
        if (metric === 'steps') return item.steps;
        return null;
    });
    
    const allTimes = lastData.map(item => {
        const date = new Date(item.time || item.recorded_time);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    

    const labels = [];
    const step = Math.max(1, Math.floor(lastData.length / 12));
    
    for (let i = 0; i < lastData.length; i++) {
        if (i % step === 0 || i === lastData.length - 1) {
            labels.push(allTimes[i]);
        } else {
            labels.push('');
        }
    }
    
    return { labels, values: allValues };
}

 
async function updateChart() {
    if (allHealthData.length === 0) {
        await loadAllHealthData();
    }
    
    const { labels, values } = prepareChartData(allHealthData, currentMetric);
    
    const metricNames = {
        'heart_rate': 'Пульс (BPM)',
        'steps': 'Шаги'
    };
    
    const validValues = values.filter(v => v !== null && v !== undefined);
    const avg = validValues.length > 0 ? Math.round(validValues.reduce((a,b) => a + b, 0) / validValues.length) : 0;
    const maxVal = validValues.length > 0 ? Math.max(...validValues) : 0;
    const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
    
    const infoDiv = document.getElementById('chartInfo');
    if (infoDiv) {
        infoDiv.innerHTML = `📊 ${allHealthData.length} записей | Средний: ${avg} | ⬆ Макс: ${maxVal} | ⬇ Мин: ${minVal} ${metricNames[currentMetric]}`;
    }
    
    const ctx = document.getElementById('healthChart')?.getContext('2d');
    if (!ctx) return;
    
    if (healthChart) {
        healthChart.data.labels = labels;
        healthChart.data.datasets[0].data = values;
        healthChart.update();
    } else {
        healthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: metricNames[currentMetric],
                    data: values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: metricNames[currentMetric] }
                    },
                    x: {
                        title: { display: true, text: 'Время' },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                const value = context.raw;
                                const time = allHealthData.slice(-100)[index]?.time;
                                const date = time ? new Date(time).toLocaleTimeString() : '';
                                return `${metricNames[currentMetric]}: ${value} в ${date}`;
                            }
                        }
                    }
                }
            }
        });
    }
}



async function updateAllStepsGoalsProgress(currentSteps) {
    if (!currentSteps || currentSteps === 0) return;
    
    console.log(`👣 Автообновление шагов из Bridge: ${currentSteps} шагов`);
    
    try {
        const goals = await getGoals();
        
        for (const goal of goals) {
            if (goal.type === 'steps') {

                localStorage.setItem(`steps_goal_${goal.id}`, currentSteps);
                

                if (typeof updateStepsFromBridge === 'function') {
                    updateStepsFromBridge(goal.id, currentSteps);
                }
                

                const response = await fetch(`${API_BASE_URL}/goals/${goal.id}/update-progress`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + sessionStorage.getItem('token')
                    },
                    body: JSON.stringify({ current_steps: currentSteps })
                });
                
                const data = await response.json();
                console.log(`   Прогресс: ${data.progress}%`);
                

                if (typeof updateProgressUI === 'function') {
                    updateProgressUI(goal.id, data.progress);
                }
            }
        }
        
        console.log('✅ Автообновление шагов завершено');
        
    } catch (error) {
        console.error('❌ Ошибка автообновления шагов:', error);
    }
}

window.updateAllStepsGoalsProgress = updateAllStepsGoalsProgress;

 
const metricSelect = document.getElementById('metricSelect');
if (metricSelect) {
    metricSelect.onchange = (e) => {
        currentMetric = e.target.value;
        updateChart();
    };
}

 
const refreshBtn = document.getElementById('refreshChartBtn');
if (refreshBtn) {
    refreshBtn.onclick = async () => {
        await loadAllHealthData();
        updateChart();
    };
}

 
(async function init() {
    await loadAllHealthData();
    await updateChart();
})();
