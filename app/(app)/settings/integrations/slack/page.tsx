import TopBar from '@/components/layout/TopBar';
import SlackDetail from '@/components/settings/SlackDetail';

export default function SlackIntegrationPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Slack" subtitle="Notifications for critical bugs, readiness flips, and daily digests" />
      <div className="p-6 max-w-3xl mx-auto">
        <SlackDetail />
      </div>
    </div>
  );
}
