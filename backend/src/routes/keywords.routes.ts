import { Router } from "express";
import { db } from "../db/client";
import { keywords } from "../db/schema";
import { ownedBy } from "../lib/authorization/ownership";
import { getCache } from "../lib/cache";
import { publish } from "../lib/kwsync";

export const keywordsRoutes = Router();

/**
 * @swagger
 * /api/keywords:
 *   get:
 *     summary: Retorna palavras-chave configuradas
 *     tags: [Keywords]
 *     responses:
 *       200:
 *         description: Lista de keywords
 */
keywordsRoutes.get("/", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  try {
    const rows = await db
      .select({ keyword: keywords.keyword, source: keywords.source })
      .from(keywords)
      .where(ownedBy(userId, keywords.userId))
      .orderBy(keywords.createdAt);

    return res.json({ ok: true, keywords: rows });
  } catch (error) {
    return res.status(500).json({
      message: "Erro ao buscar keywords.",
      error: (error as Error).message,
    });
  }
});

/**
 * @swagger
 * /api/keywords:
 *   post:
 *     summary: Enfileira uma keyword para o Go processar
 *     tags: [Keywords]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *     responses:
 *       202:
 *         description: Keyword enfileirada — o Go decide se persiste
 *       400:
 *         description: Dados inválidos
 */
keywordsRoutes.post("/", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  const raw = req.body?.keyword;
  const keyword = typeof raw === "string" ? raw.trim() : "";

  if (!keyword || typeof keyword !== "string") {
    return res.status(400).json({
      message: "O campo 'keyword' deve ser uma string não vazia.",
    });
  }

  await db
    .insert(keywords)
    .values({ keyword, source: "user", userId })
    .onConflictDoNothing({
      target: [keywords.userId, keywords.keyword],
    });

  const client = await getCache();
  await publish(client, keyword, "user", userId);

  return res.status(202).json({
    ok: true,
    message: "Keyword enfileirada para processamento.",
  });
});
