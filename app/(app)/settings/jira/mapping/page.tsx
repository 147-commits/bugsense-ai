import TopBar from '@/components/layout/TopBar';
import JiraMappingEditor from '@/components/settings/JiraMappingEditor';

export default function JiraMappingPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Jira mapping" subtitle="Configure how BugSense fields map to your Jira workflow" />
      <div className="p-6 max-w-3xl mx-auto">
        <JiraMappingEditor />
      </div>
    </div>
  );
}
