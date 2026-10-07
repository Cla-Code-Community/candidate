package classifier

import (
	"encoding/json"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestCanonicalPrecedence(t *testing.T) {
	cases := map[string]string{"Product Designer": "product_design", "Product Manager": "product", "Product Security Engineer": "security", "Product Data Engineer": "data", "Full Stack Engineer": "fullstack", "Backend Engineer": "backend", "Frontend Engineer": "frontend", "Mobile Engineer": "mobile", "Platform Engineer": "platform", "DevOps Engineer": "devops", "QA Engineer": "qa", "Security Engineer": "security", "Software Engineer": "software", "Engineering Manager": "leadership", "Engineering Manager Backend": "leadership", "Platform DevOps Engineer": "devops"}
	for title, want := range cases {
		t.Run(title, func(t *testing.T) {
			c := Classify(domain.Job{Title: title, Description: "backend frontend data engineer product manager platform engineer java react sql"})
			require.Equal(t, want, c.PrimaryFamily)
			require.True(t, taxonomy.IsPublic(c.PrimaryFamily))
			require.NotEmpty(t, c.Reasons)
			for _, f := range c.RelatedFamilies {
				require.True(t, taxonomy.IsPublic(f))
				require.NotEqual(t, c.PrimaryFamily, f)
			}
			for i := 0; i < 20; i++ {
				require.Equal(t, c, Classify(domain.Job{Title: title, Description: "backend frontend data engineer product manager platform engineer java react sql"}))
			}
			raw, err := json.Marshal(c)
			require.NoError(t, err)
			var restored domain.Classification
			require.NoError(t, json.Unmarshal(raw, &restored))
			require.Equal(t, c, restored)
		})
	}
	require.Equal(t, []string{"backend"}, Classify(domain.Job{Title: "Engineering Manager Backend"}).RelatedFamilies)
	require.Equal(t, []string{"backend", "frontend"}, Classify(domain.Job{Title: "Full Stack Engineer"}).RelatedFamilies)
}
func TestRulesExactlyMatchPublicContract(t *testing.T) {
	require.Equal(t, "v1", TaxonomyVersion())
	seen := map[string]bool{}
	for _, r := range familyRules {
		require.True(t, taxonomy.IsPublic(r.Family))
		require.False(t, seen[r.Family])
		seen[r.Family] = true
	}
	require.Len(t, seen, 13)
}

func TestTitleCannotBeOverriddenByDescription(t *testing.T) {
	for title, family := range map[string]string{"Backend Engineer": "backend", "Frontend Engineer": "frontend", "Engineering Manager Backend": "leadership", "Software Engineer": "software"} {
		c := Classify(domain.Job{Title: title, Description: "graphic designer ux designer frontend backend data engineer data engineer devops platform engineer"})
		require.Equal(t, family, c.PrimaryFamily)
	}
}
func TestRelatedEmptySerializationRemainsCompatible(t *testing.T) {
	c := Classify(domain.Job{Title: "Software Engineer"})
	require.Empty(t, c.RelatedFamilies)
	raw, err := json.Marshal(c)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "relatedFamilies")
	var restored domain.Classification
	require.NoError(t, json.Unmarshal(raw, &restored))
	require.Empty(t, restored.RelatedFamilies)
	require.Equal(t, c.PrimaryFamily, restored.PrimaryFamily)
}

func TestExplicitLexicalTieBreak(t *testing.T) {
	for _, title := range []string{"Platform Engineer / DevOps Engineer", "DevOps Engineer / Platform Engineer"} {
		c := Classify(domain.Job{Title: title})
		require.Equal(t, "devops", c.PrimaryFamily)
		require.Equal(t, []string{"platform"}, c.RelatedFamilies)
	}
}
