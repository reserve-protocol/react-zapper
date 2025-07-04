import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Zapper } from "../src";
import React, { useState } from "react";
import { base } from "wagmi/chains";

const DTF_ADDRESS = "0x23418de10d422ad71c9d5713a2b8991a9c586443";

function App() {
  const [showInline, setShowInline] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          React Zapper Demo
        </h1>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Wallet Connection</h2>
          <ConnectButton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Modal Mode</h2>
            <p className="text-gray-600 mb-4">
              Click the button below to open the zapper in a modal.
            </p>
            <Zapper chain={base.id} dtfAddress={DTF_ADDRESS} mode="modal" />
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Open Zapper Modal
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Inline Mode</h2>
            <p className="text-gray-600 mb-4">
              Toggle to show the zapper inline.
            </p>
            <button
              onClick={() => setShowInline(!showInline)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors mb-4"
            >
              {showInline ? "Hide" : "Show"} Inline Zapper
            </button>
            {showInline && (
              <div className="border border-gray-200 rounded-lg p-4">
                <Zapper
                  chain={base.id}
                  dtfAddress={DTF_ADDRESS}
                  mode="inline"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-2 text-sm font-mono bg-gray-100 p-4 rounded">
            <p>
              Chain: {base.name} (ID: {base.id})
            </p>
            <p>DTF Address: {DTF_ADDRESS}</p>
            <p>DTF Symbol: hyRSI</p>
            <p>DTF Name: High Yield RSI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
