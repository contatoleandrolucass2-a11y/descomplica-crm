import { LeadLoadingState, LeadPageShell } from "./_components/LeadWorkspace";

export default function LeadsLoading() {
  return (
    <LeadPageShell
      eyebrow="Operação comercial"
      title="Lead"
      description="Carregando contatos, atividades e funil."
    >
      <LeadLoadingState />
    </LeadPageShell>
  );
}
