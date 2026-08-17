package keywords

import "strings"

func NormalizeKeywords(keywords []string) []string {
	unique := make(map[string]struct{})
	var result []string

	for _, k := range keywords {
		k = strings.ToLower(strings.TrimSpace(k))

		if k == "" {
			continue
		}

		if _, exists := unique[k]; exists {
			continue
		}

		unique[k] = struct{}{}
		result = append(result, k)
	}

	return result
}
