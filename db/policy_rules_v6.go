package db

import "fmt"

// v6: make three policy rules respect command-line boundaries in the JSON input.
//
// In the tool input a newline is the two characters backslash + n. That caused two
// problems seen in a live run:
//   - a match could run past the end of an rm command into the NEXT line
//     (rm -f $COOKIE_JAR, then curl ... -o /dev/null) and deny the agent's own
//     cleanup;
//   - a command at the start of a line is preceded by "n", so \b did not fire and
//     e.g. "cd /tmp\nrm -rf /etc/x" was NOT denied.
// The rm rule's gap now stops at a backslash, and the rm / find / SQL-password
// rules may also start right after an escaped newline. Updated only when a rule
// still has its previous seeded pattern (operator edits win).

// policyRulesV5Patterns are the exact previous seeds (generated from policy_rules.json).
var policyRulesV5Patterns = map[string]string{
	"[Policy] Delete system files/dirs (rm/rmdir/unlink/shred)": "(?i)\\b(?:rm|rmdir|unlink|shred|srm)\\b[^\\n;&|]{0,200}?(?:\\s|\\\\?[\"'=])(?:/(?:etc|bin|sbin|usr|boot|lib|lib32|lib64|opt|srv|root|home|proc|sys|mnt|media|snap|run|var/(?:www|lib|log|spool|mail|opt|backups|cache|db|local))(?:/|\\s|\\\\?[\"';&|*]|$)|/(?:var|app)(?:\\s|\\\\?[\"';&|*]|$)|/app/(?:artex|skills|start\\.sh)|/(?:\\s|\\\\?[\"';&|*]|$)|~(?:/|\\s|\\\\?[\"';&|]|$)|\\.\\./)",
	"[Policy] Delete system files/dirs (find -delete)":          "(?i)\\bfind\\s+\\\\?[\"']?(?:/(?:etc|bin|sbin|usr|boot|lib|lib64|opt|srv|root|home|var/(?:www|lib|log)|app)\\b|/(?:\\s|\\\\?[\"']))[^\\n;&|]{0,200}(?:-delete|-exec\\s+(?:rm|shred|unlink))",
	"[Policy] Change password - SQL":                            "(?i)\\bALTER\\s+(?:USER|LOGIN|ROLE)\\b[^;\\n]{0,200}\\b(?:PASSWORD|IDENTIFIED)\\b|\\bSET\\s+PASSWORD\\b|\\bsp_password\\b|\\bUPDATE\\s+[\\w.\\x60\"\\[\\]\\\\]*(?:user|account|member|admin|login)\\w*[\\x60\"\\]\\\\]*\\s+SET\\s+[^;\\n]{0,200}?(?:pass(?:word|wd)?|pwd|hash)\\w*[\\x60\"\\]\\\\]*\\s*=",
}

func (d *DB) seedPolicyInterceptRulesV6() error {
	const flag = "intercept_policy_rules_v6"
	if v, _, _ := d.GetSetting(flag); v == "done" {
		return nil
	}
	rules, err := PolicyRules()
	if err != nil {
		return err
	}
	for _, r := range rules {
		old, ok := policyRulesV5Patterns[r.Name]
		if !ok {
			continue
		}
		if _, err := d.Exec(`UPDATE intercept_rules SET pattern = $3 WHERE name = $1 AND pattern = $2`, r.Name, old, r.Pattern); err != nil {
			return fmt.Errorf("update %q: %w", r.Name, err)
		}
	}
	return d.SetSetting(flag, "done")
}
