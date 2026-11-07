package db

import "fmt"

// v7: stop the built-in shutdown/reboot rules from matching the bare word.
//
// "[Built-in] Shutdown / reboot" (\b(?:shutdown|reboot|…)\b) and the
// "shutdown|reboot" branch of "[Built-in] Destructive system commands" matched the
// word anywhere in the input. In a live run that denied a read-only endpoint
// discovery loop whose word list contained "shutdown" (GET /actuator/<word>).
//
// shutdownRuleV7 only matches:
//   - the command at command position (start of input / line, after ; & | ( ` sudo
//     exec, optionally /sbin/…): shutdown, reboot, halt, poweroff, init 0|6,
//     telinit 0|6; systemctl poweroff|reboot|halt|kexec;
//   - the same commands launched from code: os.system("reboot"), subprocess.run(["shutdown", …]) …;
//   - an HTTP request that POSTs to a /shutdown path (e.g. Spring Boot
//     /actuator/shutdown), which really stops the target application. A GET of
//     that path is read-only and allowed.
// The destructive rule drops its shutdown|reboot branch (covered above). Each rule
// is updated only when it still has its previous seeded pattern.

const (
	seededShutdownPattern = `\b(?:shutdown|reboot|halt|poweroff|init\s+[06])\b`
	shutdownRuleV7        = `(?i)(?:^|"command"\s*:\s*"|"text"\s*:\s*"|[;&|(` + "`" + `]|\\n|\bsudo\s+|\bexec\s+)\s*(?:/s?bin/)?(?:shutdown|reboot|halt|poweroff|init\s+[06]|telinit\s+[06])\b` +
		`|\bsystemctl\s+(?:poweroff|reboot|halt|kexec)\b` +
		`|(?:system|popen|run|call|check_call|check_output|exec|spawn)\s*\(\s*\[?\s*\\?["'](?:sudo\s+)?(?:shutdown|reboot|halt|poweroff)\b` +
		`|(?:-X\s*POST|--request[ =]POST|\s-d\s|--data(?:-\w+)?\s)(?:[^\\;&|]|\\"){0,300}?/shutdown\b` +
		`|/shutdown\b(?:[^\\;&|]|\\"){0,300}?(?:-X\s*POST|--request[ =]POST|\s-d\s|--data(?:-\w+)?\s)`
	destructiveRuleV7 = `(?i)\b(rm\s+-rf\s+/(?:\s|\*|\\?["']|$)|mkfs|dd\s+if=|:\(\)\s*\{|>\s*/dev/sd)`
)

func (d *DB) seedBuiltinRulesV7() error {
	const flag = "intercept_builtin_rules_v7"
	if v, _, _ := d.GetSetting(flag); v == "done" {
		return nil
	}
	updates := []struct{ name, from, to string }{
		{"[Built-in] Shutdown / reboot", seededShutdownPattern, shutdownRuleV7},
		{"[Built-in] Destructive system commands", narrowedDestructivePattern, destructiveRuleV7},
	}
	for _, u := range updates {
		if _, err := d.Exec(`UPDATE intercept_rules SET pattern = $3 WHERE name = $1 AND pattern = $2`, u.name, u.from, u.to); err != nil {
			return fmt.Errorf("update %q: %w", u.name, err)
		}
	}
	return d.SetSetting(flag, "done")
}
