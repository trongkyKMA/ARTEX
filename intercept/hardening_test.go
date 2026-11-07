package intercept

import (
	"regexp"
	"strings"
	"testing"

	"github.com/Autumn-27/artex/db"
)

// u returns the JSON escape sequence for a code point, e.g. u("0065") = backslash
// + "u0065". Built at runtime so no tool rewrites the escape in this source file.
func u(hex string) string { return string(rune(92)) + "u" + hex }

// A tool_input rule must also match the canonical (unescaped) form of the input:
// OpenAI-format tool arguments reach the matcher as the model's raw JSON text, so a
// JSON escape would otherwise hide the word from the rule while the tool still
// receives the decoded string.
func TestRuleMatchesCanonicalInput(t *testing.T) {
	r := compiledRule{InterceptRule: db.InterceptRule{MatchTarget: "tool_input", MatchType: "regex", Pattern: `\bhello\b`}}
	r.re = regexp.MustCompile(r.Pattern)
	s := compiledRule{InterceptRule: db.InterceptRule{MatchTarget: "tool_input", MatchType: "string", Pattern: "hello"}}

	escOne := `{"command":"echo h` + u("0065") + `llo"}`
	escAll := `{"command":"echo ` + u("0068") + u("0065") + u("006c") + u("006c") + u("006f") + `"}`
	if !strings.Contains(escOne, string(rune(92))+"u0065") {
		t.Fatalf("test input lost its escape: %s", escOne)
	}

	cases := []struct {
		name  string
		input string
		want  bool
	}{
		{"plain", `{"command":"echo hello"}`, true},
		{"one char escaped", escOne, true},
		{"whole word escaped", escAll, true},
		{"no match", `{"command":"echo world"}`, false},
	}
	for _, c := range cases {
		in := []byte(c.input)
		canon := canonicalInput(in)
		if got := ruleMatches(r, "Bash", in, canon); got != c.want {
			t.Errorf("regex %s: got %v want %v (input=%s canon=%s)", c.name, got, c.want, in, canon)
		}
		if got := ruleMatches(s, "Bash", in, canon); got != c.want {
			t.Errorf("string %s: got %v want %v (input=%s canon=%s)", c.name, got, c.want, in, canon)
		}
	}

	// The raw bytes alone must NOT match - otherwise this test proves nothing.
	if r.re.MatchString(escOne) {
		t.Fatal("raw escaped input unexpectedly matched; escape was not preserved")
	}
}

func TestCanonicalInputEdgeCases(t *testing.T) {
	if got := canonicalInput([]byte(`not json`)); got != nil {
		t.Errorf("invalid JSON should give nil, got %s", got)
	}
	if got := canonicalInput([]byte(`{"a":"b"}`)); got != nil {
		t.Errorf("already-canonical input should give nil, got %s", got)
	}
	// HTML characters must stay literal after re-encoding so rules written against
	// "&" or ">" keep matching.
	in := `{"command":"a ` + u("0026") + u("0026") + ` b ` + u("003e") + ` c"}`
	if got := string(canonicalInput([]byte(in))); got != `{"command":"a && b > c"}` {
		t.Errorf("unexpected canonical form: %q (from %s)", got, in)
	}
}

// MCP tools must always enter the rule path, without needing the DB-backed list.
func TestIsToolEnabledMCPAlwaysOn(t *testing.T) {
	i := &Interceptor{pending: newPendingManager(), enabledTools: map[string]bool{"Bash": true}}
	if !i.IsToolEnabled("mcp__browser__browser_navigate") {
		t.Error("mcp__ tool should always be intercept-enabled")
	}
	if !i.IsToolEnabled("Bash") {
		t.Error("configured tool should stay enabled")
	}
	if i.IsToolEnabled("Read") {
		t.Error("unconfigured non-MCP tool should not be enabled")
	}
}
