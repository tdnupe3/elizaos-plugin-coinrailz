import { OutreachDashboard } from '@/components/OutreachDashboard';

export default function OutreachPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Telegram Outreach</h1>
          <p className="text-gray-600">
            Promote @FeedAlphaBot to crypto Telegram communities for free
          </p>
        </div>
        
        <OutreachDashboard />
      </div>
    </div>
  );
}