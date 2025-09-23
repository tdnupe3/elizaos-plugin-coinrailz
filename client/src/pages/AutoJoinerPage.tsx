import { AutoJoinerDashboard } from '@/components/AutoJoinerDashboard';

export default function AutoJoinerPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">FREE Group Auto-Joiner</h1>
          <p className="text-gray-600">
            Automatically join hundreds of crypto Telegram groups - completely free alternative to $135 QQSHILL service!
          </p>
        </div>
        
        <AutoJoinerDashboard />
      </div>
    </div>
  );
}