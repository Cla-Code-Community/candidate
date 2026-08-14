package domain

type Job struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Company     string   `json:"company"`
	Location    string   `json:"location"`
	URL         string   `json:"url"`
	Salary      string   `json:"salary,omitempty"`
	Modality    string   `json:"modality,omitempty"`
	Description string   `json:"description,omitempty"`
	PostedAt    string   `json:"postedAt,omitempty"`
	Source      string   `json:"source"`
	Sources     []string `json:"sources"`
	Keyword     string   `json:"keyword"`
	Keywords    []string `json:"keywords"`

	Classification *Classification `json:"classification,omitempty"`
}

type Classification struct {
	PrimaryFamily   string   `json:"primaryFamily"`
	RelatedFamilies []string `json:"relatedFamilies,omitempty"`
	Technologies    []string `json:"technologies,omitempty"`
	Seniority       string   `json:"seniority,omitempty"`
	InScope         bool     `json:"inScope"`
	Confidence      float64  `json:"confidence"`
	Reasons         []string `json:"reasons,omitempty"`
}

type ScrapeRequest struct {
	Keywords              []string `json:"keywords"`
	SearchLocation        string   `json:"searchLocation"`
	SearchGeoID           string   `json:"searchGeoId"`
	SearchLanguage        string   `json:"searchLanguage"`
	JobTypes              string   `json:"jobTypes"`
	TimeFilter            string   `json:"timeFilter"`
	RemoteOnly            bool     `json:"remoteOnly"`
	Sources               []string `json:"sources"`
	ResultsPerPage        int      `json:"resultsPerPage"`
	MaxPagesPerKeyword    int      `json:"maxPagesPerKeyword"`
	WaitBetweenSearchesMs int      `json:"waitBetweenSearchesMs"`
	PageTimeoutMs         int      `json:"pageTimeoutMs"`
	MaxConcurrency        int      `json:"maxConcurrency"`
}

type ScrapeResponse struct {
	Jobs      []Job  `json:"jobs"`
	Total     int    `json:"total"`
	CachedAt  string `json:"cachedAt"`
	FromCache bool   `json:"fromCache"`
}
