pipeline {
  agent { label 'docker' }
  options { disableConcurrentBuilds(); skipDefaultCheckout(true); timeout(time: 20, unit: 'MINUTES') }
  triggers { pollSCM('H/2 * * * *') }
  parameters { booleanParam(name: 'VERIFY_FAILURE_GATE', defaultValue: false, description: 'Inject a failing test into this disposable workspace to verify deployment is stopped.') }
  environment {
    COMPOSE_PROJECT_NAME = 'pawroster-ci'
    IMAGE_REPOSITORY = 'localhost:5000/pawroster'
    IMAGE_TAG = "${JOB_BASE_NAME}-${BUILD_NUMBER}"
    APP_PORT = '3180'
  }
  stages {
    stage('Checkout') {
      steps {
        deleteDir()
        script {
          def source = checkout scm
          env.GIT_COMMIT = source.GIT_COMMIT
          env.SOURCE_BRANCH = source.GIT_BRANCH.replaceFirst('^refs/remotes/', '').replaceFirst('^origin/', '')
        }
        sh 'mkdir -p evidence/runtime; git rev-parse HEAD > evidence/runtime/commit.txt; git ls-files -z > evidence/runtime/tracked-files.nul; printf "%s\\n" "$SOURCE_BRANCH" > evidence/runtime/source-branch.txt'
      }
    }
    stage('Verify') {
      steps {
        sh 'docker run --rm -e TRACKED_FILES=evidence/runtime/tracked-files.nul -v "$WORKSPACE:/app" -w /app node:24.14.0-alpine node scripts/secret-scan.mjs'
        script {
          if (params.VERIFY_FAILURE_GATE) {
            writeFile file: 'test/ci-failure-probe.test.js', text: "import { test } from 'node:test'; test('intentional CI failure gate probe', () => { throw new Error('Expected verification failure'); });\n"
          }
        }
        sh 'docker run --rm -v "$WORKSPACE:/app" -w /app node:24.14.0-alpine npm run check'
        sh 'docker run --rm -v "$WORKSPACE:/app" -w /app node:24.14.0-alpine node --test --test-reporter=junit --test-reporter-destination=evidence/runtime/tests.xml'
        sh 'docker compose config --quiet'
      }
    }
    stage('Build image') { steps { sh 'VCS_REF="$GIT_COMMIT" docker compose build --pull' } }
    stage('Publish image') { steps { sh 'docker push "$IMAGE_REPOSITORY:$IMAGE_TAG"; docker image inspect "$IMAGE_REPOSITORY:$IMAGE_TAG" --format "{{json .RepoDigests}}" > evidence/runtime/image-digest.txt' } }
    stage('Deploy') {
      when { expression { env.SOURCE_BRANCH == 'main' } }
      steps { sh 'docker compose up -d --no-build --wait --wait-timeout 90' }
    }
    stage('Verify deployed service') {
      when { expression { env.SOURCE_BRANCH == 'main' } }
      steps {
        sh '''docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{const h=await r.json();if(!r.ok || h.revision!==process.argv[1])process.exit(1);console.log(JSON.stringify(h))}).catch(()=>process.exit(1))" "$GIT_COMMIT" > evidence/runtime/health.txt'''
        sh 'docker compose exec -T app node scripts/smoke.mjs seed > evidence/runtime/deployed-smoke.txt; docker compose exec -T app node scripts/smoke.mjs verify >> evidence/runtime/deployed-smoke.txt'
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
