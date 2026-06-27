import { fetchKeywords, saveKeywords } from "@/domains/jobs/infrastructure/jobsApi";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

interface KeywordsModalProps {
  onClose: () => void;
}

export function KeywordsModal({ onClose }: KeywordsModalProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadKeywords() {
      setIsLoading(true);
      try {
        const data = await fetchKeywords();
        setKeywords(data);
      } catch (error) {
        console.error("Failed to load keywords:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadKeywords();
  }, []);

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (toRemove: string) => {
    setKeywords(keywords.filter((k) => k !== toRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveKeywords(keywords);
      onClose();
    } catch (error) {
      console.error("Failed to save keywords:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Gerenciar filtros</CardTitle>
          <CardDescription>
            Adicione ou remova as palavras-chave usadas na busca e nos filtros de vagas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nova keyword ou filtro..."
              aria-label="Nova keyword ou filtro"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            />
            <Button onClick={handleAddKeyword} disabled={isLoading || isSaving}>
              Adicionar filtro
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-muted/20">
            {isLoading ? (
              <p className="text-sm text-muted-foreground italic">Carregando keywords...</p>
            ) : keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma keyword cadastrada.</p>
            ) : (
              keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="pl-3 pr-1 gap-1">
                  {kw}
                  <button
                    onClick={() => handleRemoveKeyword(kw)}
                    className="hover:bg-red-500/50 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading || isSaving}>
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
