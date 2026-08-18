package keywords

import (
	"reflect"
	"strconv"
	"testing"
)

func TestNormalizeKeywordsTrimsLowercasesAndDeduplicates(t *testing.T) {
	got := NormalizeKeywords([]string{" Go ", "go", "", " Node.js ", "NODE.js"})
	want := []string{"go", "node.js"}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("NormalizeKeywords() = %#v, want %#v", got, want)
	}
}

func TestGenerateSearchKeywordsBuildsCompatibleTitleTechnologyQueries(t *testing.T) {
	got := GenerateSearchKeywords([]string{
		"Frontend Developer",
		"Backend Developer",
		"DevOps Engineer",
		"React",
		"Spring Boot",
		"Docker",
	})

	assertContains(t, got, "react frontend developer")
	assertContains(t, got, "spring boot backend developer")
	assertContains(t, got, "docker devops engineer")
	assertNotContains(t, got, "spring boot frontend developer")
}

func TestGenerateSearchKeywordsKeepsStableLimit(t *testing.T) {
	input := []string{
		"frontend developer",
		"frontend engineer",
		"backend developer",
		"backend engineer",
		"full stack developer",
		"software engineer",
		"mobile developer",
		"data engineer",
		"devops engineer",
		"platform engineer",
		"qa engineer",
		"security engineer",
		"react",
		"next.js",
		"vue",
		"angular",
		"typescript",
		"node.js",
		"java",
		"spring boot",
		"python",
		"go",
		"docker",
		"kubernetes",
		"terraform",
		"aws",
		"postgresql",
		"kafka",
		"react native",
		"flutter",
		"selenium",
	}

	got := GenerateSearchKeywords(input)
	if len(got) > len(NormalizeKeywords(input))+maxGeneratedCombinations {
		t.Fatalf("GenerateSearchKeywords() returned %d items, want <= %d", len(got), len(NormalizeKeywords(input))+maxGeneratedCombinations)
	}
}

func TestGenerateSearchKeywordsIsIdempotent(t *testing.T) {
	input := []string{
		"backend developer",
		"backend engineer",
		"frontend developer",
		"frontend engineer",
		"full stack developer",
		"full stack engineer",
		"fullstack developer",
		"fullstack engineer",
		"software engineer",
		"software developer",
		"mobile developer",
		"mobile engineer",
		"data engineer",
		"data analyst",
		"data scientist",
		"machine learning engineer",
		"devops engineer",
		"cloud engineer",
		"platform engineer",
		"infrastructure engineer",
		"qa engineer",
		"qa analyst",
		"automation engineer",
		"security engineer",
		"application security engineer",
		"salesforce developer",
		"salesforce engineer",
		"salesforce architect",
		"sap consultant",
		"sap developer",
		"integration developer",
		"integration engineer",
		"blockchain developer",
		"embedded engineer",
		"firmware engineer",
		"game developer",
		"react",
		"next.js",
		"vue",
		"angular",
		"javascript",
		"typescript",
		"node.js",
		"nestjs",
		"java",
		"spring boot",
		"python",
		"django",
		"flask",
		"go",
		"golang",
		"php",
		"laravel",
		"ruby on rails",
		".net",
		"c#",
		"react native",
		"flutter",
		"android",
		"ios",
		"kotlin",
		"swift",
		"docker",
		"kubernetes",
		"terraform",
		"ansible",
		"aws",
		"azure",
		"gcp",
		"postgresql",
		"mysql",
		"mongodb",
		"redis",
		"kafka",
		"rabbitmq",
		"graphql",
		"selenium",
		"cypress",
		"playwright",
		"salesforce",
		"apex",
		"lwc",
		"mulesoft",
		"sap abap",
		"sap hana",
		"sap fiori",
		"oracle",
		"power platform",
		"solidity",
		"web3",
		"unity",
		"unreal engine",
	}

	once := GenerateSearchKeywords(input)
	twice := GenerateSearchKeywords(once)

	if len(once) > len(NormalizeKeywords(input))+maxGeneratedCombinations {
		t.Fatalf("GenerateSearchKeywords() returned %d items, want <= %d", len(once), len(NormalizeKeywords(input))+maxGeneratedCombinations)
	}
	if !reflect.DeepEqual(twice, once) {
		t.Fatalf("GenerateSearchKeywords() should be idempotent; once=%d twice=%d", len(once), len(twice))
	}
}

func TestGenerateSearchKeywordsPreservesLargeSeedLists(t *testing.T) {
	input := make([]string, 0, maxGeneratedCombinations+1)
	for i := 0; i < maxGeneratedCombinations+1; i++ {
		input = append(input, "keyword "+strconv.Itoa(i))
	}

	got := GenerateSearchKeywords(input)
	if len(got) != len(input) {
		t.Fatalf("GenerateSearchKeywords() returned %d items, want all %d seed keywords preserved", len(got), len(input))
	}
}

func assertContains(t *testing.T, values []string, expected string) {
	t.Helper()
	for _, value := range values {
		if value == expected {
			return
		}
	}
	t.Fatalf("expected %#v to contain %q", values, expected)
}

func assertNotContains(t *testing.T, values []string, unexpected string) {
	t.Helper()
	for _, value := range values {
		if value == unexpected {
			t.Fatalf("expected %#v not to contain %q", values, unexpected)
		}
	}
}
