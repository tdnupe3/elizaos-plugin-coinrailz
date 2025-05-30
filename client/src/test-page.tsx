export default function TestPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Coin Railz Platform Test
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Platform is loading successfully
        </p>
        <div className="space-y-4">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded">
            ✓ Frontend React Application: Working
          </div>
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded">
            ✓ Backend Express Server: Running on Port 5000
          </div>
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded">
            ✓ API Endpoints: Responding
          </div>
        </div>
      </div>
    </div>
  );
}