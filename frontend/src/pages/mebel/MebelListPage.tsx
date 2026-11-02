import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMebelProject, deleteMebelProject, getMebelProject, listMebelProjects, type MebelProjectSummary } from "@/lib/api";
import { newProject } from "@/features/mebel/engine";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ProjectCard } from "@/features/mebel/ui/ProjectCard";

const MAX_NAME = 120;

/**
 * A copy's name: "<name> (nusxa)", never "(nusxa) (nusxa)" — a copy of a copy keeps one suffix —
 * numbered when taken ("… (nusxa) 2"), and cut short to fit the 120-character limit.
 */
export function copyName(name: string, suffixed: (base: string) => string, taken: Set<string>): string {
  const tail = suffixed("");
  const strip = (n: string) => n.replace(/ \d+$/, "").replace(tail, "");
  let base = name;
  while (base.endsWith(tail) || (/ \d+$/.test(base) && strip(base) !== base && base.replace(/ \d+$/, "").endsWith(tail))) {
    base = strip(base).trimEnd();
  }
  for (let i = 1; ; i++) {
    const number = i === 1 ? "" : ` ${i}`;
    const room = MAX_NAME - tail.length - number.length;
    const candidate = `${suffixed(base.slice(0, room).trimEnd())}${number}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** /mebel: a furniture workshop's cabinet projects. */
export default function MebelListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: projects, isLoading, isError, refetch } = useQuery({
    queryKey: ["mebel", "projects"],
    queryFn: listMebelProjects,
  });

  const create = useMutation({
    mutationFn: () => {
      // "Oshxona", then "Oshxona 2", "Oshxona 3": never two projects with one name
      const base = t("mebel.default_name");
      const taken = new Set((projects ?? []).map((p) => p.name));
      let name = base;
      for (let i = 2; taken.has(name); i++) name = `${base} ${i}`;
      return createMebelProject(name, newProject(name));
    },
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ["mebel", "projects"] });
      navigate(`/mebel/${p.id}`);
    },
  });

  const [copyFailed, setCopyFailed] = useState(false);
  // One copy at a time: a quick second choice from the menu would make two (isPending lands a tick late).
  const copying = useRef(false);
  const copy = useMutation({
    mutationFn: async (p: MebelProjectSummary) => {
      const source = await getMebelProject(p.id);
      const name = copyName(p.name, (base) => t("mebel.list.copy_name", { name: base }), new Set((projects ?? []).map((x) => x.name)));
      return createMebelProject(name, { ...source.data, name });
    },
    onMutate: () => setCopyFailed(false),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ["mebel", "projects"] });
      navigate(`/mebel/${p.id}`);
    },
    onError: () => setCopyFailed(true),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMebelProject(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["mebel", "projects"] }),
  });

  async function onDelete(id: string, name: string) {
    if (!(await confirm({ title: t("mebel.delete_confirm", { name }), destructive: true, confirmLabel: t("mebel.delete") }))) return;
    remove.mutate(id);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("mebel.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("mebel.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/mebel/qoldiqlar" className="rounded-full bg-card-soft px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line hover:bg-card">
            {t("mebel.offcuts.title")}
          </Link>
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            {t("mebel.new_project")}
          </Button>
        </div>
      </div>

      {copyFailed && <p role="alert" className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">{t("mebel.list.copy_failed")}</p>}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-card-soft" />
      ) : isError ? (
        <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-500">
          <p>{t("mebel.load_failed")}</p>
          <button type="button" className="mt-2 font-semibold underline" onClick={() => void refetch()}>
            {t("mebel.retry")}
          </button>
        </div>
      ) : !projects?.length ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-ink-muted">{t("mebel.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onCopy={(x) => {
              if (copying.current) return;
              copying.current = true;
              copy.mutate(x, { onSettled: () => { copying.current = false; } });
            }} onDelete={(x) => void onDelete(x.id, x.name)} />
          ))}
        </ul>
      )}
    </div>
  );
}
