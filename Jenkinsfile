pipeline {
  agent { label 'docker-agent' }

  environment {
    APP_NAME            = 'app'
    CANARY_APP_NAME     = 'app-canary'
    DOCKER_HUB_USER     = 'oaoaoaoaoa'
    GIT_REPO            = 'https://github.com/oaoaoaoaoaoaoaoaoaoa/crudapp.git'
    BACKEND_IMAGE_NAME  = 'front'
    DATABASE_IMAGE_NAME = 'mysql'
    MANAGER_IP          = '192.168.0.1'
    MYSQL_ROOT_PASSWORD = '1'
    MYSQL_DATABASE      = 'db'
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
          echo "=== Развёртывание Canary ==="
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
            HTTP_CODE=$(curl -s -o /tmp/canary_$i.html -w "%{http_code}" --max-time 15 http://${MANAGER_IP}:8081/)
            if [ "$HTTP_CODE" = "200" ]; then
              SUCCESS=$((SUCCESS + 1))
              echo "Test $i passed (HTTP $HTTP_CODE)"
            else
              echo "Test $i failed (HTTP $HTTP_CODE)"
            fi
            sleep 4
          done
          echo "Successful tests: $SUCCESS/$TESTS"
          [ "$SUCCESS" -ge 8 ] || exit 1
          echo "Canary прошёл тестирование!"
        '''
      }
    }

    stage('Database Validation') {
      steps {
        sh '''
          echo "=== Проверка наличия таблицы goals в Canary БД (через TCP) ==="

          DB_HOST="${MANAGER_IP}"
          DB_PORT="3307"
          DB_USER="root"
          DB_PASS="${MYSQL_ROOT_PASSWORD}"
          DB_NAME="${MYSQL_DATABASE}"

          # --- Ожидание готовности MySQL ---
          echo "Ожидание готовности MySQL на ${DB_HOST}:${DB_PORT}..."
          READY=0
          for i in $(seq 1 60); do
            if echo 'SELECT 1;' | mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASS}" --ssl=0 > /dev/null 2>&1; then
              echo "MySQL готов (попытка $i)"
              READY=1
              break
            fi
            echo "  Попытка $i/60..."
            sleep 5
          done

          if [ "$READY" -ne 1 ]; then
            echo "ERROR: MySQL не отвечает за 5 минут"
            exit 1
          fi

          # --- Проверка наличия таблицы goals ---
          echo "=== Проверка таблицы goals в БД ${DB_NAME} ==="

          TABLES=$(echo "SHOW TABLES LIKE 'goals';" | mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASS}" --ssl=0 -N -B "${DB_NAME}" 2>/dev/null)

          echo "Result: [$TABLES]"

          if [ "$TABLES" = "goals" ]; then
            echo "Table goals exists - OK"
          else
            echo "Table goals NOT found - FAIL"
            exit 1
          fi

          echo "=== Проверка БД пройдена ==="
        '''
      }
    }

    stage('Gradual Traffic Shift') {
      steps {
        sh '''
          echo "=== Постепенное переключение трафика на новую версию ==="

          if docker service ls --filter name=${APP_NAME}_web | grep -q ${APP_NAME}_web; then
            echo "Основной сервис существует — начинаем rolling update"

            docker service update \
              --image ${DOCKER_HUB_USER}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER} \
              --update-parallelism 1 \
              --update-delay 20s \
              --detach=true \
              ${APP_NAME}_web

            sleep 40
            docker service ps ${APP_NAME}_web --no-trunc | head -20

            MONITOR_SUCCESS=0
            MONITOR_TESTS=10
            for j in $(seq 1 $MONITOR_TESTS); do
              HTTP_CODE=$(curl -s -o /tmp/monitor_$j.html -w "%{http_code}" --max-time 15 http://${MANAGER_IP}/)
              if [ "$HTTP_CODE" = "200" ]; then
                MONITOR_SUCCESS=$((MONITOR_SUCCESS + 1))
                echo "Check $j passed (HTTP 200)"
              else
                echo "Check $j failed (HTTP $HTTP_CODE)"
              fi
              sleep 5
            done
            echo "Successful checks: $MONITOR_SUCCESS/$MONITOR_TESTS"
            [ "$MONITOR_SUCCESS" -ge 9 ] || exit 1

            sleep 60

            docker service update \
              --image ${DOCKER_HUB_USER}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER} \
              --update-parallelism 1 \
              --update-delay 30s \
              ${APP_NAME}_web

            sleep 90

            docker service ps ${APP_NAME}_web | head -20

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
            if curl -f --max-time 10 http://${MANAGER_IP}/ > /dev/null 2>&1; then
              echo "Final test $i passed"
            else
              echo "Final test $i failed"
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
      echo "Canary-деплой успешно завершён!"
      sh 'docker logout'
    }
    failure {
      echo "Ошибка в пайплайне — canary удалён, продакшен остался прежним"
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