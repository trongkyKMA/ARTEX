package db

import "fmt"

// v5: narrow "[Policy] OTP brute-force loop".
//
// The v4 pattern paired an OTP keyword with ANY loop (for x in, while, xargs, …).
// Endpoint discovery scripts legitimately loop over a path list that contains
// "/api/otp" next to dozens of other paths, so plain reconnaissance was denied.
// OTP brute force is, by nature, enumeration of a numeric code space, so v5 only
// matches an OTP keyword together with a large numeric generator (seq 0 999999,
// range(1000000), {0000..9999}, itertools.product, %06d / {i:06} / zfill(6), crunch).
// Updated only when the rule still has the v4 seeded pattern (operator edits win).

// otpRuleV4Pattern is the exact v4 seed (generated from the previous policy_rules.json).
const otpRuleV4Pattern = "(?i)(?:^|[^a-z0-9])(?:otp|totp|2fa|mfa|sms_?code|verify_?code|verification_?code|one.?time)(?:[^a-z0-9]|$)[\\s\\S]{0,500}?(?:\\bseq\\s+-?w?\\s*\\d|range\\s*\\(\\s*\\d|\\{\\d+\\.\\.\\d+\\}|\\bfor\\s+\\w+\\s+in\\b|\\bwhile\\b|\\bxargs\\b|\\bparallel\\b|itertools\\.product|\\s-w\\s)|(?:\\bseq\\s+-?w?\\s*\\d|range\\s*\\(\\s*\\d|\\{\\d+\\.\\.\\d+\\}|\\bfor\\s+\\w+\\s+in\\b|\\bwhile\\b|\\bxargs\\b|\\bparallel\\b|itertools\\.product)[\\s\\S]{0,500}?(?:^|[^a-z0-9])(?:otp|totp|2fa|mfa|sms_?code|verify_?code|verification_?code|one.?time)(?:[^a-z0-9]|$)"

func (d *DB) seedPolicyInterceptRulesV5() error {
	const flag = "intercept_policy_rules_v5"
	if v, _, _ := d.GetSetting(flag); v == "done" {
		return nil
	}
	rules, err := PolicyRules()
	if err != nil {
		return err
	}
	const name = "[Policy] OTP brute-force loop"
	for _, r := range rules {
		if r.Name != name {
			continue
		}
		if _, err := d.Exec(`UPDATE intercept_rules SET pattern = $3 WHERE name = $1 AND pattern = $2`, name, otpRuleV4Pattern, r.Pattern); err != nil {
			return fmt.Errorf("narrow OTP rule: %w", err)
		}
	}
	return d.SetSetting(flag, "done")
}
