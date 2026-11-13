# Current files and Jenkins bootstrap verification
+
+Checked on 13 November 2026. Application remains 2.2.0/schema 4; no API or data migration changes in this update.
+
+- Architecture/README technology descriptions and API catalog checked against current source. Removed the obsolete statement that member removal leaves the invite unchanged.
+- Operations/course verification now select a separate Compose project, port and image tag; active documentation links and historical-evidence index checked.
+- Jenkins image built successfully from the updated bootstrap source. Calling start-course-jenkins.sh with existing running services succeeded. Shell syntax check passed.
+- Started a fresh isolated Jenkins controller: main points to */main, review points to */feature/household-security, and anonymous API access is denied. No Docker socket or app volume was mounted into this test controller, and no builds were triggered there. The test container was stopped and removed.
+- On the synthetic CI app, SQLite online backup into /app/data/care-backup.db followed by Docker copy from the named volume and integrity_check passed. This replaces the tmpfs-copy example in OPERATIONS.md.
+- checks.json records branch/auth checks and LF-normalized SHA-256 of the two tested bootstrap source files. Existing API/Course/Jenkins pipeline results remain under their original source commits in household-security/submission-2.2; no old logs were relabeled.
+