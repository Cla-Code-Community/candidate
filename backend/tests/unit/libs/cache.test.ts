import { createClient } from "redis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheAbsoluteSCard,
  cacheAbsoluteSMembers,
  cacheDel,
  cacheGet,
  cacheGetJobsByIds,
  cacheSearchKeywords,
  cacheSet,
  closeCache,
  getCache,
  invalidateUser,
} from "../../../src/lib/cache"; // Ajuste o caminho se necessário conforme sua estrutura

// Mock do logger para não sujar o console durante os testes
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock do pacote redis
vi.mock("redis", () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    sMembers: vi.fn(),
    sCard: vi.fn(),
    sUnion: vi.fn(),
    mGet: vi.fn(),
  };
  return {
    createClient: vi.fn(() => mockClient),
  };
});

describe("Valkey Cache Lib", () => {
  let mockClientInstance: any;

  beforeEach(() => {
    vi.stubEnv("VALKEY_URL", "redis://localhost:6379");
    mockClientInstance = createClient();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await closeCache();
  });

  describe("Gerenciamento de Conexão", () => {
    it("deve lançar erro se VALKEY_URL não estiver definida", async () => {
      vi.stubEnv("VALKEY_URL", "");
      await expect(getCache()).rejects.toThrow(
        "VALKEY_URL environment variable is not set",
      );
    });

    it("deve criar e conectar o cliente com sucesso", async () => {
      const client = await getCache();
      expect(createClient).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
      });
      expect(client.connect).toHaveBeenCalled();
    });
  });

  describe("Operações Básicas (GET, SET, DEL)", () => {
    it("deve buscar um valor parseado como JSON no cacheGet", async () => {
      mockClientInstance.get.mockResolvedValue(
        JSON.stringify({ id: 1, name: "Test" }),
      );

      const result = await cacheGet<{ id: number; name: string }>(
        "profile:123",
      );

      expect(mockClientInstance.get).toHaveBeenCalledWith("user:profile:123");
      expect(result).toEqual({ id: 1, name: "Test" });
    });

    it("deve retornar uma string pura se falhar no JSON.parse", async () => {
      mockClientInstance.get.mockResolvedValue("string_pura");
      const result = await cacheGet("profile:123");
      expect(result).toBe("string_pura");
    });

    it("deve salvar com TTL se fornecido", async () => {
      await cacheSet("profile:123", { role: "developer" }, 60);
      expect(mockClientInstance.set).toHaveBeenCalledWith(
        "user:profile:123",
        JSON.stringify({ role: "developer" }),
        { EX: 60 },
      );
    });

    it("deve salvar sem TTL se o valor for menor ou igual a 0", async () => {
      await cacheSet("profile:123", "dados", 0);
      expect(mockClientInstance.set).toHaveBeenCalledWith(
        "user:profile:123",
        "dados",
      );
    });

    it("deve deletar uma chave no cacheDel", async () => {
      await cacheDel("profile:123");
      expect(mockClientInstance.del).toHaveBeenCalledWith("user:profile:123");
    });
  });

  describe("Invalidação de Usuário", () => {
    it("deve limpar o perfil e as preferências simultaneamente", async () => {
      await invalidateUser("user_xyz");
      expect(mockClientInstance.del).toHaveBeenCalledWith(
        "user:profile:user_xyz",
      );
      expect(mockClientInstance.del).toHaveBeenCalledWith(
        "user:preferences:user_xyz",
      );
    });
  });

  describe("Operações Absolutas e Avançadas", () => {
    it("deve buscar membros de um Set sem injetar o namespace user:", async () => {
      mockClientInstance.sMembers.mockResolvedValue(["id_1", "id_2"]);
      const result = await cacheAbsoluteSMembers("scraper:jobs:custom_key");

      expect(mockClientInstance.sMembers).toHaveBeenCalledWith(
        "scraper:jobs:custom_key",
      );
      expect(result).toEqual(["id_1", "id_2"]);
    });

    it("deve contar membros de um Set sem injetar o namespace user:", async () => {
      mockClientInstance.sCard.mockResolvedValue(42);

      const result = await cacheAbsoluteSCard("scraper:jobs:index");

      expect(mockClientInstance.sCard).toHaveBeenCalledWith(
        "scraper:jobs:index",
      );
      expect(result).toBe(42);
    });
  });

  describe("cacheSearchKeywords", () => {
    it("deve retornar array vazio se nenhuma keyword for passada", async () => {
      const result = await cacheSearchKeywords([]);
      expect(result).toEqual([]);
    });

    it("deve normalizar e buscar direto com SMembers se houver apenas uma keyword válida", async () => {
      mockClientInstance.sMembers.mockResolvedValue(["job_1"]);

      const result = await cacheSearchKeywords(["  UX/UI Designer  "]);

      // "UX/UI Designer" -> "ux ui designer"
      expect(mockClientInstance.sMembers).toHaveBeenCalledWith(
        "scraper:jobs:keyword:ux ui designer",
      );
      expect(result).toEqual(["job_1"]);
    });

    it("deve aplicar SUNION se houver múltiplas keywords válidas", async () => {
      mockClientInstance.sUnion.mockResolvedValue(["job_1", "job_2"]);

      const result = await cacheSearchKeywords(["Go", "C#", "   "]); // O espaço em branco deve ser ignorado

      expect(mockClientInstance.sUnion).toHaveBeenCalledWith([
        "scraper:jobs:keyword:go",
        "scraper:jobs:keyword:c#",
      ]);
      expect(result).toEqual(["job_1", "job_2"]);
    });
  });

  describe("cacheGetJobsByIds", () => {
    it("deve retornar array vazio se nenhum ID for fornecido", async () => {
      const result = await cacheGetJobsByIds([]);
      expect(result).toEqual([]);
    });

    it("deve buscar múltiplos jobs via mGet e ignorar valores nulos ou corrompidos", async () => {
      mockClientInstance.mGet.mockResolvedValue([
        JSON.stringify({ title: "Go Dev" }),
        null,
        "invalid-json-data",
        JSON.stringify({ title: "Rust Dev" }),
      ]);

      const result = await cacheGetJobsByIds(["1", "2", "3", "4"]);

      expect(mockClientInstance.mGet).toHaveBeenCalledWith([
        "scraper:job:1",
        "scraper:job:2",
        "scraper:job:3",
        "scraper:job:4",
      ]);
      // Deve filtrar o nulo e o JSON quebrado mantendo apenas os válidos
      expect(result).toEqual([{ title: "Go Dev" }, { title: "Rust Dev" }]);
    });
  });
});
