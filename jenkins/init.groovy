import jenkins.model.Jenkins
import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.plugins.git.GitSCM
import hudson.plugins.git.BranchSpec
import hudson.plugins.git.UserRemoteConfig
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition
def j = Jenkins.get()
def secretFile = new File('/run/secrets/pawroster_admin')
if (!secretFile.exists()) throw new IllegalStateException('Mount a generated Jenkins admin password file')
def realm = new HudsonPrivateSecurityRealm(false)
realm.createAccount('pawroster-admin', secretFile.text.trim())
j.setSecurityRealm(realm)
def policy = new FullControlOnceLoggedInAuthorizationStrategy()
policy.setAllowAnonymousRead(false)
j.setAuthorizationStrategy(policy)
j.setLabelString('docker')
j.setNumExecutors(1)
['main', 'course-readiness'].each { branch ->
  def name = branch == 'main' ? 'pawroster-main' : 'pawroster-review'
  def job = j.getItem(name) ?: j.createProject(WorkflowJob, name)
  def scm = new GitSCM([new UserRemoteConfig('https://github.com/67070282/PawRoster.git', null, null, null)], [new BranchSpec('*/' + branch)], false, [], null, null, [])
  job.definition = new CpsScmFlowDefinition(scm, 'Jenkinsfile')
  job.save()
}
j.save()
