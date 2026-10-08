pipeline {
  agent { label 'docker-agent' }
  environment {
    APP_NAME = 'app'
    CANARY_APP_NAME = 'app-canary'
    DOCKER_HUB_USER = 'oaoaoaoaoa'
    GIT_REPO = 'https://github.com/oaoaoaoaoaoaoaoaoaoa/crudapp.git'
    BACKEND_IMAGE_NAME = 'front'
    DATABASE_IMAGE_NAME = 'mysql'
    MANAGER_IP = '192.168.0.1'
  }

  stages {
    stage('Checkout') {
      steps {
        git url: "${GIT_REPO}", branch: 'main'
      }
    }

    stage('Build Docker Images') {
      steps {
        sh "docker build -f node.Dockerfile . -t ${DOCKER_HUB_USER}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER}"
        sh "docker build -f mysql.Dockerfile . -t ${DOCKER_HUB_USER}/${DATABASE_IMAGE_NAME}:${BUILD_NUMBER}"
      }
    }

    stage('Push to Docker Hub') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
            docker push ${DOCKER_HUB_USER}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER}
            docker push ${DOCKER_HUB_USER}/${DATABASE_IMAGE_NAME}:${BUILD_NUMBER}
          '''
        }
      }
    }

    stage('Deploy Canary') {
      steps {
        sh '''
          echo "=== Развёртывание Canary (1 реплика) ==="
          docker stack deploy -c docker-compose_canary.yaml ${CANARY_APP_NAME} --with-registry-auth
          sleep 40
          docker service ls --filter name=${CANARY_APP_NAME}
        '''
      }
    }

    stage('Canary Testing') {
      steps {
        sh '''
          echo "=== Тестирование Canary-версии (порт 8081) ==="
          SUCCESS=0
          TESTS=10
          for i in $(seq 1 $TESTS); do
            echo "Тест $i/$TESTS..."
            HTTP_CODE=$(curl -s -o /tmp/canary_$i.html -w "%{http_code}" --max-time 15 http://${MANAGER_IP}:8081/)
            if [ "$HTTP_CODE" = "200" ]; then
              SUCCESS=$((SUCCESS + 1))
              echo "✓ Тест $i пройден (HTTP $HTTP_CODE)"
            else
              echo "✗ Тест $i: HTTP $HTTP_CODE"
            fi
            sleep 4
          done
          echo "Успешных тестов: $SUCCESS/$TESTS"
          [ "$SUCCESS" -ge 8 ] || exit 1
          echo "Canary прошёл тестирование!"
        '''
      }
    }
    stage('Canary Testing') {
      steps {
        sh '''
          echo "=== Тестирование Canary-версии (порт 8081) ==="
          SUCCESS=0
          TESTS=10
          for i in $(seq 1 $TESTS); do
            echo "Тест $i/$TESTS..."
            if curl -f -s --max-time 15 http://${MANAGER_IP}:8081/ > /tmp/canary_$i.html; then
              if ! grep -iq "error\\|fatal\\|exception\\|failed" /tmp/canary_$i.html; then
                SUCCESS=$((SUCCESS + 1))
                echo "✓ Тест $i пройден"
              else
                echo "✗ Тест $i: найдены ошибки в ответе"
              fi
            else
              echo "✗ Тест $i: нет ответа"
            fi
            sleep 4
          done
          echo "Успешных тестов: $SUCCESS/$TESTS"
          [ "$SUCCESS" -ge 8 ] || exit 1
          echo "Canary прошёл тестирование!"
        '''
      }
    }

    stage('Gradual Traffic Shift') {
      steps {
        sh '''
          echo "=== Постепенное переключение трафика на новую версию ==="
          # Проверяем, существует ли основной сервис
          if docker service ls --filter name=${APP_NAME}_web | grep -q ${APP_NAME}_web; then
            echo "Основной сервис существует — начинаем rolling update по одной реплике"

            # Шаг 1: Обновляем первую реплику продакшена (33% трафика на v${BUILD_NUMBER})
            echo "Шаг 1: Обновляем 1-ю реплику продакшена"
            docker service update \
              --image ${DOCKER_HUB_USER}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER} \
              --update-parallelism 1 \
              --update-delay 20s \
              --detach=true \
              ${APP_NAME}_web

            echo "Ожидание стабилизации после первой реплики..."
            sleep 40
            docker service ps ${APP_NAME}_web --no-trunc | head -20

            # Мониторинг после первого шага
            echo "=== Мониторинг после первой реплики ==="
            MONITOR_SUCCESS=0
            MONITOR_TESTS=10
            for j in $(seq 1 $MONITOR_TESTS); do
              if curl -f -s --max-time 15 http://${MANAGER_IP}:8080/ > /tmp/monitor_$j.html; then
                if ! grep -iq "error\\|fatal" /tmp/monitor_$j.html; then
                  MONITOR_SUCCESS=$((MONITOR_SUCCESS + 1))
                fi
              fi
              sleep 5
            done
            echo "Успешных проверок после первой реплики: $MONITOR_SUCCESS/$MONITOR_TESTS"
            [ "$MONITOR_SUCCESS" -ge 9 ] || exit 1

            echo "Мониторинг после первой реплики прошёл!"
            sleep 60

            # Шаг 2: Обновляем оставшиеся реплики
            echo "Шаг 2: Обновляем оставшиеся реплики"
            docker service update \
              --image ${DOCKER_HUB_USER}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER} \
              --update-parallelism 1 \
              --update-delay 30s \
              ${APP_NAME}_web

            echo "Ожидание завершения полного обновления..."
            sleep 90

            # Проверяем, что все реплики обновлены
            echo "Статус после обновления:"
            docker service ps ${APP_NAME}_web | head -20

            # Удаляем canary — он больше не нужен
            echo "Удаление canary stack..."
            docker stack rm ${CANARY_APP_NAME} || true
            sleep 20
          else
            echo "Первый деплой — разворачиваем продакшен"
            docker stack deploy -c docker-compose.yaml ${APP_NAME} --with-registry-auth
            sleep 60
          fi

          echo "Постепенное переключение завершено"
        '''
      }
    }

    stage('Final Verification') {
      steps {
        sh '''
          echo "=== Финальная проверка ==="
          for i in $(seq 1 5); do
            echo "Финальный тест $i/5..."
            if curl -f --max-time 10 http://${MANAGER_IP}:8080/ > /dev/null 2>&1; then
              echo "✓ Тест $i пройден"
            else
              echo "✗ Тест $i не пройден"
              exit 1
            fi
            sleep 5
          done
          echo "Все финальные тесты пройдены!"
        '''
      }
    }
  }

  post {
    success {
      echo "✓ Canary-деплой успешно завершён!"
      sh 'docker logout'
    }
    failure {
      echo "✗ Ошибка в пайплайне — canary удалён, продакшен остался прежним"
      sh '''
        docker stack rm ${CANARY_APP_NAME} || true
        echo "Canary удалён, продакшен не тронут"
      '''
      sh 'docker logout'
    }
    always {
      sh 'docker image prune -f || true'
    }
  }
}
