package serverutils

import "testing"

// TestBuildSQL_ReturnsValidColumns verifies the happy path:
// given a valid list of wanted attributes, they should appear in the SQL SELECT string.
func TestBuildSQL_ReturnsValidColumns(t *testing.T) {
	allowed := []string{"uuid", "format", "filepath", "status"}
	wanted := []string{"uuid", "status"}

	result := BuildSQL(allowed, wanted)

	// We expect "uuid, status" — both columns are valid and both were requested.
	expected := "uuid, status"
	if result != expected {
		t.Errorf("got %q, want %q", result, expected)
	}
}

// TestBuildSQL_FiltersOutInvalidColumns verifies the security-critical behavior:
// columns that are NOT in the allowed list must be silently dropped.
// This prevents a user from injecting arbitrary column names like "password" or "secret".
func TestBuildSQL_FiltersOutInvalidColumns(t *testing.T) {
	allowed := []string{"uuid", "format", "filepath"}
	wanted := []string{"uuid", "secret_column", "filepath"}

	result := BuildSQL(allowed, wanted)

	expected := "uuid, filepath"
	if result != expected {
		t.Errorf("got %q, want %q", result, expected)
	}
}

// TestBuildSQL_EmptyWanted verifies that requesting no columns returns an empty string.
// The caller is responsible for not sending this as a query — this test just confirms
// BuildSQL itself doesn't panic or return garbage.
func TestBuildSQL_EmptyWanted(t *testing.T) {
	allowed := []string{"uuid", "format"}
	wanted := []string{}

	result := BuildSQL(allowed, wanted)

	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

// TestBuildSQL_AllInvalid verifies that if ALL requested columns are invalid,
// we get an empty string back (not a crash or a wildcard like "*").
func TestBuildSQL_AllInvalid(t *testing.T) {
	allowed := []string{"uuid", "format"}
	wanted := []string{"password", "credit_card"}

	result := BuildSQL(allowed, wanted)

	if result != "" {
		t.Errorf("expected empty string for all-invalid input, got %q", result)
	}
}
