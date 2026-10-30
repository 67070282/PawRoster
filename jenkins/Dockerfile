FROM docker:29-cli AS dockercli
FROM jenkins/jenkins:lts-jdk21
USER root
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
RUN jenkins-plugin-cli --plugins workflow-aggregator git junit
COPY init.groovy /usr/share/jenkins/ref/init.groovy.d/pawroster.groovy
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
