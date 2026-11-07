package server

// Security hardening for the auth surface (added during the EN localisation pass):
//
//   - one-time setup token gating POST /api/auth/init (CWE-306 first-run takeover)
//   - CORS origin allowlist instead of a blanket "*" (CWE-942)
//   - query-string tokens accepted only on the SSE stream routes (CWE-598)
//   - per-client login throttling (CWE-307)
//   - JWT signing-key rotation on password change so old tokens die (CWE-613)

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const setupTokenFilename = "setup.token"

// ---------------------------------------------------------------------------
// Setup token
// ---------------------------------------------------------------------------

// setupTokenState holds the one-time token required to set the initial admin
// password. It exists only while no password is configured.
type setupTokenState struct {
	mu    sync.Mutex
	token string
	path  string // file the token was written to (removed after use)
}

// initSetupToken prepares the setup token when the admin password is not yet
// initialised. ARTEX_SETUP_TOKEN overrides the random value (for automated
// deployments). The token is printed to the server log and written to
// <keyDir>/setup.token (0600) so the operator can read it from the host.
func (s *Server) initSetupToken(keyDir string) {
	if s.m != nil && s.m.pg != nil {
		if hash, _, err := s.m.pg.GetSetting(authPassKey); err == nil && hash != "" {
			return // already initialised: no setup token needed
		}
	}
	tok := strings.TrimSpace(os.Getenv("ARTEX_SETUP_TOKEN"))
	if tok == "" {
		buf := make([]byte, 24)
		if _, err := rand.Read(buf); err != nil {
			log.Fatalf("[auth] generate setup token: %v", err)
		}
		tok = hex.EncodeToString(buf)
	}
	path := ""
	if keyDir != "" {
		path = filepath.Join(keyDir, setupTokenFilename)
		if err := os.WriteFile(path, []byte(tok+"\n"), 0o600); err != nil {
			log.Printf("[auth] could not write setup token file %s: %v", path, err)
			path = ""
		}
	}
	s.setup.mu.Lock()
	s.setup.token, s.setup.path = tok, path
	s.setup.mu.Unlock()
	where := "the server log"
	if path != "" {
		where = path
	}
	log.Printf("[auth] Admin password not set. Initial setup requires the one-time setup token (also stored in %s): %s", where, tok)
}

// checkSetupToken reports whether supplied matches the active setup token.
// When no token was prepared (e.g. tests constructing Server directly) setup is
// refused, failing closed.
func (s *Server) checkSetupToken(supplied string) bool {
	s.setup.mu.Lock()
	defer s.setup.mu.Unlock()
	if s.setup.token == "" || supplied == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(strings.TrimSpace(supplied)), []byte(s.setup.token)) == 1
}

// consumeSetupToken invalidates the setup token after a successful init.
func (s *Server) consumeSetupToken() {
	s.setup.mu.Lock()
	defer s.setup.mu.Unlock()
	if s.setup.path != "" {
		_ = os.Remove(s.setup.path)
	}
	s.setup.token, s.setup.path = "", ""
}

// ---------------------------------------------------------------------------
// JWT signing key (rotatable)
// ---------------------------------------------------------------------------

// signingKey returns the current JWT signing key.
func (s *Server) signingKey() []byte {
	s.jwtMu.RLock()
	defer s.jwtMu.RUnlock()
	return s.jwtKey
}

// rotateSigningKey replaces the JWT signing key (persisting it next to the old
// one), which invalidates every token issued before the rotation.
func (s *Server) rotateSigningKey() ([]byte, error) {
	buf, err := randomKey()
	if err != nil {
		return nil, err
	}
	if s.keyDir != "" {
		if err := os.WriteFile(filepath.Join(s.keyDir, jwtKeyFilename), buf, 0o600); err != nil {
			return nil, err
		}
	}
	s.jwtMu.Lock()
	s.jwtKey = buf
	s.jwtMu.Unlock()
	return buf, nil
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

// isSSERoute reports whether a request targets one of the EventSource stream
// endpoints, which cannot send an Authorization header and therefore carry the
// token as ?token=.
func isSSERoute(r *http.Request) bool {
	if r.Method != http.MethodGet {
		return false
	}
	p := r.URL.Path
	return strings.HasPrefix(p, "/api/") && (strings.HasSuffix(p, "/stream") || strings.HasSuffix(p, "/events"))
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// corsAllowedOrigins parses ARTEX_CORS_ORIGINS (comma separated). Empty by
// default: the production UI is served same-origin and needs no CORS. For
// `next dev` set e.g. ARTEX_CORS_ORIGINS=http://localhost:3000 (dev.sh does).
func corsAllowedOrigins() map[string]bool {
	out := map[string]bool{}
	for _, o := range strings.Split(os.Getenv("ARTEX_CORS_ORIGINS"), ",") {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			out[o] = true
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

const (
	loginMaxFailures = 5
	loginWindow      = 15 * time.Minute
)

type loginAttempt struct {
	failures int
	first    time.Time
}

// loginLimiter counts failed password checks per client IP and blocks a
// client for loginWindow after loginMaxFailures failures.
type loginLimiter struct {
	mu sync.Mutex
	m  map[string]*loginAttempt
}

func (l *loginLimiter) key(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// blocked reports whether the client is currently locked out.
func (l *loginLimiter) blocked(r *http.Request) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	a := l.m[l.key(r)]
	if a == nil {
		return false
	}
	if time.Since(a.first) > loginWindow {
		delete(l.m, l.key(r))
		return false
	}
	return a.failures >= loginMaxFailures
}

func (l *loginLimiter) fail(r *http.Request) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.m == nil {
		l.m = map[string]*loginAttempt{}
	}
	k := l.key(r)
	a := l.m[k]
	if a == nil || time.Since(a.first) > loginWindow {
		a = &loginAttempt{first: time.Now()}
		l.m[k] = a
	}
	a.failures++
	// keep the map bounded under a spray from many addresses
	if len(l.m) > 10000 {
		for kk, v := range l.m {
			if time.Since(v.first) > loginWindow {
				delete(l.m, kk)
			}
		}
	}
	log.Printf("[auth] failed password check from %s (%d/%d)", k, a.failures, loginMaxFailures)
}

func (l *loginLimiter) reset(r *http.Request) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.m, l.key(r))
}
