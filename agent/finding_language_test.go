package agent

import (
	"context"
	"strings"
	"testing"

	actool "github.com/Autumn-27/norma/tool"
)

// report_finding must carry the English-output note for every reporter, whatever
// the traffic-binding switch and even when the operator customised the
// description; other tools must not get it.
func TestReportFindingLanguageNote(t *testing.T) {
	oldPolicy, oldResolve, oldAugment := FindingTrafficBindingEnabled, ToolResolve, ToolAugment
	t.Cleanup(func() { FindingTrafficBindingEnabled, ToolResolve, ToolAugment = oldPolicy, oldResolve, oldAugment })
	ToolAugment = nil
	on := false
	FindingTrafficBindingEnabled = func() bool { return on }
	ts := NewToolSet(nil, "fixture")
	ToolResolve = func(_ context.Context, _ string, base []actool.CoreTool) []actool.CoreTool {
		out := make([]actool.CoreTool, len(base))
		for i, tool := range base {
			out[i] = DecorateTool(tool, "CUSTOM DESCRIPTION", tool.InputSchema())
		}
		return out
	}
	for _, role := range []string{"worker", "planner", "pentest"} {
		for _, enabled := range []bool{false, true} {
			on = enabled
			out, _, cleanup := AugmentTools(t.Context(), role, []actool.CoreTool{ts.addFinding(), ts.addHint()})
			cleanup()
			for _, tool := range out {
				has := strings.Contains(tool.Description(), findingLanguageNote)
				if tool.Name() == "report_finding" && !has {
					t.Fatalf("%s (binding=%v): report_finding lacks the English note", role, enabled)
				}
				if tool.Name() != "report_finding" && has {
					t.Fatalf("%s: %s must not get the English note", role, tool.Name())
				}
				if !strings.HasPrefix(tool.Description(), "CUSTOM DESCRIPTION") {
					t.Fatal("custom description replaced")
				}
			}
		}
	}
}
