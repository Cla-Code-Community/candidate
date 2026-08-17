package classifier

type familyRule struct {
	Family          string
	StrongTerms     []string
	TechnologyTerms []string
	NegativeTerms   []string
}

var familyRules = []familyRule{
	{
		Family: "backend",
		StrongTerms: []string{
			"backend", "back end", "back-end", "server side", "api", "apis",
			"microservices", "distributed systems", "sistemas distribuidos",
			"desenvolvedor backend", "engenheiro backend",
		},
		TechnologyTerms: []string{
			"go", "golang", "java", "spring", "spring boot", "node", "node js",
			"nestjs", "python", "django", "flask", "ruby", "rails", "php",
			"laravel", "csharp", "dotnet", "postgresql", "mysql", "mongodb",
			"redis", "kafka", "rabbitmq", "grpc", "rest",
		},
	},
	{
		Family: "frontend",
		StrongTerms: []string{
			"frontend", "front end", "front-end", "web developer", "ui engineer",
			"desenvolvedor frontend", "desenvolvedor front end", "engenheiro frontend",
		},
		TechnologyTerms: []string{
			"react", "next js", "vue", "angular", "svelte", "typescript",
			"javascript", "html", "css", "tailwind", "graphql",
		},
		NegativeTerms: []string{"designer", "ux", "ui designer", "product designer"},
	},
	{
		Family: "mobile",
		StrongTerms: []string{
			"mobile", "ios", "android", "react native", "flutter",
			"desenvolvedor mobile", "engenheiro mobile",
		},
		TechnologyTerms: []string{
			"swift", "kotlin", "react native", "flutter", "dart", "android", "ios",
		},
	},
	{
		Family: "fullstack",
		StrongTerms: []string{
			"fullstack", "full stack", "full-stack", "desenvolvedor fullstack",
			"desenvolvedor full stack",
		},
		TechnologyTerms: []string{
			"react", "node", "node js", "typescript", "javascript", "next js",
			"postgresql", "mongodb",
		},
	},
	{
		Family: "platform",
		StrongTerms: []string{
			"platform engineer", "platform software", "plataforma",
			"developer platform", "engenheiro de plataforma",
		},
		TechnologyTerms: []string{
			"kubernetes", "docker", "terraform", "aws", "azure", "gcp",
			"google cloud", "ci cd", "github actions", "gitlab ci",
		},
	},
	{
		Family: "devops",
		StrongTerms: []string{
			"devops", "site reliability", "sre", "cloud engineer",
			"infrastructure engineer", "engenheiro devops", "infraestrutura",
		},
		TechnologyTerms: []string{
			"kubernetes", "docker", "terraform", "ansible", "jenkins", "aws",
			"azure", "gcp", "prometheus", "grafana",
		},
	},
	{
		Family: "data",
		StrongTerms: []string{
			"data engineer", "data analyst", "data scientist", "analytics engineer",
			"machine learning", "ml engineer", "ai engineer", "engenheiro de dados",
			"cientista de dados", "analista de dados",
		},
		TechnologyTerms: []string{
			"python", "sql", "spark", "airflow", "dbt", "bigquery", "snowflake",
			"pandas", "tensorflow", "pytorch",
		},
	},
	{
		Family: "qa",
		StrongTerms: []string{
			"qa engineer", "test engineer", "automation engineer", "sdet",
			"quality assurance", "analista qa", "engenheiro qa", "tester",
		},
		TechnologyTerms: []string{
			"selenium", "cypress", "playwright", "jest", "vitest", "junit",
		},
	},
	{
		Family: "security",
		StrongTerms: []string{
			"security engineer", "cybersecurity", "application security",
			"devsecops", "information security", "seguranca da informacao",
		},
		TechnologyTerms: []string{
			"owasp", "iam", "soc", "siem", "vulnerability", "pentest",
		},
	},
	{
		Family: "leadership",
		StrongTerms: []string{
			"tech lead", "technical lead", "engineering lead", "engineering manager",
			"head of engineering", "cto", "lider tecnico", "gerente de engenharia",
		},
	},
	{
		Family: "software",
		StrongTerms: []string{
			"software engineer", "software developer", "engenheiro de software",
			"desenvolvedor de software", "application developer",
		},
	},
}

var technologyAliases = map[string][]string{
	"angular":      {"angular"},
	"aws":          {"aws", "amazon web services"},
	"azure":        {"azure"},
	"csharp":       {"c#", "c sharp", "csharp"},
	"docker":       {"docker"},
	"dotnet":       {".net", "dotnet", "asp net"},
	"flutter":      {"flutter"},
	"gcp":          {"gcp", "google cloud"},
	"go":           {"go", "golang"},
	"graphql":      {"graphql"},
	"java":         {"java"},
	"javascript":   {"javascript", "js"},
	"kafka":        {"kafka"},
	"kotlin":       {"kotlin"},
	"kubernetes":   {"kubernetes", "k8s"},
	"mongodb":      {"mongodb", "mongo db"},
	"mysql":        {"mysql"},
	"nestjs":       {"nestjs", "nest js"},
	"next.js":      {"next js", "nextjs", "next.js"},
	"node.js":      {"node js", "nodejs", "node.js"},
	"php":          {"php"},
	"postgresql":   {"postgresql", "postgres", "postgres sql"},
	"python":       {"python"},
	"rabbitmq":     {"rabbitmq", "rabbit mq"},
	"react":        {"react", "reactjs", "react js"},
	"react-native": {"react native", "react-native"},
	"redis":        {"redis"},
	"ruby":         {"ruby"},
	"spring":       {"spring", "spring boot"},
	"swift":        {"swift"},
	"terraform":    {"terraform"},
	"typescript":   {"typescript", "ts"},
	"vue":          {"vue", "vue js", "vuejs"},
}
