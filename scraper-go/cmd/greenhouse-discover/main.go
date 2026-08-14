package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

type boardResult struct {
	Token   string `json:"token"`
	Name    string `json:"name,omitempty"`
	URL     string `json:"url"`
	APIURL  string `json:"apiUrl"`
	Valid   bool   `json:"valid"`
	Jobs    int    `json:"jobs,omitempty"`
	Status  int    `json:"status,omitempty"`
	Error   string `json:"error,omitempty"`
	Source  string `json:"source,omitempty"`
	Company string `json:"company,omitempty"`
}

type greenhouseJobsResponse struct {
	Jobs []struct {
		Title string `json:"title"`
	} `json:"jobs"`
	Meta struct {
		Total int `json:"total"`
	} `json:"meta"`
}

func main() {
	var (
		namesArg  = flag.String("names", "", "nomes de empresas separados por vírgula, ex: Reddit,GitLab")
		tokensArg = flag.String("tokens", "", "board tokens separados por vírgula, ex: reddit,gitlab")
		filePath  = flag.String("file", "", "arquivo JSON com array de nomes/tokens")
		out       = flag.String("out", "text", "formato de saída: text ou json")
		timeout   = flag.Duration("timeout", 10*time.Second, "timeout por token")
	)
	flag.Parse()

	nameInputs := splitCSV(*namesArg)
	exactTokens := splitCSV(*tokensArg)
	if *filePath != "" {
		fromFile, err := readStringArray(*filePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "erro ao ler arquivo: %v\n", err)
			os.Exit(1)
		}
		exactTokens = append(exactTokens, fromFile...)
	}
	nameInputs = uniqueStrings(append(nameInputs, flag.Args()...))
	exactTokens = uniqueStrings(exactTokens)

	if len(nameInputs) == 0 && len(exactTokens) == 0 {
		fmt.Fprintln(os.Stderr, "uso: greenhouse-discover -names Reddit,GitLab ou -file internal/interfaces/greenhouseCompanies.json")
		os.Exit(2)
	}

	client := &http.Client{Timeout: *timeout}
	var results []boardResult
	seenTokens := make(map[string]struct{})

	for _, token := range exactTokens {
		token = strings.TrimSpace(strings.ToLower(token))
		if token == "" {
			continue
		}
		if _, seen := seenTokens[token]; seen {
			continue
		}
		seenTokens[token] = struct{}{}

		ctx, cancel := context.WithTimeout(context.Background(), *timeout)
		result := checkBoard(ctx, client, token, token)
		cancel()
		results = append(results, result)
	}

	for _, input := range nameInputs {
		for _, token := range candidateTokens(input) {
			if _, seen := seenTokens[token]; seen {
				continue
			}
			seenTokens[token] = struct{}{}

			ctx, cancel := context.WithTimeout(context.Background(), *timeout)
			result := checkBoard(ctx, client, input, token)
			cancel()
			results = append(results, result)
		}
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].Valid != results[j].Valid {
			return results[i].Valid
		}
		return results[i].Token < results[j].Token
	})

	switch strings.ToLower(strings.TrimSpace(*out)) {
	case "json":
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(results); err != nil {
			fmt.Fprintf(os.Stderr, "erro ao escrever json: %v\n", err)
			os.Exit(1)
		}
	default:
		printText(results)
	}
}

func checkBoard(ctx context.Context, client *http.Client, company, token string) boardResult {
	apiURL := fmt.Sprintf("https://boards-api.greenhouse.io/v1/boards/%s/jobs", url.PathEscape(token))
	result := boardResult{
		Token:   token,
		URL:     fmt.Sprintf("https://job-boards.greenhouse.io/%s", token),
		APIURL:  apiURL,
		Company: company,
		Source:  "boards-api",
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "JobsScraper/greenhouse-discover")

	resp, err := client.Do(req)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	result.Status = resp.StatusCode
	if resp.StatusCode != http.StatusOK {
		return result
	}

	var data greenhouseJobsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		result.Error = err.Error()
		return result
	}

	result.Valid = true
	result.Jobs = data.Meta.Total
	if result.Jobs == 0 {
		result.Jobs = len(data.Jobs)
	}

	return result
}

func candidateTokens(input string) []string {
	normalized := normalize(input)
	words := strings.Fields(normalized)
	if len(words) == 0 {
		return nil
	}

	joined := strings.Join(words, "")
	hyphenated := strings.Join(words, "-")
	underscored := strings.Join(words, "_")

	return uniqueStrings([]string{
		strings.TrimSpace(strings.ToLower(input)),
		joined,
		hyphenated,
		underscored,
		joined + "careers",
		joined + "jobs",
	})
}

func normalize(input string) string {
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r)
	}), norm.NFC)

	value, _, _ := transform.String(t, strings.ToLower(input))

	var b strings.Builder
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

func readStringArray(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var values []string
	if err := json.Unmarshal(data, &values); err != nil {
		return nil, err
	}

	return values, nil
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, value)
	}
	return out
}

func printText(results []boardResult) {
	validCount := 0
	for _, result := range results {
		if !result.Valid {
			continue
		}
		validCount++
		fmt.Printf("OK   %-32s %5d vagas  %s\n", result.Token, result.Jobs, result.URL)
	}

	if validCount > 0 {
		fmt.Println()
	}

	for _, result := range results {
		if result.Valid {
			continue
		}
		detail := fmt.Sprintf("status=%d", result.Status)
		if result.Error != "" {
			detail = "erro=" + result.Error
		}
		fmt.Printf("MISS %-32s %s\n", result.Token, detail)
	}
}
