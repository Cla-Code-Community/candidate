package classifier

import (
	"strings"
	"unicode"

	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

func normalizeText(value string) string {
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r)
	}), norm.NFC)

	result, _, _ := transform.String(t, value)

	var b strings.Builder
	for _, r := range strings.ToLower(result) {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

// These inputs are immutable rule data. Only their normalized representation
// is shared; scoring still visits every original term, including duplicates.
var productContextTerms = []string{"product", "produto", "produtos", "production", "producao"}
var designContextTerms = []string{"designer", "design", "ux", "ui"}
var internTerms = []string{"estagio", "estagiario", "intern", "internship", "trainee"}
var seniorTerms = []string{"senior", "sr", "especialista", "lead", "principal", "staff"}
var juniorTerms = []string{"junior", "jr", "entry level", "assistente"}
var normalizedTerms = prepareFixedTerms()

func prepareFixedTerms() map[string]string {
	terms := make(map[string]string)
	add := func(values []string) {
		for _, term := range values {
			if _, exists := terms[term]; !exists {
				terms[term] = normalizeText(term)
			}
		}
	}
	for _, rule := range familyRules {
		add(rule.StrongTerms)
		add(rule.TechnologyTerms)
		add(rule.NegativeTerms)
	}
	for _, aliases := range technologyAliases {
		add(aliases)
	}
	for _, values := range [][]string{nonConcreteTerms, administrativeTerms, productContextTerms, designContextTerms, internTerms, seniorTerms, juniorTerms} {
		add(values)
	}
	return terms
}

func normalizedFixedTerm(term string) string {
	if normalized, ok := normalizedTerms[term]; ok {
		return normalized
	}
	return normalizeText(term)
}

type matchQuery struct {
	needle string
	whole  bool
}
type matchedText struct {
	text    string
	results map[matchQuery]bool
}

func newMatchedText(text string) *matchedText {
	return &matchedText{text: text, results: make(map[matchQuery]bool)}
}
func (text *matchedText) contains(term string, whole bool) bool {
	query := matchQuery{needle: normalizedFixedTerm(term), whole: whole}
	if result, ok := text.results[query]; ok {
		return result
	}
	result := containsNormalized(text.text, query.needle, whole)
	text.results[query] = result
	return result
}
func (text *matchedText) any(terms ...string) bool {
	for _, term := range terms {
		if text.contains(term, false) {
			return true
		}
	}
	return false
}

func containsTokenOrPhrase(text, needle string) bool {
	return containsNormalized(text, normalizedFixedTerm(needle), false)
}

func containsNormalized(text, needle string, whole bool) bool {
	if needle == "" {
		// The former whole-phrase padding could match two adjacent spaces,
		// including the artificial pair for empty text. Keep that edge case.
		return whole && (text == "" || strings.HasPrefix(text, " ") || strings.HasSuffix(text, " ") || strings.Contains(text, "  "))
	}
	if !whole && strings.Contains(needle, " ") {
		return strings.Contains(text, needle)
	}
	for offset := 0; offset <= len(text)-len(needle); {
		relative := strings.Index(text[offset:], needle)
		if relative < 0 {
			return false
		}
		start := offset + relative
		end := start + len(needle)
		if (start == 0 || text[start-1] == ' ') && (end == len(text) || text[end] == ' ') {
			return true
		}
		offset = start + 1
	}
	return false
}

func unique(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))

	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}

	return result
}
