package db

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

// Operator policy intercept rules (v4).
//
// The deployment forbids exactly three agent behaviours:
//  1. brute-forcing user credentials or OTP codes;
//  2. changing / resetting system or user passwords;
//  3. deleting system files or directories (files the agent itself created —
//     relative paths in the task workdir, /tmp, /var/tmp, /dev/shm — may be removed).
//
// The rules live in policy_rules.json (tested against 57 allow/deny cases with Go's
// RE2 engine; see docs/intercept-policy-rules.md). They are ordinary DB rules, so the
// operator can toggle, edit or delete them on System -> Intercept rules.
//
// Two v1 delete rules blocked the agent from cleaning up its own files (every
// `rm -rf`, and `rm` of ANY absolute path incl. /tmp) and the v2 combined rule
// matched `rm -rf /<anything>`. They are disabled / narrowed here ONLY when still at
// their seeded pattern, so an operator's own edits are never overwritten.

//go:embed policy_rules.json
var policyRulesJSON []byte

type policyRule struct {
	Name        string `json:"name"`
	Enabled     bool   `json:"enabled"`
	Priority    int    `json:"priority"`
	MatchTarget string `json:"match_target"`
	MatchType   string `json:"match_type"`
	Pattern     string `json:"pattern"`
	Action      string `json:"action"`
}

// PolicyRules returns the embedded operator-policy rules (exported for tests).
func PolicyRules() ([]policyRule, error) {
	var rules []policyRule
	if err := json.Unmarshal(policyRulesJSON, &rules); err != nil {
		return nil, fmt.Errorf("parse policy_rules.json: %w", err)
	}
	return rules, nil
}

// Seeded patterns of the default rules adjusted by v4 (must equal the v1/v2 seeds).
const (
	seededRmRecursivePattern     = `(?i)\brm\b.{0,80}(?:-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|--recursive|--no-preserve-root)`
	seededRmSystemDirsPattern    = `\brm\b[^"'\n]{0,60}["'\s](/|/etc|/bin|/usr|/boot|/var|/lib|/sys|/proc|/dev|/sbin|/root)`
	seededDestructivePattern     = `(?i)\b(rm\s+-rf\s+/|mkfs|dd\s+if=|:\(\)\s*\{|shutdown|reboot|>\s*/dev/sd)`
	narrowedDestructivePattern   = `(?i)\b(rm\s+-rf\s+/(?:\s|\*|\\?["']|$)|mkfs|dd\s+if=|:\(\)\s*\{|shutdown|reboot|>\s*/dev/sd)`
	policyRulesSettingV4         = "intercept_policy_rules_v4"
	policyRulesDefaultMessageTag = "" // empty message -> interceptor's default deny text
)

func (d *DB) seedPolicyInterceptRulesV4() error {
	if v, _, _ := d.GetSetting(policyRulesSettingV4); v == "done" {
		return nil
	}
	rules, err := PolicyRules()
	if err != nil {
		return err
	}
	for _, r := range rules {
		if _, err := d.Exec(`
INSERT INTO intercept_rules(name, enabled, priority, match_target, match_type, pattern, action, message, timeout_enabled, timeout_seconds, timeout_action)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, false, 60, 'deny'
WHERE NOT EXISTS (SELECT 1 FROM intercept_rules WHERE name = $1)`,
			r.Name, r.Enabled, r.Priority, r.MatchTarget, r.MatchType, r.Pattern, r.Action, policyRulesDefaultMessageTag,
		); err != nil {
			return fmt.Errorf("policy rule %q: %w", r.Name, err)
		}
	}
	if _, err := d.Exec(`UPDATE intercept_rules SET enabled = false WHERE name = $1 AND pattern = $2`,
		"[Built-in] Recursive force delete rm -rf", seededRmRecursivePattern); err != nil {
		return fmt.Errorf("disable rm -rf rule: %w", err)
	}
	if _, err := d.Exec(`UPDATE intercept_rules SET enabled = false WHERE name = $1 AND pattern = $2`,
		"[Built-in] Delete critical system directories", seededRmSystemDirsPattern); err != nil {
		return fmt.Errorf("disable system-dirs rule: %w", err)
	}
	if _, err := d.Exec(`UPDATE intercept_rules SET pattern = $3 WHERE name = $1 AND pattern = $2`,
		"[Built-in] Destructive system commands", seededDestructivePattern, narrowedDestructivePattern); err != nil {
		return fmt.Errorf("narrow destructive rule: %w", err)
	}
	return d.SetSetting(policyRulesSettingV4, "done")
}
