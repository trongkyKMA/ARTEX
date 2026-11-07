package db

import (
	"regexp"
	"testing"
)

// TestBuiltinShutdownRulesV7 checks the narrowed built-in shutdown/reboot rule and
// the destructive rule without its bare shutdown|reboot branch.
func TestBuiltinShutdownRulesV7(t *testing.T) {
	shutdown := regexp.MustCompile(shutdownRuleV7)
	destructive := regexp.MustCompile(destructiveRuleV7)
	deny := func(cmd string) bool {
		in := toolInput(cmd)
		return shutdown.Match(in) || destructive.Match(in)
	}
	cases := []struct {
		deny bool
		cmd  string
	}{
		// real shutdown / reboot of the host
		{true, `shutdown -h now`},
		{true, `sudo reboot`},
		{true, `echo bye; poweroff`},
		{true, "cd /tmp\nhalt"},
		{true, `init 0`},
		{true, `/sbin/shutdown -r +1`},
		{true, `systemctl reboot`},
		{true, `python3 -c "import os; os.system('reboot')"`},
		{true, `python3 -c "import subprocess; subprocess.run(['shutdown','-h','now'])"`},
		// stopping the target application via its shutdown endpoint (POST)
		{true, `curl -X POST "https://t/actuator/shutdown"`},
		{true, `curl -s -XPOST https://t/actuator/shutdown`},
		{true, `curl https://t/actuator/shutdown -H 'Content-Type: application/json' -d '{}'`},
		// still covered by the destructive rule
		{true, `rm -rf /`},
		{true, `mkfs.ext4 /dev/sdb1`},
		// read-only uses of the word: must be allowed
		{false, "for w in env gateway routes shutdown jolokia prometheus; do\n  code=$(curl -sk -o /dev/null -w '%{http_code}' \"$T/actuator/$w\")\n  body=$(head -c 120 out | tr -d '\\n')\ndone"},
		{false, `curl -s https://t/actuator/shutdown`},
		{false, `grep -i shutdown /var/log/app.log`},
		{false, `echo "registering graceful shutdown hook"`},
		{false, `cat /etc/passwd`},
		{false, `rm -rf /tmp/scan-out`},
	}
	for _, c := range cases {
		if got := deny(c.cmd); got != c.deny {
			t.Errorf("deny=%v expected for %q, got %v", c.deny, c.cmd, got)
		}
	}
}
