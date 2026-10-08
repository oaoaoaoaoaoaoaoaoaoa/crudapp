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
          docker stack deploy -c docker-compose_canary.yaml ${CANARY_APP_NAME} --with-registry-auth
          sleep 40
          docker service ls --filter name=${CANARY_APP_NAME}
        '''
      }
    }

    stage('Canary Testing') {
      steps {
        sh '''
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
        '''
      }
    }

    stage('Gradual Traffic Shift') {
      steps {
        sh '''
          if docker service ls --filter name=${APP_NAME}_web | grep -q ${APP_NAME}_web; then
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
            docker stack deploy -c docker-compose.yaml ${APP_NAME} --with-registry-auth
            sleep 60
          fi
        '''
      }
    }

    stage('Final Verification') {
      steps {
        sh '''
          for i in $(seq 1 5); do
            if curl -f --max-time 10 http://${MANAGER_IP}/ > /dev/null 2>&1; then
              echo "Final test $i passed"
            else
              echo "Final test $i failed"
              exit 1
            fi
            sleep 5
          done
        '''
      }
    }
  }

  post {
    success {
      sh 'docker logout'
    }
    failure {
      sh '''
        docker stack rm ${CANARY_APP_NAME} || true
      '''
      sh 'docker logout'
    }
    always {
      sh 'docker image prune -f || true'
    }
  }
}