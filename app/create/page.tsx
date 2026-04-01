import { CreateSessionForm } from "@/components/CreateSessionForm";
import { ProjectFooter } from "@/components/ProjectFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getAnalysisRuntimeStatus } from "@/lib/analysis-runtime";

export default function CreateSessionPage() {
  const analysisStatus = getAnalysisRuntimeStatus();

  return (
    <main className="page-shell">
      <SiteHeader current="create" />

      <section className="page-intro create-page-intro">
        <h2 className="create-page-title">Add one scroll session</h2>
        <p className="lede">Ready to see what "side" of the internet you were on today?</p>
      </section>

      <section className="create-page-shell">
        <div className="create-page-tools">
          <span className="status-badge">
            Reflection engine: {analysisStatus.openaiEnabled ? "AI-enhanced" : "local mode"}
          </span>
        </div>

        <div className="create-form-wrap">
          <CreateSessionForm />
        </div>
      </section>

      <ProjectFooter />
    </main>
  );
}
