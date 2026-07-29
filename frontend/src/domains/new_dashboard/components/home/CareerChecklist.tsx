import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CareerChecklist as CareerChecklistList } from "../../types";

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type ChecklistList = {
  id: string;
  title: string;
  month: string;
  items: ChecklistItem[];
};

const STORAGE_KEY = "new-dashboard-career-checklists";

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

function loadLists(): ChecklistList[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface CareerChecklistProps {
  lists?: CareerChecklistList[];
  onChange?: (lists: CareerChecklistList[]) => void;
}

export function CareerChecklist({
  lists: controlledLists,
  onChange,
}: CareerChecklistProps = {}) {
  const [localLists, setLocalLists] = useState<ChecklistList[]>(() =>
    loadLists(),
  );
  const lists = controlledLists ?? localLists;
  const [selectedListId, setSelectedListId] = useState<string | null>(
    () => lists[0]?.id ?? null,
  );
  const [newListTitle, setNewListTitle] = useState("");
  const [newListMonth, setNewListMonth] = useState(currentMonth);
  const [newItemLabel, setNewItemLabel] = useState("");

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) ?? lists[0],
    [lists, selectedListId],
  );

  useEffect(() => {
    if (!controlledLists) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localLists));
    }
  }, [controlledLists, localLists]);

  function updateLists(updater: (current: ChecklistList[]) => ChecklistList[]) {
    const next = updater(lists);
    if (controlledLists) {
      onChange?.(next);
    } else {
      setLocalLists(next);
    }
  }

  const completedItems =
    selectedList?.items.filter((item) => item.checked).length ?? 0;
  const totalItems = selectedList?.items.length ?? 0;

  function addList() {
    const month = newListMonth || currentMonth();
    const title = newListTitle.trim() || `Checklist de ${formatMonth(month)}`;
    const list = {
      id: createId(),
      title,
      month,
      items: [],
    };

    updateLists((current) => [list, ...current]);
    setSelectedListId(list.id);
    setNewListTitle("");
    setNewListMonth(currentMonth());
  }

  function deleteSelectedList() {
    if (!selectedList) return;

    updateLists((current) =>
      current.filter((list) => list.id !== selectedList.id),
    );
    setSelectedListId(null);
  }

  function addItem() {
    const label = newItemLabel.trim();
    if (!selectedList || !label) return;

    updateLists((current) =>
      current.map((list) =>
        list.id === selectedList.id
          ? {
              ...list,
              items: [
                ...list.items,
                { id: createId(), label, checked: false },
              ],
            }
          : list,
      ),
    );
    setNewItemLabel("");
  }

  function toggleItem(itemId: string) {
    if (!selectedList) return;

    updateLists((current) =>
      current.map((list) =>
        list.id === selectedList.id
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId
                  ? { ...item, checked: !item.checked }
                  : item,
              ),
            }
          : list,
      ),
    );
  }

  function deleteItem(itemId: string) {
    if (!selectedList) return;

    updateLists((current) =>
      current.map((list) =>
        list.id === selectedList.id
          ? {
              ...list,
              items: list.items.filter((item) => item.id !== itemId),
            }
          : list,
      ),
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[18px] font-bold text-foreground">
            Checklist de Carreira
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize listas mensais de acompanhamento.
          </p>
        </div>

        {selectedList ? (
          <button
            type="button"
            onClick={deleteSelectedList}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-500/30 px-3 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Excluir lista
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto]">
        <input
          value={newListTitle}
          onChange={(event) => setNewListTitle(event.target.value)}
          placeholder="Nome da nova lista"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
        />
        <input
          type="month"
          value={newListMonth}
          onChange={(event) => setNewListMonth(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
        />
        <button
          type="button"
          onClick={addList}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Lista
        </button>
      </div>

      {lists.length > 0 ? (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setSelectedListId(list.id)}
              className={`shrink-0 rounded-md border px-3 py-2 text-left text-xs font-bold transition-colors ${
                list.id === selectedList?.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="block">{list.title}</span>
              <span className="block font-semibold opacity-75">
                {formatMonth(list.month)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedList ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">
                {selectedList.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMonth(selectedList.month)} · {completedItems}/{totalItems} itens
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newItemLabel}
              onChange={(event) => setNewItemLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addItem();
              }}
              placeholder="Novo item do checklist"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={addItem}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Item
            </button>
          </div>

          {selectedList.items.length > 0 ? (
            <ul className="mt-4 divide-y divide-border">
              {selectedList.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleItem(item.id)}
                    className="h-5 w-5 rounded border-border accent-emerald-600"
                  />
                  <span
                    className={`min-w-0 flex-1 ${
                      item.checked
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    aria-label="Excluir item"
                    title="Excluir item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
              Nenhum item nesta lista.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed border-border bg-background p-4">
          <ListChecks className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <p className="text-sm leading-6 text-muted-foreground">
            Crie uma lista mensal para começar seu acompanhamento de carreira.
          </p>
        </div>
      )}
    </section>
  );
}
