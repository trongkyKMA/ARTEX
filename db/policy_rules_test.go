package db

import (
	"bytes"
	"encoding/json"
	"regexp"
	"testing"
)

// toolInput encodes a Bash tool input the way the interceptor's canonical form
// does (intercept.canonicalInput): JSON without HTML escaping, so "&" stays "&".
func toolInput(cmd string) []byte {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(map[string]string{"command": cmd})
	return bytes.TrimRight(buf.Bytes(), "\n")
}

// TestPolicyRulesBehaviour checks the embedded operator-policy rules (policy_rules.json)
// against the allow/deny cases they were designed for, evaluated like the
// interceptor does: regex over the JSON-encoded tool input. A failure means an edit
// to the rules either stopped blocking a forbidden action or started blocking a
// legitimate testing action.
func TestPolicyRulesBehaviour(t *testing.T) {
	rules, err := PolicyRules()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 11 {
		t.Fatalf("expected 11 policy rules, got %d", len(rules))
	}
	var res []*regexp.Regexp
	for _, r := range rules {
		if r.MatchTarget != "tool_input" || r.MatchType != "regex" || r.Action != "deny" || !r.Enabled {
			t.Fatalf("rule %q: unexpected config %+v", r.Name, r)
		}
		re, err := regexp.Compile(r.Pattern)
		if err != nil {
			t.Fatalf("rule %q does not compile: %v", r.Name, err)
		}
		res = append(res, re)
	}
	narrowed := regexp.MustCompile(narrowedDestructivePattern)

	cases := []struct {
		deny bool
		cmd  string
	}{
		// 1. brute force
		{true, `hydra -l admin -P users.lst ssh://10.0.0.5`},
		{true, `cd /opt && medusa -h 10.0.0.5 -U u.txt -P p.txt -M ssh`},
		{true, `nmap -p 22 --script ssh-brute 10.0.0.5`},
		{true, `msfconsole -q -x "use auxiliary/scanner/ssh/ssh_login; run"`},
		{true, `nxc smb 10.0.0.5 -u admin -p /usr/share/wordlists/rockyou.txt`},
		{true, `ffuf -u https://t/api/login -X POST -d '{"user":"admin","password":"FUZZ"}' -w top.txt`},
		{true, `ffuf -u https://t/api/otp/verify -X POST -d "otp=FUZZ" -w codes.txt`},
		{true, `for c in $(seq -w 0 999999); do curl -s -d "otp=$c" https://t/verify; done`},
		{true, "python3 - <<'EOF'\nimport requests\nfor i in range(1000000):\n    requests.post('https://t/2fa', data={'code': f'{i:06}'})\nEOF"},
		{true, `while read p; do curl -s -d "u=admin&p=$p" https://t/login; done < passwords.txt`},
		{false, `curl -s -X POST https://t/api/login -d '{"user":"admin","password":"admin"}'`},
		{false, `ffuf -u https://t/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt`},
		{false, `hashcat -m 0 hashes.txt /usr/share/wordlists/rockyou.txt`},
		{false, `nmap -sV -sC -p- 10.0.0.5`},
		{false, `curl -s https://t/api/otp/send -d '{"phone":"0900000000"}'`},
		{false, `echo a92fa1 | sha256sum; for h in a b c; do ping -c1 $h; done`},
		// Endpoint discovery: a path list that happens to contain /api/otp, looped with
		// curl (false positive seen in a live run with the v4 OTP rule).
		{false, "PATHS=(/api/bank /api/payment /api/customer /api/otp /api/upload)\nfor p in \"${PATHS[@]}\"; do curl -sk -m 10 \"$TARGET$p\"; done"},
		{false, "words = ['auth', 'customer', 'payment', 'otp']\nfor w in words:\n    for m in ('PUT', 'DELETE', 'OPTIONS'):\n        probe(base + '/api/' + w, m)"},
		{false, "for i in range(3):\n    r = requests.get(base + '/api/otp/config')"},
		{true, `for i in {0000..9999}; do curl -s -d "pin=$i&otp=$i" https://t/verify; done`},
		{true, "import itertools\nfor c in itertools.product('0123456789', repeat=6):\n    requests.post('https://t/mfa', data={'otp': ''.join(c)})"},
		{true, "for i in range(0, 1000000):\n    s.post(u, data={'verify_code': str(i).zfill(6)})"},
		// 2. password change
		{true, `passwd root`},
		{true, `echo 'admin:NewPass1' | chpasswd`},
		{true, `sudo usermod -p '$6$x' admin`},
		{true, `net user administrator P@ssw0rd1`},
		{true, `mysql -e "ALTER USER 'root'@'%' IDENTIFIED BY 'x'"`},
		{true, `psql -c "UPDATE users SET password_hash='x' WHERE id=1"`},
		{true, `curl -X POST https://t/api/user/change-password -d '{"oldPassword":"a","newPassword":"b"}'`},
		{true, `curl -X POST https://t/reset-password --data 'token=abc&password=Zz123'`},
		{false, `cat /etc/passwd`},
		{false, `grep -i passwd /var/www/html/config.php`},
		{false, `curl -s https://t/reset-password`},
		{false, `net user administrator /domain`},
		{false, `sqlmap -u "https://t/item?id=1" --batch --dbs`},
		{false, `mysql -e "SELECT user, password FROM mysql.user"`},
		// 3. deleting system files (agent's own files allowed)
		{true, `rm -rf /var/www/html`},
		{true, `rm /etc/hosts`},
		{true, `sudo rm -rf /`},
		{true, `rm -rf ~`},
		{true, `rm -rf ../../..`},
		{true, `rm -f /app/artex`},
		{true, `find /var/log -name '*.log' -delete`},
		{true, `python3 -c "import shutil; shutil.rmtree('/etc/nginx')"`},
		{true, `node -e "require('fs').rmSync('/home/app', {recursive:true})"`},
		{false, `rm -rf ./out tmp_scan`},
		{false, `rm -f /tmp/artex_payload.txt`},
		{false, `rm -rf /var/tmp/recon-123`},
		{false, `rm -f /dev/shm/x`},
		{false, `python3 -c "import os; os.remove('result.json')"`},
		{false, `curl -s https://t/download?file=../../etc/passwd`},
	}
	for _, c := range cases {
		in := toolInput(c.cmd)
		hit := ""
		for i, re := range res {
			if re.Match(in) {
				hit = rules[i].Name
				break
			}
		}
		if (hit != "") != c.deny {
			t.Errorf("deny=%v expected for %q, got hit=%q", c.deny, c.cmd, hit)
		}
		// The narrowed default destructive rule must not block the agent's own cleanup.
		if !c.deny && narrowed.Match(in) {
			t.Errorf("narrowed destructive rule blocks allowed command %q", c.cmd)
		}
	}
	for _, root := range []string{`rm -rf /`, `sudo rm -rf /*`, `rm -rf / --no-preserve-root`} {
		in := toolInput(root)
		if !narrowed.Match(in) {
			t.Errorf("narrowed destructive rule must still block %q", root)
		}
	}
}
