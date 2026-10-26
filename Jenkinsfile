pipeline {
  agent { label 'docker' }
  options { timestamps(); disableConcurrentBuilds() }
  environment { COMPOSE_PROJECT_NAME = 'pawroster'; IMAGE_TAG = "${BUILD_NUMBER}" }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Verify') {
      steps {
        sh 'mkdir -p evidence/runtime'
        sh 'docker run --rm -v "$WORKSPACE:/app" -w /app node:24.14.0-alpine node --check src/server.js'
        sh 'docker run --rm -v "$WORKSPACE:/app" -w /app node:24.14.0-alpine node --check public/app.js'
        sh 'docker run --rm -v "$WORKSPACE:/app" -w /app node:24.14.0-alpine node --test --test-reporter=junit --test-reporter-destination=evidence/runtime/tests.xml'
        sh 'docker compose config --quiet'
      }
    }
    stage('Build image') { steps { sh 'docker compose build --pull'; sh 'docker save pawroster:$IMAGE_TAG | gzip > evidence/runtime/pawroster-image.tar.gz' } }
    stage('Deploy') {
      when { branch 'main' }
      steps { sh 'docker compose up -d --no-build --wait --wait-timeout 90' }
    }
    stage('Verify deployed service') {
      when { branch 'main' }
      steps {
        sh '''docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))" > evidence/runtime/health.txt'''
        sh 'docker compose ps > evidence/runtime/compose-status.txt'
      }
    }
  }
  post {
    always {
      junit allowEmptyResults: true, testResults: 'evidence/runtime/tests.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'evidence/runtime/*'
    }
  }
}
