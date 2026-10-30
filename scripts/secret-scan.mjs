import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = (process.env.TRACKED_FILES ? readFileSync(process.env.TRACKED_FILES,'utf8') : execFileSync('git', ['ls-files','-z'], { encoding:'utf8' })).split('\0').filter(Boolean);
const forbiddenPath = /(?:^|\/)(?:\.env|[^/]+\.(?:db|sqlite|sqlite3|pem|key)|[^/]*admin[^/]*\.secret)$/i;
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{50,}/, /AKIA[0-9A-Z]{16}/];
const failures = [];
for(const file of files) {
  if(forbiddenPath.test(file)) failures.push(file + ': forbidden sensitive file type');
  if(file.endsWith('.png')) continue;
  const content = readFileSync(file,'utf8');
  if(patterns.some(p=>p.test(content))) failures.push(file + ': possible credential');
}
if(failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`PASS: ${files.length} tracked paths checked for common credentials and sensitive files`);
